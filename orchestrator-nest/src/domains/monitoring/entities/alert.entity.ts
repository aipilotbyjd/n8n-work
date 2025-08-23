import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'suppressed';
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';
export type AlertType = 'system' | 'application' | 'business' | 'security';

@Entity('alerts')
@Index(['tenantId', 'status'])
@Index(['severity', 'status'])
@Index(['alertType', 'status'])
@Index(['triggeredAt'])
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenantId: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: ['critical', 'high', 'medium', 'low'],
    default: 'medium',
  })
  severity: AlertSeverity;

  @Column({
    type: 'enum',
    enum: ['active', 'acknowledged', 'resolved', 'suppressed'],
    default: 'active',
  })
  status: AlertStatus;

  @Column({
    type: 'enum',
    enum: ['system', 'application', 'business', 'security'],
    default: 'system',
  })
  alertType: AlertType;

  @Column({ nullable: true })
  source: string;

  @Column('jsonb', { nullable: true })
  conditions: any;

  @Column('jsonb', { nullable: true })
  actions: any;

  @Column('jsonb', { nullable: true })
  metadata: any;

  @Column({ type: 'timestamp', nullable: true })
  triggeredAt: Date;

  @Column('uuid', { nullable: true })
  acknowledgedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  acknowledgedAt: Date;

  @Column('uuid', { nullable: true })
  resolvedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @Column('uuid', { nullable: true })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}