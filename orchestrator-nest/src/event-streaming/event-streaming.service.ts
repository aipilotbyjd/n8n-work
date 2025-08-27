import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RedisService } from '../redis/redis.service';
import { WebSocketService } from '../websocket/websocket.service';
import { GrpcClientService } from '../grpc/grpc-client.service';
import { QueueService } from '../queue/queue.service';

interface EventStreamConfig {
  redis: {
    streamKey: string;
    consumerGroup: string;
    consumerId: string;
    maxLength: number;
    blockTime: number;
  };
  processing: {
    batchSize: number;
    concurrency: number;
    retryAttempts: number;
    retryDelay: number;
  };
  sync: {
    stateCheckInterval: number;
    conflictResolution: 'last_write_wins' | 'merge' | 'manual';
    enableVersioning: boolean;
  };
}

interface WorkflowState {
  workflowId: string;
  tenantId: string;
  version: number;
  status: string;
  lastModified: string;
  modifiedBy: string;
  checksum: string;
  nodes: any[];
  edges: any[];
  variables: Record<string, any>;
  metadata: Record<string, any>;
}

interface ExecutionState {
  executionId: string;
  workflowId: string;
  tenantId: string;
  status: string;
  progress: {
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    runningSteps: number;
  };
  currentStep?: string;
  startedAt: string;
  completedAt?: string;
  lastHeartbeat: string;
  variables: Record<string, any>;
  stepStates: Record<string, any>;
}

interface StreamEvent {
  id: string;
  type: string;
  source: string;
  tenantId: string;
  resourceId: string;
  payload: any;
  timestamp: string;
  version: number;
  correlationId?: string;
  causationId?: string;
}

