import { IsUUID, IsOptional, IsEnum, IsObject, IsString, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExecutionMode, ExecutionPriority } from '../entities/execution.entity';

export class StartExecutionDto {
  @ApiProperty({
    description: 'ID of the workflow to execute',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  workflowId: string;

  @ApiPropertyOptional({
    description: 'Execution mode',
    enum: ExecutionMode,
    example: ExecutionMode.MANUAL,
  })
  @IsOptional()
  @IsEnum(ExecutionMode)
  mode?: ExecutionMode;

  @ApiPropertyOptional({
    description: 'Execution priority',
    enum: ExecutionPriority,
    example: ExecutionPriority.NORMAL,
  })
  @IsOptional()
  @IsEnum(ExecutionPriority)
  priority?: ExecutionPriority;

  @ApiPropertyOptional({
    description: 'Input data for the workflow',
    type: 'object',
  })
  @IsOptional()
  @IsObject()
  inputData?: any;

  @ApiPropertyOptional({
    description: 'Trigger data that initiated the execution',
    type: 'object',
  })
  @IsOptional()
  @IsObject()
  triggerData?: any;

  @ApiPropertyOptional({
    description: 'Source that triggered the execution',
    example: 'manual',
  })
  @IsOptional()
  @IsString()
  triggerSource?: string;

  @ApiPropertyOptional({
    description: 'Webhook ID if triggered by webhook',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  webhookId?: string;

  @ApiPropertyOptional({
    description: 'Schedule ID if triggered by schedule',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  scheduleId?: string;

  @ApiPropertyOptional({
    description: 'Execution timeout in milliseconds',
    example: 300000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(3600000) // Max 1 hour
  timeoutMs?: number;

  @ApiPropertyOptional({
    description: 'Additional metadata for the execution',
    type: 'object',
  })
  @IsOptional()
  @IsObject()
  metadata?: any;
}