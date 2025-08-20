export const configuration = () => ({
  // Application
  app: {
    name: process.env.APP_NAME || 'n8n-work-orchestrator',
    version: process.env.APP_VERSION || '0.1.0',
    environment: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3000,
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },

  // Database
  database: {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME || 'n8nwork',
    password: process.env.DB_PASSWORD || 'n8nwork_dev',
    database: process.env.DB_DATABASE || 'n8nwork',
    ssl: process.env.DB_SSL === 'true',
    synchronize: process.env.DB_SYNCHRONIZE === 'true' || false,
    logging: process.env.DB_LOGGING === 'true' || false,
    migrationsRun: process.env.DB_MIGRATIONS_RUN === 'true' || true,
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'n8nwork:',
  },

  // Message Queue (RabbitMQ)
  messageQueue: {
    url: process.env.RABBITMQ_URL || 'amqp://n8nwork:n8nwork_dev@localhost:5672',
    exchanges: {
      workflow: process.env.MQ_WORKFLOW_EXCHANGE || 'workflow.execute',
      execution: process.env.MQ_EXECUTION_EXCHANGE || 'execution.step',
      events: process.env.MQ_EVENTS_EXCHANGE || 'run.event',
    },
    queues: {
      workflowExecution: process.env.MQ_WORKFLOW_QUEUE || 'workflow.execution',
      stepExecution: process.env.MQ_STEP_QUEUE || 'step.execution',
      eventNotification: process.env.MQ_EVENT_QUEUE || 'event.notification',
    },
  },

  // Authentication & Security
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
    apiKeyHeader: process.env.API_KEY_HEADER || 'X-API-Key',
  },

  // Encryption
  encryption: {
    algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
    key: process.env.ENCRYPTION_KEY || 'your-super-secret-encryption-key-32',
  },

  // External Services
  services: {
    engineGrpcUrl: process.env.ENGINE_GRPC_URL || 'localhost:50051',
    nodeRunnerUrl: process.env.NODE_RUNNER_URL || 'http://localhost:3002',
    clickhouseUrl: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    minioEndpoint: process.env.MINIO_ENDPOINT || 'localhost:9000',
    minioAccessKey: process.env.MINIO_ACCESS_KEY || 'n8nwork',
    minioSecretKey: process.env.MINIO_SECRET_KEY || 'n8nwork_dev',
  },

  // Observability
  observability: {
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
    serviceName: process.env.OTEL_SERVICE_NAME || 'n8n-work-orchestrator',
    serviceVersion: process.env.OTEL_SERVICE_VERSION || '0.1.0',
    enableTracing: process.env.OTEL_ENABLE_TRACING !== 'false',
    enableMetrics: process.env.OTEL_ENABLE_METRICS !== 'false',
    enableLogs: process.env.OTEL_ENABLE_LOGS !== 'false',
  },

  // Rate Limiting
  rateLimit: {
    defaultTtl: parseInt(process.env.RATE_LIMIT_TTL, 10) || 60000,
    defaultLimit: parseInt(process.env.RATE_LIMIT_REQUESTS, 10) || 100,
  },

  // Feature Flags
  features: {
    enableWebhooks: process.env.FEATURE_WEBHOOKS !== 'false',
    enableMarketplace: process.env.FEATURE_MARKETPLACE === 'true',
    enableBilling: process.env.FEATURE_BILLING === 'true',
    enableAdvancedAuth: process.env.FEATURE_ADVANCED_AUTH === 'true',
    enableMultiTenancy: process.env.FEATURE_MULTI_TENANCY !== 'false',
  },

  // Limits
  limits: {
    maxWorkflowSize: parseInt(process.env.MAX_WORKFLOW_SIZE, 10) || 1048576, // 1MB
    maxExecutionTime: parseInt(process.env.MAX_EXECUTION_TIME, 10) || 3600000, // 1 hour
    maxConcurrentExecutions: parseInt(process.env.MAX_CONCURRENT_EXECUTIONS, 10) || 100,
    maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS, 10) || 5,
  },

  // Storage
  storage: {
    artifactsBucket: process.env.ARTIFACTS_BUCKET || 'n8n-work-artifacts',
    backupsBucket: process.env.BACKUPS_BUCKET || 'n8n-work-backups',
    tempBucket: process.env.TEMP_BUCKET || 'n8n-work-temp',
  },

  // Notifications
  notifications: {
    defaultChannels: (process.env.DEFAULT_NOTIFICATION_CHANNELS || 'email,slack').split(','),
    emailProvider: process.env.EMAIL_PROVIDER || 'smtp',
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || '',
  },
});
