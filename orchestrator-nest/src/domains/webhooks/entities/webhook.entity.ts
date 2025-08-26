import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum WebhookMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
}

export enum WebhookStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
}

export enum AuthType {
  NONE = 'none',
  BASIC = 'basic',
  BEARER = 'bearer',
  API_KEY = 'api_key',
  HMAC = 'hmac',
  CUSTOM = 'custom',
}

// Alias for compatibility with existing imports
export const AuthenticationType = AuthType;

@Entity('webhooks')
@Index(['tenantId', 'isActive'])
@Index(['workflowId', 'isActive'])
@Index(['path', 'method'])
@Index(['status', 'isActive'])
export class Webhook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column('uuid')
  workflowId: string;

  @Column('uuid')
  tenantId: string;

  @Column({ unique: true })
  path: string; // e.g., '/webhook/my-workflow-trigger'

  @Column({
    type: 'enum',
    enum: WebhookMethod,
    array: true,
    default: [WebhookMethod.POST],
  })
  allowedMethods: WebhookMethod[];

  @Column({
    type: 'enum',
    enum: WebhookStatus,
    default: WebhookStatus.ACTIVE,
  })
  status: WebhookStatus;

  @Column({ default: true })
  isActive: boolean;

  // Authentication
  @Column({
    type: 'enum',
    enum: AuthType,
    default: AuthType.NONE,
  })
  authType: AuthType;

  @Column('text', { nullable: true })
  authConfig: string; // Encrypted authentication configuration

  // Request Processing
  @Column({ default: true })
  captureHeaders: boolean;

  @Column({ default: true })
  captureQueryParams: boolean;

  @Column({ default: true })
  captureBody: boolean;

  @Column('jsonb', { nullable: true })
  headerWhitelist: string[]; // Headers to capture if captureHeaders is selective

  @Column('jsonb', { nullable: true })
  headerBlacklist: string[]; // Headers to exclude

  // Response Configuration
  @Column({ type: 'int', default: 200 })
  responseStatusCode: number;

  @Column('jsonb', { nullable: true })
  responseHeaders: Record<string, string>;

  @Column({ type: 'text', nullable: true })
  responseBody: string; // Custom response body

  @Column({ default: 'application/json' })
  responseContentType: string;

  // Processing Options
  @Column({ default: false })
  isAsync: boolean; // Whether to process webhook asynchronously

  @Column({ type: 'int', default: 30 })
  timeoutSeconds: number;

  @Column({ default: false })
  enableCors: boolean;

  @Column('simple-array', { nullable: true })
  corsOrigins: string[]; // Allowed CORS origins

  // Rate Limiting
  @Column({ default: false })
  enableRateLimit: boolean;

  @Column({ type: 'int', nullable: true })
  rateLimitRequests: number; // Requests per window

  @Column({ type: 'int', nullable: true })
  rateLimitWindowMs: number; // Window in milliseconds

  // Webhook Validation
  @Column({ default: false })
  enableSignatureValidation: boolean;

  @Column({ nullable: true })
  signatureHeader: string; // Header containing signature

  @Column('text', { nullable: true })
  secretKey: string; // Encrypted secret key for signature validation

  @Column({ default: 'sha256' })
  signatureAlgorithm: string;

  // Request Size Limits
  @Column({ type: 'int', default: 1048576 }) // 1MB default
  maxBodySize: number;

  @Column({ type: 'int', default: 100 })
  maxHeaders: number;

  // Statistics
  @Column({ type: 'int', default: 0 })
  totalRequests: number;

  @Column({ type: 'int', default: 0 })
  successfulRequests: number;

  @Column({ type: 'int', default: 0 })
  failedRequests: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  averageResponseTime: number; // In milliseconds

  @Column({ type: 'timestamp', nullable: true })
  lastRequestAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastSuccessAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastFailureAt: Date;

  // Error Handling
  @Column({ type: 'text', nullable: true })
  lastError: string;

  @Column({ type: 'int', default: 0 })
  consecutiveFailures: number;

  @Column({ default: false })
  isBlocked: boolean; // Block webhook due to too many failures

  @Column({ type: 'timestamp', nullable: true })
  blockedUntil: Date;

  // Monitoring and Alerting
  @Column({ default: false })
  enableMonitoring: boolean;

  @Column({ default: false })
  alertOnFailure: boolean;

  @Column('simple-array', { nullable: true })
  alertEmails: string[]; // Email addresses to notify on failure

  @Column({ type: 'int', default: 5 })
  alertThreshold: number; // Number of failures before alerting

  // Request Transformation
  @Column('jsonb', { nullable: true })
  requestTransform: any; // JSONata or similar transformation rules

  @Column('jsonb', { nullable: true })
  responseTransform: any; // Response transformation rules

  // Custom Configuration
  @Column('jsonb', { nullable: true })
  customConfig: any; // Additional webhook-specific configuration

  @Column('simple-array', { nullable: true })
  tags: string[]; // Tags for organization

  @Column('uuid')
  createdBy: string;

  @Column('uuid')
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Workflow Integration
  @Column({ nullable: true })
  nodeId: string; // Specific node that this webhook triggers

  @Column('jsonb', { nullable: true })
  nodeConfig: any; // Configuration for the webhook node

  // Multi-environment Support
  @Column({ nullable: true })
  environment: string; // Environment tag (dev, staging, prod)

  @Column({ default: false })
  isTemplate: boolean; // Whether this webhook serves as a template

  @Column('uuid', { nullable: true })
  templateId: string; // Reference to template if created from one
}