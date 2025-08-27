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
import { CredentialType } from "./credential-type.entity";

@Entity("credentials")
@Index(["tenantId", "name"], { unique: true })
@Index(["tenantId", "isActive"])
export class Credential {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column("uuid")
  typeId: string;

  @ManyToOne(() => CredentialType, { eager: false })
  @JoinColumn({ name: "typeId" })
  type: CredentialType;

  @Column("text")
  data: string; // Encrypted credential data

  @Column({ default: true })
  isActive: boolean;

  @Column("uuid")
  tenantId: string;

  @Column("uuid")
  createdBy: string;

  @Column("uuid")
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // OAuth-specific fields
  @Column({ nullable: true })
  oauthTokenId: string;

  @Column({ type: "timestamp", nullable: true })
  lastTestedAt: Date;

  @Column({ default: false })
  testPassed: boolean;
}
