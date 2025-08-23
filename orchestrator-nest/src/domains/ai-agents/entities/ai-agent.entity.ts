import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import { AIAgentExecution } from './ai-agent-execution.entity';

export enum AIAgentType {
  LLM = 'llm',
  ML = 'ml',
  CV = 'cv',
  NLP = 'nlp',
  CUSTOM = 'custom',
}

export enum AIAgentStatus {
  INACTIVE = 'inactive',
  ACTIVE = 'active',
  LOADING = 'loading',
  ERROR = 'error',
  UPDATING = 'updating',
}

export interface AIModelConfig {
  provider: string;
  model: string;
  version?: string;
  parameters?: Record<string, any>;
  endpoint?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface ResourceRequirements {
  memory: string;
  cpu?: string;
  gpu?: boolean;
  gpuMemory?: string;
  storage?: string;
  maxConcurrency?: number;
}

export interface AICapability {
  name: string;
  description: string;
  inputTypes: string[];
  outputTypes: string[];
  examples?: any[];
}

@Entity('ai_agents')
@Index(['tenantId', 'type'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'createdBy'])
export class AIAgent {
  @ApiProperty({
    description: 'Unique identifier for the AI agent',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'Human-readable name for the AI agent',
    example: 'GPT-4 Content Generator',
    maxLength: 255,
  })
  @Column({ length: 255 })
  name: string;

  @ApiProperty({
    description: 'Detailed description of the AI agent capabilities',
    example: 'Advanced language model for content generation and analysis',
  })
  @Column('text', { nullable: true })
  description: string;

  @ApiProperty({
    description: 'Type of AI agent',
    enum: AIAgentType,
    example: AIAgentType.LLM,
  })
  @Column({
    type: 'enum',
    enum: AIAgentType,
    default: AIAgentType.CUSTOM,
  })
  type: AIAgentType;

  @ApiProperty({
    description: 'Current status of the AI agent',
    enum: AIAgentStatus,
    example: AIAgentStatus.ACTIVE,
  })
  @Column({
    type: 'enum',
    enum: AIAgentStatus,
    default: AIAgentStatus.INACTIVE,
  })
  status: AIAgentStatus;

  @ApiProperty({
    description: 'Version of the AI agent',
    example: '1.0.0',
  })
  @Column({ length: 50, default: '1.0.0' })
  version: string;

  @ApiProperty({
    description: 'AI model configuration',
    type: 'object',
  })
  @Column('jsonb')
  modelConfig: AIModelConfig;

  @ApiProperty({
    description: 'Resource requirements for running the agent',
    type: 'object',
  })
  @Column('jsonb')
  resourceRequirements: ResourceRequirements;

  @ApiProperty({
    description: 'List of capabilities this agent provides',
    type: 'array',
  })
  @Column('jsonb', { default: [] })
  capabilities: AICapability[];

  @ApiProperty({
    description: 'JSON schema for input validation',
    type: 'object',
  })
  @Column('jsonb', { nullable: true })
  inputSchema: any;

  @ApiProperty({
    description: 'JSON schema for output validation',
    type: 'object',
  })
  @Column('jsonb', { nullable: true })
  outputSchema: any;

  @ApiProperty({
    description: 'Configuration schema for the agent',
    type: 'object',
  })
  @Column('jsonb', { nullable: true })
  configSchema: any;

  @ApiProperty({
    description: 'Custom metadata for the agent',
    type: 'object',
  })
  @Column('jsonb', { default: {} })
  metadata: Record<string, any>;

  @ApiProperty({
    description: 'Whether the agent is publicly available',
    example: false,
  })
  @Column({ default: false })
  isPublic: boolean;

  @ApiProperty({
    description: 'Whether the agent is enabled for use',
    example: true,
  })
  @Column({ default: true })
  isEnabled: boolean;

  @ApiProperty({
    description: 'Usage statistics',
    type: 'object',
  })
  @Column('jsonb', { default: {} })
  usage: {
    totalExecutions?: number;
    totalTokens?: number;
    avgExecutionTime?: number;
    lastUsed?: Date;
  };

  @ApiProperty({
    description: 'Health check configuration',
    type: 'object',
  })
  @Column('jsonb', { nullable: true })
  healthCheck: {
    enabled: boolean;
    interval: number;
    timeout: number;
    endpoint?: string;
    method?: string;
  };

  @ApiProperty({
    description: 'Tags for categorization',
    type: 'array',
    example: ['content', 'generation', 'ai'],
  })
  @Column('simple-array', { default: [] })
  tags: string[];

  // Relationships
  @ApiProperty({
    description: 'Tenant this agent belongs to',
    type: () => Tenant,
  })
  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  tenant: Tenant;

  @Column('uuid')
  tenantId: string;

  @ApiProperty({
    description: 'User who created this agent',
    type: () => User,
  })
  @ManyToOne(() => User, { nullable: true })
  createdBy: User;

  @Column('uuid', { nullable: true })
  createdById: string;

  @ApiProperty({
    description: 'User who last updated this agent',
    type: () => User,
  })
  @ManyToOne(() => User, { nullable: true })
  updatedBy: User;

  @Column('uuid', { nullable: true })
  updatedById: string;

  @ApiProperty({
    description: 'Executions using this agent',
    type: () => [AIAgentExecution],
  })
  @OneToMany(() => AIAgentExecution, (execution) => execution.agent)
  executions: AIAgentExecution[];

  @ApiProperty({
    description: 'Timestamp when the agent was created',
    example: '2024-01-15T10:30:00Z',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the agent was last updated',
    example: '2024-01-15T10:30:00Z',
  })
  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  isHealthy(): boolean {
    return this.status === AIAgentStatus.ACTIVE;
  }

  canExecute(): boolean {
    return this.isEnabled && this.isHealthy();
  }

  incrementUsage(tokens?: number, executionTime?: number): void {
    this.usage.totalExecutions = (this.usage.totalExecutions || 0) + 1;
    if (tokens) {
      this.usage.totalTokens = (this.usage.totalTokens || 0) + tokens;
    }
    if (executionTime) {
      const total = this.usage.totalExecutions;
      const current = this.usage.avgExecutionTime || 0;
      this.usage.avgExecutionTime = (current * (total - 1) + executionTime) / total;
    }
    this.usage.lastUsed = new Date();
  }
}