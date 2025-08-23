import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Credential } from './credential.entity';

@Entity('oauth_tokens')
export class OAuthToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  credentialId: string;

  @OneToOne(() => Credential)
  @JoinColumn({ name: 'credentialId' })
  credential: Credential;

  @Column('text')
  accessToken: string; // Encrypted

  @Column('text', { nullable: true })
  refreshToken: string; // Encrypted

  @Column({ nullable: true })
  tokenType: string; // Usually 'Bearer'

  @Column({ type: 'int', nullable: true })
  expiresIn: number; // Seconds until expiration

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column('simple-array', { nullable: true })
  scopes: string[];

  @Column('jsonb', { nullable: true })
  additionalData: any; // Any additional OAuth data

  @Column('uuid')
  tenantId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}