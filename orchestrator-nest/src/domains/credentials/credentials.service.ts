import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Credential } from "./entities/credential.entity";
import { CredentialType } from "./entities/credential-type.entity";
import { OAuthToken } from "./entities/oauth-token.entity";
import { CreateCredentialDto } from "./dto/create-credential.dto";
import { UpdateCredentialDto } from "./dto/update-credential.dto";
import { CredentialResponseDto } from "./dto/credential-response.dto";
import { CredentialEncryptionService } from "./services/credential-encryption.service";
import { OAuthService } from "./services/oauth.service";
import { CredentialValidationService } from "./services/credential-validation.service";
import { TenantService } from "../tenants/tenants.service";
import { MetricsService } from "../../observability/metrics.service";
import { AuditLogService } from "../audit/audit-log.service";

@Injectable()
export class CredentialsService {
  constructor(
    @InjectRepository(Credential)
    private readonly credentialRepository: Repository<Credential>,
    @InjectRepository(CredentialType)
    private readonly credentialTypeRepository: Repository<CredentialType>,
    @InjectRepository(OAuthToken)
    private readonly oauthTokenRepository: Repository<OAuthToken>,
    private readonly encryptionService: CredentialEncryptionService,
    private readonly oauthService: OAuthService,
    private readonly validationService: CredentialValidationService,
    private readonly tenantService: TenantService,
    private readonly metricsService: MetricsService,
    private readonly auditService: AuditLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new credential
   */
  async create(
    createCredentialDto: CreateCredentialDto,
    tenantId: string,
    userId: string,
  ): Promise<CredentialResponseDto> {
    // Validate tenant
    await this.tenantService.findById(tenantId);

    // Validate credential type
    const credentialType = await this.credentialTypeRepository.findOne({
      where: { id: createCredentialDto.typeId },
    });

    if (!credentialType) {
      throw new NotFoundException("Credential type not found");
    }

    // Check for duplicate names within tenant
    const existingCredential = await this.credentialRepository.findOne({
      where: {
        name: createCredentialDto.name,
        tenantId,
      },
    });

    if (existingCredential) {
      throw new ConflictException("Credential with this name already exists");
    }

    // Validate credential data against type schema
    await this.validationService.validateCredentialData(
      createCredentialDto.data,
      credentialType.schema,
    );

    // Encrypt sensitive data
    const encryptedData = await this.encryptionService.encrypt(
      createCredentialDto.data,
      tenantId,
    );

    // Create credential
    const credential = this.credentialRepository.create({
      ...createCredentialDto,
      data: encryptedData,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
      type: credentialType,
    });

    const savedCredential = await this.credentialRepository.save(credential);

    // Emit event
    this.eventEmitter.emit("credential.created", {
      credentialId: savedCredential.id,
      tenantId,
      userId,
    });

    // Log audit event
    await this.auditService.log({
      action: "credential.created",
      resourceType: "credential",
      resourceId: savedCredential.id,
      tenantId,
      userId,
      ipAddress: "unknown",
      userAgent: "unknown",
      newValues: { credentialName: savedCredential.name },
    });

    // Update metrics
    this.metricsService.incrementCounter("credentials_created_total", {
      tenant_id: tenantId,
      credential_type: credentialType.name,
    });

    return this.toResponseDto(savedCredential);
  }

  /**
   * Find all credentials for a tenant
   */
  async findAll(
    tenantId: string,
    includeData = false,
  ): Promise<CredentialResponseDto[]> {
    const credentials = await this.credentialRepository.find({
      where: { tenantId },
      relations: ["type"],
      order: { createdAt: "DESC" },
    });

    return Promise.all(
      credentials.map((credential) =>
        this.toResponseDto(credential, includeData),
      ),
    );
  }

  /**
   * Find a credential by ID
   */
  async findOne(
    id: string,
    tenantId: string,
    includeData = false,
  ): Promise<CredentialResponseDto> {
    const credential = await this.credentialRepository.findOne({
      where: { id, tenantId },
      relations: ["type"],
    });

    if (!credential) {
      throw new NotFoundException("Credential not found");
    }

    return this.toResponseDto(credential, includeData);
  }

  /**
   * Update a credential
   */
  async update(
    id: string,
    updateCredentialDto: UpdateCredentialDto,
    tenantId: string,
    userId: string,
  ): Promise<CredentialResponseDto> {
    const credential = await this.credentialRepository.findOne({
      where: { id, tenantId },
      relations: ["type"],
    });

    if (!credential) {
      throw new NotFoundException("Credential not found");
    }

    // Check for name conflicts if name is being updated
    if (
      updateCredentialDto.name &&
      updateCredentialDto.name !== credential.name
    ) {
      const existingCredential = await this.credentialRepository.findOne({
        where: {
          name: updateCredentialDto.name,
          tenantId,
          id: { $ne: id } as any,
        },
      });

      if (existingCredential) {
        throw new ConflictException("Credential with this name already exists");
      }
    }

    // Validate and encrypt new data if provided
    let encryptedData = credential.data;
    if (updateCredentialDto.data) {
      await this.validationService.validateCredentialData(
        updateCredentialDto.data,
        credential.type.schema,
      );

      encryptedData = await this.encryptionService.encrypt(
        updateCredentialDto.data,
        tenantId,
      );
    }

    // Update credential
    Object.assign(credential, {
      ...updateCredentialDto,
      data: encryptedData,
      updatedBy: userId,
      updatedAt: new Date(),
    });

    const savedCredential = await this.credentialRepository.save(credential);

    // Emit event
    this.eventEmitter.emit("credential.updated", {
      credentialId: savedCredential.id,
      tenantId,
      userId,
    });

    // Log audit event
    await this.auditService.log({
      action: "credential.updated",
      resourceType: "credential",
      resourceId: savedCredential.id,
      tenantId,
      userId,
      ipAddress: "unknown",
      userAgent: "unknown",
      newValues: { credentialName: savedCredential.name },
    });

    return this.toResponseDto(savedCredential);
  }

  /**
   * Delete a credential
   */
  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const credential = await this.credentialRepository.findOne({
      where: { id, tenantId },
    });

    if (!credential) {
      throw new NotFoundException("Credential not found");
    }

    // Check if credential is in use by any workflows
    // This would require checking workflow nodes for credential references
    // For now, we'll just delete it

    await this.credentialRepository.remove(credential);

    // Emit event
    this.eventEmitter.emit("credential.deleted", {
      credentialId: id,
      tenantId,
      userId,
    });

    // Log audit event
    await this.auditService.log({
      action: "credential.deleted",
      resourceType: "credential",
      resourceId: id,
      tenantId,
      userId,
      ipAddress: "unknown",
      userAgent: "unknown",
      oldValues: { credentialName: credential.name },
    });

    // Update metrics
    this.metricsService.incrementCounter("credentials_deleted_total", {
      tenant_id: tenantId,
    });
  }

