import { IsOptional, IsString, IsNumber, IsArray, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum WorkflowStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived'
}

export class ListWorkflowsDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsEnum(WorkflowStatus)
  status?: WorkflowStatus;

  @IsOptional()
  @IsString()
  orderBy?: string = 'updatedAt';

  @IsOptional()
  @IsString()
  orderDirection?: 'ASC' | 'DESC' = 'DESC';
}