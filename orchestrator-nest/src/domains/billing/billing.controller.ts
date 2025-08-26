import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { BillingService } from './billing.service';
import {
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  SubscriptionResponseDto,
  CreateInvoiceDto,
  InvoiceResponseDto,
  UsageMetricsDto,
  PaymentMethodDto,
  BillingResponseDto,
} from './dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { GetCurrentUser } from '../../auth/decorators/get-current-user.decorator';
import { GetCurrentTenant } from '../../auth/decorators/get-current-tenant.decorator';

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Get all available billing plans' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns all available billing plans',
    type: 'array',
  })
  async getBillingPlans() {
    return this.billingService.getBillingPlans();
  }

  @Post('subscriptions')
  @ApiOperation({ summary: 'Create a new subscription' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Subscription created successfully',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request data or tenant already has active subscription',
  })
  async createSubscription(
    @GetCurrentTenant() tenantId: string,
    @GetCurrentUser('id') userId: string,
    @Body() createSubscriptionDto: CreateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    return this.billingService.createSubscription(
      tenantId,
      createSubscriptionDto,
      userId,
    );
  }

  @Get('subscriptions/current')
  @ApiOperation({ summary: 'Get current subscription for tenant' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns current subscription',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No active subscription found',
  })
  async getCurrentSubscription(
    @GetCurrentTenant() tenantId: string,
  ): Promise<SubscriptionResponseDto | null> {
    return this.billingService.getSubscriptionByTenant(tenantId);
  }

  @Put('subscriptions/:subscriptionId')
  @ApiOperation({ summary: 'Update an existing subscription' })
  @ApiParam({
    name: 'subscriptionId',
    description: 'Subscription ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription updated successfully',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Subscription not found',
  })
  async updateSubscription(
    @GetCurrentTenant() tenantId: string,
    @GetCurrentUser('id') userId: string,
    @Param('subscriptionId') subscriptionId: string,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    return this.billingService.updateSubscription(
      tenantId,
      subscriptionId,
      updateSubscriptionDto,
      userId,
    );
  }

  @Delete('subscriptions/:subscriptionId')
  @ApiOperation({ summary: 'Cancel a subscription' })
  @ApiParam({
    name: 'subscriptionId',
    description: 'Subscription ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription cancelled successfully',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Subscription not found',
  })
  async cancelSubscription(
    @GetCurrentTenant() tenantId: string,
    @GetCurrentUser('id') userId: string,
    @Param('subscriptionId') subscriptionId: string,
  ): Promise<SubscriptionResponseDto> {
    return this.billingService.cancelSubscription(tenantId, subscriptionId, userId);
  }

  @Post('usage/check')
  @ApiOperation({ summary: 'Check if tenant usage is within limits' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns usage check results',
    schema: {
      type: 'object',
      properties: {
        isWithinLimits: { type: 'boolean', example: true },
        violations: {
          type: 'array',
          items: { type: 'string' },
          example: [],
        },
        usage: {
          type: 'object',
          example: {
            workflowsCount: 15,
            executionsCount: 5000,
            storageUsed: 2.5,
            usersCount: 3,
            integrationsCount: 25,
            period: {
              start: '2024-01-01T00:00:00.000Z',
              end: '2024-01-31T23:59:59.999Z',
            },
          },
        },
      },
    },
  })
  async checkUsageLimits(
    @GetCurrentTenant() tenantId: string,
    @Body() usageMetrics: UsageMetricsDto,
  ) {
    return this.billingService.checkUsageLimits(tenantId, usageMetrics);
  }

  @Post('invoices')
  @ApiOperation({ summary: 'Create a new invoice' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Invoice created successfully',
    type: InvoiceResponseDto,
  })
  async createInvoice(
    @GetCurrentTenant() tenantId: string,
    @GetCurrentUser('id') userId: string,
    @Body() createInvoiceDto: CreateInvoiceDto,
  ): Promise<InvoiceResponseDto> {
    return this.billingService.createInvoice(tenantId, createInvoiceDto, userId);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'Get all invoices for tenant' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns all invoices for the tenant',
    type: [InvoiceResponseDto],
  })
  async getInvoices(
    @GetCurrentTenant() tenantId: string,
  ): Promise<InvoiceResponseDto[]> {
    return this.billingService.getInvoicesByTenant(tenantId);
  }

  @Post('invoices/:invoiceId/pay')
  @ApiOperation({ summary: 'Process payment for an invoice' })
  @ApiParam({
    name: 'invoiceId',
    description: 'Invoice ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment processed successfully',
    type: InvoiceResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invoice not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invoice is already paid',
  })
  async processPayment(
    @GetCurrentTenant() tenantId: string,
    @GetCurrentUser('id') userId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() paymentMethod: PaymentMethodDto,
  ): Promise<InvoiceResponseDto> {
    return this.billingService.processPayment(
      tenantId,
      invoiceId,
      paymentMethod.paymentMethodId,
      userId,
    );
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get billing dashboard data' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns billing dashboard information',
    schema: {
      type: 'object',
      properties: {
        subscription: { $ref: '#/components/schemas/SubscriptionResponseDto' },
        recentInvoices: {
          type: 'array',
          items: { $ref: '#/components/schemas/InvoiceResponseDto' },
        },
        upcomingInvoice: { $ref: '#/components/schemas/InvoiceResponseDto' },
        totalSpent: { type: 'number', example: 299.99 },
        nextPaymentDate: { type: 'string', example: '2024-02-01T00:00:00.000Z' },
      },
    },
  })
  async getBillingDashboard(@GetCurrentTenant() tenantId: string) {
    const subscription = await this.billingService.getSubscriptionByTenant(tenantId);
    const invoices = await this.billingService.getInvoicesByTenant(tenantId);

    const recentInvoices = invoices.slice(0, 5);
    const paidInvoices = invoices.filter(invoice => invoice.status === 'paid');
    const totalSpent = paidInvoices.reduce((total, invoice) => total + invoice.amount, 0);

    const upcomingInvoice = invoices.find(
      invoice => invoice.status === 'pending' && invoice.dueDate > new Date(),
    );

    return {
      subscription,
      recentInvoices,
      upcomingInvoice,
      totalSpent,
      nextPaymentDate: subscription?.currentPeriodEnd,
    };
  }

  @Get('reports/usage')
  @ApiOperation({ summary: 'Get usage report for billing period' })
  @ApiQuery({
    name: 'startDate',
    description: 'Start date for the report',
    example: '2024-01-01',
    required: false,
  })
  @ApiQuery({
    name: 'endDate',
    description: 'End date for the report',
    example: '2024-01-31',
    required: false,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns usage report',
    schema: {
      type: 'object',
      properties: {
        period: {
          type: 'object',
          properties: {
            start: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
            end: { type: 'string', example: '2024-01-31T23:59:59.999Z' },
          },
        },
        usage: {
          type: 'object',
          example: {
            workflowsCount: 15,
            executionsCount: 5000,
            storageUsed: 2.5,
            usersCount: 3,
            integrationsCount: 25,
          },
        },
        limits: {
          type: 'object',
          example: {
            maxWorkflows: -1,
            maxExecutions: 10000,
            maxStorage: 10,
            maxUsers: 5,
            maxIntegrations: 50,
          },
        },
        overages: {
          type: 'array',
          items: { type: 'string' },
          example: [],
        },
      },
    },
  })
  async getUsageReport(
    @GetCurrentTenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const subscription = await this.billingService.getSubscriptionByTenant(tenantId);

    // Default to current billing period if no dates provided
    const start = startDate
      ? new Date(startDate)
      : subscription?.currentPeriodStart || new Date();
    const end = endDate
      ? new Date(endDate)
      : subscription?.currentPeriodEnd || new Date();

    // In a real implementation, you would fetch actual usage data from your metrics service
    const mockUsage: UsageMetricsDto = {
      workflowsCount: 15,
      executionsCount: 5000,
      storageUsed: 2.5,
      usersCount: 3,
      integrationsCount: 25,
      periodStart: start,
      periodEnd: end,
    };

    const usageCheck = await this.billingService.checkUsageLimits(tenantId, mockUsage);

    return {
      period: { start, end },
      usage: usageCheck.usage,
      limits: subscription?.limits,
      overages: usageCheck.violations,
    };
  }
}