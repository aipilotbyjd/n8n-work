import amqp from 'amqplib';

export class MessageQueueConsumer {
  constructor(config) {
    this.logger = config.logger;
    this.nodeRegistry = config.nodeRegistry;
    this.sandboxManager = config.sandboxManager;
    this.queueUrl = config.queueUrl;
    this.concurrency = config.concurrency;
    this.connection = null;
    this.channel = null;
    this.consumerTag = null;
  }

  async start() {
    try {
      this.connection = await amqp.connect(this.queueUrl);
      this.channel = await this.connection.createChannel();
      
      await this.channel.assertQueue('node-execution-queue', {
        durable: true,
        arguments: {
          'x-max-priority': 10
        }
      });
      
      await this.channel.prefetch(this.concurrency);
      
      this.consumerTag = await this.channel.consume('node-execution-queue', 
        async (msg) => {
          if (msg) {
            await this.processMessage(msg);
          }
        }, {
          noAck: false
        }
      );
      
      this.logger.info('Message queue consumer started', {
        queueUrl: this.queueUrl,
        concurrency: this.concurrency
      });
    } catch (error) {
      this.logger.error('Failed to start message queue consumer', error);
      throw error;
    }
  }

  async processMessage(msg) {
    try {
      const data = JSON.parse(msg.content.toString());
      
      // Process the node execution request
      this.logger.info('Processing node execution', { 
        nodeType: data.nodeType,
        executionId: data.executionId 
      });
      
      // Execute node in sandbox
      const result = await this.sandboxManager.executeNode(data);
      
      // Acknowledge message
      await this.channel.ack(msg);
      
      // Send result back if needed
      if (data.replyTo) {
        await this.sendReply(data.replyTo, result);
      }
    } catch (error) {
      this.logger.error('Error processing message', error);
      
      // Reject and requeue message if not already retried too many times
      const retryCount = (msg.properties.headers['x-retry-count'] || 0) + 1;
      if (retryCount < 3) {
        await this.channel.reject(msg, true);
      } else {
        // Send to dead letter queue
        await this.channel.reject(msg, false);
      }
    }
  }

  async sendReply(replyTo, result) {
    await this.channel.sendToQueue(replyTo, Buffer.from(JSON.stringify(result)), {
      contentType: 'application/json'
    });
  }

  async stop() {
    try {
      if (this.consumerTag) {
        await this.channel.cancel(this.consumerTag.consumerTag);
      }
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      this.logger.info('Message queue consumer stopped');
    } catch (error) {
      this.logger.error('Error stopping message queue consumer', error);
      throw error;
    }
  }
}
