import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AIAgent } from './ai-agent.entity';
import { Execution } from '../../executions/entities/execution.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

export enum AIExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
}

export interface AIExecutionMetrics {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  executionTime: number;
  modelLatency?: number;
  queueTime?: number;
  memoryUsage?: number;
  gpuUsage?: number;
  cost?: number;
}

export interface AIExecutionError {
  code: string;
  message: string;
  details?: any;
  stack?: string;
  timestamp: Date;
}

@Entity('ai_agent_executions')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'createdAt'])
@Index(['agentId', 'status'])
@Index(['executionId'])
export class AIAgentExecution {
  @ApiProperty({
    description: 'Unique identifier for the AI agent execution',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'Current status of the AI execution',
    enum: AIExecutionStatus,
    example: AIExecutionStatus.COMPLETED,
  })
  @Column({
    type: 'enum',
    enum: AIExecutionStatus,
    default: AIExecutionStatus.PENDING,
  })
  status: AIExecutionStatus;

  @ApiProperty({
    description: 'Input data sent to the AI agent',
    type: 'object',
  })
  @Column('jsonb')
  input: any;

  @ApiProperty({
    description: 'Output data received from the AI agent',
    type: 'object',
  })
  @Column('jsonb', { nullable: true })
  output: any;

  @ApiProperty({
    description: 'Configuration used for this execution',
    type: 'object',
  })
  @Column('jsonb', { nullable: true })
  config: any;

  @ApiProperty({
    description: 'Execution metrics and performance data',
    type: 'object',
  })
  @Column('jsonb', { nullable: true })
  metrics: AIExecutionMetrics;

  @ApiProperty({
    description: 'Error information if execution failed',
    type: 'object',
  })
  @Column('jsonb', { nullable: true })
  error: AIExecutionError;

  @ApiProperty({
    description: 'Execution context and metadata',
    type: 'object',
  })
  @Column('jsonb', { default: {} })
  context: {
    nodeId?: string;
    workflowId?: string;
    runId?: string;
    retryCount?: number;
    priority?: number;
    tags?: string[];
  };

  @ApiProperty({
    description: 'Timestamp when execution started',
    example: '2024-01-15T10:30:00Z',
  })
  @Column({ nullable: true })
  startedAt: Date;

  @ApiProperty({
    description: 'Timestamp when execution completed',
    example: '2024-01-15T10:30:30Z',
  })
  @Column({ nullable: true })
  completedAt: Date;

  @ApiProperty({
    description: 'Maximum allowed execution time in seconds',
    example: 300,
  })
  @Column({ default: 300 })
  timeoutSeconds: number;

  @ApiProperty({
    description: 'Number of retry attempts',
    example: 0,
  })
  @Column({ default: 0 })
  retryCount: number;

  @ApiProperty({
    description: 'Maximum number of retries allowed',
    example: 3,
  })
  @Column({ default: 3 })
  maxRetries: number;

  @ApiProperty({
    description: 'Priority level for execution queue',
    example: 5,
  })
  @Column({ default: 5 })
  priority: number;

  // Relationships
  @ApiProperty({
    description: 'AI agent used for this execution',
    type: () => AIAgent,
  })
  @ManyToOne(() => AIAgent, (agent) => agent.executions, { onDelete: 'CASCADE' })
  agent: AIAgent;

  @Column('uuid')
  agentId: string;

  @ApiProperty({
    description: 'Parent workflow execution',
    type: () => Execution,
  })
  @ManyToOne(() => Execution, { nullable: true, onDelete: 'CASCADE' })
  execution: Execution;

  @Column('uuid', { nullable: true })
  executionId: string;

  @ApiProperty({
    description: 'Tenant this execution belongs to',
    type: () => Tenant,
  })
  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  tenant: Tenant;

  @Column('uuid')
  tenantId: string;

  @ApiProperty({
    description: 'Timestamp when the execution was created',
    example: '2024-01-15T10:30:00Z',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the execution was last updated',
    example: '2024-01-15T10:30:00Z',
  })
  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  getDuration(): number | null {
    if (!this.startedAt || !this.completedAt) {
      return null;
    }
    return this.completedAt.getTime() - this.startedAt.getTime();
  }

  isTimedOut(): boolean {
    if (!this.startedAt) return false;
    const now = new Date();
    const elapsed = (now.getTime() - this.startedAt.getTime()) / 1000;
    return elapsed > this.timeoutSeconds;
  }

  canRetry(): boolean {
    return this.status === AIExecutionStatus.FAILED && 
           this.retryCount < this.maxRetries;
  }

  markAsStarted(): void {
    this.status = AIExecutionStatus.RUNNING;
    this.startedAt = new Date();
  }

  markAsCompleted(output: any, metrics?: AIExecutionMetrics): void {
    this.status = AIExecutionStatus.COMPLETED;
    this.output = output;
    this.completedAt = new Date();
    if (metrics) {
      this.metrics = metrics;
    }
  }

  markAsFailed(error: AIExecutionError): void {
    this.status = AIExecutionStatus.FAILED;
    this.error = error;
    this.completedAt = new Date();
  }

  markAsCancelled(): void {
    this.status = AIExecutionStatus.CANCELLED;
    this.completedAt = new Date();
  }

  markAsTimeout(): void {
    this.status = AIExecutionStatus.TIMEOUT;
    this.completedAt = new Date();
    this.error = {
      code: 'TIMEOUT',
      message: `Execution timed out after ${this.timeoutSeconds} seconds`,
      timestamp: new Date(),
    };
  }
}