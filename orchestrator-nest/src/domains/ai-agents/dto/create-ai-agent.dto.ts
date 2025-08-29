import { IsString, IsObject, IsOptional } from 'class-validator';

export class CreateAIAgentDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsObject()
  modelConfig: any;

  @IsObject()
  @IsOptional()
  resourceRequirements?: any;
}
