import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, In, Between } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Execution, ExecutionStatus, ExecutionMode } from './entities/execution.entity';
import { StartExecutionDto } from './dto/start-execution.dto';
import { ExecutionResponseDto } from './dto/execution-response.dto';
import { ExecutionFilterDto } from './dto/execution-filter.dto';
import { RetryExecutionDto } from './dto/retry-execution.dto';
import { AuditLogService } from '../audit/audit-log.service';

@Injectable()
export class ExecutionsService {
  private readonly logger = new Logger(ExecutionsService.name);

  constructor(
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditService: AuditLogService,
  ) {}

  async startExecution(
    startExecutionDto: StartExecutionDto,
    tenantId: string,
    userId: string,
  ): Promise<ExecutionResponseDto> {
    this.logger.log(`Starting execution for workflow ${startExecutionDto.workflowId}`);

    const execution = this.executionRepository.create({
      ...startExecutionDto,
      tenantId,
      triggeredBy: userId,
      status: ExecutionStatus.PENDING,
      queuedAt: new Date(),
    });

    const savedExecution = await this.executionRepository.save(execution);

    // Emit event to trigger execution
    this.eventEmitter.emit('execution.started', {
      execution: savedExecution,
      tenantId,
      userId,
    });

    // Log audit event
    await this.auditService.log({
      action: 'execution.started',
      resourceType: 'execution',
      resourceId: savedExecution.id,
      tenantId,
      userId,
      ipAddress: 'unknown',
      userAgent: 'unknown',
      newValues: { workflowId: startExecutionDto.workflowId },
    });

    return this.toResponseDto(savedExecution);
  }

  async findExecutions(
    tenantId: string,
    filters: ExecutionFilterDto,
  ): Promise<ExecutionResponseDto[]> {
    const queryBuilder = this.executionRepository.createQueryBuilder('execution')
      .where('execution.tenantId = :tenantId', { tenantId });

    // Apply filters
    if (filters.workflowId) {
      queryBuilder.andWhere('execution.workflowId = :workflowId', { workflowId: filters.workflowId });
    }

    if (filters.status) {
      queryBuilder.andWhere('execution.status = :status', { status: filters.status });
    }

    if (filters.mode) {
      queryBuilder.andWhere('execution.mode = :mode', { mode: filters.mode });
    }

    // Pagination
    queryBuilder
      .orderBy('execution.createdAt', 'DESC')
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);

    const executions = await queryBuilder.getMany();

