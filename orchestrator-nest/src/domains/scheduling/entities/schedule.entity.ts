import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

export enum ScheduleStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  PAUSED = "paused",
  ERROR = "error",
}

export enum TriggerType {
  CRON = "cron",
  INTERVAL = "interval",
  WEBHOOK = "webhook",
  MANUAL = "manual",
  API = "api",
}

@Entity("schedules")
@Index(["tenantId", "workflowId"])
@Index(["status", "nextRunAt"])
@Index(["triggerType", "isActive"])
export class Schedule {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column("uuid")
  workflowId: string;

  @Column("uuid")
  tenantId: string;

  @Column({
    type: "enum",
    enum: TriggerType,
    default: TriggerType.CRON,
  })
  triggerType: TriggerType;

  @Column({
    type: "enum",
    enum: ScheduleStatus,
    default: ScheduleStatus.ACTIVE,
  })
  status: ScheduleStatus;

  // Cron-specific fields
  @Column({ nullable: true })
  cronExpression: string; // e.g., '0 9 * * MON-FRI'

  @Column({ nullable: true })
  timezone: string; // e.g., 'America/New_York'

  // Interval-specific fields
  @Column({ type: "int", nullable: true })
  intervalSeconds: number; // For interval triggers

  // Execution scheduling
  @Column({ type: "timestamp", nullable: true })
  nextRunAt: Date;

  @Column({ type: "timestamp", nullable: true })
  lastRunAt: Date;

  @Column({ type: "timestamp", nullable: true })
  lastSuccessAt: Date;

  @Column({ type: "timestamp", nullable: true })
  lastFailureAt: Date;

  // Configuration
  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  allowOverlap: boolean; // Allow multiple executions to run simultaneously

  @Column({ type: "int", default: 3 })
  maxRetries: number;

  @Column({ type: "int", default: 60 })
  retryDelaySeconds: number;

  @Column({ type: "int", default: 300 })
  timeoutSeconds: number;

  // Execution limits
  @Column({ type: "timestamp", nullable: true })
  startDate: Date; // When to start executing

  @Column({ type: "timestamp", nullable: true })
  endDate: Date; // When to stop executing

  @Column({ type: "int", nullable: true })
  maxExecutions: number; // Maximum number of executions

  // Statistics
  @Column({ type: "int", default: 0 })
  totalExecutions: number;

  @Column({ type: "int", default: 0 })
  successfulExecutions: number;

  @Column({ type: "int", default: 0 })
  failedExecutions: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  averageExecutionTime: number; // In seconds

  // Metadata
  @Column("jsonb", { nullable: true })
  triggerData: any; // Additional trigger configuration

  @Column("jsonb", { nullable: true })
  executionContext: any; // Context data for executions

  @Column({ type: "text", nullable: true })
  lastError: string;

  @Column("uuid")
  createdBy: string;

  @Column("uuid")
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Webhook-specific fields
  @Column({ nullable: true })
  webhookId: string; // Reference to webhook if trigger type is webhook

  @Column("simple-array", { nullable: true })
  allowedMethods: string[]; // HTTP methods for webhook triggers

  @Column("jsonb", { nullable: true })
  webhookConfig: any; // Webhook-specific configuration

  // Monitoring and alerting
  @Column({ default: false })
  alertOnFailure: boolean;

  @Column("simple-array", { nullable: true })
  alertEmails: string[]; // Email addresses to notify on failure

  @Column({ type: "int", nullable: true })
  consecutiveFailures: number; // Track consecutive failures

  @Column({ type: "int", default: 3 })
  alertThreshold: number; // Number of failures before alerting
}
