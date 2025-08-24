// Continue the WorkflowWebSocketGateway class with private helper methods

  // Private helper methods

  private async validateToken(token: string): Promise<{ userId: string; tenantId: string } | null> {
    try {
      // This should integrate with your actual JWT validation service
      // For now, we'll use a placeholder implementation
      const decoded = await this.verifyJWT(token);
      
      if (!decoded || !decoded.sub || !decoded.tenantId) {
        return null;
      }

      return {
        userId: decoded.sub,
        tenantId: decoded.tenantId,
      };
    } catch (error) {
      this.logger.error(`Token validation error: ${error.message}`);
      return null;
    }
  }

  private async verifyJWT(token: string): Promise<any> {
    // Placeholder - implement actual JWT verification
    // This should use your JWT service or library
    try {
      // Mock implementation
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      
      // Check expiration
      if (payload.exp && payload.exp < Date.now() / 1000) {
        throw new Error('Token expired');
      }

      return payload;
    } catch (error) {
      throw new Error('Invalid token');
    }
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
      // Implement permission checking based on your authorization logic
      // For now, we'll check basic tenant membership and resource access
      
      switch (request.type) {
        case 'workflow':
          if (request.resourceId) {
            // Check if user has access to specific workflow
            const workflow = await this.workflowService.findOne(request.resourceId, tenantId);
            return workflow !== null;
          }
          return true; // Allow tenant-wide workflow subscriptions

        case 'execution':
          if (request.resourceId) {
            // Check if user has access to specific execution
            const execution = await this.executionService.findOne(request.resourceId, tenantId);
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
    } catch (error) {
      this.logger.error(`Permission check error: ${error.message}`);
      return false;
    }
  }

  private async sendInitialData(client: AuthenticatedSocket, request: SubscriptionRequest): Promise<void> {
    try {
      switch (request.type) {
        case 'workflow':
          if (request.resourceId) {
            const workflow = await this.workflowService.findOne(request.resourceId, client.tenantId);
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
            const execution = await this.executionService.findOne(request.resourceId, client.tenantId);
            if (execution) {
              client.emit('initial_data', {
                type: 'execution',
                data: execution,
                timestamp: new Date().toISOString(),
              });
            }
          }
          break;

        case 'metrics':
          const metrics = await this.getTenantMetrics(client.tenantId);
          client.emit('initial_data', {
            type: 'metrics',
            data: metrics,
            timestamp: new Date().toISOString(),
          });
          break;

        default:
          // No initial data for other types
          break;
      }
    } catch (error) {
      this.logger.error(`Send initial data error: ${error.message}`);
    }
  }

  private async broadcastToSubscribers(subscriptionKey: string, message: WebSocketMessage): Promise<void> {
    const subscribers = this.subscriptions.get(subscriptionKey);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const messageWithId = {
      ...message,
      messageId: this.generateMessageId(),
    };

    let successCount = 0;
    let errorCount = 0;

    await Promise.all(
      Array.from(subscribers).map(async (clientId) => {
        try {
          const client = this.connectedClients.get(clientId);
          if (client && client.connected) {
            client.emit('message', messageWithId);
            successCount++;
            this.metrics.messagesSent++;
          } else {
            // Clean up disconnected client
            subscribers.delete(clientId);
            this.clientSubscriptions.get(clientId)?.delete(subscriptionKey);
          }
        } catch (error) {
          this.logger.error(`Failed to send message to client ${clientId}: ${error.message}`);
          errorCount++;
          this.metrics.errors++;
        }
      })
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
      const [workflows, activeExecutions, completedExecutions] = await Promise.all([
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
    } catch (error) {
      this.logger.error(`Get tenant stats error: ${error.message}`);
      return {
        error: 'Failed to get tenant stats',
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
    } catch (error) {
      this.logger.error(`Get tenant metrics error: ${error.message}`);
      return {
        error: 'Failed to get tenant metrics',
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
    this.eventEmitter.emit('websocket.metrics', {
      ...this.metrics,
      subscriptions: this.subscriptions.size,
      connectedClients: this.connectedClients.size,
      timestamp: new Date().toISOString(),
    });
  }

  // Public methods for external services to use

  public async broadcastToTenant(tenantId: string, message: any): Promise<void> {
    const subscriptionKey = `tenant_activity:${tenantId}`;
    await this.broadcastToSubscribers(subscriptionKey, {
      type: 'tenant_broadcast',
      payload: message,
      timestamp: new Date().toISOString(),
      messageId: this.generateMessageId(),
    });
  }

  public async broadcastToWorkflow(tenantId: string, workflowId: string, message: any): Promise<void> {
    const subscriptionKey = `workflow:${tenantId}:${workflowId}`;
    await this.broadcastToSubscribers(subscriptionKey, {
      type: 'workflow_broadcast',
      payload: message,
      timestamp: new Date().toISOString(),
      messageId: this.generateMessageId(),
    });
  }

  public async broadcastToExecution(tenantId: string, executionId: string, message: any): Promise<void> {
    const subscriptionKey = `execution:${tenantId}:${executionId}`;
    await this.broadcastToSubscribers(subscriptionKey, {
      type: 'execution_broadcast',
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
    const breakdown = {
      workflow: 0,
      execution: 0,
      logs: 0,
      metrics: 0,
      tenant_activity: 0,
    };

    for (const key of this.subscriptions.keys()) {
      const type = key.split(':')[0];
      if (breakdown[type] !== undefined) {
        breakdown[type]++;
      }
    }

    return breakdown;
  }

  // Graceful shutdown
  public async shutdown(): Promise<void> {
    this.logger.log('Shutting down WebSocket gateway...');
    
    // Notify all clients of shutdown
    const shutdownMessage = {
      type: 'server_shutdown',
      payload: { message: 'Server is shutting down' },
      timestamp: new Date().toISOString(),
      messageId: this.generateMessageId(),
    };

    for (const client of this.connectedClients.values()) {
      try {
        client.emit('message', shutdownMessage);
        client.disconnect();
      } catch (error) {
        // Ignore errors during shutdown
      }
    }

    this.connectedClients.clear();
    this.subscriptions.clear();
    this.clientSubscriptions.clear();
    
    this.logger.log('WebSocket gateway shutdown complete');
  }
}