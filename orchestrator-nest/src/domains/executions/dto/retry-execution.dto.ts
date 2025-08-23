import { IsOptional, IsObject, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RetryExecutionDto {
  @ApiPropertyOptional({
    description: 'Override input data for the retry',
    type: 'object',
  })
  @IsOptional()
  @IsObject()
  inputData?: any;

  @ApiPropertyOptional({
    description: 'Optional reason for the retry',
    example: 'Retrying due to temporary network issue',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Node ID to start retry from (if partial retry)',
    example: 'node-12345',
  })
  @IsOptional()
  @IsString()
  fromNodeId?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for the retry',
    type: 'object',
  })
  @IsOptional()
  @IsObject()
  metadata?: any;
}