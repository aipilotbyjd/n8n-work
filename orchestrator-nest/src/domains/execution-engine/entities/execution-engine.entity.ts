import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Tenant } from "../../tenants/entities/tenant.entity";
import { User } from "../../auth/entities/user.entity";
import { Workflow } from "../../workflows/entities/workflow.entity";

export enum ExecutionStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

@Entity("executions")
export class Execution {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  workflowId: string;

  @ManyToOne(() => Workflow)
  @JoinColumn({ name: "workflowId" })
  workflow: Workflow;

  @Column({ type: "jsonb", nullable: true })
  input: Record<string, any>;

  @Column({ type: "jsonb", nullable: true })
  output: Record<string, any>;

  @Column({ type: "text", nullable: true })
  error: string;

  @Column({
    type: "enum",
    enum: ExecutionStatus,
    default: ExecutionStatus.PENDING,
  })
  status: ExecutionStatus;

  @Column({ nullable: true })
  engineVersion: string; // Version of execution engine

  @Column()
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: "tenantId" })
  tenant: Tenant;

  @Column()
  createdBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "createdBy" })
  creator: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
