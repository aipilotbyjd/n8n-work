"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.validationSchema = void 0;
const Joi = __importStar(require("joi"));
exports.validationSchema = Joi.object({
    NODE_ENV: Joi.string()
        .valid('development', 'production', 'test', 'staging')
        .default('development'),
    PORT: Joi.number().default(3000),
    APP_NAME: Joi.string().default('n8n-work-orchestrator'),
    APP_VERSION: Joi.string().default('0.1.0'),
    CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
    DB_HOST: Joi.string().default('localhost'),
    DB_PORT: Joi.number().default(5432),
    DB_USERNAME: Joi.string().default('n8nwork'),
    DB_PASSWORD: Joi.string().default('n8nwork_dev'),
    DB_DATABASE: Joi.string().default('n8nwork'),
    DB_SSL: Joi.boolean().default(false),
    DB_SYNCHRONIZE: Joi.boolean().default(false),
    DB_LOGGING: Joi.boolean().default(false),
    DB_MIGRATIONS_RUN: Joi.boolean().default(true),
    REDIS_HOST: Joi.string().default('localhost'),
    REDIS_PORT: Joi.number().default(6379),
    REDIS_PASSWORD: Joi.string().optional(),
    REDIS_DB: Joi.number().default(0),
    REDIS_KEY_PREFIX: Joi.string().default('n8nwork:'),
    RABBITMQ_URL: Joi.string().default('amqp://n8nwork:n8nwork_dev@localhost:5672'),
    MQ_WORKFLOW_EXCHANGE: Joi.string().default('workflow.execute'),
    MQ_EXECUTION_EXCHANGE: Joi.string().default('execution.step'),
    MQ_EVENTS_EXCHANGE: Joi.string().default('run.event'),
    MQ_WORKFLOW_QUEUE: Joi.string().default('workflow.execution'),
    MQ_STEP_QUEUE: Joi.string().default('step.execution'),
    MQ_EVENT_QUEUE: Joi.string().default('event.notification'),
    JWT_SECRET: Joi.string().min(32).required(),
    JWT_EXPIRES_IN: Joi.string().default('24h'),
    BCRYPT_ROUNDS: Joi.number().min(10).max(15).default(12),
    API_KEY_HEADER: Joi.string().default('X-API-Key'),
    ENCRYPTION_ALGORITHM: Joi.string().default('aes-256-gcm'),
    ENCRYPTION_KEY: Joi.string().length(32).required(),
    ENGINE_GRPC_URL: Joi.string().default('localhost:50051'),
    NODE_RUNNER_URL: Joi.string().uri().default('http://localhost:3002'),
    CLICKHOUSE_URL: Joi.string().uri().default('http://localhost:8123'),
    MINIO_ENDPOINT: Joi.string().default('localhost:9000'),
    MINIO_ACCESS_KEY: Joi.string().default('n8nwork'),
    MINIO_SECRET_KEY: Joi.string().default('n8nwork_dev'),
    OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string().uri().default('http://localhost:4317'),
    OTEL_SERVICE_NAME: Joi.string().default('n8n-work-orchestrator'),
    OTEL_SERVICE_VERSION: Joi.string().default('0.1.0'),
    OTEL_ENABLE_TRACING: Joi.boolean().default(true),
    OTEL_ENABLE_METRICS: Joi.boolean().default(true),
    OTEL_ENABLE_LOGS: Joi.boolean().default(true),
    RATE_LIMIT_TTL: Joi.number().default(60000),
    RATE_LIMIT_REQUESTS: Joi.number().default(100),
    FEATURE_WEBHOOKS: Joi.boolean().default(true),
    FEATURE_MARKETPLACE: Joi.boolean().default(false),
    FEATURE_BILLING: Joi.boolean().default(false),
    FEATURE_ADVANCED_AUTH: Joi.boolean().default(false),
    FEATURE_MULTI_TENANCY: Joi.boolean().default(true),
    MAX_WORKFLOW_SIZE: Joi.number().default(1048576),
    MAX_EXECUTION_TIME: Joi.number().default(3600000),
    MAX_CONCURRENT_EXECUTIONS: Joi.number().default(100),
    MAX_RETRY_ATTEMPTS: Joi.number().min(1).max(10).default(5),
    ARTIFACTS_BUCKET: Joi.string().default('n8n-work-artifacts'),
    BACKUPS_BUCKET: Joi.string().default('n8n-work-backups'),
    TEMP_BUCKET: Joi.string().default('n8n-work-temp'),
    DEFAULT_NOTIFICATION_CHANNELS: Joi.string().default('email,slack'),
    EMAIL_PROVIDER: Joi.string().valid('smtp', 'sendgrid', 'ses').default('smtp'),
    SLACK_WEBHOOK_URL: Joi.string().uri().optional(),
});
//# sourceMappingURL=validation.schema.js.map