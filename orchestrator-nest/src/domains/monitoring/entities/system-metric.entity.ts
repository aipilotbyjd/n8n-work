import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

export type MetricType = "system" | "application" | "business" | "custom";

@Entity("system_metrics")
@Index(["tenantId", "metricName", "timestamp"])
@Index(["metricType", "timestamp"])
@Index(["timestamp"])
export class SystemMetric {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  tenantId: string;

  @Column()
  metricName: string;

  @Column({
    type: "enum",
    enum: ["system", "application", "business", "custom"],
  })
  metricType: MetricType;

  @Column({ type: "decimal", precision: 15, scale: 6 })
  value: number;

  @Column({ nullable: true })
  unit: string;

  @Column("jsonb", { nullable: true })
  tags: any; // Key-value pairs for additional metadata

  @Column("jsonb", { nullable: true })
  metadata: any; // Additional metric metadata

  @Column({ type: "timestamp" })
  timestamp: Date;

  @CreateDateColumn()
  createdAt: Date;
}
