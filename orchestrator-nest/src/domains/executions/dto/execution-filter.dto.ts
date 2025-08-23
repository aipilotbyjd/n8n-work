import { IsOptional, IsEnum, IsUUID, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ExecutionStatus, ExecutionMode } from '../entities/execution.entity';

export class ExecutionFilterDto {
  @ApiPropertyOptional({
    description: 'Filter by workflow ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  workflowId?: string;

  @ApiPropertyOptional({
    description: 'Filter by execution status',
    enum: ExecutionStatus,
    example: ExecutionStatus.SUCCESS,
  })
  @IsOptional()
  @IsEnum(ExecutionStatus)
  status?: ExecutionStatus;

  @ApiPropertyOptional({
    description: 'Filter by execution mode',
    enum: ExecutionMode,
    example: ExecutionMode.MANUAL,
  })
  @IsOptional()
  @IsEnum(ExecutionMode)
  mode?: ExecutionMode;

  @ApiPropertyOptional({
    description: 'Number of results to return',
    example: 50,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Number of results to skip',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({
    description: 'Include execution data in response',
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeData?: boolean;
}