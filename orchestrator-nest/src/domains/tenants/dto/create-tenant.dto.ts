import { IsString, IsOptional, IsEmail, IsObject, IsBoolean, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({
    description: 'Tenant name',
    example: 'Acme Corporation',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Tenant description',
    example: 'Main production tenant for Acme Corporation',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Tenant domain',
    example: 'acme.com',
  })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional({
    description: 'Admin email for the tenant',
    example: 'admin@acme.com',
  })
  @IsOptional()
  @IsEmail()
  adminEmail?: string;

  @ApiPropertyOptional({
    description: 'Tenant configuration settings',
    type: 'object',
  })
  @IsOptional()
  @IsObject()
  settings?: {
    maxWorkflows?: number;
    maxExecutionsPerDay?: number;
    allowCustomNodes?: boolean;
    allowWebhooks?: boolean;
    retentionDays?: number;
  };

  @ApiPropertyOptional({
    description: 'Whether tenant is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Maximum number of users allowed',
    example: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  maxUsers?: number;

  @ApiPropertyOptional({
    description: 'Billing plan identifier',
    example: 'enterprise',
  })
  @IsOptional()
  @IsString()
  plan?: string;
}