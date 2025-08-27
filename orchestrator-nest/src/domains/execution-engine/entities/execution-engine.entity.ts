import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../auth/entities/user.entity';
import { Workflow } from '../../workflows/entities/workflow.entity';

export enum ExecutionStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PENDING = 'pending',
  CANCELED = 'canceled',
}

@Entity('executions')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'createdAt'])
@Index(['workflowId', 'status'])
export class Execution {
  @ApiProperty({
    description: 'Unique identifier for the execution',
    example: 'uuid-v4',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'ID of the workflow being executed',
    example: 'uuid-v4',
  })
  @Column({ type: 'uuid' })
  @Index()
  workflowId: string;

  @ApiProperty({
    description: 'Current status of the execution',
    enum: ExecutionStatus,
    example: ExecutionStatus.RUNNING,
  })
  @Column({
    type: 'enum',
    enum: ExecutionStatus,
    default: ExecutionStatus.PENDING,
  })
  status: ExecutionStatus;

  @ApiProperty({
    description: 'Timestamp when the execution started',
    example: '2023-11-01T08:00:00Z',
  })
  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @ApiProperty({
    description: 'Timestamp when the execution completed',
    example: '2023-11-01T08:05:00Z',
  })
  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @ApiProperty({
    description: 'Input data for the execution',
    type: 'object',
  })
  @Column({ type: 'jsonb', nullable: true })
  input: Record<string, any>;

  @ApiProperty({
    description: 'Output data of the execution',
    type: 'object',
  })
  @Column({ type: 'jsonb', nullable: true })
  output: Record<string, any>;

  @ApiProperty({
    description: 'Error message if the execution failed',
    example: 'Something went wrong',
  })
  @Column({ type: 'text', nullable: true })
  error: string;

  @ApiProperty({
    description: 'Tenant ID this execution belongs to',
    example: 'tenant-uuid',
  })
  @Column({ type: 'uuid' })
  @Index()
  tenantId: string;

  @ApiProperty({
    description: 'ID of the user who started this execution',
    example: 'user-uuid',
  })
  @Column({ type: 'uuid' })
  createdBy: string;

  @ApiProperty({
    description: 'Timestamp when the execution was created',
    example: '2023-11-01T08:00:00Z',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the execution was last updated',
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

  @ManyToOne(() => Workflow, { eager: false })
  @JoinColumn({ name: 'workflowId' })
  workflow: Workflow;
}
