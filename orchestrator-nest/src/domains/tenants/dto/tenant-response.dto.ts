import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class TenantResponseDto {
  @ApiProperty({
    description: "Unique tenant ID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  id: string;

  @ApiProperty({
    description: "Tenant name",
    example: "Acme Corporation",
  })
  name: string;

  @ApiPropertyOptional({
    description: "Tenant description",
    example: "Main production tenant for Acme Corporation",
  })
  description?: string;

  @ApiPropertyOptional({
    description: "Tenant domain",
    example: "acme.com",
  })
  domain?: string;

  @ApiPropertyOptional({
    description: "Admin email",
    example: "admin@acme.com",
  })
  adminEmail?: string;

  @ApiProperty({
    description: "Whether tenant is active",
    example: true,
  })
  isActive: boolean;

  @ApiPropertyOptional({
    description: "Maximum number of users allowed",
    example: 100,
  })
  maxUsers?: number;

  @ApiPropertyOptional({
    description: "Current number of users",
    example: 25,
  })
  currentUsers?: number;

  @ApiPropertyOptional({
    description: "Billing plan",
    example: "enterprise",
  })
  plan?: string;

  @ApiPropertyOptional({
    description: "Tenant settings",
    type: "object",
    example: {
      maxWorkflows: 1000,
      maxExecutionsPerDay: 10000,
      allowCustomNodes: true,
      allowWebhooks: true,
      retentionDays: 30,
    },
  })
  settings?: {
    maxWorkflows?: number;
    maxExecutionsPerDay?: number;
    allowCustomNodes?: boolean;
    allowWebhooks?: boolean;
    retentionDays?: number;
  };

  @ApiProperty({
    description: "When tenant was created",
    example: "2024-01-01T00:00:00Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "When tenant was last updated",
    example: "2024-01-15T12:00:00Z",
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: "Usage statistics",
    type: "object",
    example: {
      workflowCount: 150,
      executionCount: 5000,
      storageUsedMB: 250,
      lastActivityAt: "2024-01-15T10:30:00Z",
    },
  })
  usage?: {
    workflowCount?: number;
    executionCount?: number;
    storageUsedMB?: number;
    lastActivityAt?: Date;
  };
}
