import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, UseFilters } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WsExceptionFilter } from '../common/filters/ws-exception.filter';
import { WorkflowsService } from '../domains/workflows/workflows.service';
import { ExecutionsService } from '../domains/executions/executions.service';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { AuthUser } from '../auth/interfaces/auth-user.interface';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  tenantId?: string;
  subscriptions?: Set<string>;
}

interface SubscriptionRequest {
  type: 'workflow' | 'execution' | 'logs' | 'metrics' | 'tenant_activity';
  resourceId?: string; // workflow_id, execution_id, etc.
  filters?: {
    eventTypes?: string[];
    logLevel?: string;
    stepId?: string;
  };
}

interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
  messageId: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
  namespace: '/workflow',
  transports: ['websocket', 'polling'],
})
@UseFilters(WsExceptionFilter)
@UseGuards(ThrottlerGuard)
export class WorkflowWebSocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WorkflowWebSocketGateway.name);
  private readonly connectedClients = new Map<string, AuthenticatedSocket>();
  private readonly subscriptions = new Map<string, Set<string>>(); // resourceId -> Set<clientId>
  private readonly clientSubscriptions = new Map<string, Set<string>>(); // clientId -> Set<resourceId>
  private readonly metrics = {
    connections: 0,
    messagesReceived: 0,
    messagesSent: 0,
    subscriptions: 0,
    errors: 0,
  };

  constructor(
    private readonly workflowsService: WorkflowsService,
    private readonly executionsService: ExecutionsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly jwtService: JwtService,
  ) { }

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');

    // Set up periodic cleanup and metrics reporting
    setInterval(() => this.cleanupInactiveConnections(), 300000); // 5 minutes
    setInterval(() => this.reportMetrics(), 60000); // 1 minute
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract token from query parameters or headers
      const token = client.handshake.auth?.token || client.handshake.query?.token;

      if (!token) {
        this.logger.warn(`Connection rejected: No authentication token provided`);
        client.emit('error', { message: 'Authentication token required' });
        client.disconnect();
        return;
      }

      // Validate token and extract user info
      const userInfo = await this.validateToken(token as string);
      if (!userInfo) {
        this.logger.warn(`Connection rejected: Invalid token`);
        client.emit('error', { message: 'Invalid authentication token' });
        client.disconnect();
        return;
      }

      // Set user context
      client.userId = userInfo.userId;
      client.tenantId = userInfo.tenantId;
      client.subscriptions = new Set();

      // Store connection
      this.connectedClients.set(client.id, client);
      this.clientSubscriptions.set(client.id, new Set());
      this.metrics.connections++;

      this.logger.log(
        `Client connected: ${client.id} (User: ${client.userId}, Tenant: ${client.tenantId})`,
      );

      // Send connection confirmation
      client.emit('connected', {
        clientId: client.id,
        userId: client.userId,
        tenantId: client.tenantId,
        timestamp: new Date().toISOString(),
      });

      // Send current tenant stats
      const stats = await this.getTenantStats(client.tenantId);
      client.emit('tenant_stats', stats);

    } catch (error: any) {
      this.logger.error(`Connection error: ${error.message}`, error.stack);
      client.emit('error', { message: 'Connection failed' });
      client.disconnect();
      this.metrics.errors++;
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Clean up subscriptions
    const clientSubs = this.clientSubscriptions.get(client.id);
    if (clientSubs) {
      clientSubs.forEach(resourceId => {
        const subscribers = this.subscriptions.get(resourceId);
        if (subscribers) {
          subscribers.delete(client.id);
          if (subscribers.size === 0) {
            this.subscriptions.delete(resourceId);
          }
        }
      });
      this.clientSubscriptions.delete(client.id);
    }

    // Remove from connected clients
    this.connectedClients.delete(client.id);
    this.metrics.connections--;
  }

  @SubscribeMessage('subscribe')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 subscriptions per minute
  async handleSubscription(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: SubscriptionRequest,
  ) {
    try {
      this.metrics.messagesReceived++;

      if (!client.tenantId) {
        client.emit('error', { message: 'Not authenticated' });
        return;
      }

      // Validate subscription request
      if (!this.isValidSubscriptionType(data.type)) {
        client.emit('error', { message: 'Invalid subscription type' });
        return;
      }

      // Generate subscription key
      const subscriptionKey = this.generateSubscriptionKey(data, client.tenantId);

      // Check permissions
      const hasPermission = await this.checkSubscriptionPermission(
        client.tenantId,
        client.userId,
        data,
      );

      if (!hasPermission) {
        client.emit('error', { message: 'Permission denied for this subscription' });
        return;
      }

      // Add to subscriptions
      if (!this.subscriptions.has(subscriptionKey)) {
        this.subscriptions.set(subscriptionKey, new Set());
      }
      this.subscriptions.get(subscriptionKey).add(client.id);

      // Add to client subscriptions
      this.clientSubscriptions.get(client.id).add(subscriptionKey);
      client.subscriptions.add(subscriptionKey);
      this.metrics.subscriptions++;

      this.logger.log(
        `Client ${client.id} subscribed to ${data.type}: ${subscriptionKey}`,
      );

      // Send confirmation
      client.emit('subscription_confirmed', {
        type: data.type,
        resourceId: data.resourceId,
        subscriptionKey,
        timestamp: new Date().toISOString(),
      });

      // Send initial data if available
      await this.sendInitialData(client, data);

    } catch (error: any) {
      this.logger.error(`Subscription error: ${error.message}`, error.stack);
      client.emit('error', { message: 'Subscription failed' });
      this.metrics.errors++;
    }
  }

  @SubscribeMessage('unsubscribe')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 unsubscriptions per minute
  handleUnsubscription(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { subscriptionKey: string },
  ) {
    try {
      this.metrics.messagesReceived++;

      const { subscriptionKey } = data;

      // Remove from subscriptions
      const subscribers = this.subscriptions.get(subscriptionKey);
      if (subscribers) {
        subscribers.delete(client.id);
        if (subscribers.size === 0) {
          this.subscriptions.delete(subscriptionKey);
        }
      }

      // Remove from client subscriptions
      this.clientSubscriptions.get(client.id)?.delete(subscriptionKey);
      client.subscriptions?.delete(subscriptionKey);

      this.logger.log(`Client ${client.id} unsubscribed from ${subscriptionKey}`);

      client.emit('unsubscription_confirmed', {
        subscriptionKey,
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      this.logger.error(`Unsubscription error: ${error.message}`, error.stack);
      client.emit('error', { message: 'Unsubscription failed' });
      this.metrics.errors++;
    }
  }

  @SubscribeMessage('ping')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 pings per minute
  handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    client.emit('pong', { timestamp: new Date().toISOString() });
  }

  @SubscribeMessage('get_status')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 status requests per minute
  async handleGetStatus(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { executionId?: string; workflowId?: string },
  ) {
    try {
      this.metrics.messagesReceived++;

      if (!client.tenantId) {
        client.emit('error', { message: 'Not authenticated' });
        return;
      }

      let status;
      if (data.executionId) {
        // Use getExecution method instead of getExecutionStatus
        status = await this.executionsService.getExecution(
          data.executionId,
          client.tenantId,
        );
      } else if (data.workflowId) {
        // Create a mock user object for the findOne method
        const mockUser: AuthUser = {
          id: client.userId,
          tenantId: client.tenantId,
          email: '',
          roles: [],
          permissions: [],
        };
        // Use findOne method instead of getWorkflowStatus
        status = await this.workflowsService.findOne(data.workflowId, mockUser);
      } else {
        status = await this.getTenantStats(client.tenantId);
      }

      client.emit('status_response', {
        ...data,
        status,
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      this.logger.error(`Get status error: ${error.message}`, error.stack);
      client.emit('error', { message: 'Failed to get status' });
      this.metrics.errors++;
    }
  }

  // Event listeners for broadcasting updates

  @OnEvent('workflow.created')
  async handleWorkflowCreated(payload: any) {
    const subscriptionKey = `workflow:${payload.tenantId}:${payload.workflowId}`;
    await this.broadcastToSubscribers(subscriptionKey, {
      type: 'workflow_created',
      payload,
      timestamp: new Date().toISOString(),
    });
  }

  @OnEvent('workflow.updated')
  async handleWorkflowUpdated(payload: any) {
    const subscriptionKey = `workflow:${payload.tenantId}:${payload.workflowId}`;
    await this.broadcastToSubscribers(subscriptionKey, {
      type: 'workflow_updated',
      payload,
      timestamp: new Date().toISOString(),
    });
  }

  @OnEvent('execution.started')
  async handleExecutionStarted(payload: any) {
    const subscriptionKeys = [
      `execution:${payload.tenantId}:${payload.executionId}`,
      `workflow:${payload.tenantId}:${payload.workflowId}`,
      `tenant_activity:${payload.tenantId}`,
    ];

    const message = {
      type: 'execution_started',
      payload,
      timestamp: new Date().toISOString(),
    };

    await Promise.all(
      subscriptionKeys.map(key => this.broadcastToSubscribers(key, message)),
    );
  }

  @OnEvent('execution.completed')
  async handleExecutionCompleted(payload: any) {
    const subscriptionKeys = [
      `execution:${payload.tenantId}:${payload.executionId}`,
      `workflow:${payload.tenantId}:${payload.workflowId}`,
      `tenant_activity:${payload.tenantId}`,
    ];

    const message = {
      type: 'execution_completed',
      payload,
      timestamp: new Date().toISOString(),
    };

    await Promise.all(
      subscriptionKeys.map(key => this.broadcastToSubscribers(key, message)),
    );
  }

  @OnEvent('execution.failed')
  async handleExecutionFailed(payload: any) {
    const subscriptionKeys = [
      `execution:${payload.tenantId}:${payload.executionId}`,
      `workflow:${payload.tenantId}:${payload.workflowId}`,
      `tenant_activity:${payload.tenantId}`,
    ];

    const message = {
      type: 'execution_failed',
      payload,
      timestamp: new Date().toISOString(),
    };

    await Promise.all(
      subscriptionKeys.map(key => this.broadcastToSubscribers(key, message)),
    );
  }

  @OnEvent('step.started')
  async handleStepStarted(payload: any) {
    const subscriptionKey = `execution:${payload.tenantId}:${payload.executionId}`;
    await this.broadcastToSubscribers(subscriptionKey, {
      type: 'step_started',
      payload,
      timestamp: new Date().toISOString(),
    });
  }

  @OnEvent('step.completed')
  async handleStepCompleted(payload: any) {
    const subscriptionKey = `execution:${payload.tenantId}:${payload.executionId}`;
    await this.broadcastToSubscribers(subscriptionKey, {
      type: 'step_completed',
      payload,
      timestamp: new Date().toISOString(),
    });
  }

  @OnEvent('step.failed')
  async handleStepFailed(payload: any) {
    const subscriptionKey = `execution:${payload.tenantId}:${payload.executionId}`;
    await this.broadcastToSubscribers(subscriptionKey, {
      type: 'step_failed',
      payload,
      timestamp: new Date().toISOString(),
    });
  }

  @OnEvent('log.created')
  async handleLogCreated(payload: any) {
    const subscriptionKey = `logs:${payload.tenantId}:${payload.executionId}`;
    await this.broadcastToSubscribers(subscriptionKey, {
      type: 'log_created',
      payload,
      timestamp: new Date().toISOString(),
    });
  }

  @OnEvent('metrics.updated')
  async handleMetricsUpdated(payload: any) {
    const subscriptionKey = `metrics:${payload.tenantId}`;
    await this.broadcastToSubscribers(subscriptionKey, {
      type: 'metrics_updated',
      payload,
      timestamp: new Date().toISOString(),
    });
  }

  // Private helper methods

  /**
   * Broadcast a message to all subscribers of a specific resource
   * @param subscriptionKey The subscription key to broadcast to
   * @param message The message to broadcast
   */
  private async broadcastToSubscribers(subscriptionKey: string, message: any): Promise<void> {
    const subscribers = this.subscriptions.get(subscriptionKey);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    // Send message to all subscribers
    const promises: Promise<void>[] = [];
    subscribers.forEach(clientId => {
      const client = this.connectedClients.get(clientId);
      if (client) {
        promises.push(
          new Promise<void>((resolve) => {
            client.emit('update', message);
            resolve();
          })
        );
      }
    });

    // Wait for all messages to be sent
    await Promise.all(promises);
    this.metrics.messagesSent += promises.length;
  }

  private isValidSubscriptionType(type: string): boolean {
    return ['workflow', 'execution', 'logs', 'metrics', 'tenant_activity'].includes(type);
  }

  private generateSubscriptionKey(request: SubscriptionRequest, tenantId: string): string {
    const { type, resourceId } = request;

    switch (type) {
      case 'workflow':
        return resourceId ? `workflow:${tenantId}:${resourceId}` : `workflow:${tenantId}`;
      case 'execution':
        return resourceId ? `execution:${tenantId}:${resourceId}` : `execution:${tenantId}`;
      case 'logs':
        return resourceId ? `logs:${tenantId}:${resourceId}` : `logs:${tenantId}`;
      case 'metrics':
        return `metrics:${tenantId}`;
      case 'tenant_activity':
        return `tenant_activity:${tenantId}`;
      default:
        throw new Error(`Invalid subscription type: ${type}`);
    }
  }

  private async checkSubscriptionPermission(
    tenantId: string,
    userId: string,
    request: SubscriptionRequest,
  ): Promise<boolean> {
    try {
      // Create a mock user object for service methods
      const mockUser: AuthUser = {
        id: userId,
        tenantId: tenantId,
        email: '',
        roles: [],
        permissions: [],
      };

      // Implement permission checking based on your authorization logic
      // For now, we'll check basic tenant membership and resource access

      switch (request.type) {
        case 'workflow':
          if (request.resourceId) {
            // Check if user has access to specific workflow
            const workflow = await this.workflowsService.findOne(request.resourceId, mockUser);
            return workflow !== null;
          }
          return true; // Allow tenant-wide workflow subscriptions

        case 'execution':
          if (request.resourceId) {
            // Check if user has access to specific execution
            const execution = await this.executionsService.getExecution(request.resourceId, tenantId);
            return execution !== null;
          }
          return true; // Allow tenant-wide execution subscriptions

        case 'logs':
        case 'metrics':
        case 'tenant_activity':
          return true; // Allow for authenticated users within tenant

        default:
          return false;
      }
    } catch (error: any) {
      this.logger.error(`Permission check error: ${error.message}`);
      return false;
    }
  }

  private async sendInitialData(
    client: AuthenticatedSocket,
    request: SubscriptionRequest,
  ): Promise<void> {
    try {
      // Create a mock user object for service methods
      const mockUser: AuthUser = {
        id: client.userId,
        tenantId: client.tenantId,
        email: '',
        roles: [],
        permissions: [],
      };

      switch (request.type) {
        case 'workflow':
          if (request.resourceId) {
            const workflow = await this.workflowsService.findOne(
              request.resourceId,
              mockUser,
            );
            if (workflow) {
              client.emit('initial_data', {
                type: 'workflow',
                data: workflow,
                timestamp: new Date().toISOString(),
              });
            }
          }
          break;

        case 'execution':
          if (request.resourceId) {
            const execution = await this.executionsService.getExecution(
              request.resourceId,
              client.tenantId,
            );
            if (execution) {
              client.emit('initial_data', {
                type: 'execution',
                data: execution,
                timestamp: new Date().toISOString(),
              });
            }
          }
          break;

        // Add cases for other subscription types as needed
      }
    } catch (error: any) {
      this.logger.error(`Initial data error: ${error.message}`);
    }
  }

  private async getTenantStats(tenantId: string): Promise<any> {
    // Implement tenant statistics retrieval
    return {
      tenantId,
      activeWorkflows: 0,
      runningExecutions: 0,
      completedToday: 0,
      failedToday: 0,
    };
  }

  private async validateToken(token: string): Promise<{ userId: string; tenantId: string } | null> {
    try {
      // Use the injected JWT service for token validation
      const decoded: any = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'default-secret',
      });

      if (!decoded || !decoded.sub || !decoded.tenantId) {
        return null;
      }

      return {
        userId: decoded.sub,
        tenantId: decoded.tenantId,
      };
    } catch (error: any) {
      this.logger.error(`Token validation error: ${error.message}`);
      return null;
    }
  }

  private async cleanupInactiveConnections(): Promise<void> {
    // Implement cleanup logic for inactive connections
    this.logger.debug(`Active connections: ${this.connectedClients.size}`);
  }

  private async reportMetrics(): Promise<void> {
    // Implement metrics reporting
    this.logger.debug(`Current metrics: ${JSON.stringify(this.metrics)}`);
  }
}