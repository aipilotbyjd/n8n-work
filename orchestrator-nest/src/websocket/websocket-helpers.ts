import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import {
  UsePipes,
  ValidationPipe,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import { EventEmitter2 } from "@nestjs/event-emitter";

/**
 * Replace these with your real services and DTOs
 */
interface WorkflowService {
  findOne(id: string, tenantId: string): Promise<any | null>;
  countByTenant(tenantId: string): Promise<number>;
}

interface ExecutionService {
  findOne(id: string, tenantId: string): Promise<any | null>;
  countActiveByTenant(tenantId: string): Promise<number>;
  countCompletedTodayByTenant(tenantId: string): Promise<number>;
  getTenantMetrics(tenantId: string): Promise<Record<string, any>>;
}

export type SubscriptionType =
  | "workflow"
  | "execution"
  | "logs"
  | "metrics"
  | "tenant_activity";

export interface SubscriptionRequest {
  /** type of stream */
  type: SubscriptionType;
  /** optional resource identifier for narrowcast */
  resourceId?: string;
}

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
  messageId?: string;
}

export interface SubscribePayload extends SubscriptionRequest {}
export interface UnsubscribePayload extends SubscriptionRequest {}

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  tenantId?: string;
  /** internal: friendly id */
  cid?: string;
}

