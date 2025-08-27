import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { ApiProperty } from "@nestjs/swagger";

export enum TenantStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  SUSPENDED = "suspended",
  DELETED = "deleted",
}

export enum TenantPlan {
  FREE = "free",
  STARTER = "starter",
  PROFESSIONAL = "professional",
  ENTERPRISE = "enterprise",
}

@Entity("tenants")
@Index(["name"])
@Index(["status"])
export class Tenant {
  @ApiProperty({
    description: "Unique identifier for the tenant",
    example: "uuid-v4",
  })
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ApiProperty({
    description: "Name of the tenant organization",
    example: "Acme Corp",
  })
  @Column({ type: "varchar", length: 255 })
  @Index()
  name: string;

  @ApiProperty({
    description: "Display name for the tenant",
    example: "Acme Corporation",
  })
  @Column({ type: "varchar", length: 255, nullable: true })
  displayName: string;

  @ApiProperty({
    description: "Description of the tenant",
    example: "Leading provider of innovative solutions",
  })
  @Column({ type: "text", nullable: true })
  description: string;

  @ApiProperty({
    description: "Current status of the tenant",
    enum: TenantStatus,
    example: TenantStatus.ACTIVE,
  })
  @Column({
    type: "enum",
    enum: TenantStatus,
    default: TenantStatus.ACTIVE,
  })
  status: TenantStatus;

  @ApiProperty({
    description: "Subscription plan of the tenant",
    enum: TenantPlan,
    example: TenantPlan.PROFESSIONAL,
  })
  @Column({
    type: "enum",
    enum: TenantPlan,
    default: TenantPlan.FREE,
  })
  plan: TenantPlan;

  @ApiProperty({
    description: "Tenant configuration and settings",
    type: "object",
  })
  @Column({ type: "jsonb", default: {} })
  settings: Record<string, any>;

  @ApiProperty({
    description: "Tenant metadata and custom properties",
    type: "object",
  })
  @Column({ type: "jsonb", default: {} })
  metadata: Record<string, any>;

  @ApiProperty({
    description: "Whether the tenant is active",
    example: true,
  })
  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @ApiProperty({
    description: "Timestamp when the tenant was created",
    example: "2023-11-01T08:00:00Z",
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    description: "Timestamp when the tenant was last updated",
    example: "2023-12-01T10:30:00Z",
  })
  @UpdateDateColumn()
  updatedAt: Date;

  // Virtual properties
  get isActiveStatus(): boolean {
    return this.status === TenantStatus.ACTIVE && this.isActive;
  }
}
