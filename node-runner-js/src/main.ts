import { build } from './app.js';
import { initializeTracing, gracefulShutdown } from './telemetry/tracing.js';
import { MessageQueueConsumer } from './runtime/message-queue.js';
import { NodeRegistry } from './runtime/node-registry.js';
import { SandboxManager } from './sandbox/sandbox-manager.js';

const serviceName = 'n8n-work-node-runner';
const serviceVersion = '0.1.0';

async function main() {
  // Initialize OpenTelemetry
  const telemetryShutdown = await initializeTracing(serviceName, serviceVersion);

  const app = await build({ 
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      prettyPrint: process.env.NODE_ENV === 'development',
    }
  });

  try {
    // Initialize core components
    const nodeRegistry = new NodeRegistry(app.log);
    const sandboxManager = new SandboxManager(app.log, {
      defaultIsolation: process.env.ISOLATION_DEFAULT || 'vm2',
      allowedEgress: (process.env.ALLOWED_EGRESS || '').split(',').filter(Boolean),
      enableMicroVM: process.env.MICROVM_ENABLED === 'true',
    });

    // Initialize message queue consumer
    const messageConsumer = new MessageQueueConsumer({
      logger: app.log,
      nodeRegistry,
      sandboxManager,
      queueUrl: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
      concurrency: parseInt(process.env.RUNNER_CONCURRENCY || '50', 10),
    });

    // Register built-in nodes
    await nodeRegistry.loadBuiltInNodes();

    // Start message queue consumer
    await messageConsumer.start();

    // Start HTTP server
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });

    app.log.info({
      service: serviceName,
      version: serviceVersion,
      port,
      host,
      environment: process.env.NODE_ENV || 'development',
    }, '🚀 N8N-Work Node Runner started');

    // Setup graceful shutdown
    const shutdown = async () => {
      app.log.info('Shutting down gracefully...');
      
      try {
        // Stop message consumer
        await messageConsumer.stop();
        
        // Close HTTP server
        await app.close();
        
        // Shutdown telemetry
        await telemetryShutdown();
        
        app.log.info('Shutdown complete');
        process.exit(0);
      } catch (error) {
        app.log.error(error, 'Error during shutdown');
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // Handle unhandled errors
    process.on('uncaughtException', (error) => {
      app.log.fatal(error, 'Uncaught exception');
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      app.log.fatal({ reason, promise }, 'Unhandled rejection');
      process.exit(1);
    });

  } catch (error) {
    app.log.fatal(error, 'Failed to start application');
    await gracefulShutdown();
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal startup error:', error);
  process.exit(1);
});
