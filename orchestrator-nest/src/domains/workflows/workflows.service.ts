import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, FindOptionsWhere } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';

import { Workflow, WorkflowStatus } from './entities/workflow.entity';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { ListWorkflowsDto } from './dto/list-workflows.dto';
import { WorkflowValidationService } from './workflow-validation.service';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { TenantService } from '../tenants/tenants.service';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { WorkflowCompilerService } from './workflow-compiler.service';
import { MetricsService } from '../../observability/metrics.service';
import { AuditLogService } from '../audit/audit-log.service';

@Injectable()
export class WorkflowsService {
  private readonly logger = new Logger(WorkflowsService.name);

  constructor(
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly eventEmitter: EventEmitter2,
    private readonly workflowValidationService: WorkflowValidationService,
    private readonly workflowCompilerService: WorkflowCompilerService,
    private readonly tenantService: TenantService,
    private readonly metricsService: MetricsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(
    createWorkflowDto: CreateWorkflowDto,
    user: AuthUser,
  ): Promise<Workflow> {
    this.logger.debug(
      `Creating workflow ${createWorkflowDto.name} for tenant ${user.tenantId}`,
    );

    // Validate tenant exists and user has access
    await this.tenantService.validateTenantAccess(user.tenantId, user.userId);

    // Check for duplicate workflow names within tenant
    const existingWorkflow = await this.workflowRepository.findOne({
      where: {
        name: createWorkflowDto.name,
        tenantId: user.tenantId,
      },
    });

    if (existingWorkflow) {
      throw new ConflictException(
        `Workflow with name '${createWorkflowDto.name}' already exists in this tenant`,
      );
    }

    // Validate workflow definition
    const validationResult = await this.workflowValidationService.validateWorkflow({
      nodes: createWorkflowDto.nodes,
      connections: createWorkflowDto.connections,
    });

    if (!validationResult.valid) {
      throw new BadRequestException({
        message: 'Workflow validation failed',
        errors: validationResult.errors,
      });
    }

    // Create workflow entity
    const workflow = this.workflowRepository.create({
      ...createWorkflowDto,
      tenantId: user.tenantId,
      createdBy: user.userId,
      status: WorkflowStatus.DRAFT,
    });

    // Save workflow
    const savedWorkflow = await this.workflowRepository.save(workflow);

    // Clear cache
    await this.clearWorkflowCache(user.tenantId);

    // Emit workflow created event
    this.eventEmitter.emit('workflow.created', {
      workflow: savedWorkflow,
      user,
    });

    // Record audit log
    await this.auditLogService.logWorkflowCreated(
      savedWorkflow.id,
      savedWorkflow.name,
      user.id,
      savedWorkflow.nodes.length,
    );

    // Update metrics
    this.metricsService.incrementCounter('workflows_created_total', {
      tenant_id: user.tenantId,
    });

    this.logger.log(
      `Created workflow ${savedWorkflow.id} (${savedWorkflow.name}) for tenant ${user.tenantId}`,
    );

    return savedWorkflow;
  }

  async findAll(
    listWorkflowsDto: ListWorkflowsDto,
    user: AuthUser,
  ): Promise<PaginatedResult<Workflow>> {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = listWorkflowsDto;

    // Check cache first
    const cacheKey = `workflows:${user.tenantId}:${JSON.stringify(listWorkflowsDto)}`;
    const cached = await this.cacheManager.get<PaginatedResult<Workflow>>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for workflows list: ${cacheKey}`);
      return cached;
    }

    const where: FindOptionsWhere<Workflow> = {
      tenantId: user.tenantId,
    };

    if (status) {
      where.status = status;
    }

    const options: FindManyOptions<Workflow> = {
      where,
      take: limit,
      skip: (page - 1) * limit,
      order: {
        [sortBy]: sortOrder,
      },
      relations: ['creator'],
    };

    // Add search functionality
    if (search) {
      const searchTerm = `%${search}%`;
      options.where = [
        { ...where, name: searchTerm } as any,
        { ...where, description: searchTerm } as any,
      ];
    }

    const [workflows, total] = await this.workflowRepository.findAndCount(options);

    const result: PaginatedResult<Workflow> = {
      items: workflows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
      hasPrevious: page > 1,
    };

    // Cache the result for 5 minutes
    await this.cacheManager.set(cacheKey, result, 300);

    this.logger.debug(
      `Retrieved ${workflows.length} workflows for tenant ${user.tenantId}`,
    );

    return result;
  }

  async findOne(id: string, user: AuthUser): Promise<Workflow> {
    // Check cache first
    const cacheKey = `workflow:${id}:${user.tenantId}`;
    const cached = await this.cacheManager.get<Workflow>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for workflow: ${cacheKey}`);
      return cached;
    }

