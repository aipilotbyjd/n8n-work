import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  oldValues?: any;
  newValues?: any;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    // @InjectRepository(AuditLogEntry)
    // private readonly auditLogRepository: Repository<AuditLogEntry>,
  ) {}

  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    try {
      // For now, just log to console until we have the entity set up
      this.logger.log('Audit Log Entry:', {
        ...entry,
        timestamp: new Date(),
      });
      
      // TODO: Save to database when AuditLogEntry entity is created
      // const auditEntry = this.auditLogRepository.create({
      //   ...entry,
      //   timestamp: new Date(),
      // });
      // await this.auditLogRepository.save(auditEntry);
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
    // TODO: Implement when repository is available
    this.logger.warn('getAuditLogs not implemented - returning empty array');
    return [];
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