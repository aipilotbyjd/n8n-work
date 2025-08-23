import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { NodeVersion } from './node-version.entity';
import { PluginPackage } from './plugin-package.entity';

export enum NodeType {
  ACTION = 'action',
  TRIGGER = 'trigger',
  WEBHOOK = 'webhook',
}

export enum NodeCategory {
  COMMUNICATION = 'communication',
  DATA = 'data',
  FILE = 'file',
  PRODUCTIVITY = 'productivity',
  ANALYTICS = 'analytics',
  MARKETING = 'marketing',
  SALES = 'sales',
  DEVELOPMENT = 'development',
  SOCIAL = 'social',
  FINANCE = 'finance',
  UTILITY = 'utility',
  AI = 'ai',
}

@Entity('node_types')
@Index(['name', 'isActive'])
@Index(['category', 'isActive'])
@Index(['nodeType', 'isActive'])
export class NodeType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 100 })
  name: string; // e.g., 'HttpRequestNode', 'SlackNode', 'GoogleSheetsNode'

  @Column({ length: 255 })
  displayName: string; // e.g., 'HTTP Request', 'Slack', 'Google Sheets'

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  icon: string; // Icon URL or base64

  @Column({
    type: 'enum',
    enum: NodeType,
    default: NodeType.ACTION,
  })
  nodeType: NodeType;

  @Column({
    type: 'enum',
    enum: NodeCategory,
    default: NodeCategory.UTILITY,
  })
  category: NodeCategory;

  @Column('jsonb')
  definition: any; // Node definition schema

  @Column('jsonb', { nullable: true })
  properties: any; // Node properties schema

  @Column('jsonb', { nullable: true })
  credentials: any; // Required credential types

  @Column('simple-array', { nullable: true })
  keywords: string[]; // Search keywords

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isBuiltIn: boolean; // Built-in nodes cannot be deleted

  @Column({ default: false })
  isBeta: boolean;

  @Column({ default: false })
  requiresCredentials: boolean;

  @Column('uuid', { nullable: true })
  pluginPackageId: string;

  @ManyToOne(() => PluginPackage, { nullable: true })
  @JoinColumn({ name: 'pluginPackageId' })
  pluginPackage: PluginPackage;

  @Column('uuid', { nullable: true })
  currentVersionId: string;

  @ManyToOne(() => NodeVersion, { nullable: true })
  @JoinColumn({ name: 'currentVersionId' })
  currentVersion: NodeVersion;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Version information
  @Column({ default: '1.0.0' })
  version: string;

  @Column({ nullable: true })
  minNodeVersion: string; // Minimum Node.js version required

  @Column('jsonb', { nullable: true })
  codex: any; // Additional metadata for AI/ML features

  @Column('simple-array', { nullable: true })
  supportedAuthTypes: string[]; // Supported authentication types

  @Column('jsonb', { nullable: true })
  webhookConfig: any; // Webhook-specific configuration

  @Column('jsonb', { nullable: true })
  triggerConfig: any; // Trigger-specific configuration

  @Column({ default: 0 })
  downloadCount: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating: number;

  @Column({ default: 0 })
  ratingCount: number;
}