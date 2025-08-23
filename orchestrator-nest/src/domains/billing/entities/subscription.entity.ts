import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';

export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'unpaid' | 'trialing';
export type SubscriptionInterval = 'monthly' | 'yearly';

export interface SubscriptionLimits {
  maxWorkflows: number;
  maxExecutions: number;
  maxStorage: number; // in GB
  maxUsers: number;
  maxIntegrations: number;
}

@Entity('subscriptions')
@Index(['tenantId', 'status'])
@Index(['status', 'currentPeriodEnd'])
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenantId: string;

  @Column()
  planId: string;

  @Column()
  planName: string;

  @Column({
    type: 'enum',
    enum: ['active', 'cancelled', 'past_due', 'unpaid', 'trialing'],
    default: 'active',
  })
  status: SubscriptionStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ default: 'USD' })
  currency: string;

  @Column({
    type: 'enum',
    enum: ['monthly', 'yearly'],
    default: 'monthly',
  })
  interval: SubscriptionInterval;

  @Column({ type: 'timestamp' })
  currentPeriodStart: Date;

  @Column({ type: 'timestamp' })
  currentPeriodEnd: Date;

  @Column('simple-array')
  features: string[];

  @Column('jsonb')
  limits: SubscriptionLimits;

  @Column({ nullable: true })
  paymentMethodId: string;

  @Column({ type: 'timestamp', nullable: true })
  trialStart: Date;

  @Column({ type: 'timestamp', nullable: true })
  trialEnd: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date;

  @Column({ nullable: true })
  cancellationReason: string;

  @Column({ default: false })
  cancelAtPeriodEnd: boolean;

  @Column('jsonb', { nullable: true })
  metadata: any;

  @OneToMany('Invoice', 'subscription')
  invoices: Invoice[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// Type declaration for circular dependency
interface Invoice {
  id: string;
  subscription: Subscription;
}