  /**
   * Test a credential (verify it works with the target service)
   */
  async test(
    id: string,
    tenantId: string,
  ): Promise<{ success: boolean; message?: string }> {
    const credential = await this.credentialRepository.findOne({
      where: { id, tenantId },
      relations: ["type"],
    });

    if (!credential) {
      throw new NotFoundException("Credential not found");
    }

    try {
      // Decrypt the credential data
      const decryptedData = await this.encryptionService.decrypt(
        credential.data,
        tenantId,
      );

      // Perform validation based on credential type
      const isValid = await this.validationService.testCredential(
        decryptedData,
        credential.type,
      );

      // Update metrics
      this.metricsService.incrementCounter("credentials_tested_total", {
        tenant_id: tenantId,
        credential_type: credential.type.name,
        success: isValid.toString(),
      });

      return isValid
        ? { success: true, message: "Credential test successful" }
        : { success: false, message: "Credential test failed" };
    } catch (error) {
      // Update metrics
      this.metricsService.incrementCounter("credentials_tested_total", {
        tenant_id: tenantId,
        credential_type: credential.type.name,
        success: "false",
      });

      return {
        success: false,
        message: error.message || "Credential test failed",
      };
    }
  }

  /**
   * Get decrypted credential data (for internal use by workflows)
   */
  async getDecryptedCredential(id: string, tenantId: string): Promise<any> {
    const credential = await this.credentialRepository.findOne({
      where: { id, tenantId },
    });

    if (!credential) {
      throw new NotFoundException("Credential not found");
    }

    return this.encryptionService.decrypt(credential.data, tenantId);
  }

  /**
   * Start OAuth flow for a credential
   */
  async startOAuthFlow(
    credentialId: string,
    tenantId: string,
    redirectUrl?: string,
  ): Promise<{ authUrl: string; state: string }> {
    const credential = await this.credentialRepository.findOne({
      where: { id: credentialId, tenantId },
      relations: ["type"],
    });

    if (!credential) {
      throw new NotFoundException("Credential not found");
    }

    if (!credential.type.oauth) {
      throw new BadRequestException("Credential type does not support OAuth");
    }

    return this.oauthService.startFlow(credential, redirectUrl);
  }

  /**
   * Complete OAuth flow
   */
  async completeOAuthFlow(
    state: string,
    code: string,
    tenantId: string,
  ): Promise<CredentialResponseDto> {
    return this.oauthService.completeFlow(state, code, tenantId);
  }

  /**
   * Refresh OAuth token
   */
  async refreshOAuthToken(
    credentialId: string,
    tenantId: string,
  ): Promise<CredentialResponseDto> {
    const credential = await this.credentialRepository.findOne({
      where: { id: credentialId, tenantId },
      relations: ["type"],
    });

    if (!credential) {
      throw new NotFoundException("Credential not found");
    }

    return this.oauthService.refreshToken(credential);
  }

  /**
   * Get available credential types
   */
  async getCredentialTypes(): Promise<CredentialType[]> {
    return this.credentialTypeRepository.find({
      order: { name: "ASC" },
    });
  }

  /**
   * Convert credential entity to response DTO
   */
  private async toResponseDto(
    credential: Credential,
    includeData = false,
  ): Promise<CredentialResponseDto> {
    const response: CredentialResponseDto = {
      id: credential.id,
      name: credential.name,
      description: credential.description,
      type: {
        id: credential.type.id,
        name: credential.type.name,
        displayName: credential.type.displayName,
        icon: credential.type.icon,
        oauth: credential.type.oauth,
      },
      isActive: credential.isActive,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
      createdBy: credential.createdBy,
      updatedBy: credential.updatedBy,
    };

    if (includeData) {
      // Only include decrypted data if explicitly requested and user has permission
      response.data = await this.encryptionService.decrypt(
        credential.data,
        credential.tenantId,
      );
    }

    return response;
  }
}
