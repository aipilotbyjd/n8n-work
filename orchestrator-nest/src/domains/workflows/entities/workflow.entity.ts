import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Tenant } from '../../../tenants/entities/tenant.entity';
import { User } from '../../../auth/entities/user.entity';
import { Execution } from '../../../executions/entities/execution.entity';
import { WorkflowConnectionDto } from '../dto/create-workflow.dto';

export enum WorkflowStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DEPRECATED = 'deprecated',
}

export interface WorkflowNode {
  id: string;
  type: string;
  name: string;
  parameters: Record<string, any>;
  dependencies: string[];
  position: {
    x: number;
    y: number;
  };
  policy: {
    timeoutSeconds: number;
    retryCount: number;
    retryStrategy: string;
    allowedDomains: string[];
    resourceLimits: Record<string, any>;
  };
}

export interface WorkflowEdge {
  fromNode: string;
  toNode: string;
  condition?: string;
}

@Entity('workflows')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'createdAt'])
@Index(['name', 'tenantId'])
export class Workflow {
  @ApiProperty({
    description: 'Unique identifier for the workflow',
    example: 'uuid-v4',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'Human-readable name of the workflow',
    example: 'Customer Onboarding Process',
  })
  @Column({ type: 'varchar', length: 255 })
  @Index()
  name: string;

  @ApiProperty({
    description: 'Detailed description of the workflow',
    example: 'Automated customer onboarding with email verification and welcome sequence',
  })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({
    description: 'Current status of the workflow',
    enum: WorkflowStatus,
    example: WorkflowStatus.ACTIVE,
  })
  @Column({
    type: 'enum',
    enum: WorkflowStatus,
    default: WorkflowStatus.DRAFT,
  })
  status: WorkflowStatus;

  @ApiProperty({
    description: 'Version of the workflow',
    example: '1.0.0',
  })
  @Column({ type: 'varchar', length: 50, default: '1.0.0' })
  version: string;

  @ApiProperty({
    description: 'Workflow nodes configuration',
    type: 'object',
    isArray: true,
  })
  @Column({ type: 'jsonb' })
  nodes: WorkflowNode[];

  @ApiProperty({
    description: 'Workflow edges configuration',
    type: 'object',
    isArray: true,
  })
  @Column({ type: 'jsonb' })
  edges: WorkflowEdge[];

  @ApiProperty({
    description: 'Workflow node connections',
    type: 'object',
    isArray: true,
  })
  @Column({ type: 'jsonb', default: [] })
  connections: WorkflowConnectionDto[];

  @ApiProperty({
    description: 'Workflow settings and configuration',
    type: 'object',
  })
  @Column({ type: 'jsonb', default: {} })
  settings: Record<string, any>;

  @ApiProperty({
    description: 'Workflow metadata and labels',
    type: 'object',
  })
  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @ApiProperty({
    description: 'Workflow trigger configuration',
    type: 'object',
  })
  @Column({ type: 'jsonb', nullable: true })
  triggerConfig: Record<string, any>;

  @ApiProperty({
    description: 'Workflow scheduling configuration',
    type: 'object',
  })
  @Column({ type: 'jsonb', nullable: true })
  scheduleConfig: Record<string, any>;

  @ApiProperty({
    description: 'Number of times this workflow has been executed',
    example: 42,
  })
  @Column({ type: 'bigint', default: 0 })
  executionCount: number;

  @ApiProperty({
    description: 'Number of successful executions',
    example: 38,
  })
  @Column({ type: 'bigint', default: 0 })
  successCount: number;

  @ApiProperty({
    description: 'Number of failed executions',
    example: 4,
  })
  @Column({ type: 'bigint', default: 0 })
  failureCount: number;

  @ApiProperty({
    description: 'Average execution time in milliseconds',
    example: 2500,
  })
  @Column({ type: 'bigint', default: 0 })
  avgExecutionTimeMs: number;

  @ApiProperty({
    description: 'Last execution timestamp',
    example: '2023-12-01T10:30:00Z',
  })
  @Column({ type: 'timestamp', nullable: true })
  lastExecutionAt: Date;

  @ApiProperty({
    description: 'Whether the workflow is enabled for execution',
    example: true,
  })
  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;

  @ApiProperty({
    description: 'Tenant ID this workflow belongs to',
    example: 'tenant-uuid',
  })
  @Column({ type: 'uuid' })
  @Index()
  tenantId: string;

  @ApiProperty({
    description: 'ID of the user who created this workflow',
    example: 'user-uuid',
  })
  @Column({ type: 'uuid' })
  createdBy: string;

  @ApiProperty({
    description: 'ID of the user who last updated this workflow',
    example: 'user-uuid',
  })
  @Column({ type: 'uuid', nullable: true })
  updatedBy: string;

  @ApiProperty({
    description: 'Timestamp when the workflow was created',
    example: '2023-11-01T08:00:00Z',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the workflow was last updated',
    example: '2023-12-01T10:30:00Z',
  })
  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Tenant, { eager: false })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'createdBy' })
  creator: User;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'updatedBy' })
  updater: User;

  @OneToMany(() => Execution, (execution) => execution.workflow)
  executions: Execution[];

  // Virtual properties
  @ApiProperty({
    description: 'Success rate percentage',
    example: 90.5,
  })
  get successRate(): number {
    if (this.executionCount === 0) return 0;
    return (this.successCount / this.executionCount) * 100;
  }

  @ApiProperty({
    description: 'Failure rate percentage',
    example: 9.5,
  })
  get failureRate(): number {
    if (this.executionCount === 0) return 0;
    return (this.failureCount / this.executionCount) * 100;
  }

  @ApiProperty({
    description: 'Whether the workflow is currently active',
    example: true,
  })
  get isActive(): boolean {
    return this.status === WorkflowStatus.ACTIVE && this.isEnabled;
  }
}
