import { IsUUID, IsString, IsOptional, IsEnum, IsBoolean, IsObject, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TriggerType } from '../entities/schedule.entity';

export class CreateScheduleDto {
  @ApiProperty({
    description: 'ID of the workflow to schedule',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  workflowId: string;

  @ApiProperty({
    description: 'Human-readable name for the schedule',
    example: 'Daily Report Generation',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Description of the schedule purpose',
    example: 'Generates daily sales report every morning at 9 AM',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Type of trigger for the schedule',
    enum: TriggerType,
    example: TriggerType.CRON,
  })
  @IsEnum(TriggerType)
  triggerType: TriggerType;

  @ApiPropertyOptional({
    description: 'Cron expression for scheduling (required if triggerType is CRON)',
    example: '0 9 * * *',
  })
  @IsOptional()
  @IsString()
  cronExpression?: string;

  @ApiPropertyOptional({
    description: 'Interval in seconds (required if triggerType is INTERVAL)',
    example: 3600,
    minimum: 60,
    maximum: 2592000, // 30 days
  })
  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(2592000)
  intervalSeconds?: number;

  @ApiPropertyOptional({
    description: 'Timezone for cron expression',
    example: 'America/New_York',
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Whether the schedule is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Maximum number of retries on failure',
    example: 3,
    minimum: 0,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  maxRetries?: number;

  @ApiPropertyOptional({
    description: 'Retry delay in seconds',
    example: 300,
    minimum: 60,
    maximum: 3600,
  })
  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(3600)
  retryDelaySeconds?: number;

  @ApiPropertyOptional({
    description: 'Input data to pass to the workflow',
    type: 'object',
  })
  @IsOptional()
  @IsObject()
  inputData?: any;

  @ApiPropertyOptional({
    description: 'Additional configuration for the schedule',
    type: 'object',
  })
  @IsOptional()
  @IsObject()
  configuration?: any;
}"