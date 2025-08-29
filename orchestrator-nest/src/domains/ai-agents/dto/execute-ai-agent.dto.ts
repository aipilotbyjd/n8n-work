import { IsObject, IsOptional, IsNumber, IsString } from 'class-validator';

export class ExecuteAIAgentDto {
  @IsObject()
  input: any;

  @IsObject()
  @IsOptional()
  config?: any;

  @IsObject()
  @IsOptional()
  context?: any;

  @IsNumber()
  @IsOptional()
  timeoutSeconds?: number;

  @IsNumber()
  @IsOptional()
  maxRetries?: number;

  @IsNumber()
  @IsOptional()
  priority?: number;
}
