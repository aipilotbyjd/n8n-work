import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export interface PluginRating {
  userId: string;
  rating: number;
  comment?: string;
  review?: string; // Adding review property
  createdAt: Date;
}

@Entity('plugin_packages')
export class PluginPackage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  version: string;

  @Column()
  description: string;

  @Column()
  author: string;

  @Column('jsonb')
  manifest: Record<string, any>;

  @Column({
    type: 'enum',
    enum: ['pending', 'approved', 'rejected', 'published'],
    default: 'pending'
  })
  status: string;

  @Column('text', { nullable: true })
  packageData: string;

  @Column({ nullable: true })
  signature: string;

  @Column({ nullable: true })
  signatureAlgorithm: string;

  @Column({ nullable: true })
  packageUrl: string;

  @Column({ type: 'bigint', default: 0 })
  downloadCount: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  averageRating: number;

  @Column('jsonb', { default: [] })
  ratings: PluginRating[];

  @Column({ nullable: true })
  publisherId: string;

  @Column({ type: 'boolean', default: false })
  publisherVerified: boolean;

  @Column({ nullable: true })
  reviewerId: string;

  @Column({ nullable: true })
  reviewReason: string;

  @Column({ nullable: true })
  rejectionReason: string;

  @Column({ nullable: true })
  approvedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}