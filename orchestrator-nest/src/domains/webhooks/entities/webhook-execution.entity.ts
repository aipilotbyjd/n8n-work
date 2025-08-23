import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Webhook } from './webhook.entity';
import { WebhookMethod } from './webhook.entity';

export enum WebhookExecutionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  BLOCKED = 'blocked',
  RATE_LIMITED = 'rate_limited',
}

@Entity('webhook_executions')
@Index(['webhookId', 'status'])
@Index(['tenantId', 'createdAt'])
@Index(['status', 'createdAt'])
@Index(['workflowExecutionId'])
export class WebhookExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  webhookId: string;

  @ManyToOne(() => Webhook)
  @JoinColumn({ name: 'webhookId' })
  webhook: Webhook;

  @Column('uuid')
  workflowId: string;

  @Column('uuid', { nullable: true })
  workflowExecutionId: string; // Reference to actual workflow execution

  @Column('uuid')
  tenantId: string;

  @Column({
    type: 'enum',
    enum: WebhookExecutionStatus,
    default: WebhookExecutionStatus.PENDING,
  })
  status: WebhookExecutionStatus;

  // Request Details
  @Column({
    type: 'enum',
    enum: WebhookMethod,
  })
  method: WebhookMethod;

  @Column('text')
  url: string; // Full URL of the request

  @Column('text')
  path: string; // Path portion of the URL

  @Column('jsonb', { nullable: true })
  headers: Record<string, string>; // Request headers

  @Column('jsonb', { nullable: true })
  queryParams: Record<string, any>; // Query parameters

  @Column('text', { nullable: true })
  body: string; // Request body (stored as string)

  @Column({ nullable: true })
  contentType: string;

  @Column({ type: 'int', nullable: true })
  contentLength: number;

  @Column({ nullable: true })
  userAgent: string;

  @Column({ nullable: true })
  remoteIp: string; // Client IP address

  @Column({ nullable: true })
  forwardedFor: string; // X-Forwarded-For header

  // Response Details
  @Column({ type: 'int', nullable: true })
  responseStatusCode: number;

  @Column('jsonb', { nullable: true })
  responseHeaders: Record<string, string>;

  @Column('text', { nullable: true })
  responseBody: string;

  @Column({ type: 'int', nullable: true })
  responseTime: number; // Response time in milliseconds

  // Processing Details
  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date; // When processing started

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date; // When processing completed

  @Column({ type: 'int', nullable: true })
  processingTime: number; // Total processing time in milliseconds

  @Column({ type: 'text', nullable: true })
  error: string; // Error message if processing failed

  @Column('jsonb', { nullable: true })
  errorDetails: any; // Detailed error information

  // Authentication and Security
  @Column({ default: false })
  isAuthenticated: boolean;

  @Column({ nullable: true })
  authType: string; // Type of authentication used

  @Column({ default: false })
  signatureValid: boolean; // Whether signature validation passed

  @Column({ nullable: true })
  signature: string; // Request signature

  // Rate Limiting
  @Column({ default: false })
  wasRateLimited: boolean;

  @Column({ type: 'int', nullable: true })
  rateLimitRemaining: number; // Remaining requests in window

  @Column({ type: 'timestamp', nullable: true })
  rateLimitReset: Date; // When rate limit window resets

  // Workflow Execution Context
  @Column('jsonb', { nullable: true })
  triggerData: any; // Data passed to the workflow

  @Column('jsonb', { nullable: true })
  executionContext: any; // Additional execution context

  @Column('jsonb', { nullable: true })
  workflowResult: any; // Result from workflow execution

  // Request Transformation
  @Column('jsonb', { nullable: true })
  originalData: any; // Original request data before transformation

  @Column('jsonb', { nullable: true })
  transformedData: any; // Data after transformation

  @Column({ default: false })
  wasTransformed: boolean; // Whether data transformation was applied

  // Monitoring and Debugging
  @Column('jsonb', { nullable: true })
  metrics: any; // Performance and execution metrics

  @Column('text', { nullable: true })
  logs: string; // Execution logs (truncated)

  @Column('jsonb', { nullable: true })
  debugInfo: any; // Debug information

  // Retry Information
  @Column({ type: 'int', default: 0 })
  retryCount: number; // Number of retry attempts

  @Column({ default: false })
  isRetry: boolean; // Whether this is a retry execution

  @Column('uuid', { nullable: true })
  originalExecutionId: string; // Reference to original execution if this is a retry

  @Column({ type: 'timestamp', nullable: true })
  nextRetryAt: Date; // When to retry if failed

  // Compliance and Auditing
  @Column('jsonb', { nullable: true })
  auditData: any; // Additional audit information

  @Column({ nullable: true })
  requestId: string; // Unique request identifier for tracing

  @Column({ nullable: true })
  correlationId: string; // Correlation ID for distributed tracing

  @CreateDateColumn()
  createdAt: Date;

  // Additional fields for analytics
  @Column({ nullable: true })
  country: string; // Country of origin (from IP)

  @Column({ nullable: true })
  city: string; // City of origin (from IP)

  @Column({ nullable: true })
  timezone: string; // Client timezone

  @Column({ nullable: true })
  device: string; // Device type (mobile, desktop, etc.)

  @Column({ nullable: true })
  browser: string; // Browser information

  @Column({ nullable: true })
  referrer: string; // HTTP Referer header
}