import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { ApiProperty } from "@nestjs/swagger";
import { Tenant } from "../../tenants/entities/tenant.entity";

export enum UserStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  SUSPENDED = "suspended",
  DELETED = "deleted",
}

@Entity("users")
@Index(["email"])
@Index(["tenantId"])
export class User {
  @ApiProperty({
    description: "Unique identifier for the user",
    example: "uuid-v4",
  })
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ApiProperty({
    description: "Email address of the user",
    example: "user@example.com",
  })
  @Column({ unique: true })
  @Index()
  email: string;

  @ApiProperty({
    description: "Username for the user",
    example: "johndoe",
  })
  @Column({ nullable: true })
  username: string;

  @ApiProperty({
    description: "First name of the user",
    example: "John",
  })
  @Column({ nullable: true })
  firstName: string;

  @ApiProperty({
    description: "Last name of the user",
    example: "Doe",
  })
  @Column({ nullable: true })
  lastName: string;

  @ApiProperty({
    description: "Hashed password",
  })
  @Column()
  passwordHash: string;

  @ApiProperty({
    description: "Current status of the user",
    enum: UserStatus,
    example: UserStatus.ACTIVE,
  })
  @Column({
    type: "enum",
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @ApiProperty({
    description: "User roles",
    type: [String],
    example: ["user", "admin"],
  })
  @Column("simple-array", { default: "" })
  roles: string[];

  @ApiProperty({
    description: "User permissions",
    type: [String],
    example: ["read:workflows", "write:workflows"],
  })
  @Column("simple-array", { default: "" })
  permissions: string[];

  @ApiProperty({
    description: "Whether the user is active",
    example: true,
  })
  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @ApiProperty({
    description: "Last login timestamp",
    example: "2023-12-01T10:30:00Z",
  })
  @Column({ type: "timestamp", nullable: true })
  lastLoginAt: Date;

  @ApiProperty({
    description: "Tenant ID this user belongs to",
    example: "tenant-uuid",
  })
  @Column({ type: "uuid" })
  @Index()
  tenantId: string;

  @ApiProperty({
    description: "User metadata and settings",
    type: "object",
  })
  @Column({ type: "jsonb", default: {} })
  metadata: Record<string, any>;

  @ApiProperty({
    description: "Timestamp when the user was created",
    example: "2023-11-01T08:00:00Z",
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    description: "Timestamp when the user was last updated",
    example: "2023-12-01T10:30:00Z",
  })
  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Tenant, { eager: false })
  @JoinColumn({ name: "tenantId" })
  tenant: Tenant;

  // Virtual properties
  @ApiProperty({
    description: "Full name of the user",
    example: "John Doe",
  })
  get fullName(): string {
    if (this.firstName && this.lastName) {
      return `${this.firstName} ${this.lastName}`;
    }
    return this.firstName || this.lastName || this.username || this.email;
  }

  get isActiveUser(): boolean {
    return this.status === UserStatus.ACTIVE && this.isActive;
  }
}
