import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Credential } from "./credential.entity";

@Entity("credential_types")
export class CredentialType {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true, length: 100 })
  name: string; // e.g., 'googleApi', 'slackOAuth', 'basicAuth'

  @Column({ length: 255 })
  displayName: string; // e.g., 'Google API', 'Slack OAuth', 'Basic Authentication'

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ nullable: true })
  icon: string; // Icon URL or base64

  @Column("jsonb")
  schema: any; // JSON schema for credential properties

  @Column({ default: false })
  oauth: boolean; // Whether this credential type uses OAuth

  @Column("jsonb", { nullable: true })
  oauthConfig: any; // OAuth configuration (client ID, scopes, endpoints)

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isBuiltIn: boolean; // Built-in types cannot be deleted

  @OneToMany(() => Credential, (credential) => credential.type)
  credentials: Credential[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
