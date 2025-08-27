import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ExecutionStatus,
  ExecutionMode,
  ExecutionPriority,
} from "../entities/execution.entity";

export class ExecutionResponseDto {
  @ApiProperty({
    description: "Unique execution ID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  id: string;

  @ApiProperty({
    description: "Workflow ID that was executed",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  workflowId: string;

  @ApiProperty({
    description: "Current execution status",
    enum: ExecutionStatus,
    example: ExecutionStatus.SUCCESS,
  })
  status: ExecutionStatus;

  @ApiProperty({
    description: "Execution mode",
    enum: ExecutionMode,
    example: ExecutionMode.MANUAL,
  })
  mode: ExecutionMode;

  @ApiProperty({
    description: "Execution priority",
    enum: ExecutionPriority,
    example: ExecutionPriority.NORMAL,
  })
  priority: ExecutionPriority;

  @ApiPropertyOptional({
    description: "When execution started",
    example: "2024-01-15T10:30:00Z",
  })
  startedAt?: Date;

  @ApiPropertyOptional({
    description: "When execution completed",
    example: "2024-01-15T10:30:30Z",
  })
  completedAt?: Date;

  @ApiPropertyOptional({
    description: "Execution duration in milliseconds",
    example: 30000,
  })
  durationMs?: number;

  @ApiPropertyOptional({
    description: "User ID who triggered the execution",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  triggeredBy?: string;

  @ApiPropertyOptional({
    description: "Source that triggered the execution",
    example: "manual",
  })
  triggerSource?: string;

  @ApiProperty({
    description: "Number of retry attempts",
    example: 0,
  })
  retryCount: number;

  @ApiProperty({
    description: "Maximum allowed retries",
    example: 3,
  })
  maxRetries: number;

  @ApiProperty({
    description: "Whether this is a retry execution",
    example: false,
  })
  isRetry: boolean;

  @ApiPropertyOptional({
    description: "Parent execution ID if this is a retry",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  parentExecutionId?: string;

  @ApiPropertyOptional({
    description: "Error message if execution failed",
    example: 'Node "HTTP Request" failed: Connection timeout',
  })
  error?: string;

  @ApiProperty({
    description: "When execution was created",
    example: "2024-01-15T10:30:00Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "When execution was last updated",
    example: "2024-01-15T10:30:30Z",
  })
  updatedAt: Date;

  // Optional data fields (included based on request parameters)
  @ApiPropertyOptional({
    description: "Input data for the workflow",
    type: "object",
  })
  inputData?: any;

  @ApiPropertyOptional({
    description: "Output data from the workflow",
    type: "object",
  })
  outputData?: any;

  @ApiPropertyOptional({
    description: "Step-by-step execution data",
    type: "object",
  })
  executionData?: any;

  @ApiPropertyOptional({
    description: "Trigger data that initiated the execution",
    type: "object",
  })
  triggerData?: any;

  @ApiPropertyOptional({
    description: "Additional execution metadata",
    type: "object",
  })
  metadata?: any;

  @ApiPropertyOptional({
    description: "Execution logs",
    example:
      'Execution started\nNode "HTTP Request" executed successfully\n...',
  })
  logs?: string;
}
