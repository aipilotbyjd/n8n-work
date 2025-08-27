import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { NodeType } from "./node-type.entity";

@Entity("node_versions")
@Index(["nodeTypeId", "version"], { unique: true })
@Index(["nodeTypeId", "isActive"])
export class NodeVersion {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  nodeTypeId: string;

  @ManyToOne(() => NodeType)
  @JoinColumn({ name: "nodeTypeId" })
  nodeType: NodeType;

  @Column({ length: 20 })
  version: string; // Semantic version (e.g., '1.2.3')

  @Column("text")
  code: string; // Node implementation code

  @Column("jsonb")
  definition: any; // Node definition for this version

  @Column("jsonb", { nullable: true })
  changelog: any; // What changed in this version

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isStable: boolean; // Whether this version is considered stable

  @Column({ default: false })
  isDeprecated: boolean;

  @Column({ nullable: true })
  deprecationMessage: string;

  @Column("simple-array", { nullable: true })
  breakingChanges: string[]; // List of breaking changes

  @Column("jsonb", { nullable: true })
  migrationInstructions: any; // How to migrate from previous versions

  @Column({ nullable: true })
  minEngineVersion: string; // Minimum execution engine version required

  @Column("jsonb", { nullable: true })
  testCases: any; // Test cases for this version

  @Column("uuid")
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  publishedAt: Date;

  @Column({ default: 0 })
  downloadCount: number;

  @Column("jsonb", { nullable: true })
  dependencies: any; // NPM dependencies for this version

  @Column("text", { nullable: true })
  documentation: string; // Markdown documentation

  @Column("jsonb", { nullable: true })
  examples: any; // Usage examples
}
