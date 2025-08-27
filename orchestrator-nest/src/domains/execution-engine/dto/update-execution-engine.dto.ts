import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { ExecutionStatus } from '../entities/execution-engine.entity';

export class UpdateExecutionEngineDto {
  @ApiProperty({
    description: 'The new status of the execution',
    enum: ExecutionStatus,
    example: ExecutionStatus.COMPLETED,
  })
  @IsOptional()
  @IsEnum(ExecutionStatus)
  status?: ExecutionStatus;

  @ApiProperty({
    description: 'The output data of the execution',
    example: { result: 'success' },
  })
  @IsOptional()
  @IsObject()
  output?: Record<string, any>;

  @ApiProperty({
    description: 'The error message if the execution failed',
    example: 'Something went wrong',
  })
  @IsOptional()
  @IsString()
  error?: string;
}
