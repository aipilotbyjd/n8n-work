import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
  WAITING = 'waiting', // Waiting for user input or external event
  PAUSED = 'paused',
  WARNING = 'warning', // Completed with warnings
}

export enum ExecutionMode {
  MANUAL = 'manual',
  WEBHOOK = 'webhook',
  SCHEDULED = 'scheduled',
  API = 'api',
  RETRY = 'retry',
  TEST = 'test',
}

export enum ExecutionPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity('executions')
@Index(['tenantId', 'workflowId'])
@Index(['status', 'createdAt'])
@Index(['mode', 'status'])
@Index(['tenantId', 'status', 'createdAt'])
@Index(['workflowId', 'status', 'createdAt'])
export class Execution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  workflowId: string;

  @Column('uuid')
  tenantId: string;

  @Column({
    type: 'enum',
    enum: ExecutionStatus,
    default: ExecutionStatus.PENDING,
  })
  status: ExecutionStatus;

  @Column({
    type: 'enum',
    enum: ExecutionMode,
    default: ExecutionMode.MANUAL,
  })
  mode: ExecutionMode;

  @Column({
    type: 'enum',
    enum: ExecutionPriority,
    default: ExecutionPriority.NORMAL,
  })
  priority: ExecutionPriority;

  // Timing Information
  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'int', nullable: true })
  durationMs: number; // Execution duration in milliseconds

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt: Date; // When execution was scheduled

  @Column({ type: 'timestamp', nullable: true })
  queuedAt: Date; // When execution was added to queue

  // Execution Context
  @Column('jsonb', { nullable: true })
  triggerData: any; // Data that triggered the execution

  @Column('jsonb', { nullable: true })
  inputData: any; // Input data for the workflow

  @Column('jsonb', { nullable: true })
  outputData: any; // Output data from the workflow

  @Column('jsonb', { nullable: true })
  executionData: any; // Step-by-step execution data

  @Column('jsonb', { nullable: true })
  metadata: any; // Additional execution metadata

  // Error Handling
  @Column({ type: 'text', nullable: true })
  error: string; // Primary error message

  @Column('jsonb', { nullable: true })
  errorDetails: any; // Detailed error information

  @Column({ nullable: true })
  failedNodeId: string; // Node where execution failed

  @Column({ nullable: true })
  failedNodeName: string; // Name of the failed node

  @Column({ type: 'int', default: 0 })
  retryCount: number; // Number of retry attempts

  @Column({ type: 'int', default: 3 })
  maxRetries: number; // Maximum retry attempts

  @Column({ default: false })
  isRetry: boolean; // Whether this is a retry execution

  @Column('uuid', { nullable: true })
  parentExecutionId: string; // Reference to parent execution if this is a retry

  // Workflow Version
  @Column({ nullable: true })
  workflowVersion: string; // Version of workflow used

  @Column('jsonb', { nullable: true })
  workflowDefinition: any; // Snapshot of workflow definition at execution time

  // Resource Usage
  @Column({ type: 'int', nullable: true })
  memoryUsageMb: number; // Peak memory usage in MB

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  cpuUsagePercent: number; // Average CPU usage percentage

  @Column({ type: 'int', nullable: true })
  networkRequests: number; // Number of network requests made

  @Column({ type: 'int', nullable: true })
  storageUsageBytes: number; // Storage used during execution

  // Execution Statistics
  @Column({ type: 'int', default: 0 })
  totalNodes: number; // Total number of nodes in workflow

  @Column({ type: 'int', default: 0 })
  executedNodes: number; // Number of nodes executed

  @Column({ type: 'int', default: 0 })
  successfulNodes: number; // Number of nodes that succeeded

  @Column({ type: 'int', default: 0 })
  failedNodes: number; // Number of nodes that failed

  @Column({ type: 'int', default: 0 })
  skippedNodes: number; // Number of nodes that were skipped

  // Trigger Information
  @Column('uuid', { nullable: true })
  triggeredBy: string; // User ID who triggered the execution

  @Column({ nullable: true })
  triggerSource: string; // Source that triggered execution (webhook, schedule, etc.)

  @Column('uuid', { nullable: true })
  webhookId: string; // Webhook that triggered execution (if applicable)

  @Column('uuid', { nullable: true })
  scheduleId: string; // Schedule that triggered execution (if applicable)

  // Queue Information
  @Column({ type: 'int', nullable: true })
  queuePosition: number; // Position in execution queue

  @Column({ nullable: true })
  queueName: string; // Name of the queue processing this execution

  @Column({ type: 'int', nullable: true })
  timeoutMs: number; // Execution timeout in milliseconds

  // Logging and Debugging
  @Column('text', { nullable: true })
  logs: string; // Execution logs (truncated for storage)

  @Column({ nullable: true })
  logLevel: string; // Log level for this execution

  @Column('jsonb', { nullable: true })
  debugInfo: any; // Debug information

  @Column({ default: false })
  debugMode: boolean; // Whether execution ran in debug mode

  // Monitoring and Observability
  @Column({ nullable: true })
  traceId: string; // Distributed tracing ID

  @Column({ nullable: true })
  spanId: string; // Span ID for tracing

  @Column('jsonb', { nullable: true })
  metrics: any; // Performance metrics

  @Column('jsonb', { nullable: true })
  tags: string[]; // Tags for categorization

  // Compliance and Auditing
  @Column('jsonb', { nullable: true })
  auditData: any; // Audit information

  @Column({ default: false })
  containsPii: boolean; // Whether execution data contains PII

  @Column({ default: false })
  isCompliant: boolean; // Whether execution meets compliance requirements

  // Environment Information
  @Column({ nullable: true })
  environment: string; // Environment where execution ran (dev, staging, prod)

  @Column({ nullable: true })
  region: string; // Geographic region

  @Column({ nullable: true })
  engineVersion: string; // Version of execution engine

  @Column({ nullable: true })
  nodeVersion: string; // Node.js version

  // Workflow Sharing and Collaboration
  @Column({ default: false })
  isShared: boolean; // Whether execution results are shared

  @Column('simple-array', { nullable: true })
  sharedWith: string[]; // User IDs who have access to this execution

  @Column({ default: false })
  isPublic: boolean; // Whether execution is publicly visible

  // Billing and Usage
  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  cost: number; // Estimated cost of execution

  @Column({ nullable: true })
  currency: string; // Currency for cost calculation

  @Column({ type: 'int', nullable: true })
  creditsUsed: number; // Credits consumed by execution

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Workflow State Management
  @Column('jsonb', { nullable: true })
  currentState: any; // Current state of the workflow execution

  @Column('jsonb', { nullable: true })
  nodeStates: any; // State of individual nodes

  @Column({ default: false })
  canResume: boolean; // Whether execution can be resumed

  @Column({ type: 'timestamp', nullable: true })
  resumeAt: Date; // When execution can be resumed

  @Column('jsonb', { nullable: true })
  resumeData: any; // Data needed to resume execution

  // External Integrations
  @Column('jsonb', { nullable: true })
  externalRefs: any; // References to external systems

  @Column('jsonb', { nullable: true })
  webhookResponses: any; // Responses sent to webhooks

  @Column('jsonb', { nullable: true })
  notifications: any; // Notifications sent during execution
}