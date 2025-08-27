import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, FindManyOptions, FindOneOptions } from "typeorm";
import { Credential } from "./entities/credential.entity";
import { CredentialType } from "./entities/credential-type.entity";
import { OAuthToken } from "./entities/oauth-token.entity";

@Injectable()
export class CredentialsRepository {
  constructor(
    @InjectRepository(Credential)
    private readonly credentialRepository: Repository<Credential>,
    @InjectRepository(CredentialType)
    private readonly credentialTypeRepository: Repository<CredentialType>,
    @InjectRepository(OAuthToken)
    private readonly oauthTokenRepository: Repository<OAuthToken>,
  ) {}

  // Credential operations
  async createCredential(
    credentialData: Partial<Credential>,
  ): Promise<Credential> {
    const credential = this.credentialRepository.create(credentialData);
    return this.credentialRepository.save(credential);
  }

  async findCredentials(
    options: FindManyOptions<Credential>,
  ): Promise<Credential[]> {
    return this.credentialRepository.find(options);
  }

  async findCredentialById(
    id: string,
    tenantId: string,
  ): Promise<Credential | null> {
    return this.credentialRepository.findOne({
      where: { id, tenantId },
      relations: ["type"],
    });
  }

  async findCredentialByName(
    name: string,
    tenantId: string,
  ): Promise<Credential | null> {
    return this.credentialRepository.findOne({
      where: { name, tenantId },
      relations: ["type"],
    });
  }

  async updateCredential(credential: Credential): Promise<Credential> {
    return this.credentialRepository.save(credential);
  }

  async deleteCredential(credential: Credential): Promise<void> {
    await this.credentialRepository.remove(credential);
  }

  async countCredentialsByTenant(tenantId: string): Promise<number> {
    return this.credentialRepository.count({
      where: { tenantId },
    });
  }

  async findCredentialsByType(
    typeId: string,
    tenantId: string,
  ): Promise<Credential[]> {
    return this.credentialRepository.find({
      where: { typeId, tenantId },
      relations: ["type"],
      order: { createdAt: "DESC" },
    });
  }

  // Credential Type operations
  async findCredentialTypes(): Promise<CredentialType[]> {
    return this.credentialTypeRepository.find({
      where: { isActive: true },
      order: { displayName: "ASC" },
    });
  }

  async findCredentialTypeById(id: string): Promise<CredentialType | null> {
    return this.credentialTypeRepository.findOne({
      where: { id, isActive: true },
    });
  }

  async findCredentialTypeByName(name: string): Promise<CredentialType | null> {
    return this.credentialTypeRepository.findOne({
      where: { name, isActive: true },
    });
  }

  async createCredentialType(
    typeData: Partial<CredentialType>,
  ): Promise<CredentialType> {
    const credentialType = this.credentialTypeRepository.create(typeData);
    return this.credentialTypeRepository.save(credentialType);
  }

  async updateCredentialType(
    credentialType: CredentialType,
  ): Promise<CredentialType> {
    return this.credentialTypeRepository.save(credentialType);
  }

  // OAuth Token operations
  async findOAuthToken(credentialId: string): Promise<OAuthToken | null> {
    return this.oauthTokenRepository.findOne({
      where: { credentialId },
    });
  }

  async createOAuthToken(tokenData: Partial<OAuthToken>): Promise<OAuthToken> {
    const oauthToken = this.oauthTokenRepository.create(tokenData);
    return this.oauthTokenRepository.save(oauthToken);
  }

  async updateOAuthToken(oauthToken: OAuthToken): Promise<OAuthToken> {
    return this.oauthTokenRepository.save(oauthToken);
  }

  async deleteOAuthToken(oauthToken: OAuthToken): Promise<void> {
    await this.oauthTokenRepository.remove(oauthToken);
  }

  async findExpiredOAuthTokens(): Promise<OAuthToken[]> {
    return this.oauthTokenRepository
      .createQueryBuilder("token")
      .where("token.expiresAt < :now", { now: new Date() })
      .andWhere("token.refreshToken IS NOT NULL")
      .getMany();
  }
}
