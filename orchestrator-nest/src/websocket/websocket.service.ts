import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WorkflowWebSocketGateway } from './workflow-websocket.gateway';

interface BroadcastOptions {
  tenantId?: string;
  workflowId?: string;
  executionId?: string;
  userId?: string;
  eventType?: string;
  includePayload?: boolean;
  excludeClients?: string[];
}

interface ConnectionStats {
  totalConnections: number;
  connectionsByTenant: Record<string, number>;
  activeSubscriptions: number;
  messagesPerMinute: number;
  errorsPerMinute: number;
}

@Injectable()
export class WebSocketService implements OnModuleDestroy {
  private readonly logger = new Logger(WebSocketService.name);
  private gateway: WorkflowWebSocketGateway;

  constructor(private eventEmitter: EventEmitter2) {
    // Listen for application events and convert them to WebSocket events
    this.setupEventListeners();
  }

  onModuleDestroy() {
    if (this.gateway) {
      this.gateway.shutdown();
    }
  }

  // Set the gateway reference (called by the gateway after initialization)
  setGateway(gateway: WorkflowWebSocketGateway) {
    this.gateway = gateway;
  }

  /**
   * Broadcast a message to all connected clients matching the criteria
   */
  async broadcast(message: any, options: BroadcastOptions = {}): Promise<void> {
    if (!this.gateway) {
      this.logger.warn('WebSocket gateway not initialized');
      return;
    }

    try {
      const { tenantId, workflowId, executionId } = options;

      if (executionId && tenantId) {
        await this.gateway.broadcastToExecution(tenantId, executionId, message);
      } else if (workflowId && tenantId) {
        await this.gateway.broadcastToWorkflow(tenantId, workflowId, message);
      } else if (tenantId) {
        await this.gateway.broadcastToTenant(tenantId, message);
      } else {
        this.logger.warn('Broadcast called without sufficient targeting criteria');
      }
    } catch (error) {
      this.logger.error(`Broadcast error: ${error.message}`, error.stack);
    }
  }

  /**
   * Notify about workflow events
   */
  async notifyWorkflowEvent(
    tenantId: string,
    workflowId: string,
    eventType: string,
    payload: any,
  ): Promise<void> {
    const message = {
      type: 'workflow_event',
      eventType,
      workflowId,
      payload,
      timestamp: new Date().toISOString(),
    };

    await this.broadcast(message, { tenantId, workflowId });
    
    // Also emit to event bus for other services
    this.eventEmitter.emit(`workflow.${eventType}`, {
      tenantId,
      workflowId,
      ...payload,
    });
  }

  /**
   * Notify about execution events
   */
  async notifyExecutionEvent(
    tenantId: string,
    executionId: string,
    workflowId: string,
    eventType: string,
    payload: any,
  ): Promise<void> {
    const message = {
      type: 'execution_event',
      eventType,
      executionId,
      workflowId,
      payload,
      timestamp: new Date().toISOString(),
    };

    await this.broadcast(message, { tenantId, executionId });
    
    // Also broadcast to workflow subscribers
    await this.broadcast(message, { tenantId, workflowId });
    
    // Emit to event bus
    this.eventEmitter.emit(`execution.${eventType}`, {
      tenantId,
      executionId,
      workflowId,
      ...payload,
    });
  }

  /**
   * Notify about step events
   */
  async notifyStepEvent(
    tenantId: string,
    executionId: string,
    stepId: string,
    eventType: string,
    payload: any,
  ): Promise<void> {
    const message = {
      type: 'step_event',
      eventType,
      executionId,
      stepId,
      payload,
      timestamp: new Date().toISOString(),
    };

    await this.broadcast(message, { tenantId, executionId });
    
    // Emit to event bus
    this.eventEmitter.emit(`step.${eventType}`, {
      tenantId,
      executionId,
      stepId,
      ...payload,
    });
  }

  /**
   * Notify about system events
   */
  async notifySystemEvent(
    tenantId: string,
    eventType: string,
    payload: any,
  ): Promise<void> {
    const message = {
      type: 'system_event',
      eventType,
      payload,
      timestamp: new Date().toISOString(),
    };

    await this.broadcast(message, { tenantId });
    
    // Emit to event bus
    this.eventEmitter.emit(`system.${eventType}`, {
      tenantId,
      ...payload,
    });
  }