    return executions.map(execution => this.toResponseDto(execution, filters.includeData));
  }

  async getExecution(
    id: string,
    tenantId: string,
    includeData = true,
    includeLogs = false,
  ): Promise<ExecutionResponseDto> {
    const execution = await this.executionRepository.findOne({
      where: { id, tenantId },
    });

    if (!execution) {
      throw new NotFoundException(`Execution ${id} not found`);
    }

    return this.toResponseDto(execution, includeData, includeLogs);
  }

  async stopExecution(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<ExecutionResponseDto> {
    const execution = await this.getExecutionEntity(id, tenantId);

    if (execution.status !== ExecutionStatus.RUNNING && execution.status !== ExecutionStatus.PENDING) {
      throw new BadRequestException('Execution cannot be stopped');
    }

    execution.status = ExecutionStatus.CANCELLED;
    execution.completedAt = new Date();
    
    const savedExecution = await this.executionRepository.save(execution);

    // Emit event to stop execution
    this.eventEmitter.emit('execution.stopped', {
      execution: savedExecution,
      tenantId,
      userId,
    });

    // Log audit event
    await this.auditService.log({
      action: 'execution.stopped',
      resourceType: 'execution',
      resourceId: id,
      tenantId,
      userId,
      ipAddress: 'unknown',
      userAgent: 'unknown',
    });

    return this.toResponseDto(savedExecution);
  }

  async retryExecution(
    id: string,
    retryDto: RetryExecutionDto,
    tenantId: string,
    userId: string,
  ): Promise<ExecutionResponseDto> {
    const originalExecution = await this.getExecutionEntity(id, tenantId);

    if (originalExecution.status !== ExecutionStatus.FAILED) {
      throw new BadRequestException('Only failed executions can be retried');
    }

    if (originalExecution.retryCount >= originalExecution.maxRetries) {
      throw new BadRequestException('Maximum retry attempts exceeded');
    }

    // Create new execution for retry
    const retryExecution = this.executionRepository.create({
      workflowId: originalExecution.workflowId,
      tenantId,
      triggeredBy: userId,
      status: ExecutionStatus.PENDING,
      mode: ExecutionMode.RETRY,
      isRetry: true,
      parentExecutionId: originalExecution.id,
      retryCount: originalExecution.retryCount + 1,
      maxRetries: originalExecution.maxRetries,
      inputData: retryDto.inputData || originalExecution.inputData,
      triggerData: originalExecution.triggerData,
      queuedAt: new Date(),
    });

    const savedExecution = await this.executionRepository.save(retryExecution);

    // Emit event to trigger retry
    this.eventEmitter.emit('execution.retried', {
      execution: savedExecution,
      originalExecution,
      tenantId,
      userId,
    });

    return this.toResponseDto(savedExecution);
  }

  async deleteExecution(id: string, tenantId: string, userId: string): Promise<void> {
    const execution = await this.getExecutionEntity(id, tenantId);

    if (execution.status === ExecutionStatus.RUNNING) {
      throw new BadRequestException('Cannot delete running execution');
    }

    await this.executionRepository.remove(execution);

    // Log audit event
    await this.auditService.log({
      action: 'execution.deleted',
      resourceType: 'execution',
      resourceId: id,
      tenantId,
      userId,
      ipAddress: 'unknown',
      userAgent: 'unknown',
      oldValues: { workflowId: execution.workflowId, status: execution.status },
    });
  }

  async getExecutionStats(tenantId: string, workflowId?: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const queryBuilder = this.executionRepository.createQueryBuilder('execution')
      .where('execution.tenantId = :tenantId', { tenantId })
      .andWhere('execution.createdAt >= :startDate', { startDate });

    if (workflowId) {
      queryBuilder.andWhere('execution.workflowId = :workflowId', { workflowId });
    }

    const executions = await queryBuilder.getMany();

    const totalExecutions = executions.length;
    const successfulExecutions = executions.filter(e => e.status === ExecutionStatus.SUCCESS).length;
    const failedExecutions = executions.filter(e => e.status === ExecutionStatus.FAILED).length;

    const executionsByStatus = executions.reduce((acc, execution) => {
      acc[execution.status] = (acc[execution.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const executionsByMode = executions.reduce((acc, execution) => {
      acc[execution.mode] = (acc[execution.mode] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const averageExecutionTime = executions
      .filter(e => e.durationMs)
      .reduce((sum, e) => sum + e.durationMs, 0) / executions.length || 0;

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime: Math.round(averageExecutionTime),
      executionsByStatus,
      executionsByMode,
      period: { days, startDate },
    };
  }

  async getExecutionLogs(
    id: string,
    tenantId: string,
    level?: string,
    nodeId?: string,
  ) {
    const execution = await this.getExecutionEntity(id, tenantId);
    
    // In a real implementation, this would query a separate logs table/service
    return {
      executionId: id,
      logs: [
        {
          timestamp: execution.createdAt,
          level: 'info',
          message: 'Execution started',
          nodeId: null,
          data: { status: execution.status },
        },
        // Add more log entries as needed
      ],
    };
  }

  async getExecutionTimeline(id: string, tenantId: string) {
    const execution = await this.getExecutionEntity(id, tenantId);
    
    const timeline = [];
    
    timeline.push({
      timestamp: execution.createdAt,
      event: 'execution_created',
      status: ExecutionStatus.PENDING,
    });

    if (execution.startedAt) {
      timeline.push({
        timestamp: execution.startedAt,
        event: 'execution_started',
        status: ExecutionStatus.RUNNING,
      });
    }

    if (execution.completedAt) {
      timeline.push({
        timestamp: execution.completedAt,
        event: 'execution_completed',
        status: execution.status,
        duration: execution.durationMs,
      });
    }

    return {
      executionId: id,
      timeline,
    };
  }

  async bulkDeleteExecutions(
    criteria: ExecutionFilterDto,
    tenantId: string,
    userId: string,
  ) {
    const queryBuilder = this.executionRepository.createQueryBuilder('execution')
      .where('execution.tenantId = :tenantId', { tenantId });

    // Apply criteria
    if (criteria.status) {
      queryBuilder.andWhere('execution.status = :status', { status: criteria.status });
    }

    if (criteria.workflowId) {
      queryBuilder.andWhere('execution.workflowId = :workflowId', { workflowId: criteria.workflowId });
    }

    const executions = await queryBuilder.getMany();
    const executionIds = executions.map(e => e.id);

    if (executionIds.length === 0) {
      return { deletedCount: 0, criteria };
    }

    // Prevent deletion of running executions
    const runningExecutions = executions.filter(e => e.status === ExecutionStatus.RUNNING);
    if (runningExecutions.length > 0) {
      throw new BadRequestException('Cannot delete running executions');
    }

    await this.executionRepository.delete({ id: In(executionIds) });

    // Log audit event
    await this.auditService.log({
      action: 'execution.bulk_deleted',
      resourceType: 'execution',
      resourceId: 'bulk',
      tenantId,
      userId,
      ipAddress: 'unknown',
      userAgent: 'unknown',
      oldValues: { deletedCount: executionIds.length, criteria },
    });

    return {
      deletedCount: executionIds.length,
      criteria,
    };
  }

  async bulkRetryExecutions(
    criteria: ExecutionFilterDto,
    tenantId: string,
    userId: string,
  ) {
    const queryBuilder = this.executionRepository.createQueryBuilder('execution')
      .where('execution.tenantId = :tenantId', { tenantId })
      .andWhere('execution.status = :status', { status: ExecutionStatus.FAILED });

    // Apply additional criteria
    if (criteria.workflowId) {
      queryBuilder.andWhere('execution.workflowId = :workflowId', { workflowId: criteria.workflowId });
    }

    const failedExecutions = await queryBuilder.getMany();
    const retriedExecutions = [];
    const skippedExecutions = [];

    for (const execution of failedExecutions) {
      if (execution.retryCount < execution.maxRetries) {
        const retryExecution = await this.retryExecution(execution.id, {}, tenantId, userId);
        retriedExecutions.push(retryExecution.id);
      } else {
        skippedExecutions.push(execution.id);
      }
    }

    return {
      retriedCount: retriedExecutions.length,
      skippedCount: skippedExecutions.length,
      executionIds: retriedExecutions,
    };
  }

  private async getExecutionEntity(id: string, tenantId: string): Promise<Execution> {
    const execution = await this.executionRepository.findOne({
      where: { id, tenantId },
    });

    if (!execution) {
      throw new NotFoundException(`Execution ${id} not found`);
    }

    return execution;
  }

  private toResponseDto(
    execution: Execution,
    includeData = false,
    includeLogs = false,
  ): ExecutionResponseDto {
    const dto: ExecutionResponseDto = {
      id: execution.id,
      workflowId: execution.workflowId,
      status: execution.status,
      mode: execution.mode,
      priority: execution.priority,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      durationMs: execution.durationMs,
      triggeredBy: execution.triggeredBy,
      triggerSource: execution.triggerSource,
      retryCount: execution.retryCount,
      maxRetries: execution.maxRetries,
      isRetry: execution.isRetry,
      parentExecutionId: execution.parentExecutionId,
      error: execution.error,
      createdAt: execution.createdAt,
      updatedAt: execution.updatedAt,
    };

    if (includeData) {
      dto.inputData = execution.inputData;
      dto.outputData = execution.outputData;
      dto.executionData = execution.executionData;
      dto.triggerData = execution.triggerData;
      dto.metadata = execution.metadata;
    }

    if (includeLogs) {
      dto.logs = execution.logs;
    }

    return dto;
  }
}