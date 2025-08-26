import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntry } from './audit-log.entity';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLogEntry)
    private readonly auditLogRepository: Repository<AuditLogEntry>,
  ) {}

  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'oldValues' | 'newValues'> & { oldValues?: any; newValues?: any }): Promise<void> {
    try {
      const auditEntry = this.auditLogRepository.create({
        ...entry,
        timestamp: new Date(),
      });
      
      await this.auditLogRepository.save(auditEntry);
      this.logger.debug('Audit log entry created', { id: auditEntry.id });
    } catch (error) {
      this.logger.error('Failed to create audit log entry:', error);
    }
  }

  async logWorkflowAction(
    tenantId: string,
    userId: string,
    action: string,
    workflowId: string,
    oldValues?: any,
    newValues?: any,
    metadata?: any,
  ): Promise<void> {
    await this.log({
      tenantId,
      userId,
      action,
      resourceType: 'workflow',
      resourceId: workflowId,
      oldValues,
      newValues,
      ipAddress: metadata?.ipAddress || 'unknown',
      userAgent: metadata?.userAgent || 'unknown',
    });
  }

  async logExecutionAction(
    tenantId: string,
    userId: string,
    action: string,
    executionId: string,
    metadata?: any,
  ): Promise<void> {
    await this.log({
      tenantId,
      userId,
      action,
      resourceType: 'execution',
      resourceId: executionId,
      ipAddress: metadata?.ipAddress || 'unknown',
      userAgent: metadata?.userAgent || 'unknown',
    });
  }

  async getAuditLogs(
    tenantId: string,
    filters?: {
      userId?: string;
      resourceType?: string;
      action?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<AuditLogEntry[]> {
    try {
      const queryBuilder = this.auditLogRepository.createQueryBuilder('audit_log')
        .where('audit_log.tenantId = :tenantId', { tenantId });

      if (filters?.userId) {
        queryBuilder.andWhere('audit_log.userId = :userId', { userId: filters.userId });
      }

      if (filters?.resourceType) {
        queryBuilder.andWhere('audit_log.resourceType = :resourceType', { resourceType: filters.resourceType });
      }

      if (filters?.action) {
        queryBuilder.andWhere('audit_log.action = :action', { action: filters.action });
      }

      if (filters?.startDate) {
        queryBuilder.andWhere('audit_log.timestamp >= :startDate', { startDate: filters.startDate });
      }

      if (filters?.endDate) {
        queryBuilder.andWhere('audit_log.timestamp <= :endDate', { endDate: filters.endDate });
      }

      queryBuilder.orderBy('audit_log.timestamp', 'DESC');

      const results = await queryBuilder.getMany();
      return results;
    } catch (error) {
      this.logger.error('Failed to retrieve audit logs:', error);
      throw error;
    }
  }

  async logWorkflowCreated(
    workflowId: string,
    workflowName: string,
    userId: string,
    nodeCount: number,
    metadata?: any,
  ): Promise<void> {
    await this.log({
      tenantId: metadata?.tenantId || 'unknown',
      userId,
      action: 'workflow.created',
      resourceType: 'workflow',
      resourceId: workflowId,
      newValues: {
        name: workflowName,
        nodeCount,
      },
      ipAddress: metadata?.ipAddress || 'unknown',
      userAgent: metadata?.userAgent || 'unknown',
    });
  }

  async logWorkflowEvent(
    event: {
      workflowId: string;
      workflowName: string;
      action: string;
      userId: string;
      tenantId: string;
      oldValues?: any;
      newValues?: any;
      metadata?: any;
    },
  ): Promise<void> {
    await this.log({
      tenantId: event.tenantId,
      userId: event.userId,
      action: event.action,
      resourceType: 'workflow',
      resourceId: event.workflowId,
      oldValues: event.oldValues,
      newValues: event.newValues,
      ipAddress: event.metadata?.ipAddress || 'unknown',
      userAgent: event.metadata?.userAgent || 'unknown',
    });
  }
}