    const workflow = await this.workflowRepository.findOne({
      where: {
        id,
        tenantId: user.tenantId,
      },
      relations: ['creator', 'updater'],
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    // Cache the result for 10 minutes
    await this.cacheManager.set(cacheKey, workflow, 600);

    this.logger.debug(`Retrieved workflow ${id} for tenant ${user.tenantId}`);

    return workflow;
  }

  async update(
    id: string,
    updateWorkflowDto: UpdateWorkflowDto,
    user: AuthUser,
  ): Promise<Workflow> {
    this.logger.debug(`Updating workflow ${id} for tenant ${user.tenantId}`);

    const workflow = await this.findOne(id, user);

    // Check if user has permission to update
    if (workflow.createdBy !== user.userId && !user.permissions.includes('workflow:update')) {
      throw new ForbiddenException('Insufficient permissions to update this workflow');
    }

    // If workflow is active, validate that changes are safe
    if (workflow.status === WorkflowStatus.ACTIVE) {
      const hasBreakingChanges = await this.workflowValidationService.hasBreakingChanges(
        workflow,
        updateWorkflowDto,
      );

      if (hasBreakingChanges) {
        throw new BadRequestException(
          'Cannot make breaking changes to an active workflow. Please create a new version or deactivate first.',
        );
      }
    }

    // Validate updated workflow if nodes or connections changed
    if (updateWorkflowDto.nodes || updateWorkflowDto.connections) {
      const validationResult = await this.workflowValidationService.validateWorkflow({
        nodes: updateWorkflowDto.nodes || workflow.nodes,
        connections: updateWorkflowDto.connections || workflow.connections,
      });

      if (!validationResult.valid) {
        throw new BadRequestException({
          message: 'Updated workflow validation failed',
          errors: validationResult.errors,
        });
      }
    }

    // Update workflow
    Object.assign(workflow, updateWorkflowDto, {
      updatedBy: user.userId,
    });

    const updatedWorkflow = await this.workflowRepository.save(workflow);

    // Clear cache
    await this.clearWorkflowCache(user.tenantId, id);

    // Emit workflow updated event
    this.eventEmitter.emit('workflow.updated', {
      workflow: updatedWorkflow,
      previousVersion: workflow,
      user,
    });

    // Record audit log
    await this.auditLogService.logWorkflowEvent({
      workflowId: id,
      workflowName: updatedWorkflow.name,
      action: 'update',
      userId: user.userId,
      tenantId: user.tenantId,
      newValues: updateWorkflowDto,
      metadata: {
        changes: updateWorkflowDto,
      },
    });

    // Update metrics
    this.metricsService.incrementCounter('workflows_updated_total', {
      tenant_id: user.tenantId,
    });

    this.logger.log(`Updated workflow ${id} for tenant ${user.tenantId}`);

    return updatedWorkflow;
  }

  async remove(id: string, user: AuthUser): Promise<void> {
    this.logger.debug(`Removing workflow ${id} for tenant ${user.tenantId}`);

    const workflow = await this.findOne(id, user);

    // Check if user has permission to delete
    if (workflow.createdBy !== user.userId && !user.permissions.includes('workflow:delete')) {
      throw new ForbiddenException('Insufficient permissions to delete this workflow');
    }

    // Prevent deletion of active workflows
    if (workflow.status === WorkflowStatus.ACTIVE) {
      throw new BadRequestException(
        'Cannot delete an active workflow. Please deactivate it first.',
      );
    }

    // Check if workflow has recent executions
    const hasRecentExecutions = await this.hasRecentExecutions(id);
    if (hasRecentExecutions) {
      throw new BadRequestException(
        'Cannot delete a workflow with executions in the last 30 days. Please archive instead.',
      );
    }

    await this.workflowRepository.remove(workflow);

    // Clear cache
    await this.clearWorkflowCache(user.tenantId, id);

    // Emit workflow deleted event
    this.eventEmitter.emit('workflow.deleted', {
      workflow,
      user,
    });

    // Record audit log
    await this.auditLogService.logWorkflowEvent({
      workflowId: id,
      workflowName: workflow.name,
      action: 'delete',
      userId: user.userId,
      tenantId: user.tenantId,
      metadata: {},
    });

    // Update metrics
    this.metricsService.incrementCounter('workflows_deleted_total', {
      tenant_id: user.tenantId,
    });

    this.logger.log(`Deleted workflow ${id} for tenant ${user.tenantId}`);
  }

  async activate(id: string, user: AuthUser): Promise<Workflow> {
    this.logger.debug(`Activating workflow ${id} for tenant ${user.tenantId}`);

    const workflow = await this.findOne(id, user);

    if (workflow.status === WorkflowStatus.ACTIVE) {
      throw new BadRequestException('Workflow is already active');
    }

    // Validate workflow before activation
    const validationResult = await this.workflowValidationService.validateWorkflow({
      nodes: workflow.nodes,
      connections: workflow.connections,
    });

    if (!validationResult.valid) {
      throw new BadRequestException({
        message: 'Cannot activate workflow with validation errors',
        errors: validationResult.errors,
      });
    }

    // Compile workflow for execution
    const compilationResult = await this.workflowCompilerService.compile(workflow);

    // Update status
    workflow.status = WorkflowStatus.ACTIVE;
    workflow.updatedBy = user.userId;

    const activatedWorkflow = await this.workflowRepository.save(workflow);

    // Clear cache
    await this.clearWorkflowCache(user.tenantId, id);

    // Emit workflow activated event
    this.eventEmitter.emit('workflow.activated', {
      workflow: activatedWorkflow,
      user,
    });

    // Record audit log
    await this.auditLogService.logWorkflowEvent({
      workflowId: id,
      workflowName: workflow.name,
      action: 'activate',
      userId: user.userId,
      tenantId: user.tenantId,
      metadata: {},
    });

    // Update metrics
    this.metricsService.incrementCounter('workflows_activated_total', {
      tenant_id: user.tenantId,
    });

    this.logger.log(`Activated workflow ${id} for tenant ${user.tenantId}`);

    return activatedWorkflow;
  }

  async deactivate(id: string, user: AuthUser): Promise<Workflow> {
    this.logger.debug(`Deactivating workflow ${id} for tenant ${user.tenantId}`);

    const workflow = await this.findOne(id, user);

    if (workflow.status !== WorkflowStatus.ACTIVE) {
      throw new BadRequestException('Workflow is not currently active');
    }

    // Update status
    workflow.status = WorkflowStatus.INACTIVE;
    workflow.updatedBy = user.userId;

    const deactivatedWorkflow = await this.workflowRepository.save(workflow);

    // Clear cache
    await this.clearWorkflowCache(user.tenantId, id);

    // Emit workflow deactivated event
    this.eventEmitter.emit('workflow.deactivated', {
      workflow: deactivatedWorkflow,
      user,
    });

    // Record audit log
    await this.auditLogService.logWorkflowEvent({
      workflowId: id,
      workflowName: deactivatedWorkflow.name,
      action: 'deactivate',
      userId: user.userId,
      tenantId: user.tenantId,
      metadata: {},
    });

    // Update metrics
    this.metricsService.incrementCounter('workflows_deactivated_total', {
      tenant_id: user.tenantId,
    });

    this.logger.log(`Deactivated workflow ${id} for tenant ${user.tenantId}`);

    return deactivatedWorkflow;
  }

  async getWorkflowStatistics(user: AuthUser): Promise<any> {
    const cacheKey = `workflow-stats:${user.tenantId}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    const stats = await this.workflowRepository
      .createQueryBuilder('workflow')
      .select([
        'COUNT(*) as total',
        'COUNT(CASE WHEN status = \'active\' THEN 1 END) as active',
        'COUNT(CASE WHEN status = \'draft\' THEN 1 END) as draft',
        'COUNT(CASE WHEN status = \'inactive\' THEN 1 END) as inactive',
        'SUM(execution_count) as total_executions',
        'SUM(success_count) as total_successes',
        'SUM(failure_count) as total_failures',
        'AVG(avg_execution_time_ms) as avg_execution_time',
      ])
      .where('tenant_id = :tenantId', { tenantId: user.tenantId })
      .getRawOne();

    const result = {
      totalWorkflows: parseInt(stats.total) || 0,
      activeWorkflows: parseInt(stats.active) || 0,
      draftWorkflows: parseInt(stats.draft) || 0,
      inactiveWorkflows: parseInt(stats.inactive) || 0,
      totalExecutions: parseInt(stats.total_executions) || 0,
      totalSuccesses: parseInt(stats.total_successes) || 0,
      totalFailures: parseInt(stats.total_failures) || 0,
      avgExecutionTimeMs: Math.round(parseFloat(stats.avg_execution_time) || 0),
      successRate: stats.total_executions > 0 
        ? Math.round((stats.total_successes / stats.total_executions) * 100 * 100) / 100
        : 0,
    };

    // Cache for 5 minutes
    await this.cacheManager.set(cacheKey, result, 300);

    return result;
  }

  private async clearWorkflowCache(tenantId: string, workflowId?: string): Promise<void> {
    const keys = [
      `workflows:${tenantId}:*`,
      `workflow-stats:${tenantId}`,
    ];

    if (workflowId) {
      keys.push(`workflow:${workflowId}:${tenantId}`);
    }

    await Promise.all(keys.map(key => this.cacheManager.del(key)));
  }

  private async hasRecentExecutions(workflowId: string): Promise<boolean> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const count = await this.workflowRepository
      .createQueryBuilder('workflow')
      .leftJoin('workflow.executions', 'execution')
      .where('workflow.id = :workflowId', { workflowId })
      .andWhere('execution.created_at > :date', { date: thirtyDaysAgo })
      .getCount();

    return count > 0;
  }
}
