import { IsOptional, IsEnum, IsString, IsBoolean, IsNumber, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { NodeCategory } from '../entities/node-type.entity';

export class NodeSearchFilters {
  @ApiPropertyOptional({
    description: 'Filter by node category',
    enum: NodeCategory,
    example: NodeCategory.COMMUNICATION,
  })
  @IsOptional()
  @IsEnum(NodeCategory)
  category?: NodeCategory;

  @ApiPropertyOptional({
    description: 'Search by node type name or keywords',
    example: 'http request',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by built-in vs custom nodes',
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isBuiltIn?: boolean;

  @ApiPropertyOptional({
    description: 'Filter nodes that require credentials',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requiresCredentials?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by plugin package ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  pluginPackageId?: string;

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
}