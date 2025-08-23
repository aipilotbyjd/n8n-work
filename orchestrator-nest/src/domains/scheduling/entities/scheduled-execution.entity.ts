import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Schedule } from './schedule.entity';

export enum ExecutionStatus {
  SCHEDULED = 'scheduled',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
  SKIPPED = 'skipped',
}

@Entity('scheduled_executions')
@Index(['scheduleId', 'status'])
@Index(['scheduledAt', 'status'])
@Index(['tenantId', 'createdAt'])
export class ScheduledExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  scheduleId: string;

  @ManyToOne(() => Schedule)
  @JoinColumn({ name: 'scheduleId' })
  schedule: Schedule;

  @Column('uuid')
  workflowId: string;

  @Column('uuid', { nullable: true })
  executionId: string; // Reference to actual workflow execution

  @Column('uuid')
  tenantId: string;

  @Column({
    type: 'enum',
    enum: ExecutionStatus,
    default: ExecutionStatus.SCHEDULED,
  })
  status: ExecutionStatus;

  @Column({ type: 'timestamp' })
  scheduledAt: Date; // When this execution was scheduled to run

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date; // When execution actually started

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date; // When execution completed

  @Column({ type: 'int', nullable: true })
  durationSeconds: number; // Execution duration

  @Column({ type: 'text', nullable: true })
  error: string; // Error message if execution failed

  @Column('jsonb', { nullable: true })
  triggerData: any; // Data that triggered this execution

  @Column('jsonb', { nullable: true })
  executionContext: any; // Context for this execution

  @Column('jsonb', { nullable: true })
  result: any; // Execution result summary

  @Column({ type: 'int', default: 0 })
  retryCount: number; // Number of retry attempts

  @Column({ type: 'timestamp', nullable: true })
  nextRetryAt: Date; // When to retry if failed

  @Column({ default: false })
  isRetry: boolean; // Whether this is a retry execution

  @Column('uuid', { nullable: true })
  originalExecutionId: string; // Reference to original execution if this is a retry

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Monitoring fields
  @Column({ type: 'int', nullable: true })
  queuePosition: number; // Position in execution queue

  @Column({ type: 'timestamp', nullable: true })
  queuedAt: Date; // When added to execution queue

  @Column('jsonb', { nullable: true })
  metrics: any; // Execution metrics and performance data

  @Column({ type: 'text', nullable: true })
  logs: string; // Execution logs (truncated)
}