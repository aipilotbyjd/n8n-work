import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionStatus, SubscriptionInterval, SubscriptionLimits } from '../entities/subscription.entity';

export class CreateSubscriptionDto {
  @ApiProperty({
    description: 'Billing plan ID',
    example: 'professional',
  })
  @IsString()
  planId: string;

  @ApiPropertyOptional({
    description: 'Payment method ID',
    example: 'pm_1234567890',
  })
  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @ApiPropertyOptional({
    description: 'Trial end date for trial subscriptions',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  trialEnd?: Date;
}

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({
    description: 'New billing plan ID',
    example: 'enterprise',
  })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({
    description: 'New payment method ID',
    example: 'pm_0987654321',
  })
  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @ApiPropertyOptional({
    description: 'Subscription status',
    enum: ['active', 'cancelled', 'past_due', 'unpaid', 'trialing'],
    example: 'active',
  })
  @IsOptional()
  @IsEnum(['active', 'cancelled', 'past_due', 'unpaid', 'trialing'])
  status?: SubscriptionStatus;

  @ApiPropertyOptional({
    description: 'Whether to cancel at period end',
    example: false,
  })
  @IsOptional()
  cancelAtPeriodEnd?: boolean;

  @ApiPropertyOptional({
    description: 'Cancellation reason',
    example: 'User requested cancellation',
  })
  @IsOptional()
  @IsString()
  cancellationReason?: string;
}

export class SubscriptionResponseDto {
  @ApiProperty({
    description: 'Subscription ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Tenant ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  tenantId: string;

  @ApiProperty({
    description: 'Plan ID',
    example: 'professional',
  })
  planId: string;

  @ApiProperty({
    description: 'Plan name',
    example: 'Professional',
  })
  planName: string;

  @ApiProperty({
    description: 'Subscription status',
    enum: ['active', 'cancelled', 'past_due', 'unpaid', 'trialing'],
    example: 'active',
  })
  status: SubscriptionStatus;

  @ApiProperty({
    description: 'Subscription amount',
    example: 29.99,
  })
  amount: number;

  @ApiProperty({
    description: 'Currency',
    example: 'USD',
  })
  currency: string;

  @ApiProperty({
    description: 'Billing interval',
    enum: ['monthly', 'yearly'],
    example: 'monthly',
  })
  interval: SubscriptionInterval;

  @ApiProperty({
    description: 'Current period start',
    example: '2024-01-01T00:00:00.000Z',
  })
  currentPeriodStart: Date;

  @ApiProperty({
    description: 'Current period end',
    example: '2024-02-01T00:00:00.000Z',
  })
  currentPeriodEnd: Date;

  @ApiProperty({
    description: 'Plan features',
    example: ['Unlimited workflows', 'Priority support'],
  })
  features: string[];

  @ApiProperty({
    description: 'Usage limits',
    example: {
      maxWorkflows: -1,
      maxExecutions: 10000,
      maxStorage: 10,
      maxUsers: 5,
      maxIntegrations: 50,
    },
  })
  limits: SubscriptionLimits;

  @ApiProperty({
    description: 'Payment method ID',
    example: 'pm_1234567890',
  })
  paymentMethodId?: string;

  @ApiProperty({
    description: 'Creation date',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update date',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Cancellation date',
    example: '2024-01-01T00:00:00.000Z',
  })
  cancelledAt?: Date;
}