@WebSocketGateway({
  namespace: "/ws",
  cors: { origin: true, credentials: true },
})
export class WorkflowWebSocketGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(WorkflowWebSocketGateway.name);

  // clientId -> socket
  private connectedClients = new Map<string, AuthenticatedSocket>();

  // subscriptionKey -> set(clientId)
  private subscriptions = new Map<string, Set<string>>();

  // clientId -> set(subscriptionKey)
  private clientSubscriptions = new Map<string, Set<string>>();

  // light metrics
  private metrics = {
    connections: 0,
    disconnections: 0,
    subscriptionsCreated: 0,
    subscriptionsRemoved: 0,
    messagesSent: 0,
    errors: 0,
    lastReportAt: new Date().toISOString(),
  };

  // timers
  private cleanupTimer: NodeJS.Timeout | null = null;
  private metricsTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly jwtService: JwtService,
    private readonly workflowService: WorkflowService,
    private readonly executionService: ExecutionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ---------------- Lifecycle ----------------
  onModuleInit() {
    this.logger.log("WorkflowWebSocketGateway initialized");
    // periodic cleanup of stale/disconnected sockets
    this.cleanupTimer = setInterval(
      () => this.cleanupInactiveConnections(),
      30_000,
    );
    // periodic metric reporting
    this.metricsTimer = setInterval(() => this.reportMetrics(), 60_000);
  }

  onModuleDestroy() {
    this.shutdown();
  }

  // ---------------- Connection Hooks ----------------
  async handleConnection(client: AuthenticatedSocket) {
    try {
      // token can be provided via query (?token=) or headers (Authorization: Bearer <token>)
      const token = this.extractToken(client);
      const auth = await this.validateToken(token);

      if (!auth) {
        this.logger.warn("Unauthorized socket connection attempt");
        client.emit("error", {
          code: "UNAUTHORIZED",
          message: "Invalid token",
        });
        return client.disconnect();
      }

      client.userId = auth.userId;
      client.tenantId = auth.tenantId;
      client.cid = this.generateClientId(client);

      this.connectedClients.set(client.cid, client);
      this.metrics.connections++;
      this.logger.log(
        `Client connected cid=${client.cid} tenant=${client.tenantId} user=${client.userId}`,
      );

      client.emit("connected", {
        cid: client.cid,
        tenantId: client.tenantId,
        userId: client.userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      this.logger.error(`handleConnection error: ${error?.message}`);
      client.emit("error", {
        code: "CONNECTION_ERROR",
        message: "Connection failed",
      });
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const cid = client.cid;
    if (!cid) return;

    // remove from connected map
    this.connectedClients.delete(cid);
    this.metrics.disconnections++;

    // cleanup all subscriptions for this client
    const keys = this.clientSubscriptions.get(cid) || new Set<string>();
    for (const key of keys) {
      const set = this.subscriptions.get(key);
      if (set) {
        set.delete(cid);
        if (set.size === 0) this.subscriptions.delete(key);
      }
      this.metrics.subscriptionsRemoved++;
    }
    this.clientSubscriptions.delete(cid);

    this.logger.log(`Client disconnected cid=${cid}`);
  }

  // ---------------- Messaging API ----------------
  @UsePipes(new ValidationPipe({ transform: true, whitelist: false }))
  @SubscribeMessage("subscribe")
  async subscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() request: SubscribePayload,
  ) {
    try {
      if (!client.tenantId || !client.userId) {
        return client.emit("error", {
          code: "UNAUTHORIZED",
          message: "Authenticate first",
        });
      }

      if (!this.isValidSubscriptionType(request.type)) {
        return client.emit("error", {
          code: "BAD_REQUEST",
          message: "Invalid subscription type",
        });
      }

      const allowed = await this.checkSubscriptionPermission(
        client.tenantId,
        client.userId,
        request,
      );
      if (!allowed) {
        return client.emit("error", {
          code: "FORBIDDEN",
          message: "Not allowed for this resource",
        });
      }

      const key = this.generateSubscriptionKey(request, client.tenantId);

      // attach client to subscription
      if (!this.subscriptions.has(key))
        this.subscriptions.set(key, new Set<string>());
      this.subscriptions.get(key)!.add(client.cid!);

      if (!this.clientSubscriptions.has(client.cid!))
        this.clientSubscriptions.set(client.cid!, new Set());
      this.clientSubscriptions.get(client.cid!)!.add(key);

      this.metrics.subscriptionsCreated++;

      client.emit("subscribed", {
        key,
        request,
        timestamp: new Date().toISOString(),
      });

      // send initial snapshot if applicable
      await this.sendInitialData(client, request);
    } catch (error: any) {
      this.logger.error(`subscribe error: ${error?.message}`);
      client.emit("error", {
        code: "SUBSCRIBE_ERROR",
        message: "Failed to subscribe",
      });
    }
  }

  @SubscribeMessage("unsubscribe")
  async unsubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() request: UnsubscribePayload,
  ) {
    try {
      const key = this.generateSubscriptionKey(request, client.tenantId!);
      const set = this.subscriptions.get(key);
      if (set) {
        set.delete(client.cid!);
        if (set.size === 0) this.subscriptions.delete(key);
      }
      const cset = this.clientSubscriptions.get(client.cid!);
      cset?.delete(key);
      this.metrics.subscriptionsRemoved++;

      client.emit("unsubscribed", {
        key,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      this.logger.error(`unsubscribe error: ${error?.message}`);
      client.emit("error", {
        code: "UNSUBSCRIBE_ERROR",
        message: "Failed to unsubscribe",
      });
    }
  }

  @SubscribeMessage("ping")
  async ping(@ConnectedSocket() client: AuthenticatedSocket) {
    client.emit("pong", { timestamp: new Date().toISOString() });
  }

  // ---------------- Private helper methods ----------------

  private extractToken(client: Socket): string {
    const qToken = (client.handshake.query?.token as string) || "";
    const hAuth = client.handshake.headers["authorization"] as
      | string
      | undefined;
    if (qToken) return qToken;
    if (hAuth?.startsWith("Bearer ")) return hAuth.substring("Bearer ".length);
    return "";
  }

  private generateClientId(client: Socket): string {
    const base = client.id?.replace(/[^a-zA-Z0-9]/g, "") || "sock";
    return `${base}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private async validateToken(
    token: string,
  ): Promise<{ userId: string; tenantId: string } | null> {
    try {
      // Use the injected JWT service for token validation
      const decoded: any = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || "default-secret",
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

  private async verifyJWT(token: string): Promise<any> {
    // Deprecated; kept for backward compatibility
    return this.validateToken(token);
  }

  private isValidSubscriptionType(type: string): boolean {
    return [
      "workflow",
      "execution",
      "logs",
      "metrics",
      "tenant_activity",
    ].includes(type);
  }

  private generateSubscriptionKey(
    request: SubscriptionRequest,
    tenantId: string,
  ): string {
    const { type, resourceId } = request;

    switch (type) {
      case "workflow":
        return resourceId
          ? `workflow:${tenantId}:${resourceId}`
          : `workflow:${tenantId}`;
      case "execution":
        return resourceId
          ? `execution:${tenantId}:${resourceId}`
          : `execution:${tenantId}`;
      case "logs":
        return resourceId
          ? `logs:${tenantId}:${resourceId}`
          : `logs:${tenantId}`;
      case "metrics":
        return `metrics:${tenantId}`;
      case "tenant_activity":
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
      // Implement permission checking based on your authorization logic
      // For now, we'll check basic tenant membership and resource access

      switch (request.type) {
        case "workflow":
          if (request.resourceId) {
            // Check if user has access to specific workflow
            const workflow = await this.workflowService.findOne(
              request.resourceId,
              tenantId,
            );
            return workflow !== null;
          }
          return true; // Allow tenant-wide workflow subscriptions

        case "execution":
          if (request.resourceId) {
            // Check if user has access to specific execution
            const execution = await this.executionService.findOne(
              request.resourceId,
              tenantId,
            );
            return execution !== null;
          }
          return true; // Allow tenant-wide execution subscriptions

        case "logs":
        case "metrics":
        case "tenant_activity":
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
      switch (request.type) {
        case "workflow":
          if (request.resourceId) {
            const workflow = await this.workflowService.findOne(
              request.resourceId,
              client.tenantId!,
            );
            if (workflow) {
              client.emit("initial_data", {
                type: "workflow",
                data: workflow,
                timestamp: new Date().toISOString(),
              });
            }
          }
          break;

        case "execution":
          if (request.resourceId) {
            const execution = await this.executionService.findOne(
              request.resourceId,
              client.tenantId!,
            );
            if (execution) {
              client.emit("initial_data", {
                type: "execution",
                data: execution,
                timestamp: new Date().toISOString(),
              });
            }
          }
          break;

        case "metrics":
          const metrics = await this.getTenantMetrics(client.tenantId!);
          client.emit("initial_data", {
            type: "metrics",
            data: metrics,
            timestamp: new Date().toISOString(),
          });
          break;

        default:
          // No initial data for other types
          break;
      }
    } catch (error: any) {
      this.logger.error(`Send initial data error: ${error.message}`);
    }
  }

  private async broadcastToSubscribers(
    subscriptionKey: string,
    message: WebSocketMessage,
  ): Promise<void> {
    const subscribers = this.subscriptions.get(subscriptionKey);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const messageWithId = {
      ...message,
      messageId: this.generateMessageId(),
    } as WebSocketMessage;

    let successCount = 0;
    let errorCount = 0;

    await Promise.all(
      Array.from(subscribers).map(async (clientId) => {
        try {
          const client = this.connectedClients.get(clientId);
          if (client && client.connected) {
            client.emit("message", messageWithId);
            successCount++;
            this.metrics.messagesSent++;
          } else {
            // Clean up disconnected client
            subscribers.delete(clientId);
            this.clientSubscriptions.get(clientId)?.delete(subscriptionKey);
          }
        } catch (error: any) {
          this.logger.error(
            `Failed to send message to client ${clientId}: ${error.message}`,
          );
          errorCount++;
          this.metrics.errors++;
        }
      }),
    );

    if (errorCount > 0) {
      this.logger.warn(
        `Broadcast completed: ${successCount} success, ${errorCount} errors for key: ${subscriptionKey}`,
      );
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getTenantStats(tenantId: string): Promise<any> {
    try {
      const [workflows, activeExecutions, completedExecutions] =
        await Promise.all([
          this.workflowService.countByTenant(tenantId),
          this.executionService.countActiveByTenant(tenantId),
          this.executionService.countCompletedTodayByTenant(tenantId),
        ]);

      return {
        workflows,
        activeExecutions,
        completedExecutions,
        connectedClients: this.getConnectedClientsByTenant(tenantId),
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error(`Get tenant stats error: ${error.message}`);
      return {
        error: "Failed to get tenant stats",
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async getTenantMetrics(tenantId: string): Promise<any> {
    try {
      // Get real-time metrics for the tenant
      const metrics = await this.executionService.getTenantMetrics(tenantId);
      return {
        ...metrics,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error(`Get tenant metrics error: ${error.message}`);
      return {
        error: "Failed to get tenant metrics",
        timestamp: new Date().toISOString(),
      };
    }
  }

  private getConnectedClientsByTenant(tenantId: string): number {
    let count = 0;
    for (const client of this.connectedClients.values()) {
      if (client.tenantId === tenantId) {
        count++;
      }
    }
    return count;
  }

  private cleanupInactiveConnections(): void {
    let cleanedUp = 0;

    for (const [clientId, client] of this.connectedClients.entries()) {
      if (!client.connected) {
        this.handleDisconnect(client);
        cleanedUp++;
      }
    }

    if (cleanedUp > 0) {
      this.logger.log(`Cleaned up ${cleanedUp} inactive connections`);
    }
  }

  private reportMetrics(): void {
    this.logger.log(`WebSocket Metrics: ${JSON.stringify(this.metrics)}`);

    // Emit metrics to monitoring system
    this.eventEmitter.emit("websocket.metrics", {
      ...this.metrics,
      subscriptions: this.subscriptions.size,
      connectedClients: this.connectedClients.size,
      timestamp: new Date().toISOString(),
    });
  }

  // ---------------- Public broadcast methods ----------------

  public async broadcastToTenant(
    tenantId: string,
    message: any,
  ): Promise<void> {
    const subscriptionKey = `tenant_activity:${tenantId}`;
    await this.broadcastToSubscribers(subscriptionKey, {
      type: "tenant_broadcast",
      payload: message,
      timestamp: new Date().toISOString(),
      messageId: this.generateMessageId(),
    });
  }

  public async broadcastToWorkflow(
    tenantId: string,
    workflowId: string,
    message: any,
  ): Promise<void> {
    const subscriptionKey = `workflow:${tenantId}:${workflowId}`;
    await this.broadcastToSubscribers(subscriptionKey, {
      type: "workflow_broadcast",
      payload: message,
      timestamp: new Date().toISOString(),
      messageId: this.generateMessageId(),
    });
  }

  public async broadcastToExecution(
    tenantId: string,
    executionId: string,
    message: any,
  ): Promise<void> {
    const subscriptionKey = `execution:${tenantId}:${executionId}`;
    await this.broadcastToSubscribers(subscriptionKey, {
      type: "execution_broadcast",
      payload: message,
      timestamp: new Date().toISOString(),
      messageId: this.generateMessageId(),
    });
  }

  public getConnectionStats(): any {
    return {
      ...this.metrics,
      connectedClients: this.connectedClients.size,
      activeSubscriptions: this.subscriptions.size,
      subscriptionBreakdown: this.getSubscriptionBreakdown(),
    };
  }

  private getSubscriptionBreakdown(): any {
    const breakdown: Record<SubscriptionType, number> = {
      workflow: 0,
      execution: 0,
      logs: 0,
      metrics: 0,
      tenant_activity: 0,
    } as Record<SubscriptionType, number>;

    for (const key of this.subscriptions.keys()) {
      const type = key.split(":")[0] as SubscriptionType;
      if (breakdown[type] !== undefined) {
        breakdown[type]++;
      }
    }

    return breakdown;
  }

  // ---------------- Graceful shutdown ----------------
  public async shutdown(): Promise<void> {
    this.logger.log("Shutting down WebSocket gateway...");

    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.metricsTimer) clearInterval(this.metricsTimer);

    // Notify all clients of shutdown
    const shutdownMessage: WebSocketMessage = {
      type: "server_shutdown",
      payload: { message: "Server is shutting down" },
      timestamp: new Date().toISOString(),
      messageId: this.generateMessageId(),
    };

    for (const client of this.connectedClients.values()) {
      try {
        client.emit("message", shutdownMessage);
        client.disconnect();
      } catch (error) {
        // Ignore errors during shutdown
      }
    }

    this.connectedClients.clear();
    this.subscriptions.clear();
    this.clientSubscriptions.clear();

    this.logger.log("WebSocket gateway shutdown complete");
  }
}
