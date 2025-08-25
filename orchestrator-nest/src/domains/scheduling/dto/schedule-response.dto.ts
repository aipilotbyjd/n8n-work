import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TriggerType, ScheduleStatus } from '../entities/schedule.entity';

export class ScheduleResponseDto {
  @ApiProperty({
    description: 'Unique schedule ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Workflow ID this schedule triggers',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  workflowId: string;

  @ApiProperty({
    description: 'Schedule name',
    example: 'Daily Report Generation',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Schedule description',
    example: 'Generates daily sales report every morning at 9 AM',
  })
  description?: string;

  @ApiProperty({
    description: 'Trigger type',
    enum: TriggerType,
    example: TriggerType.CRON,
  })
  triggerType: TriggerType;

  @ApiPropertyOptional({
    description: 'Cron expression',
    example: '0 9 * * *',
  })
  cronExpression?: string;

  @ApiPropertyOptional({
    description: 'Interval in seconds',
    example: 3600,
  })
  intervalSeconds?: number;

  @ApiPropertyOptional({
    description: 'Timezone',
    example: 'America/New_York',
  })
  timezone?: string;

  @ApiProperty({
    description: 'Schedule status',
    enum: ScheduleStatus,
    example: ScheduleStatus.ACTIVE,
  })
  status: ScheduleStatus;

  @ApiProperty({
    description: 'Whether schedule is active',
    example: true,
  })
  isActive: boolean;

  @ApiPropertyOptional({
    description: 'Next scheduled execution time',
    example: '2024-01-16T09:00:00Z',
  })
  nextRunAt?: Date;

  @ApiPropertyOptional({
    description: 'Last execution time',
    example: '2024-01-15T09:00:00Z',
  })
  lastRunAt?: Date;

  @ApiPropertyOptional({
    description: 'Last execution status',
    example: 'success',
  })
  lastExecutionStatus?: string;

  @ApiProperty({
    description: 'Maximum retries on failure',
    example: 3,
  })
  maxRetries: number;

  @ApiProperty({
    description: 'Retry delay in seconds',
    example: 300,
  })
  retryDelaySeconds: number;

  @ApiPropertyOptional({
    description: 'Total number of executions',
    example: 25,
  })
  executionCount?: number;

  @ApiPropertyOptional({
    description: 'Number of successful executions',
    example: 23,
  })
  successCount?: number;

  @ApiPropertyOptional({
    description: 'Number of failed executions',
    example: 2,
  })
  failureCount?: number;

  @ApiProperty({
    description: 'When schedule was created',
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'When schedule was last updated',
    example: '2024-01-15T12:00:00Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'User who created the schedule',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  createdBy?: string;

    @ApiPropertyOptional({
    description: 'User who last updated the schedule',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  updatedBy?: string;
}