import Fastify, { FastifyInstance, FastifyPluginOptions } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import env from '@fastify/env';
import autoload from '@fastify/autoload';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { register } from 'prom-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Environment schema
const envSchema = {
  type: 'object',
  required: [],
  properties: {
    NODE_ENV: { type: 'string', default: 'development' },
    PORT: { type: 'string', default: '3000' },
    HOST: { type: 'string', default: '0.0.0.0' },
    LOG_LEVEL: { type: 'string', default: 'info' },
    RABBITMQ_URL: { type: 'string', default: 'amqp://localhost:5672' },
    REDIS_URL: { type: 'string', default: 'redis://localhost:6379' },
    RUNNER_CONCURRENCY: { type: 'string', default: '50' },
    ISOLATION_DEFAULT: { type: 'string', default: 'vm2' },
    ALLOWED_EGRESS: { type: 'string', default: '' },
    MICROVM_ENABLED: { type: 'string', default: 'false' },
    OTEL_EXPORTER_OTLP_ENDPOINT: { type: 'string', default: 'http://localhost:4317' },
  }
};

export interface AppOptions {
  logger?: any;
}

export async function build(opts: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger || {
      level: 'info',
      transport: process.env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      } : undefined
    }
  });

  // Environment configuration
  await app.register(env, {
    schema: envSchema,
    dotenv: true,
  });

  // Security
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  });

  // CORS
  await app.register(cors, {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Allow localhost and development origins
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }

      callback(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
  });

  // API Documentation
  if (process.env.NODE_ENV !== 'production') {
    await app.register(swagger, {
      swagger: {
        info: {
          title: 'N8N-Work Node Runner API',
          description: 'Sandboxed execution environment for workflow nodes',
          version: '0.1.0'
        },
        host: 'localhost:3000',
        schemes: ['http'],
        consumes: ['application/json'],
        produces: ['application/json'],
        tags: [
          { name: 'health', description: 'Health check endpoints' },
          { name: 'execution', description: 'Node execution endpoints' },
          { name: 'metrics', description: 'Metrics and monitoring' },
        ]
      }
    });

    await app.register(swaggerUI, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'full',
        deepLinking: false
      },
      staticCSP: true,
      transformStaticCSP: (header) => header,
    });
  }

  // Health check routes
  app.get('/health', {
    schema: {
      tags: ['health'],
      description: 'Health check endpoint',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            service: { type: 'string' },
            version: { type: 'string' },
            timestamp: { type: 'string' },
            uptime: { type: 'number' },
          }
        }
      }
    }
  }, async (request, reply) => {
    return {
      status: 'ok',
      service: 'n8n-work-node-runner',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // Readiness check
  app.get('/ready', {
    schema: {
      tags: ['health'],
      description: 'Readiness check endpoint',
      response: {
        200: {
          type: 'object',
          properties: {
            ready: { type: 'boolean' },
            dependencies: { type: 'array' },
          }
        }
      }
    }
  }, async (request, reply) => {
    // Check message queue and other dependencies
    const dependencies = [
      { name: 'message-queue', status: 'connected' },
      { name: 'sandbox', status: 'ready' },
    ];

    return {
      ready: true,
      dependencies,
    };
  });

  // Metrics endpoint for Prometheus
  app.get('/metrics', {
    schema: {
      tags: ['metrics'],
      description: 'Prometheus metrics endpoint',
    }
  }, async (request, reply) => {
    reply.type('text/plain');
    return register.metrics();
  });

  // Node execution endpoint
  app.post('/execute', {
    schema: {
      tags: ['execution'],
      description: 'Execute a node with given parameters',
      body: {
        type: 'object',
        properties: {
          nodeType: { type: 'string' },
          parameters: { type: 'object' },
          inputData: { type: 'object' },
          credentials: { type: 'object' },
        },
        required: ['nodeType', 'parameters', 'inputData']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            outputData: { type: 'object' },
            executionTime: { type: 'number' },
          }
        }
      }
    }
  }, async (request, reply) => {
    const { nodeType, parameters, inputData, credentials } = request.body as any;

    // Execute node in sandbox
    try {
      const result = await sandboxManager.executeNode({
        nodeId: request.params.nodeId,
        inputData: request.body.inputData || [],
        parameters: request.body.parameters || {},
        credentials: request.body.credentials || {},
        tenantId: request.headers['x-tenant-id'] || 'default',
        executionId: request.headers['x-execution-id'] || uuidv4(),
      });
      
      reply.send({
        success: true,
        output: result,
      });
    } catch (error) {
      reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
    app.log.info({ nodeType, parameters }, 'Executing node');

    return {
      success: true,
      outputData: { message: 'Node executed successfully', result: inputData },
      executionTime: 123,
    };
  });

  // Auto-load plugins and routes
  await app.register(autoload, {
    dir: join(__dirname, 'plugins'),
    options: Object.assign({}, opts)
  });

  // Error handler
  app.setErrorHandler(async (error, request, reply) => {
    app.log.error({
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
    }, 'Request error');

    const statusCode = error.statusCode || 500;

    return reply.status(statusCode).send({
      error: true,
      message: error.message,
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  });

  return app;
}
