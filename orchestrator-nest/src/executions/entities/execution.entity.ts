import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Workflow } from "../../domains/workflows/entities/workflow.entity";

export enum ExecutionStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  TIMEOUT = "timeout",
  WAITING = "waiting",
}

@Entity("executions")
export class Execution {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  workflowId: string;

  @Column("uuid")
  tenantId: string;

  @Column({
    type: "enum",
    enum: ExecutionStatus,
    default: ExecutionStatus.PENDING,
  })
  status: ExecutionStatus;

  @Column({ nullable: true })
  triggeredBy: string;

  @Column({ nullable: true })
  triggerType: string;

  @Column("jsonb", { nullable: true })
  triggerData: Record<string, any>;

  @Column("jsonb", { nullable: true })
  inputData: Record<string, any>;

  @Column("jsonb", { nullable: true })
  outputData: Record<string, any>;

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ nullable: true })
  errorCode: string;

  @Column("bigint", { nullable: true })
  durationMs: number;

  @Column("jsonb", { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  startedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Workflow, (workflow) => workflow.executions)
  @JoinColumn({ name: "workflowId" })
  workflow: Workflow;
}
