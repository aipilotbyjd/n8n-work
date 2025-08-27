// Core DTOs
export class CreateSubscriptionDto {
  planId: string;
  paymentMethodId?: string;
  trialEnd?: Date;
}

export class UpdateSubscriptionDto {
  planId?: string;
  paymentMethodId?: string;
  status?: "active" | "cancelled" | "past_due" | "unpaid" | "trialing";
  cancelAtPeriodEnd?: boolean;
  cancellationReason?: string;
}

export class SubscriptionResponseDto {
  id: string;
  tenantId: string;
  planId: string;
  planName: string;
  status: string;
  amount: number;
  currency: string;
  interval: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  features: string[];
  limits: any;
  paymentMethodId?: string;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt?: Date;
}

export class CreateInvoiceDto {
  subscriptionId: string;
  amount: number;
  currency: string;
  description?: string;
  dueDate: Date;
  lineItems: any[];
}

export class InvoiceResponseDto {
  id: string;
  tenantId: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  dueDate: Date;
  paidAt?: Date;
  lineItems: any[];
  paymentMethodId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UsageMetricsDto {
  workflowsCount: number;
  executionsCount: number;
  storageUsed: number;
  usersCount: number;
  integrationsCount: number;
  periodStart: Date;
  periodEnd: Date;
}

export class PaymentMethodDto {
  paymentMethodId: string;
  type?: string;
  last4?: string;
  brand?: string;
}

export class BillingResponseDto {
  success: boolean;
  message?: string;
  data?: any;
}
