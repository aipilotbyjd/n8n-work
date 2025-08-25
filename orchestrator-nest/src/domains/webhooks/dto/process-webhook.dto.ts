import { IsString, IsObject, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProcessWebhookDto {
  @ApiProperty({
    description: 'HTTP method of the webhook request',
    example: 'POST',
  })
  @IsString()
  method: string;

  @ApiProperty({
    description: 'Request body data',
    type: 'object',
    example: {
      event: 'order.created',
      order_id: '12345',
      customer_email: 'customer@example.com',
    },
  })
  @IsObject()
  body: any;

  @ApiPropertyOptional({
    description: 'Query parameters from the request',
    type: 'object',
    example: {
      source: 'payment_gateway',
      version: 'v1',
    },
  })
  @IsOptional()
  @IsObject()
  query?: Record<string, any>;
}