import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Schedule, ScheduleStatus, TriggerType } from './entities/schedule.entity';
import { ScheduledExecution, ExecutionStatus } from './entities/scheduled-execution.entity';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleResponseDto } from './dto/schedule-response.dto';
import { CronParserService } from './services/cron-parser.service';
import { ScheduleValidationService } from './services/schedule-validation.service';
import { TriggerService } from './services/trigger.service';
import { MetricsService } from '../../observability/metrics.service';
import { AuditLogService } from '../audit/audit-log.service';

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);

  constructor(
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
    @InjectRepository(ScheduledExecution)
    private readonly scheduledExecutionRepository: Repository<ScheduledExecution>,
    private readonly cronParserService: CronParserService,
    private readonly scheduleValidationService: ScheduleValidationService,
    private readonly triggerService: TriggerService,
    private readonly metricsService: MetricsService,
    private readonly auditService: AuditLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new schedule
   */
  async createSchedule(
    createScheduleDto: CreateScheduleDto,
    tenantId: string,
    userId: string,
  ): Promise<ScheduleResponseDto> {
    // Validate schedule configuration
    await this.scheduleValidationService.validateSchedule(createScheduleDto);

    // Validate cron expression if provided
    if (createScheduleDto.triggerType === TriggerType.CRON && createScheduleDto.cronExpression) {
      const validation = this.cronParserService.validateCronExpression(createScheduleDto.cronExpression);
      if (!validation.isValid) {
        throw new BadRequestException(`Invalid cron expression: ${validation.error}`);
      }
    }

    // Calculate next run time
    const nextRunAt = this.calculateNextRunTime(createScheduleDto);

    // Create schedule
    const schedule = this.scheduleRepository.create({
      ...createScheduleDto,
      tenantId,
      nextRunAt,
      createdBy: userId,
      updatedBy: userId,
    });

    const savedSchedule = await this.scheduleRepository.save(schedule);

    // Schedule the first execution
    if (savedSchedule.isActive && savedSchedule.status === ScheduleStatus.ACTIVE) {
      await this.scheduleNextExecution(savedSchedule);
    }

    // Emit event
    this.eventEmitter.emit('schedule.created', {
      scheduleId: savedSchedule.id,
      workflowId: savedSchedule.workflowId,
      tenantId,
      userId,
    });

    // Log audit event
    await this.auditService.log({
      action: 'schedule.created',
      resourceType: 'schedule',
      resourceId: savedSchedule.id,
      tenantId,
      userId,
      metadata: {
        scheduleName: savedSchedule.name,
        triggerType: savedSchedule.triggerType,
        cronExpression: savedSchedule.cronExpression,
      },
    });

    // Update metrics
    this.metricsService.incrementCounter('schedules_created_total', {
      tenant_id: tenantId,
      trigger_type: savedSchedule.triggerType,
    });

    return this.toResponseDto(savedSchedule);
  }

  /**
   * Get all schedules for a tenant
   */
  async findAllSchedules(
    tenantId: string,
    workflowId?: string,
  ): Promise<ScheduleResponseDto[]> {
    const queryBuilder = this.scheduleRepository
      .createQueryBuilder('schedule')
      .where('schedule.tenantId = :tenantId', { tenantId });

    if (workflowId) {
      queryBuilder.andWhere('schedule.workflowId = :workflowId', { workflowId });
    }

    const schedules = await queryBuilder
      .orderBy('schedule.createdAt', 'DESC')
      .getMany();

    return schedules.map(schedule => this.toResponseDto(schedule));
  }

  /**
   * Get a schedule by ID
   */
  async findScheduleById(id: string, tenantId: string): Promise<ScheduleResponseDto> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id, tenantId },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return this.toResponseDto(schedule);
  }

  /**
   * Update a schedule
   */
  async updateSchedule(
    id: string,
    updateScheduleDto: UpdateScheduleDto,
    tenantId: string,
    userId: string,
  ): Promise<ScheduleResponseDto> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id, tenantId },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    // Validate updated configuration
    if (updateScheduleDto.cronExpression || updateScheduleDto.triggerType) {
      const cronExpression = updateScheduleDto.cronExpression || schedule.cronExpression;
      const triggerType = updateScheduleDto.triggerType || schedule.triggerType;

      if (triggerType === TriggerType.CRON && cronExpression) {
        const validation = this.cronParserService.validateCronExpression(cronExpression);
        if (!validation.isValid) {
          throw new BadRequestException(`Invalid cron expression: ${validation.error}`);
        }
      }
    }

    // Update schedule
    Object.assign(schedule, updateScheduleDto);
    schedule.updatedBy = userId;

    // Recalculate next run time if schedule configuration changed
    if (updateScheduleDto.cronExpression || updateScheduleDto.intervalSeconds || updateScheduleDto.triggerType) {
      schedule.nextRunAt = this.calculateNextRunTime(schedule);
    }

    const savedSchedule = await this.scheduleRepository.save(schedule);

    // Reschedule if active
    if (savedSchedule.isActive && savedSchedule.status === ScheduleStatus.ACTIVE) {
      await this.rescheduleExecution(savedSchedule);
    }

    // Emit event
    this.eventEmitter.emit('schedule.updated', {
      scheduleId: savedSchedule.id,
      workflowId: savedSchedule.workflowId,
      tenantId,
      userId,
    });

    // Log audit event
    await this.auditService.log({
      action: 'schedule.updated',
      resourceType: 'schedule',
      resourceId: savedSchedule.id,
      tenantId,
      userId,
      metadata: { scheduleName: savedSchedule.name },
    });

    return this.toResponseDto(savedSchedule);
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(id: string, tenantId: string, userId: string): Promise<void> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id, tenantId },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    // Cancel pending executions
    await this.scheduledExecutionRepository.update(
      {
        scheduleId: id,
        status: ExecutionStatus.SCHEDULED,
      },
      {
        status: ExecutionStatus.CANCELLED,
      },
    );

    // Delete schedule
    await this.scheduleRepository.remove(schedule);

    // Emit event
    this.eventEmitter.emit('schedule.deleted', {
      scheduleId: id,
      workflowId: schedule.workflowId,
      tenantId,
      userId,
    });

    // Log audit event
    await this.auditService.log({
      action: 'schedule.deleted',
      resourceType: 'schedule',
      resourceId: id,
      tenantId,
      userId,
      metadata: { scheduleName: schedule.name },
    });

    // Update metrics
    this.metricsService.incrementCounter('schedules_deleted_total', {
      tenant_id: tenantId,
      trigger_type: schedule.triggerType,
    });
  }

  /**
   * Activate/deactivate a schedule
   */
  async toggleSchedule(
    id: string,
    isActive: boolean,
    tenantId: string,
    userId: string,
  ): Promise<ScheduleResponseDto> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id, tenantId },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    schedule.isActive = isActive;
    schedule.status = isActive ? ScheduleStatus.ACTIVE : ScheduleStatus.INACTIVE;
    schedule.updatedBy = userId;

    if (isActive) {
      // Recalculate next run time when activating
      schedule.nextRunAt = this.calculateNextRunTime(schedule);
      await this.scheduleNextExecution(schedule);
    } else {
      // Cancel pending executions when deactivating
      await this.scheduledExecutionRepository.update(
        {
          scheduleId: id,
          status: ExecutionStatus.SCHEDULED,
        },
        {
          status: ExecutionStatus.CANCELLED,
        },
      );
    }

    const savedSchedule = await this.scheduleRepository.save(schedule);

    // Emit event
    this.eventEmitter.emit('schedule.toggled', {
      scheduleId: savedSchedule.id,
      isActive,
      tenantId,
      userId,
    });

    // Log audit event
    await this.auditService.log({
      action: isActive ? 'schedule.activated' : 'schedule.deactivated',
      resourceType: 'schedule',
      resourceId: savedSchedule.id,
      tenantId,
      userId,
      metadata: { scheduleName: savedSchedule.name },
    });

    return this.toResponseDto(savedSchedule);
  }

  /**
   * Get schedule execution history
   */
  async getScheduleExecutions(
    scheduleId: string,
    tenantId: string,
    limit = 50,
    offset = 0,
  ): Promise<ScheduledExecution[]> {
    return this.scheduledExecutionRepository.find({
      where: { scheduleId, tenantId },
      order: { scheduledAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Trigger a schedule manually
   */
  async triggerScheduleManually(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<ScheduledExecution> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id, tenantId },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    // Create manual execution
    const execution = this.scheduledExecutionRepository.create({
      scheduleId: schedule.id,
      workflowId: schedule.workflowId,
      tenantId,
      status: ExecutionStatus.SCHEDULED,
      scheduledAt: new Date(),
      triggerData: { type: 'manual', triggeredBy: userId },
    });

    const savedExecution = await this.scheduledExecutionRepository.save(execution);

    // Trigger execution immediately
    await this.triggerService.executeWorkflow(savedExecution);

    // Update schedule statistics
    schedule.totalExecutions += 1;
    await this.scheduleRepository.save(schedule);

    // Emit event
    this.eventEmitter.emit('schedule.manually_triggered', {
      scheduleId: id,
      executionId: savedExecution.id,
      tenantId,
      userId,
    });

    return savedExecution;
  }

  /**
   * Cron job to check for due schedules
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkDueSchedules(): Promise<void> {
    this.logger.debug('Checking for due schedules...');

    const now = new Date();
    const dueSchedules = await this.scheduleRepository.find({
      where: {
        isActive: true,
        status: ScheduleStatus.ACTIVE,
        nextRunAt: LessThan(now),
      },
    });

    this.logger.debug(`Found ${dueSchedules.length} due schedules`);

    for (const schedule of dueSchedules) {
      try {
        await this.processSchedule(schedule);
      } catch (error) {
        this.logger.error(`Failed to process schedule ${schedule.id}:`, error);
        
        // Update schedule status to error
        schedule.status = ScheduleStatus.ERROR;
        schedule.lastError = error.message;
        await this.scheduleRepository.save(schedule);
      }
    }
  }

  /**
   * Process a due schedule
   */
  private async processSchedule(schedule: Schedule): Promise<void> {
    // Check if execution is allowed
    if (!this.isExecutionAllowed(schedule)) {
      this.logger.debug(`Execution not allowed for schedule ${schedule.id}`);
      return;
    }

    // Create scheduled execution
    const execution = this.scheduledExecutionRepository.create({
      scheduleId: schedule.id,
      workflowId: schedule.workflowId,
      tenantId: schedule.tenantId,
      status: ExecutionStatus.SCHEDULED,
      scheduledAt: schedule.nextRunAt,
      triggerData: schedule.triggerData || {},
      executionContext: schedule.executionContext || {},
    });

    const savedExecution = await this.scheduledExecutionRepository.save(execution);

    // Trigger execution
    await this.triggerService.executeWorkflow(savedExecution);

    // Update schedule for next run
    schedule.lastRunAt = new Date();
    schedule.nextRunAt = this.calculateNextRunTime(schedule);
    schedule.totalExecutions += 1;

    await this.scheduleRepository.save(schedule);

    // Schedule next execution if there is one
    if (schedule.nextRunAt) {
      await this.scheduleNextExecution(schedule);
    }

    this.logger.debug(`Processed schedule ${schedule.id}, next run: ${schedule.nextRunAt}`);
  }

  /**
   * Calculate next run time for a schedule
   */
  private calculateNextRunTime(schedule: Schedule | CreateScheduleDto): Date | null {
    const now = new Date();

    // Check end date
    if (schedule.endDate && now >= schedule.endDate) {
      return null;
    }

    // Check max executions
    if (schedule.maxExecutions && 'totalExecutions' in schedule && 
        schedule.totalExecutions >= schedule.maxExecutions) {
      return null;
    }

    try {
      switch (schedule.triggerType) {
        case TriggerType.CRON:
          if (schedule.cronExpression) {
            return this.cronParserService.getNextExecution(
              schedule.cronExpression,
              schedule.timezone,
            );
          }
          break;

        case TriggerType.INTERVAL:
          if (schedule.intervalSeconds) {
            const nextRun = new Date(now.getTime() + schedule.intervalSeconds * 1000);
            
            // Respect start date
            if (schedule.startDate && nextRun < schedule.startDate) {
              return schedule.startDate;
            }
            
            return nextRun;
          }
          break;

        default:
          return null;
      }
    } catch (error) {
      this.logger.error(`Failed to calculate next run time for schedule:`, error);
      return null;
    }

    return null;
  }

  /**
   * Check if execution is allowed for a schedule
   */
  private isExecutionAllowed(schedule: Schedule): boolean {
    const now = new Date();

    // Check if schedule is active
    if (!schedule.isActive || schedule.status !== ScheduleStatus.ACTIVE) {
      return false;
    }

    // Check start date
    if (schedule.startDate && now < schedule.startDate) {
      return false;
    }

    // Check end date
    if (schedule.endDate && now >= schedule.endDate) {
      return false;
    }

    // Check max executions
    if (schedule.maxExecutions && schedule.totalExecutions >= schedule.maxExecutions) {
      return false;
    }

    // Check if overlap is allowed
    if (!schedule.allowOverlap) {
      // Check if there's already a running execution for this schedule
      // This would require checking the execution service
      // For now, we'll assume overlap checking is handled elsewhere
    }

    return true;
  }

  /**
   * Schedule next execution for a schedule
   */
  private async scheduleNextExecution(schedule: Schedule): Promise<void> {
    // This method would integrate with a job queue system like BullMQ
    // to schedule the actual execution at the specified time
    this.logger.debug(`Scheduling next execution for ${schedule.id} at ${schedule.nextRunAt}`);
  }

  /**
   * Reschedule execution for an updated schedule
   */
  private async rescheduleExecution(schedule: Schedule): Promise<void> {
    // Cancel existing scheduled executions
    await this.scheduledExecutionRepository.update(
      {
        scheduleId: schedule.id,
        status: ExecutionStatus.SCHEDULED,
      },
      {
        status: ExecutionStatus.CANCELLED,
      },
    );

    // Schedule new execution
    await this.scheduleNextExecution(schedule);
  }

  /**
   * Convert schedule entity to response DTO
   */
  private toResponseDto(schedule: Schedule): ScheduleResponseDto {
    return {
      id: schedule.id,
      name: schedule.name,
      description: schedule.description,
      workflowId: schedule.workflowId,
      triggerType: schedule.triggerType,
      status: schedule.status,
      cronExpression: schedule.cronExpression,
      timezone: schedule.timezone,
      intervalSeconds: schedule.intervalSeconds,
      nextRunAt: schedule.nextRunAt,
      lastRunAt: schedule.lastRunAt,
      lastSuccessAt: schedule.lastSuccessAt,
      lastFailureAt: schedule.lastFailureAt,
      isActive: schedule.isActive,
      allowOverlap: schedule.allowOverlap,
      maxRetries: schedule.maxRetries,
      retryDelaySeconds: schedule.retryDelaySeconds,
      timeoutSeconds: schedule.timeoutSeconds,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      maxExecutions: schedule.maxExecutions,
      totalExecutions: schedule.totalExecutions,
      successfulExecutions: schedule.successfulExecutions,
      failedExecutions: schedule.failedExecutions,
      averageExecutionTime: schedule.averageExecutionTime,
      consecutiveFailures: schedule.consecutiveFailures,
      lastError: schedule.lastError,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
      createdBy: schedule.createdBy,
      updatedBy: schedule.updatedBy,
    };
  }
}