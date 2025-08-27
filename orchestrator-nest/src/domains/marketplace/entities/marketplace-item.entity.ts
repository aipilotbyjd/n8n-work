import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from "typeorm";

export type MarketplaceItemType =
  | "workflow_template"
  | "custom_node"
  | "integration"
  | "plugin";
export type MarketplaceItemStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "deprecated";

@Entity("marketplace_items")
@Index(["status", "category"])
@Index(["type", "status"])
@Index(["rating", "downloadCount"])
@Index(["featured", "status"])
export class MarketplaceItem {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column("text")
  description: string;

  @Column()
  category: string;

  @Column({
    type: "enum",
    enum: ["workflow_template", "custom_node", "integration", "plugin"],
  })
  type: MarketplaceItemType;

  @Column("simple-array")
  tags: string[];

  @Column("uuid")
  tenantId: string;

  @Column("uuid")
  authorId: string;

  @Column()
  authorName: string;

  @Column({ default: "1.0.0" })
  version: string;

  @Column({
    type: "enum",
    enum: ["draft", "pending_review", "approved", "rejected", "deprecated"],
    default: "draft",
  })
  status: MarketplaceItemStatus;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0 })
  rating: number;

  @Column({ type: "int", default: 0 })
  reviewCount: number;

  @Column({ type: "int", default: 0 })
  downloadCount: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ default: "USD" })
  currency: string;

  @Column("simple-array", { nullable: true })
  screenshots: string[];

  @Column("text", { nullable: true })
  documentation: string;

  @Column("jsonb", { nullable: true })
  workflowDefinition: any; // For workflow templates

  @Column("text", { nullable: true })
  code: string; // For custom nodes/integrations

  @Column("jsonb", { nullable: true })
  configuration: any; // Configuration schema

  @Column("simple-array", { nullable: true })
  dependencies: string[]; // Required dependencies

  @Column("jsonb", { nullable: true })
  compatibility: any; // Compatibility requirements

  @Column({ default: false })
  featured: boolean;

  @Column("jsonb", { nullable: true })
  metadata: any;

  @Column({ nullable: true })
  licenseType: string;

  @Column("text", { nullable: true })
  changelog: string;

  @Column({ nullable: true })
  supportUrl: string;

  @Column({ nullable: true })
  homepageUrl: string;

  @Column({ nullable: true })
  repositoryUrl: string;

  @OneToMany(() => MarketplaceReview, (review) => review.item)
  reviews: MarketplaceReview[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// Import at the end to avoid circular dependencies
import { MarketplaceReview } from "./marketplace-review.entity";
