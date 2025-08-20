import { Logger } from 'pino';
import amqp, { Connection, Channel, Message } from 'amqplib';
import { NodeRegistry } from './node-registry.js';
import { SandboxManager } from '../sandbox/sandbox-manager.js';

export interface MessageQueueConfig {
  logger: Logger;
  nodeRegistry: NodeRegistry;
  sandboxManager: SandboxManager;
  queueUrl: string;
  concurrency: number;
  prefetchCount?: number;
  retryDelay?: number;
  maxRetries?: number;
}

export interface StepExecutionMessage {
  tenantId: string;
  runId: string;
  stepId: string;
  nodeType: string;
  parameters: Record<string, any>;
  inputData: any[];
  credentials?: Record<string, any>;
  timeout?: number;
  attempt?: number;
  maxAttempts?: number;
}

export interface StepExecutionResult {
  tenantId: string;
  runId: string;
  stepId: string;
  success: boolean;
  outputData?: any[];
  error?: string;
  logs?: string[];
  executionTime: number;
  metrics?: Record<string, number>;
}

export class MessageQueueConsumer {
  private config: MessageQueueConfig;
  private logger: Logger;
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private isRunning = false;
  private activeJobs = new Set<string>();

  constructor(config: MessageQueueConfig) {
    this.config = config;
    this.logger = config.logger;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Message queue consumer is already running');
      return;
    }

    try {
      this.logger.info({ queueUrl: this.config.queueUrl }, 'Connecting to message queue...');
      
      // Connect to RabbitMQ
      this.connection = await amqp.connect(this.config.queueUrl);
      this.channel = await this.connection.createChannel();

      // Set prefetch count for fair distribution
      await this.channel.prefetch(this.config.prefetchCount || 1);

      // Declare exchanges and queues
      await this.setupQueues();

      // Start consuming messages
      await this.startConsuming();

      this.isRunning = true;
      this.logger.info('Message queue consumer started successfully');

      // Handle connection errors
      this.connection.on('error', (error) => {
        this.logger.error({ error: error.message }, 'Connection error');
        this.handleConnectionError();
      });

      this.connection.on('close', () => {
        this.logger.warn('Connection closed');
        if (this.isRunning) {
          this.handleConnectionError();
        }
      });

    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to start message queue consumer');
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping message queue consumer...');
    this.isRunning = false;

    // Wait for active jobs to complete (with timeout)
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.activeJobs.size > 0 && Date.now() - startTime < timeout) {
      this.logger.info({ activeJobs: this.activeJobs.size }, 'Waiting for active jobs to complete...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.activeJobs.size > 0) {
      this.logger.warn({ activeJobs: this.activeJobs.size }, 'Forcing shutdown with active jobs');
    }

    // Close connections
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
    } catch (error) {
      this.logger.error({ error: error.message }, 'Error closing connections');
    }