@Injectable()
export class EventStreamingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventStreamingService.name);
  private readonly config: EventStreamConfig;
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout;
  private syncInterval: NodeJS.Timeout;
  private readonly workflowStates = new Map<string, WorkflowState>();
  private readonly executionStates = new Map<string, ExecutionState>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly redisService: RedisService,
    private readonly webSocketService: WebSocketService,
    private readonly grpcClientService: GrpcClientService,
    private readonly queueService: QueueService,
  ) {
    this.config = {
      redis: {
        streamKey: 'n8n-work:events',
        consumerGroup: 'orchestrator',
        consumerId: `orchestrator-${process.env.HOSTNAME || 'local'}-${Date.now()}`,
        maxLength: 10000,
        blockTime: 5000,
      },
      processing: {
        batchSize: 10,
        concurrency: 5,
        retryAttempts: 3,
        retryDelay: 1000,
      },
      sync: {
        stateCheckInterval: 30000, // 30 seconds
        conflictResolution: 'last_write_wins',
        enableVersioning: true,
      },
    };
  }

  async onModuleInit() {
    try {
      await this.initializeRedisStreams();
      await this.startEventProcessing();
      await this.startStateSynchronization();
      this.setupEventListeners();
      
      this.logger.log('Event streaming service initialized');
    } catch (error) {
      this.logger.error(`Failed to initialize event streaming: ${error.message}`, error.stack);
      throw error;
    }
  }

  async onModuleDestroy() {
    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.logger.log('Event streaming service destroyed');
  }

  /**
   * Publish an event to the stream
   */
  async publishEvent(event: Omit<StreamEvent, 'id' | 'timestamp' | 'version'>): Promise<string> {
    try {
      const fullEvent: StreamEvent = {
        ...event,
        id: this.generateEventId(),
        timestamp: new Date().toISOString(),
        version: 1,
      };

      // Add to Redis stream
      const eventId = await this.redisService.xAdd(
        this.config.redis.streamKey,
        '*',
        'event',
        JSON.stringify(fullEvent),
        {
          maxLength: this.config.redis.maxLength,
          approximateMaxLength: true,
        }
      );

      this.logger.debug(`Event published: ${eventId}`, { event: fullEvent });

      // Emit locally for immediate processing
      this.eventEmitter.emit('stream.event', fullEvent);

      return eventId;
    } catch (error) {
      this.logger.error(`Failed to publish event: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update workflow state
   */
  async updateWorkflowState(workflowState: Partial<WorkflowState>): Promise<void> {
    try {
      const key = `workflow:${workflowState.tenantId}:${workflowState.workflowId}`;
      const currentState = this.workflowStates.get(key);
      
      const newState: WorkflowState = {
        ...currentState,
        ...workflowState,
        version: (currentState?.version || 0) + 1,
        lastModified: new Date().toISOString(),
        checksum: this.calculateChecksum(workflowState),
      };

      // Store in memory
      this.workflowStates.set(key, newState);

      // Store in Redis for persistence and cross-instance sync
      await this.redisService.setWithExpiry(
        `state:${key}`,
        JSON.stringify(newState),
        3600, // 1 hour TTL
      );

      // Publish state change event
      await this.publishEvent({
        type: 'workflow.state.updated',
        source: 'orchestrator',
        tenantId: newState.tenantId,
        resourceId: newState.workflowId,
        payload: {
          workflowId: newState.workflowId,
          version: newState.version,
          status: newState.status,
          checksum: newState.checksum,
          changes: this.calculateStateChanges(currentState, newState),
        },
      });

      this.logger.debug(`Workflow state updated: ${key}`, { version: newState.version });
    } catch (error) {
      this.logger.error(`Failed to update workflow state: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update execution state
   */
  async updateExecutionState(executionState: Partial<ExecutionState>): Promise<void> {
    try {
      const key = `execution:${executionState.tenantId}:${executionState.executionId}`;
      const currentState = this.executionStates.get(key);
      
      const newState: ExecutionState = {
        ...currentState,
        ...executionState,
        lastHeartbeat: new Date().toISOString(),
      };

      // Store in memory
      this.executionStates.set(key, newState);

      // Store in Redis with shorter TTL for active executions
      await this.redisService.setWithExpiry(
        `state:${key}`,
        JSON.stringify(newState),
        1800, // 30 minutes TTL
      );

      // Publish state change event
      await this.publishEvent({
        type: 'execution.state.updated',
        source: 'orchestrator',
        tenantId: newState.tenantId,
        resourceId: newState.executionId,
        payload: {
          executionId: newState.executionId,
          workflowId: newState.workflowId,
          status: newState.status,
          progress: newState.progress,
          currentStep: newState.currentStep,
          changes: this.calculateStateChanges(currentState, newState),
        },
      });

      // Send real-time updates via WebSocket
      await this.webSocketService.notifyExecutionEvent(
        newState.tenantId,
        newState.executionId,
        newState.workflowId,
        'state_updated',
        {
          status: newState.status,
          progress: newState.progress,
          currentStep: newState.currentStep,
        },
      );

      this.logger.debug(`Execution state updated: ${key}`, { status: newState.status });
    } catch (error) {
      this.logger.error(`Failed to update execution state: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get workflow state
   */
  async getWorkflowState(tenantId: string, workflowId: string): Promise<WorkflowState | null> {
    const key = `workflow:${tenantId}:${workflowId}`;
    
    // Try memory first
    let state = this.workflowStates.get(key);
    
    if (!state) {
      // Try Redis
      const redisData = await this.redisService.get(`state:${key}`);
      if (redisData) {
        state = JSON.parse(redisData);
        this.workflowStates.set(key, state);
      }
    }

    return state || null;
  }

  /**
   * Get execution state
   */
  async getExecutionState(tenantId: string, executionId: string): Promise<ExecutionState | null> {
    const key = `execution:${tenantId}:${executionId}`;
    
    // Try memory first
    let state = this.executionStates.get(key);
    
    if (!state) {
      // Try Redis
      const redisData = await this.redisService.get(`state:${key}`);
      if (redisData) {
        state = JSON.parse(redisData);
        this.executionStates.set(key, state);
      }
    }

    return state || null;
  }

  /**
   * Synchronize state across instances
   */
  async synchronizeStates(): Promise<void> {
    try {
      // Get all state keys from Redis
      const stateKeys = await this.redisService.keys('state:*');
      
      for (const key of stateKeys) {
        try {
          const redisData = await this.redisService.get(key);
          if (!redisData) continue;

          const state = JSON.parse(redisData);
          const localKey = key.replace('state:', '');

          if (key.startsWith('state:workflow:')) {
            const localState = this.workflowStates.get(localKey);
            if (!localState || localState.version < state.version) {
              this.workflowStates.set(localKey, state);
              
              // Emit sync event
              this.eventEmitter.emit('workflow.state.synced', {
                workflowId: state.workflowId,
                tenantId: state.tenantId,
                version: state.version,
              });
            }
          } else if (key.startsWith('state:execution:')) {
            const localState = this.executionStates.get(localKey);
            if (!localState || new Date(localState.lastHeartbeat) < new Date(state.lastHeartbeat)) {
              this.executionStates.set(localKey, state);
              
              // Emit sync event
              this.eventEmitter.emit('execution.state.synced', {
                executionId: state.executionId,
                tenantId: state.tenantId,
                status: state.status,
              });
            }
          }
        } catch (error) {
          this.logger.error(`Failed to sync state ${key}: ${error.message}`);
        }
      }

      this.logger.debug(`Synchronized ${stateKeys.length} states`);
    } catch (error) {
      this.logger.error(`State synchronization failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Process events from the stream
   */
  private async processEvents(): Promise<void> {
    if (!this.isProcessing) return;

    try {
      // Read events from Redis stream
      const results = await this.redisService.xReadGroup(
        this.config.redis.consumerGroup,
        this.config.redis.consumerId,
        [this.config.redis.streamKey, '>'],
        {
          count: this.config.processing.batchSize,
          block: this.config.redis.blockTime,
        }
      );

      if (!results || results.length === 0) return;

      const events = results[0]?.messages || [];
      
      // Process events in batches
      const chunks = this.chunkArray(events, this.config.processing.concurrency);
      
      for (const chunk of chunks) {
        await Promise.all(
          chunk.map(event => this.processEvent(event))
        );
      }

      // Acknowledge processed events
      if (events.length > 0) {
        const eventIds = events.map(e => e.id);
        await this.redisService.xAck(
          this.config.redis.streamKey,
          this.config.redis.consumerGroup,
          ...eventIds
        );
      }

    } catch (error) {
      this.logger.error(`Event processing error: ${error.message}`, error.stack);
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(eventMessage: any): Promise<void> {
    try {
      const eventData = JSON.parse(eventMessage.message.event);
      const event: StreamEvent = eventData;

      this.logger.debug(`Processing event: ${event.type}`, { eventId: event.id });

      // Route event based on type
      switch (event.type) {
        case 'workflow.state.updated':
          await this.handleWorkflowStateUpdated(event);
          break;
        case 'execution.state.updated':
          await this.handleExecutionStateUpdated(event);
          break;
        case 'execution.started':
          await this.handleExecutionStarted(event);
          break;
        case 'execution.completed':
          await this.handleExecutionCompleted(event);
          break;
        case 'step.started':
          await this.handleStepStarted(event);
          break;
        case 'step.completed':
          await this.handleStepCompleted(event);
          break;
        default:
          this.logger.debug(`Unhandled event type: ${event.type}`);
      }

      // Emit to local event bus
      this.eventEmitter.emit(`stream.${event.type}`, event);

    } catch (error) {
      this.logger.error(`Failed to process event: ${error.message}`, error.stack);
    }
  }

  // Event handlers continue...
  
  private async initializeRedisStreams(): Promise<void> {
    try {
      // Create consumer group if it doesn't exist
      try {
        await this.redisService.xGroupCreate(
          this.config.redis.streamKey,
          this.config.redis.consumerGroup,
          '0',
          { mkstream: true }
        );
      } catch (error) {
        // Group might already exist
        if (!error.message.includes('BUSYGROUP')) {
          throw error;
        }
      }

      this.logger.log('Redis streams initialized');
    } catch (error) {
      this.logger.error(`Failed to initialize Redis streams: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async startEventProcessing(): Promise<void> {
    this.isProcessing = true;
    
    // Start processing loop
    this.processingInterval = setInterval(() => {
      this.processEvents().catch(error => {
        this.logger.error(`Event processing loop error: ${error.message}`);
      });
    }, 1000);

    this.logger.log('Event processing started');
  }

  private async startStateSynchronization(): Promise<void> {
    // Start state sync loop
    this.syncInterval = setInterval(() => {
      this.synchronizeStates().catch(error => {
        this.logger.error(`State synchronization loop error: ${error.message}`);
      });
    }, this.config.sync.stateCheckInterval);

    this.logger.log('State synchronization started');
  }

  private setupEventListeners(): void {
    // Listen for local events and publish them to the stream
    this.eventEmitter.on('workflow.created', (payload) => {
      this.publishEvent({
        type: 'workflow.created',
        source: 'orchestrator',
        tenantId: payload.tenantId,
        resourceId: payload.workflowId,
        payload,
      });
    });

    // Add more event listeners as needed...
    
    this.logger.log('Event listeners configured');
  }

  // Utility methods
  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateChecksum(data: any): string {
    return require('crypto')
      .createHash('md5')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  private calculateStateChanges(oldState: any, newState: any): any {
    // Simple implementation - could be enhanced with deep diff
    const changes = {};
    
    for (const key in newState) {
      if (oldState?.[key] !== newState[key]) {
        changes[key] = {
          from: oldState?.[key],
          to: newState[key],
        };
      }
    }
    
    return changes;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Event handler implementations would continue here...
  private async handleWorkflowStateUpdated(event: StreamEvent): Promise<void> {
    // Handle workflow state updates from other instances
    const { workflowId, tenantId } = event.payload;
    const localState = await this.getWorkflowState(tenantId, workflowId);
    
    // Trigger WebSocket updates if needed
    await this.webSocketService.notifyWorkflowEvent(
      tenantId,
      workflowId,
      'state_updated',
      event.payload
    );
  }

  private async handleExecutionStateUpdated(event: StreamEvent): Promise<void> {
    // Handle execution state updates from other instances
    const { executionId, tenantId, workflowId } = event.payload;
    
    // Trigger WebSocket updates
    await this.webSocketService.notifyExecutionEvent(
      tenantId,
      executionId,
      workflowId,
      'state_updated',
      event.payload
    );
  }

  private async handleExecutionStarted(event: StreamEvent): Promise<void> {
    if (process.env.EXECUTION_ENGINE === 'nest') {
      this.nestEngineService.execute(event.payload);
    } else {
      // TODO: Implement Go engine execution
    }

    // Initialize execution state
    await this.updateExecutionState({
      executionId: event.payload.executionId,
      workflowId: event.payload.workflowId,
      tenantId: event.tenantId,
      status: 'running',
      progress: {
        totalSteps: event.payload.totalSteps || 0,
        completedSteps: 0,
        failedSteps: 0,
        runningSteps: 0,
      },
      startedAt: event.timestamp,
      variables: event.payload.variables || {},
      stepStates: {},
    });
  }

  private async handleExecutionCompleted(event: StreamEvent): Promise<void> {
    // Update execution state to completed
    await this.updateExecutionState({
      executionId: event.payload.executionId,
      tenantId: event.tenantId,
      status: event.payload.status,
      completedAt: event.timestamp,
    });
  }

  private async handleStepStarted(event: StreamEvent): Promise<void> {
    // Update execution state with step progress
    const state = await this.getExecutionState(event.tenantId, event.payload.executionId);
    if (state) {
      state.progress.runningSteps++;
      state.currentStep = event.payload.stepId;
      state.stepStates[event.payload.stepId] = {
        status: 'running',
        startedAt: event.timestamp,
      };
      
      await this.updateExecutionState(state);
    }
  }

  private async handleStepCompleted(event: StreamEvent): Promise<void> {
    // Update execution state with step completion
    const state = await this.getExecutionState(event.tenantId, event.payload.executionId);
    if (state) {
      state.progress.runningSteps--;
      
      if (event.payload.status === 'success') {
        state.progress.completedSteps++;
      } else {
        state.progress.failedSteps++;
      }
      
      state.stepStates[event.payload.stepId] = {
        status: event.payload.status,
        startedAt: state.stepStates[event.payload.stepId]?.startedAt,
        completedAt: event.timestamp,
        output: event.payload.output,
        error: event.payload.error,
      };
      
      await this.updateExecutionState(state);
    }
  }
}