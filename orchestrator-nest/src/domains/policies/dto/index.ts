import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsNumber,
  IsObject,
  IsUUID,
  IsDate,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PolicyType, PolicyEffect, PolicyStatus } from '../entities/policy.entity';
import { AssigneeType } from '../entities/policy-assignment.entity';

// Policies DTOs
export class CreatePolicyDto {
  @ApiProperty({
    description: 'Policy name',
    example: 'Allow Workflow Management',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Policy description',
    example: 'Allows users to create, edit, and delete workflows',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Policy type',
    enum: ['access_control', 'security', 'compliance', 'resource_limit'],
    example: 'access_control',
  })
  @IsEnum(['access_control', 'security', 'compliance', 'resource_limit'])
  type: PolicyType;

  @ApiProperty({
    description: 'Policy effect',
    enum: ['allow', 'deny'],
    example: 'allow',
  })
  @IsEnum(['allow', 'deny'])
  effect: PolicyEffect;

  @ApiPropertyOptional({
    description: 'Policy status',
    enum: ['draft', 'active', 'inactive', 'deprecated'],
    example: 'active',
  })
  @IsOptional()
  @IsEnum(['draft', 'active', 'inactive', 'deprecated'])
  status?: PolicyStatus;

  @ApiPropertyOptional({
    description: 'Resource patterns this policy applies to',
    example: ['workflows:*', 'executions:read'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  resources?: string[];

  @ApiPropertyOptional({
    description: 'Actions this policy covers',
    example: ['create', 'read', 'update', 'delete'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  actions?: string[];

  @ApiPropertyOptional({
    description: 'Additional conditions for policy evaluation',
    type: 'object',
    example: {
      'metadata.department': { 'in': ['sales', 'marketing'] },
      'resourceId': { 'ne': 'protected-resource' },
    },
  })
  @IsOptional()
  @IsObject()
  conditions?: any;

  @ApiPropertyOptional({
    description: 'Policy priority (higher number = higher priority)',
    example: 100,
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  priority?: number;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    type: 'object',
  })
  @IsOptional()
  @IsObject()
  metadata?: any;
}

export class UpdatePolicyDto {
  @ApiPropertyOptional({
    description: 'Policy name',
    example: 'Updated Policy Name',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Policy description',
    example: 'Updated policy description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Policy type',
    enum: ['access_control', 'security', 'compliance', 'resource_limit'],
  })
  @IsOptional()
  @IsEnum(['access_control', 'security', 'compliance', 'resource_limit'])
  type?: PolicyType;

  @ApiPropertyOptional({
    description: 'Policy effect',
    enum: ['allow', 'deny'],
  })
  @IsOptional()
  @IsEnum(['allow', 'deny'])
  effect?: PolicyEffect;

  @ApiPropertyOptional({
    description: 'Policy status',
    enum: ['draft', 'active', 'inactive', 'deprecated'],
  })
  @IsOptional()
  @IsEnum(['draft', 'active', 'inactive', 'deprecated'])
  status?: PolicyStatus;

  @ApiPropertyOptional({
    description: 'Resource patterns',
    example: ['workflows:*', 'executions:*'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  resources?: string[];

  @ApiPropertyOptional({
    description: 'Actions',
    example: ['create', 'read', 'update'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  actions?: string[];

  @ApiPropertyOptional({
    description: 'Policy conditions',
    type: 'object',
  })
  @IsOptional()
  @IsObject()
  conditions?: any;

  @ApiPropertyOptional({
    description: 'Policy priority',
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  priority?: number;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    type: 'object',
  })
  @IsOptional()
  @IsObject()
  metadata?: any;
}

export class AssignPolicyDto {
  @ApiProperty({
    description: 'Policy ID to assign',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  policyId: string;

  @ApiProperty({
    description: 'Type of assignee',
    enum: ['user', 'role', 'group'],
    example: 'user',
  })
  @IsEnum(['user', 'role', 'group'])
  assigneeType: AssigneeType;

  @ApiProperty({
    description: 'ID of the assignee (user, role, or group)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  assigneeId: string;

  @ApiPropertyOptional({
    description: 'Expiration date for the assignment',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    type: 'object',
  })
  @IsOptional()
  @IsObject()
  metadata?: any;
}

export class PolicyResponseDto {
  @ApiProperty({
    description: 'Policy ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Policy name',
    example: 'Allow Workflow Management',
  })
  name: string;

  @ApiProperty({
    description: 'Policy description',
    example: 'Allows users to create, edit, and delete workflows',
  })
  description?: string;

  @ApiProperty({
    description: 'Policy type',
    enum: ['access_control', 'security', 'compliance', 'resource_limit'],
    example: 'access_control',
  })
  type: PolicyType;

  @ApiProperty({
    description: 'Policy effect',
    enum: ['allow', 'deny'],
    example: 'allow',
  })
  effect: PolicyEffect;

  @ApiProperty({
    description: 'Policy status',
    enum: ['draft', 'active', 'inactive', 'deprecated'],
    example: 'active',
  })
  status: PolicyStatus;

  @ApiProperty({
    description: 'Resource patterns',
    example: ['workflows:*', 'executions:read'],
  })
  resources?: string[];

  @ApiProperty({
    description: 'Actions',
    example: ['create', 'read', 'update', 'delete'],
  })
  actions?: string[];

  @ApiProperty({
    description: 'Policy conditions',
    type: 'object',
    example: {
      'metadata.department': { 'in': ['sales', 'marketing'] },
    },
  })
  conditions?: any;

  @ApiProperty({
    description: 'Policy priority',
    example: 100,
  })
  priority: number;

  @ApiProperty({
    description: 'Additional metadata',
    type: 'object',
  })
  metadata?: any;

  @ApiProperty({
    description: 'Created by user ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  createdBy: string;

  @ApiProperty({
    description: 'Updated by user ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  updatedBy?: string;

  @ApiProperty({
    description: 'Creation date',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update date',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}

export class PolicyEvaluationRequestDto {
  @ApiProperty({
    description: 'Resource being accessed',
    example: 'workflows',
  })
  @IsString()
  resource: string;

  @ApiProperty({
    description: 'Action being performed',
    example: 'create',
  })
  @IsString()
  action: string;

  @ApiPropertyOptional({
    description: 'Specific resource ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  resourceId?: string;

  @ApiPropertyOptional({
    description: 'Additional context metadata',
    type: 'object',
    example: { department: 'sales', project: 'Q1-campaign' },
  })
  @IsOptional()
  @IsObject()
  metadata?: any;
}

export class PolicyEvaluationResponseDto {
  @ApiProperty({
    description: 'Whether the action is allowed',
    example: true,
  })
  allowed: boolean;

  @ApiProperty({
    description: 'Reason for the decision',
    example: 'Allowed by policy: Allow Workflow Management',
  })
  reason: string;

  @ApiProperty({
    description: 'Names of applied policies',
    example: ['Allow Workflow Management', 'Security Policy'],
  })
  appliedPolicies: string[];
}
