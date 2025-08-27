import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { NodeType } from "./node-type.entity";

export enum PackageStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  DEPRECATED = "deprecated",
  BANNED = "banned",
}

@Entity("plugin_packages")
@Index(["name", "status"])
@Index(["author", "status"])
export class PluginPackage {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true, length: 100 })
  name: string; // e.g., '@n8n-work/slack-nodes'

  @Column({ length: 255 })
  displayName: string;

  @Column({ type: "text" })
  description: string;

  @Column({ length: 100 })
  author: string;

  @Column({ nullable: true })
  authorEmail: string;

  @Column({ nullable: true })
  authorUrl: string;

  @Column({ default: "1.0.0" })
  version: string;

  @Column({
    type: "enum",
    enum: PackageStatus,
    default: PackageStatus.DRAFT,
  })
  status: PackageStatus;

  @Column("simple-array", { nullable: true })
  keywords: string[];

  @Column({ nullable: true })
  homepage: string;

  @Column({ nullable: true })
  repository: string;

  @Column({ nullable: true })
  bugs: string;

  @Column({ nullable: true })
  license: string;

  @Column("jsonb", { nullable: true })
  manifest: any; // package.json content

  @Column("jsonb", { nullable: true })
  dependencies: any; // NPM dependencies

  @Column("jsonb", { nullable: true })
  peerDependencies: any;

  @Column("text", { nullable: true })
  readme: string; // README.md content

  @Column({ nullable: true })
  iconUrl: string;

  @Column("simple-array", { nullable: true })
  screenshots: string[]; // URLs to screenshots

  @Column({ default: false })
  isOfficial: boolean; // Official n8n-work package

  @Column({ default: false })
  isFeatured: boolean;

  @Column({ default: false })
  isVerified: boolean; // Verified by n8n-work team

  @Column({ default: 0 })
  downloadCount: number;

  @Column({ type: "decimal", precision: 3, scale: 2, default: 0 })
  rating: number;

  @Column({ default: 0 })
  ratingCount: number;

  @Column("uuid")
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  publishedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  lastUpdateCheck: Date;

  @OneToMany(() => NodeType, (nodeType) => nodeType.pluginPackage)
  nodeTypes: NodeType[];

  // Marketplace-specific fields
  @Column("jsonb", { nullable: true })
  pricing: any; // Pricing information for paid plugins

  @Column({ default: false })
  isPaid: boolean;

  @Column("simple-array", { nullable: true })
  supportedPlatforms: string[]; // Supported platforms/environments

  @Column({ nullable: true })
  minN8nVersion: string; // Minimum n8n-work version required

  @Column("jsonb", { nullable: true })
  categories: string[]; // Categories this package belongs to

  @Column("jsonb", { nullable: true })
  tags: string[]; // Additional tags

  @Column("text", { nullable: true })
  installInstructions: string; // Custom installation instructions

  @Column("jsonb", { nullable: true })
  environmentVariables: any; // Required environment variables

  @Column({ default: false })
  requiresDocker: boolean;

  @Column("jsonb", { nullable: true })
  resources: any; // Resource requirements (CPU, memory, etc.)
}
