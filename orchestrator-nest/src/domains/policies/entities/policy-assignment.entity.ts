import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Policy } from "./policy.entity";

export type AssigneeType = "user" | "role" | "group";

@Entity("policy_assignments")
@Index(["policyId", "assigneeType", "assigneeId"], { unique: true })
@Index(["assigneeType", "assigneeId"])
@Index(["tenantId", "assigneeType"])
export class PolicyAssignment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  tenantId: string;

  @Column("uuid")
  policyId: string;

  @Column({
    type: "enum",
    enum: ["user", "role", "group"],
  })
  assigneeType: AssigneeType;

  @Column("uuid")
  assigneeId: string; // User ID, Role ID, or Group ID

  @Column("uuid")
  assignedBy: string;

  @Column({ type: "timestamp", nullable: true })
  expiresAt: Date;

  @Column("jsonb", { nullable: true })
  metadata: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Policy, { onDelete: "CASCADE" })
  @JoinColumn({ name: "policyId" })
  policy: Policy;
}
