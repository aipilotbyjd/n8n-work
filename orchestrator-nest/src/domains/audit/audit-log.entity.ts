import { Entity, PrimaryGeneratedColumn, Column, Index } from "typeorm";

@Entity("audit_logs")
export class AuditLogEntry {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  @Index()
  tenantId: string;

  @Column({ type: "uuid", nullable: true })
  @Index()
  userId: string;

  @Column({ length: 100 })
  @Index()
  action: string;

  @Column({ length: 50 })
  @Index()
  resourceType: string;

  @Column({ type: "uuid" })
  @Index()
  resourceId: string;

  @Column({ type: "jsonb", nullable: true })
  oldValues: any;

  @Column({ type: "jsonb", nullable: true })
  newValues: any;

  @Column({ length: 50 })
  ipAddress: string;

  @Column({ length: 255 })
  userAgent: string;

  @Column({
    type: "timestamp with time zone",
    default: () => "CURRENT_TIMESTAMP",
  })
  @Index()
  timestamp: Date;
}
