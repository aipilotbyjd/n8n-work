import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type HealthCheckStatus = 'healthy' | 'degraded' | 'unhealthy';

@Entity('health_checks')
@Index(['tenantId', 'checkName', 'timestamp'])
@Index(['checkName', 'status'])
@Index(['timestamp'])
export class HealthCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenantId: string;

  @Column()
  checkName: string;

  @Column({
    type: 'enum',
    enum: ['healthy', 'degraded', 'unhealthy'],
  })
  status: HealthCheckStatus;

  @Column({ type: 'int', default: 0 })
  responseTime: number;

  @Column({ nullable: true })
  message: string;

  @Column('jsonb', { nullable: true })
  details: any;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @CreateDateColumn()
  createdAt: Date;
}