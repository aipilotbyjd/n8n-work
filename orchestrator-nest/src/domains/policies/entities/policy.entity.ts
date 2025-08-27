import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

export type PolicyType =
  | "access_control"
  | "security"
  | "compliance"
  | "resource_limit";
export type PolicyEffect = "allow" | "deny";
export type PolicyStatus = "draft" | "active" | "inactive" | "deprecated";

@Entity("policies")
@Index(["tenantId", "type"])
@Index(["tenantId", "status"])
@Index(["name", "tenantId"], { unique: true })
export class Policy {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  tenantId: string;

  @Column()
  name: string;

  @Column("text", { nullable: true })
  description: string;

  @Column({
    type: "enum",
    enum: ["access_control", "security", "compliance", "resource_limit"],
  })
  type: PolicyType;

  @Column({
    type: "enum",
    enum: ["allow", "deny"],
    default: "allow",
  })
  effect: PolicyEffect;

  @Column({
    type: "enum",
    enum: ["draft", "active", "inactive", "deprecated"],
    default: "draft",
  })
  status: PolicyStatus;

  @Column("simple-array", { nullable: true })
  resources: string[]; // Resource patterns this policy applies to

  @Column("simple-array", { nullable: true })
  actions: string[]; // Actions this policy covers

  @Column("jsonb", { nullable: true })
  conditions: any; // Additional conditions for policy evaluation

  @Column({ type: "int", default: 100 })
  priority: number; // Higher number = higher priority

  @Column("jsonb", { nullable: true })
  metadata: any; // Additional metadata

  @Column("uuid")
  createdBy: string;

  @Column("uuid", { nullable: true })
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