  /**
   * Send real-time logs
   */
  async sendLogs(
    tenantId: string,
    executionId: string,
    logs: any[],
  ): Promise<void> {
    const message = {
      type: 'logs',
      executionId,
      logs,
      timestamp: new Date().toISOString(),
    };

    await this.broadcast(message, { tenantId, executionId });
  }

  /**
   * Send real-time metrics
   */
  async sendMetrics(
    tenantId: string,
    metrics: any,
  ): Promise<void> {
    const message = {
      type: 'metrics',
      metrics,
      timestamp: new Date().toISOString(),
    };

    await this.broadcast(message, { tenantId });
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): ConnectionStats {
    if (!this.gateway) {
      return {
        totalConnections: 0,
        connectionsByTenant: {},
        activeSubscriptions: 0,
        messagesPerMinute: 0,
        errorsPerMinute: 0,
      };
    }

    return this.gateway.getConnectionStats();
  }

  /**
   * Check if a tenant has active connections
   */
  hasTenantConnections(tenantId: string): boolean {
    const stats = this.getConnectionStats();
    return (stats.connectionsByTenant[tenantId] || 0) > 0;
  }

  /**
   * Set up event listeners for internal application events
   */
  private setupEventListeners(): void {
    // Workflow events
    this.eventEmitter.on('workflow.created', (payload) => {
      this.notifyWorkflowEvent(
        payload.tenantId,
        payload.workflowId,
        'created',
        payload,
      );
    });

    this.eventEmitter.on('workflow.updated', (payload) => {
      this.notifyWorkflowEvent(
        payload.tenantId,
        payload.workflowId,
        'updated',
        payload,
      );
    });

    this.eventEmitter.on('workflow.deleted', (payload) => {
      this.notifyWorkflowEvent(
        payload.tenantId,
        payload.workflowId,
        'deleted',
        payload,
      );
    });

    // Execution events
    this.eventEmitter.on('execution.started', (payload) => {
      this.notifyExecutionEvent(
        payload.tenantId,
        payload.executionId,
        payload.workflowId,
        'started',
        payload,
      );
    });

    this.eventEmitter.on('execution.completed', (payload) => {
      this.notifyExecutionEvent(
        payload.tenantId,
        payload.executionId,
        payload.workflowId,
        'completed',
        payload,
      );
    });

    this.eventEmitter.on('execution.failed', (payload) => {
      this.notifyExecutionEvent(
        payload.tenantId,
        payload.executionId,
        payload.workflowId,
        'failed',
        payload,
      );
    });

    // Step events
    this.eventEmitter.on('step.started', (payload) => {
      this.notifyStepEvent(
        payload.tenantId,
        payload.executionId,
        payload.stepId,
        'started',
        payload,
      );
    });

    this.eventEmitter.on('step.completed', (payload) => {
      this.notifyStepEvent(
        payload.tenantId,
        payload.executionId,
        payload.stepId,
        'completed',
        payload,
      );
    });

    this.eventEmitter.on('step.failed', (payload) => {
      this.notifyStepEvent(
        payload.tenantId,
        payload.executionId,
        payload.stepId,
        'failed',
        payload,
      );
    });

    // System events
    this.eventEmitter.on('system.quota_exceeded', (payload) => {
      this.notifySystemEvent(payload.tenantId, 'quota_exceeded', payload);
    });

    this.eventEmitter.on('system.maintenance', (payload) => {
      this.notifySystemEvent(payload.tenantId, 'maintenance', payload);
    });

    // Log events
    this.eventEmitter.on('log.created', (payload) => {
      this.sendLogs(payload.tenantId, payload.executionId, [payload]);
    });

    // Metrics events
    this.eventEmitter.on('metrics.updated', (payload) => {
      this.sendMetrics(payload.tenantId, payload.metrics);
    });

    this.logger.log('Event listeners set up for WebSocket service');
  }

  /**
   * Health check for WebSocket service
   */
  getHealthStatus(): any {
    const stats = this.getConnectionStats();
    
    return {
      status: this.gateway ? 'healthy' : 'unhealthy',
      gateway_initialized: !!this.gateway,
      connections: stats.totalConnections,
      subscriptions: stats.activeSubscriptions,
      last_check: new Date().toISOString(),
    };
  }

  /**
   * Force disconnect all clients (for maintenance)
   */
  async disconnectAll(reason = 'Server maintenance'): Promise<void> {
    if (this.gateway) {
      await this.gateway.shutdown();
      this.logger.log(`Disconnected all WebSocket clients: ${reason}`);
    }
  }
}