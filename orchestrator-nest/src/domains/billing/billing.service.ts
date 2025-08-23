import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Subscription, Invoice, InvoiceStatus } from './entities';
import {
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  CreateInvoiceDto,
  BillingResponseDto,
  SubscriptionResponseDto,
  InvoiceResponseDto,
  UsageMetricsDto,
  PaymentMethodDto,
} from './dto/index';
import { AuditLogService } from '../audit/audit-log.service';

export interface BillingPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  features: string[];
  limits: {
    maxWorkflows: number;
    maxExecutions: number;
    maxStorage: number; // in GB
    maxUsers: number;
    maxIntegrations: number;
  };
}

export interface UsageMetrics {
  workflowsCount: number;
  executionsCount: number;
  storageUsed: number; // in GB
  usersCount: number;
  integrationsCount: number;
  period: {
    start: Date;
    end: Date;
  };
}

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    private eventEmitter: EventEmitter2,
    private auditLogService: AuditLogService,
  ) {}

  /**
   * Get all available billing plans
   */
  async getBillingPlans(): Promise<BillingPlan[]> {
    return [
      {
        id: 'starter',
        name: 'Starter',
        price: 0,
        currency: 'USD',
        interval: 'monthly',
        features: ['Basic workflows', 'Community support'],
        limits: {
          maxWorkflows: 5,
          maxExecutions: 1000,
          maxStorage: 1,
          maxUsers: 1,
          maxIntegrations: 10,
        },
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 29,
        currency: 'USD',
        interval: 'monthly',
        features: [
          'Unlimited workflows',
          'Priority support',
          'Advanced integrations',
          'Custom nodes',
        ],
        limits: {
          maxWorkflows: -1, // unlimited
          maxExecutions: 10000,
          maxStorage: 10,
          maxUsers: 5,
          maxIntegrations: 50,
        },
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 99,
        currency: 'USD',
        interval: 'monthly',
        features: [
          'Everything in Professional',
          'Dedicated support',
          'SSO integration',
          'Custom deployment',
          'Advanced security',
        ],
        limits: {
          maxWorkflows: -1,
          maxExecutions: 100000,
          maxStorage: 100,
          maxUsers: -1,
          maxIntegrations: -1,
        },
      },
    ];
  }

  /**
   * Create a new subscription
   */
  async createSubscription(
    tenantId: string,
    createSubscriptionDto: CreateSubscriptionDto,
    userId: string,
  ): Promise<SubscriptionResponseDto> {
    const existingSubscription = await this.subscriptionRepository.findOne({
      where: { tenantId, status: 'active' },
    });

    if (existingSubscription) {
      throw new BadRequestException('Tenant already has an active subscription');
    }

    const plans = await this.getBillingPlans();
    const plan = plans.find(p => p.id === createSubscriptionDto.planId);

    if (!plan) {
      throw new BadRequestException('Invalid billing plan');
    }

    const subscription = this.subscriptionRepository.create({
      tenantId,
      planId: createSubscriptionDto.planId,
      planName: plan.name,
      amount: plan.price,
      currency: plan.currency,
      interval: plan.interval,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: this.calculatePeriodEnd(new Date(), plan.interval),
      paymentMethodId: createSubscriptionDto.paymentMethodId,
      features: plan.features,
      limits: plan.limits,
    });

    const savedSubscription = await this.subscriptionRepository.save(subscription);

    // Emit subscription created event
    this.eventEmitter.emit('subscription.created', {
      tenantId,
      subscriptionId: savedSubscription.id,
      planId: plan.id,
      amount: plan.price,
    });

    // Log audit event
    await this.auditLogService.log({
      tenantId,
      userId,
      action: 'subscription.created',
      resourceType: 'subscription',
      resourceId: savedSubscription.id,
      ipAddress: 'unknown',
      userAgent: 'unknown',
      newValues: { planId: plan.id, amount: plan.price }
    });

    return this.mapToSubscriptionResponse(savedSubscription);
  }

  /**
   * Update an existing subscription
   */
  async updateSubscription(
    tenantId: string,
    subscriptionId: string,
    updateSubscriptionDto: UpdateSubscriptionDto,
    userId: string,
  ): Promise<SubscriptionResponseDto> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId, tenantId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (updateSubscriptionDto.planId) {
      const plans = await this.getBillingPlans();
      const newPlan = plans.find(p => p.id === updateSubscriptionDto.planId);

      if (!newPlan) {
        throw new BadRequestException('Invalid billing plan');
      }

      subscription.planId = newPlan.id;
      subscription.planName = newPlan.name;
      subscription.amount = newPlan.price;
      subscription.currency = newPlan.currency;
      subscription.interval = newPlan.interval;
      subscription.features = newPlan.features;
      subscription.limits = newPlan.limits;
    }

    if (updateSubscriptionDto.paymentMethodId) {
      subscription.paymentMethodId = updateSubscriptionDto.paymentMethodId;
    }

    if (updateSubscriptionDto.status) {
      subscription.status = updateSubscriptionDto.status;
    }

    const savedSubscription = await this.subscriptionRepository.save(subscription);

    // Emit subscription updated event
    this.eventEmitter.emit('subscription.updated', {
      tenantId,
      subscriptionId: savedSubscription.id,
      oldPlanId: subscription.planId,
      newPlanId: updateSubscriptionDto.planId,
    });

    // Log audit event
    await this.auditLogService.log({
      tenantId,
      userId,
      action: 'subscription.updated',
      resourceType: 'subscription',
      resourceId: savedSubscription.id,
      ipAddress: 'unknown',
      userAgent: 'unknown',
      newValues: updateSubscriptionDto
    });

    return this.mapToSubscriptionResponse(savedSubscription);
  }

  /**
   * Get subscription by tenant
   */
  async getSubscriptionByTenant(tenantId: string): Promise<SubscriptionResponseDto | null> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { tenantId, status: 'active' },
    });

    if (!subscription) {
      return null;
    }

    return this.mapToSubscriptionResponse(subscription);
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    tenantId: string,
    subscriptionId: string,
    userId: string,
  ): Promise<SubscriptionResponseDto> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId, tenantId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();

    const savedSubscription = await this.subscriptionRepository.save(subscription);

    // Emit subscription cancelled event
    this.eventEmitter.emit('subscription.cancelled', {
      tenantId,
      subscriptionId: savedSubscription.id,
    });

    // Log audit event
    await this.auditLogService.log({
      tenantId,
      userId,
      action: 'subscription.cancelled',
      resourceType: 'subscription',
      resourceId: savedSubscription.id,
      ipAddress: 'unknown',
      userAgent: 'unknown'
    });

    return this.mapToSubscriptionResponse(savedSubscription);
  }

  /**
   * Check if tenant has reached usage limits
   */
  async checkUsageLimits(tenantId: string, usageMetrics: UsageMetricsDto): Promise<{
    isWithinLimits: boolean;
    violations: string[];
    usage: UsageMetrics;
  }> {
    const subscription = await this.getSubscriptionByTenant(tenantId);

    if (!subscription) {
      return {
        isWithinLimits: false,
        violations: ['No active subscription'],
        usage: this.mapToUsageMetrics(usageMetrics),
      };
    }

    const violations: string[] = [];
    const limits = subscription.limits;

    if (limits.maxWorkflows !== -1 && usageMetrics.workflowsCount > limits.maxWorkflows) {
      violations.push(`Workflows limit exceeded: ${usageMetrics.workflowsCount}/${limits.maxWorkflows}`);
    }

    if (limits.maxExecutions !== -1 && usageMetrics.executionsCount > limits.maxExecutions) {
      violations.push(`Executions limit exceeded: ${usageMetrics.executionsCount}/${limits.maxExecutions}`);
    }

    if (limits.maxStorage !== -1 && usageMetrics.storageUsed > limits.maxStorage) {
      violations.push(`Storage limit exceeded: ${usageMetrics.storageUsed}GB/${limits.maxStorage}GB`);
    }

    if (limits.maxUsers !== -1 && usageMetrics.usersCount > limits.maxUsers) {
      violations.push(`Users limit exceeded: ${usageMetrics.usersCount}/${limits.maxUsers}`);
    }

    if (limits.maxIntegrations !== -1 && usageMetrics.integrationsCount > limits.maxIntegrations) {
      violations.push(`Integrations limit exceeded: ${usageMetrics.integrationsCount}/${limits.maxIntegrations}`);
    }

    return {
      isWithinLimits: violations.length === 0,
      violations,
      usage: this.mapToUsageMetrics(usageMetrics),
    };
  }

  /**
   * Create an invoice
   */
  async createInvoice(
    tenantId: string,
    createInvoiceDto: CreateInvoiceDto,
    userId: string,
  ): Promise<InvoiceResponseDto> {
    const invoice = this.invoiceRepository.create({
      tenantId,
      subscriptionId: createInvoiceDto.subscriptionId,
      amount: createInvoiceDto.amount,
      currency: createInvoiceDto.currency,
      description: createInvoiceDto.description,
      status: InvoiceStatus.PENDING,
      dueDate: createInvoiceDto.dueDate,
      lineItems: createInvoiceDto.lineItems,
    });

    const savedInvoice = await this.invoiceRepository.save(invoice);

    // Emit invoice created event
    this.eventEmitter.emit('invoice.created', {
      tenantId,
      invoiceId: savedInvoice.id,
      amount: savedInvoice.amount,
    });

    // Log audit event
    await this.auditLogService.log({
      tenantId,
      userId,
      action: 'invoice.created',
      resourceType: 'invoice',
      resourceId: savedInvoice.id,
      ipAddress: 'unknown',
      userAgent: 'unknown',
      newValues: { amount: savedInvoice.amount, currency: savedInvoice.currency }
    });

    return this.mapToInvoiceResponse(savedInvoice);
  }

  /**
   * Get invoices for tenant
   */
  async getInvoicesByTenant(tenantId: string): Promise<InvoiceResponseDto[]> {
    const invoices = await this.invoiceRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });

    return invoices.map(invoice => this.mapToInvoiceResponse(invoice));
  }

  /**
   * Process payment for invoice
   */
  async processPayment(
    tenantId: string,
    invoiceId: string,
    paymentMethodId: string,
    userId: string,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, tenantId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === 'paid') {
      throw new BadRequestException('Invoice is already paid');
    }

    // Here you would integrate with a payment processor like Stripe
    // For now, we'll simulate successful payment
    invoice.status = InvoiceStatus.PAID;
    invoice.paidDate = new Date();
    invoice.paymentMethodId = paymentMethodId;

    const savedInvoice = await this.invoiceRepository.save(invoice);

    // Emit payment processed event
    this.eventEmitter.emit('payment.processed', {
      tenantId,
      invoiceId: savedInvoice.id,
      amount: savedInvoice.amount,
    });

    // Log audit event
    await this.auditLogService.log({
      tenantId,
      userId,
      action: 'payment.processed',
      resourceType: 'invoice',
      resourceId: savedInvoice.id,
      ipAddress: 'unknown',
      userAgent: 'unknown',
      newValues: { amount: savedInvoice.amount, paymentMethodId }
    });

    return this.mapToInvoiceResponse(savedInvoice);
  }

  /**
   * Calculate period end based on interval
   */
  private calculatePeriodEnd(start: Date, interval: string): Date {
    const end = new Date(start);
    
    if (interval === 'monthly') {
      end.setMonth(end.getMonth() + 1);
    } else if (interval === 'yearly') {
      end.setFullYear(end.getFullYear() + 1);
    }

    return end;
  }

  /**
   * Map subscription entity to response DTO
   */
  private mapToSubscriptionResponse(subscription: Subscription): SubscriptionResponseDto {
    return {
      id: subscription.id,
      tenantId: subscription.tenantId,
      planId: subscription.planId,
      planName: subscription.planName,
      status: subscription.status,
      amount: subscription.amount,
      currency: subscription.currency,
      interval: subscription.interval,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      features: subscription.features,
      limits: subscription.limits,
      paymentMethodId: subscription.paymentMethodId,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
      cancelledAt: subscription.cancelledAt,
    };
  }

  /**
   * Map invoice entity to response DTO
   */
  private mapToInvoiceResponse(invoice: Invoice): InvoiceResponseDto {
    return {
      id: invoice.id,
      tenantId: invoice.tenantId,
      subscriptionId: invoice.subscriptionId,
      amount: invoice.amount,
      currency: invoice.currency,
      status: invoice.status,
      description: invoice.description,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidDate,
      lineItems: invoice.lineItems,
      paymentMethodId: invoice.paymentMethodId,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    };
  }

  /**
   * Map usage metrics DTO to interface
   */
  private mapToUsageMetrics(dto: UsageMetricsDto): UsageMetrics {
    return {
      workflowsCount: dto.workflowsCount,
      executionsCount: dto.executionsCount,
      storageUsed: dto.storageUsed,
      usersCount: dto.usersCount,
      integrationsCount: dto.integrationsCount,
      period: {
        start: dto.periodStart,
        end: dto.periodEnd,
      },
    };
  }
}