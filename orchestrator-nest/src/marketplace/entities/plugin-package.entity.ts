import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

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
  publisherId: string;

  @Column({ nullable: true })
  reviewerId: string;

  @Column({ nullable: true })
  reviewReason: string;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}