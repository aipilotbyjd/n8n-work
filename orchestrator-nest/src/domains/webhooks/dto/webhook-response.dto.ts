import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WebhookMethod, WebhookStatus, AuthenticationType } from '../entities/webhook.entity';

export class WebhookResponseDto {
  @ApiProperty({
    description: 'Unique webhook ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Workflow ID this webhook triggers',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  workflowId: string;

  @ApiProperty({
    description: 'Webhook name',
    example: 'Order Processing Webhook',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Webhook description',
    example: 'Processes incoming order notifications',
  })
  description?: string;

  @ApiProperty({
    description: 'Unique webhook path',
    example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
  })
  path: string;

  @ApiProperty({
    description: 'Full webhook URL',
    example: 'https://api.example.com/webhooks/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
  })
  url: string;

  @ApiProperty({
    description: 'HTTP method',
    enum: WebhookMethod,
    example: WebhookMethod.POST,
  })
  method: WebhookMethod;

  @ApiProperty({
    description: 'Webhook status',
    enum: WebhookStatus,
    example: WebhookStatus.ACTIVE,
  })
  status: WebhookStatus;

  @ApiProperty({
    description: 'Authentication type',
    enum: AuthenticationType,
    example: AuthenticationType.SIGNATURE,
  })
  authenticationType: AuthenticationType;

  @ApiPropertyOptional({
    description: 'Rate limit per minute',
    example: 60,
  })
  rateLimitPerMinute?: number;

  @ApiPropertyOptional({
    description: 'Timeout in milliseconds',
    example: 30000,
  })
  timeoutMs?: number;

  @ApiPropertyOptional({
    description: 'Total number of requests received',
    example: 1250,
  })
  requestCount?: number;

  @ApiPropertyOptional({
    description: 'When webhook was last triggered',
    example: '2024-01-15T10:30:00Z',
  })
  lastTriggeredAt?: Date;

  @ApiProperty({
    description: 'Whether webhook is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'When webhook was created',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'When webhook was last updated',
    example: '2024-01-15T10:30:00Z',
  })
  updatedAt: Date;
}