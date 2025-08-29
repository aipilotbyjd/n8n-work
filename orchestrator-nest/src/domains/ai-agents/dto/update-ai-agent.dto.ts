import { IsString, IsObject, IsOptional } from 'class-validator';

export class UpdateAIAgentDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  modelConfig?: any;

  @IsObject()
  @IsOptional()
  resourceRequirements?: any;
}