    this.logger.info('Message queue consumer stopped');
  }

  private async setupQueues(): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    // Declare exchanges
    await this.channel.assertExchange('execution.step', 'direct', { durable: true });
    await this.channel.assertExchange('execution.result', 'direct', { durable: true });

    // Declare queues
    const stepQueue = 'step.execution.node-runner';
    await this.channel.assertQueue(stepQueue, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'execution.step.dlq',
      },
    });

    // Bind queue to exchange
    await this.channel.bindQueue(stepQueue, 'execution.step', 'step');

    // Declare dead letter queue
    await this.channel.assertExchange('execution.step.dlq', 'direct', { durable: true });
    await this.channel.assertQueue('step.execution.dlq', { durable: true });
    await this.channel.bindQueue('step.execution.dlq', 'execution.step.dlq', 'step');
  }

  private async startConsuming(): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    const stepQueue = 'step.execution.node-runner';
    
    await this.channel.consume(stepQueue, async (message) => {
      if (!message) {
        return;
      }

      const jobId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      this.activeJobs.add(jobId);

      try {
        await this.processStepExecution(message, jobId);
        this.channel?.ack(message);
      } catch (error) {
        this.logger.error({ 
          error: error.message, 
          jobId,
          messageId: message.properties.messageId 
        }, 'Failed to process message');
        
        // Decide whether to retry or reject
        const retryCount = (message.properties.headers?.['x-retry-count'] || 0) + 1;
        const maxRetries = this.config.maxRetries || 3;

        if (retryCount <= maxRetries) {
          // Retry with delay
          setTimeout(() => {
            if (this.channel && !message.properties.redelivered) {
              this.channel.publish(
                'execution.step',
                'step',
                message.content,
                {
                  ...message.properties,
                  headers: {
                    ...message.properties.headers,
                    'x-retry-count': retryCount,
                  },
                }
              );
            }
          }, (this.config.retryDelay || 5000) * retryCount);
        }

        this.channel?.nack(message, false, retryCount <= maxRetries);
      } finally {
        this.activeJobs.delete(jobId);
      }
    });
  }

  private async processStepExecution(message: Message, jobId: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Parse message
      const stepMessage: StepExecutionMessage = JSON.parse(message.content.toString());
      
      this.logger.info({
        jobId,
        tenantId: stepMessage.tenantId,
        runId: stepMessage.runId,
        stepId: stepMessage.stepId,
        nodeType: stepMessage.nodeType,
      }, 'Processing step execution');

      // Get node definition
      const nodeDefinition = this.config.nodeRegistry.getNode(stepMessage.nodeType);
      if (!nodeDefinition) {
        throw new Error(`Unknown node type: ${stepMessage.nodeType}`);
      }

      // Execute node in sandbox
      const result = await this.config.sandboxManager.executeNode({
        nodeType: stepMessage.nodeType,
        parameters: stepMessage.parameters,
        inputData: stepMessage.inputData,
        credentials: stepMessage.credentials,
        timeout: stepMessage.timeout,
      });

      // Prepare result message
      const resultMessage: StepExecutionResult = {
        tenantId: stepMessage.tenantId,
        runId: stepMessage.runId,
        stepId: stepMessage.stepId,
        success: result.success,
        outputData: result.outputData,
        error: result.error,
        logs: result.logs,
        executionTime: result.executionTime,
        metrics: result.metrics,
      };

      // Publish result
      await this.publishResult(resultMessage);

      this.logger.info({
        jobId,
        success: result.success,
        executionTime: result.executionTime,
      }, 'Step execution completed');

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error({
        jobId,
        error: error.message,
        executionTime,
      }, 'Step execution failed');
      throw error;
    }
  }

  private async publishResult(result: StepExecutionResult): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    const messageBuffer = Buffer.from(JSON.stringify(result));
    
    await this.channel.publish(
      'execution.result',
      'result',
      messageBuffer,
      {
        persistent: true,
        messageId: `${result.runId}-${result.stepId}-${Date.now()}`,
        timestamp: Date.now(),
        headers: {
          tenantId: result.tenantId,
          runId: result.runId,
          stepId: result.stepId,
        },
      }
    );
  }

  private async handleConnectionError(): Promise<void> {
    this.isRunning = false;
    
    // Try to reconnect with exponential backoff
    let retryCount = 0;
    const maxRetries = 5;
    const baseDelay = 1000;

    while (retryCount < maxRetries) {
      try {
        const delay = baseDelay * Math.pow(2, retryCount);
        this.logger.info({ retryCount, delay }, 'Attempting to reconnect...');
        
        await new Promise(resolve => setTimeout(resolve, delay));
        await this.start();
        
        this.logger.info('Reconnected successfully');
        return;
      } catch (error) {
        retryCount++;
        this.logger.error({ 
          error: error.message, 
          retryCount, 
          maxRetries 
        }, 'Reconnection attempt failed');
      }
    }

    this.logger.error('Failed to reconnect after maximum retries. Exiting...');
    process.exit(1);
  }

  isConnected(): boolean {
    return this.isRunning && !!this.connection && !this.connection.connection.destroyed;
  }

  getActiveJobCount(): number {
    return this.activeJobs.size;
  }
}
