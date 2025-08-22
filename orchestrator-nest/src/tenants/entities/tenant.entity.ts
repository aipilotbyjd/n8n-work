import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Workflow } from '../../domains/workflows/entities/workflow.entity';
import { User } from '../../auth/entities/user.entity';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  active: boolean;

  @Column('jsonb', { nullable: true })
  settings: Record<string, any>;

  @Column('jsonb', { nullable: true })
  limits: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Workflow, (workflow) => workflow.tenant)
  workflows: Workflow[];

  @OneToMany(() => User, (user) => user.tenant)
  users: User[];
}