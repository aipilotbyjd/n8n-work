import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, FindManyOptions } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ConfigService } from "@nestjs/config";
import {
  AIAgent,
  AIAgentStatus,
  AIAgentType,
} from "./entities/ai-agent.entity";
import {
  AIAgentExecution,
  AIExecutionStatus,
} from "./entities/ai-agent-execution.entity";
import { CreateAIAgentDto } from "./dto/create-ai-agent.dto";
import { UpdateAIAgentDto } from "./dto/update-ai-agent.dto";
import { ExecuteAIAgentDto } from "./dto/execute-ai-agent.dto";
import { AIAgentFilterDto } from "./dto/ai-agent-filter.dto";
import { AIGatewayService } from "./services/ai-gateway.service";
import { ModelManagerService } from "./services/model-manager.service";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class AIAgentsService {
  private readonly logger = new Logger(AIAgentsService.name);

  constructor(
    @InjectRepository(AIAgent)
    private readonly aiAgentRepository: Repository<AIAgent>,
    @InjectRepository(AIAgentExecution)
    private readonly executionRepository: Repository<AIAgentExecution>,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly aiGateway: AIGatewayService,
    private readonly modelManager: ModelManagerService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    createAIAgentDto: CreateAIAgentDto,
    tenantId: string,
    userId: string,
  ): Promise<AIAgent> {
    this.logger.log(
      `Creating AI agent: ${createAIAgentDto.name} for tenant: ${tenantId}`,
    );

    // Validate model configuration
    await this.validateModelConfig(createAIAgentDto.modelConfig);

    // Validate resource requirements
    this.validateResourceRequirements(createAIAgentDto.resourceRequirements);

    const agent = this.aiAgentRepository.create({
      ...createAIAgentDto,
      tenantId,
      createdById: userId,
      status: AIAgentStatus.INACTIVE,
    });

    const savedAgent = await this.aiAgentRepository.save(agent);

    // Initialize the agent (load model, check health, etc.)
    try {
      await this.initializeAgent(savedAgent);
    } catch (error) {
      this.logger.error(`Failed to initialize agent ${savedAgent.id}:`, error);
      savedAgent.status = AIAgentStatus.ERROR;
      await this.aiAgentRepository.save(savedAgent);
    }

    await this.auditService.log({
      action: "ai_agent.created",
      tenantId,
      userId,
      resourceId: savedAgent.id,
      details: { name: savedAgent.name, type: savedAgent.type },
    });

    this.eventEmitter.emit("ai_agent.created", {
      agent: savedAgent,
      tenantId,
      userId,
    });

    return savedAgent;
  }

  async findAll(
    tenantId: string,
    filters?: AIAgentFilterDto,
  ): Promise<AIAgent[]> {
    const options: FindManyOptions<AIAgent> = {
      where: { tenantId },
      relations: ["createdBy", "updatedBy"],
      order: { createdAt: "DESC" },
    };

    if (filters) {
      if (filters.type) {
        options.where = { ...options.where, type: filters.type };
      }
      if (filters.status) {
        options.where = { ...options.where, status: filters.status };
      }
      if (filters.isEnabled !== undefined) {
        options.where = { ...options.where, isEnabled: filters.isEnabled };
      }
      if (filters.tags?.length) {
        // Note: This is a simplified example. In production, you'd use proper array contains query
        options.where = { ...options.where };
      }
      if (filters.limit) {
        options.take = filters.limit;
      }
      if (filters.offset) {
        options.skip = filters.offset;
      }
    }

    return this.aiAgentRepository.find(options);
  }

  async findOne(
    id: string,
    tenantId: string,
    includeExecutions = false,
  ): Promise<AIAgent> {
    const relations = ["createdBy", "updatedBy"];
    if (includeExecutions) {
      relations.push("executions");
    }

    const agent = await this.aiAgentRepository.findOne({
      where: { id, tenantId },
      relations,
    });

    if (!agent) {
      throw new NotFoundException(`AI agent with ID ${id} not found`);
    }

    return agent;
  }

  async update(
    id: string,
    updateAIAgentDto: UpdateAIAgentDto,
    tenantId: string,
    userId: string,
  ): Promise<AIAgent> {
    const agent = await this.findOne(id, tenantId);

    // If model config is being updated, validate it
    if (updateAIAgentDto.modelConfig) {
      await this.validateModelConfig(updateAIAgentDto.modelConfig);
    }

    // If resource requirements are being updated, validate them
    if (updateAIAgentDto.resourceRequirements) {
      this.validateResourceRequirements(updateAIAgentDto.resourceRequirements);
    }

    Object.assign(agent, updateAIAgentDto, {
      updatedById: userId,
    });

    const savedAgent = await this.aiAgentRepository.save(agent);

    // If the model config changed, reinitialize the agent
    if (updateAIAgentDto.modelConfig) {
      try {
        await this.reinitializeAgent(savedAgent);
      } catch (error) {
        this.logger.error(
          `Failed to reinitialize agent ${savedAgent.id}:`,
          error,
        );
        savedAgent.status = AIAgentStatus.ERROR;
        await this.aiAgentRepository.save(savedAgent);
      }
    }

    await this.auditService.log({
      action: "ai_agent.updated",
      tenantId,
      userId,
      resourceId: savedAgent.id,
      details: updateAIAgentDto,
    });

    this.eventEmitter.emit("ai_agent.updated", {
      agent: savedAgent,
      changes: updateAIAgentDto,
      tenantId,
      userId,
    });

    return savedAgent;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const agent = await this.findOne(id, tenantId);

    // Check if agent is currently being used
    const activeExecutions = await this.executionRepository.count({
      where: {
        agentId: id,
        status: AIExecutionStatus.RUNNING,
      },
    });

    if (activeExecutions > 0) {
      throw new BadRequestException(
        "Cannot delete agent with active executions",
      );
    }

    await this.modelManager.unloadModel(agent);
    await this.aiAgentRepository.remove(agent);

    await this.auditService.log({
      action: "ai_agent.deleted",
      tenantId,
      userId,
      resourceId: id,
      details: { name: agent.name, type: agent.type },
    });

    this.eventEmitter.emit("ai_agent.deleted", {
      agentId: id,
      tenantId,
      userId,
    });
  }

  async execute(
    id: string,
    executeDto: ExecuteAIAgentDto,
    tenantId: string,
    executionId?: string,
  ): Promise<AIAgentExecution> {
    const agent = await this.findOne(id, tenantId);

    if (!agent.canExecute()) {
      throw new BadRequestException(
        `AI agent ${id} is not available for execution`,
      );
    }

    // Create execution record
    const execution = this.executionRepository.create({
      agentId: id,
      tenantId,
      executionId,
      input: executeDto.input,
      config: executeDto.config,
      context: executeDto.context,
      timeoutSeconds:
        executeDto.timeoutSeconds ||
        agent.resourceRequirements.maxConcurrency ||
        300,
      maxRetries: executeDto.maxRetries || 3,
      priority: executeDto.priority || 5,
    });

    const savedExecution = await this.executionRepository.save(execution);

    // Execute asynchronously
    this.executeAgentAsync(agent, savedExecution).catch((error) => {
      this.logger.error(`Async execution failed for agent ${id}:`, error);
    });

    return savedExecution;
  }

  async getExecution(
    executionId: string,
    tenantId: string,
  ): Promise<AIAgentExecution> {
    const execution = await this.executionRepository.findOne({
      where: { id: executionId, tenantId },
      relations: ["agent"],
    });

    if (!execution) {
      throw new NotFoundException(
        `AI execution with ID ${executionId} not found`,
      );
    }

    return execution;
  }

  async getExecutionsByAgent(
    agentId: string,
    tenantId: string,
    limit = 50,
    offset = 0,
  ): Promise<AIAgentExecution[]> {
    return this.executionRepository.find({
      where: { agentId, tenantId },
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset,
    });
  }

  async cancelExecution(
    executionId: string,
    tenantId: string,
  ): Promise<AIAgentExecution> {
    const execution = await this.getExecution(executionId, tenantId);

    if (
      execution.status !== AIExecutionStatus.RUNNING &&
      execution.status !== AIExecutionStatus.PENDING
    ) {
      throw new BadRequestException(
        "Cannot cancel execution that is not running or pending",
      );
    }

    execution.markAsCancelled();
    const savedExecution = await this.executionRepository.save(execution);

    // Notify AI Gateway to cancel the execution
    await this.aiGateway.cancelExecution(executionId);

    this.eventEmitter.emit("ai_execution.cancelled", {
      execution: savedExecution,
      tenantId,
    });

    return savedExecution;
  }

  async retryExecution(
    executionId: string,
    tenantId: string,
  ): Promise<AIAgentExecution> {
    const execution = await this.getExecution(executionId, tenantId);

    if (!execution.canRetry()) {
      throw new BadRequestException("Execution cannot be retried");
    }

    execution.retryCount++;
    execution.status = AIExecutionStatus.PENDING;
    execution.error = null;
    execution.startedAt = null;
    execution.completedAt = null;

    const savedExecution = await this.executionRepository.save(execution);

    // Execute asynchronously
    this.executeAgentAsync(execution.agent, savedExecution).catch((error) => {
      this.logger.error(
        `Retry execution failed for execution ${executionId}:`,
        error,
      );
    });

    return savedExecution;
  }

  async getAgentStats(agentId: string, tenantId: string, days = 30) {
    const agent = await this.findOne(agentId, tenantId);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const executions = await this.executionRepository
      .createQueryBuilder("execution")
      .where("execution.agentId = :agentId", { agentId })
      .andWhere("execution.tenantId = :tenantId", { tenantId })
      .andWhere("execution.createdAt >= :since", { since })
      .getMany();

    const totalExecutions = executions.length;
    const successfulExecutions = executions.filter(
      (e) => e.status === AIExecutionStatus.COMPLETED,
    ).length;
    const failedExecutions = executions.filter(
      (e) => e.status === AIExecutionStatus.FAILED,
    ).length;

    const avgExecutionTime =
      executions
        .filter((e) => e.getDuration() !== null)
        .reduce((sum, e) => sum + e.getDuration(), 0) / totalExecutions || 0;

    const totalTokens = executions
      .filter((e) => e.metrics?.totalTokens)
      .reduce((sum, e) => sum + e.metrics.totalTokens, 0);

    const totalCost = executions
      .filter((e) => e.metrics?.cost)
      .reduce((sum, e) => sum + e.metrics.cost, 0);

    return {
      agent: {
        id: agent.id,
        name: agent.name,
        type: agent.type,
        status: agent.status,
      },
      period: { days, since },
      executions: {
        total: totalExecutions,
        successful: successfulExecutions,
        failed: failedExecutions,
        successRate:
          totalExecutions > 0 ? successfulExecutions / totalExecutions : 0,
      },
      performance: {
        avgExecutionTime: Math.round(avgExecutionTime),
        totalTokens,
        totalCost: Math.round(totalCost * 100) / 100,
      },
      usage: agent.usage,
    };
  }

  private async validateModelConfig(modelConfig: any): Promise<void> {
    if (!modelConfig.provider || !modelConfig.model) {
      throw new BadRequestException(
        "Model provider and model name are required",
      );
    }

    // Validate provider-specific configuration
    const isValid = await this.modelManager.validateConfig(modelConfig);
    if (!isValid) {
      throw new BadRequestException("Invalid model configuration");
    }
  }

  private validateResourceRequirements(requirements: any): void {
    if (!requirements.memory) {
      throw new BadRequestException("Memory requirement is mandatory");
    }

    // Validate memory format (e.g., "2Gi", "512Mi")
    const memoryPattern = /^\d+[KMGT]?i?$/;
    if (!memoryPattern.test(requirements.memory)) {
      throw new BadRequestException("Invalid memory format");
    }
  }

  private async initializeAgent(agent: AIAgent): Promise<void> {
    this.logger.log(`Initializing agent ${agent.id}`);

    agent.status = AIAgentStatus.LOADING;
    await this.aiAgentRepository.save(agent);

    try {
      await this.modelManager.loadModel(agent);

      // Perform health check
      const isHealthy = await this.performHealthCheck(agent);
      agent.status = isHealthy ? AIAgentStatus.ACTIVE : AIAgentStatus.ERROR;
    } catch (error) {
      this.logger.error(`Failed to initialize agent ${agent.id}:`, error);
      agent.status = AIAgentStatus.ERROR;
    }

    await this.aiAgentRepository.save(agent);
  }

  private async reinitializeAgent(agent: AIAgent): Promise<void> {
    await this.modelManager.unloadModel(agent);
    await this.initializeAgent(agent);
  }

  private async performHealthCheck(agent: AIAgent): Promise<boolean> {
    try {
      if (agent.healthCheck?.enabled) {
        return await this.aiGateway.healthCheck(agent);
      }
      return true;
    } catch (error) {
      this.logger.error(`Health check failed for agent ${agent.id}:`, error);
      return false;
    }
  }

  private async executeAgentAsync(
    agent: AIAgent,
    execution: AIAgentExecution,
  ): Promise<void> {
    try {
      execution.markAsStarted();
      await this.executionRepository.save(execution);

      this.eventEmitter.emit("ai_execution.started", {
        execution,
        agent,
      });

      const result = await this.aiGateway.execute(agent, execution);

      execution.markAsCompleted(result.output, result.metrics);
      await this.executionRepository.save(execution);

      // Update agent usage statistics
      agent.incrementUsage(
        result.metrics?.totalTokens,
        execution.getDuration(),
      );
      await this.aiAgentRepository.save(agent);

      this.eventEmitter.emit("ai_execution.completed", {
        execution,
        agent,
        result,
      });
    } catch (error) {
      this.logger.error(`Execution failed for agent ${agent.id}:`, error);

      execution.markAsFailed({
        code: "EXECUTION_ERROR",
        message: error.message,
        details: error,
        timestamp: new Date(),
      });
      await this.executionRepository.save(execution);

      this.eventEmitter.emit("ai_execution.failed", {
        execution,
        agent,
        error,
      });
    }
  }

  async train(
    tenantId: string,
    agentId: string,
    trainingData: any,
    userId: string,
  ): Promise<any> {
    // TODO: implement training logic
    return;
  }

  async getCapabilities(tenantId: string, agentId: string): Promise<any> {
    // TODO: implement getCapabilities logic
    return;
  }

  async getAnalytics(
    tenantId: string,
    startDate: string,
    endDate: string,
  ): Promise<any> {
    // TODO: implement getAnalytics logic
    return;
  }
}
