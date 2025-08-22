import { Injectable, Logger, OnModuleInit, Inject, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Vault from 'node-vault';
import * as AWS from 'aws-sdk';
import * as crypto from 'crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { Request } from 'express';

export interface SecurityContext {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  isAuthenticated: boolean;
}

export interface JwtPayload {
  sub: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  iat: number;
  exp: number;
}

@Injectable()
export class SecurityService implements OnModuleInit {
  private readonly logger = new Logger(SecurityService.name);
  private vault: any;
  private kms: AWS.KMS;
  private encryptionKey: string;
  private keyRotationInterval: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {
    this.initializeKMS();
    this.initializeVault();
  }

  async onModuleInit() {
    await this.initializeSecurity();
    this.startKeyRotation();
  }

  private async initializeKMS() {
    if (this.config.get('security.kms.provider') === 'aws') {
      this.kms = new AWS.KMS({
        region: this.config.get('aws.region'),
        accessKeyId: this.config.get('aws.accessKeyId'),
        secretAccessKey: this.config.get('aws.secretAccessKey'),
      });
      this.logger.log('AWS KMS initialized');
    }
  }

  private async initializeVault() {
    try {
      this.vault = Vault({
        endpoint: this.config.get('vault.endpoint', 'http://localhost:8200'),
        token: this.config.get('vault.token'),
      });

      // Test vault connection
      await this.vault.health();
      this.logger.log('Vault connection established');

      // Initialize KV secrets engine
      await this.setupVaultPolicies();
    } catch (error) {
      this.logger.error('Failed to initialize Vault', error);
    }
  }

  private async initializeSecurity() {
    // Generate or retrieve master encryption key
    this.encryptionKey = await this.getMasterEncryptionKey();
    
    // Setup security policies
    await this.setupSecurityPolicies();
    
    // Initialize audit logging
    await this.initializeAuditLogging();

    this.logger.log('Security service initialized');
  }

  private async setupVaultPolicies() {
    const policies = {
      'n8n-work-orchestrator': {
        path: {
          'secret/data/orchestrator/*': {
            capabilities: ['read', 'list'],
          },
          'secret/data/shared/*': {
            capabilities: ['read'],
          },
          'auth/token/lookup-self': {
            capabilities: ['read'],
          },
        },
      },
      'n8n-work-engine': {
        path: {
          'secret/data/engine/*': {
            capabilities: ['read', 'list'],
          },
          'secret/data/shared/*': {
            capabilities: ['read'],
          },
        },
      },
      'n8n-work-node-runner': {
        path: {
          'secret/data/node-runner/*': {
            capabilities: ['read', 'list'],
          },
          'secret/data/plugins/*': {
            capabilities: ['read'],
          },
        },
      },
    };

    for (const [name, policy] of Object.entries(policies)) {
      try {
        await this.vault.policy({
          name,
          rules: this.generateVaultPolicy(policy),
        });
        this.logger.log(`Vault policy '${name}' configured`);
      } catch (error) {
        this.logger.warn(`Failed to setup vault policy '${name}'`, error);
      }
    }
  }

  private generateVaultPolicy(policy: any): string {
    let rules = '';
    for (const [path, permissions] of Object.entries(policy.path)) {
      rules += `path "${path}" {\n`;
      rules += `  capabilities = ${JSON.stringify((permissions as any).capabilities)}\n`;
      rules += `}\n\n`;
    }
    return rules;
  }

  private async setupSecurityPolicies() {
    const defaultPolicies = {
      passwordPolicy: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: true,
        maxAge: 90, // days
      },
      sessionPolicy: {
        maxDuration: 24 * 60 * 60, // 24 hours
        idleTimeout: 2 * 60 * 60, // 2 hours
        requireMFA: false,
      },
      apiKeyPolicy: {
        maxDuration: 365 * 24 * 60 * 60, // 1 year
        rotationRequired: true,
        rotationInterval: 90 * 24 * 60 * 60, // 90 days
      },
      rateLimitPolicy: {
        default: { windowMs: 60000, max: 1000 },
        auth: { windowMs: 60000, max: 10 },
        webhook: { windowMs: 60000, max: 10000 },
      },
    };

    await this.storeSecretInVault('shared/security-policies', defaultPolicies);
  }

  private async initializeAuditLogging() {
    // Configure audit log destinations
    const auditConfig = {
      destinations: ['file', 'vault', 'siem'],
      retention: {
        file: '90d',
        vault: '7y',
        siem: 'unlimited',
      },
      format: 'json',
      immutable: true,
    };

    await this.storeSecretInVault('shared/audit-config', auditConfig);
  }

  async getMasterEncryptionKey(): Promise<string> {
    try {
      // Try to get from Vault first
      const vaultKey = await this.getSecretFromVault('shared/master-key');
      if (vaultKey) {
        return vaultKey.key;
      }

      // Generate new key if not found
      const newKey = crypto.randomBytes(32).toString('hex');
      await this.storeSecretInVault('shared/master-key', { key: newKey });
      
      this.logger.log('New master encryption key generated');
      return newKey;
    } catch (error) {
      this.logger.error('Failed to get master encryption key', error);
      // Fallback to environment variable
      return this.config.get('security.masterKey') || crypto.randomBytes(32).toString('hex');
    }
  }

  async encryptData(data: string, keyId?: string): Promise<string> {
    try {
      if (this.kms && keyId) {
        // Use AWS KMS for encryption
        const result = await this.kms.encrypt({
          KeyId: keyId,
          Plaintext: Buffer.from(data),
        }).promise();

        return result.CiphertextBlob?.toString('base64') || '';
      }

      // Fallback to local encryption
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(this.encryptionKey, 'hex').slice(0, 32), iv);
      cipher.setAAD(Buffer.from('n8n-work-data'));

      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();
      
      return JSON.stringify({
        iv: iv.toString('hex'),
        data: encrypted,
        authTag: authTag.toString('hex'),
      });
    } catch (error) {
      this.logger.error('Encryption failed', error);
      throw new Error('Failed to encrypt data');
    }
  }

  async decryptData(encryptedData: string, keyId?: string): Promise<string> {
    try {
      if (this.kms && keyId) {
        // Use AWS KMS for decryption
        const result = await this.kms.decrypt({
          CiphertextBlob: Buffer.from(encryptedData, 'base64'),
        }).promise();

        return result.Plaintext?.toString() || '';
      }

      // Fallback to local decryption
      const parsed = JSON.parse(encryptedData);
      const iv = Buffer.from(parsed.iv, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(this.encryptionKey, 'hex').slice(0, 32), iv);
      decipher.setAAD(Buffer.from('n8n-work-data'));
      decipher.setAuthTag(Buffer.from(parsed.authTag, 'hex'));

      let decrypted = decipher.update(parsed.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed', error);
      throw new Error('Failed to decrypt data');
    }
  }

  async storeSecretInVault(path: string, secret: any): Promise<void> {
    try {
      await this.vault.write(`secret/data/${path}`, { data: secret });
      this.logger.debug(`Secret stored in vault: ${path}`);
    } catch (error) {
      this.logger.error(`Failed to store secret in vault: ${path}`, error);
      throw error;
    }
  }

  async getSecretFromVault(path: string): Promise<any> {
    try {
      const cacheKey = `vault:${path}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const result = await this.vault.read(`secret/data/${path}`);
      const secret = result.data.data;

      // Cache for 5 minutes
      await this.cache.set(cacheKey, secret, 300);

      return secret;
    } catch (error) {
      if (error.response?.statusCode === 404) {
        return null;
      }
      this.logger.error(`Failed to get secret from vault: ${path}`, error);
      throw error;
    }
  }

  async rotateKey(keyPath: string): Promise<void> {
    try {
      // Generate new key
      const newKey = crypto.randomBytes(32).toString('hex');
      
      // Store new key with version
      const currentTime = Date.now();
      await this.storeSecretInVault(`${keyPath}/v${currentTime}`, { key: newKey });
      
      // Update current key reference
      await this.storeSecretInVault(keyPath, { 
        key: newKey,
        version: currentTime,
        rotatedAt: new Date().toISOString(),
      });

      this.eventEmitter.emit('security.keyRotated', {
        keyPath,
        version: currentTime,
        rotatedAt: new Date(),
      });

      this.logger.log(`Key rotated: ${keyPath}`);
    } catch (error) {
      this.logger.error(`Failed to rotate key: ${keyPath}`, error);
      throw error;
    }
  }

  private startKeyRotation() {
    const rotationInterval = this.config.get('security.keyRotationInterval', 24 * 60 * 60 * 1000); // 24 hours
    
    this.keyRotationInterval = setInterval(async () => {
      try {
        await this.rotateKey('shared/master-key');
      } catch (error) {
        this.logger.error('Scheduled key rotation failed', error);
      }
    }, rotationInterval);

    this.logger.log(`Key rotation scheduled every ${rotationInterval}ms`);
  }

  async validatePII(data: any): Promise<{ hasPII: boolean; detectedTypes: string[] }> {
    const piiPatterns = {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /\b(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
      ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
      creditCard: /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g,
      ipAddress: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
    };

    const detectedTypes: string[] = [];
    const dataStr = JSON.stringify(data);

    for (const [type, pattern] of Object.entries(piiPatterns)) {
      if (pattern.test(dataStr)) {
        detectedTypes.push(type);
      }
    }

    return {
      hasPII: detectedTypes.length > 0,
      detectedTypes,
    };
  }

  async redactPII(data: any): Promise<any> {
    const piiPatterns = {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /\b(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
      ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
      creditCard: /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g,
    };

    let redactedData = JSON.stringify(data);

    for (const [type, pattern] of Object.entries(piiPatterns)) {
      redactedData = redactedData.replace(pattern, `[REDACTED-${type.toUpperCase()}]`);
    }

    return JSON.parse(redactedData);
  }

  async generateAPIKey(tenantId: string, userId: string, permissions: string[]): Promise<string> {
    const keyData = {
      tenantId,
      userId,
      permissions,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
    };

    const token = crypto.randomBytes(32).toString('hex');
    const keyId = `api_key_${crypto.randomUUID()}`;

    // Store API key metadata in Vault
    await this.storeSecretInVault(`api-keys/${keyId}`, keyData);

    // Return the key ID (not the actual token)
    return keyId;
  }

  async validateAPIKey(keyId: string): Promise<any> {
    try {
      const keyData = await this.getSecretFromVault(`api-keys/${keyId}`);
      
      if (!keyData) {
        throw new Error('API key not found');
      }

      if (new Date(keyData.expiresAt) < new Date()) {
        throw new Error('API key expired');
      }

      return keyData;
    } catch (error) {
      this.logger.error(`API key validation failed: ${keyId}`, error);
      throw error;
    }
  }

  async auditLog(event: {
    action: string;
    resource: string;
    userId?: string;
    tenantId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
    success: boolean;
    error?: string;
  }) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      eventId: crypto.randomUUID(),
      ...event,
    };

    try {
      // Store in Vault for long-term retention
      await this.storeSecretInVault(
        `audit-logs/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${auditEntry.eventId}`,
        auditEntry,
      );

      // Emit event for real-time processing
      this.eventEmitter.emit('audit.logged', auditEntry);

      this.logger.debug('Audit log recorded', { eventId: auditEntry.eventId });
    } catch (error) {
      this.logger.error('Failed to record audit log', error);
    }
  }

  async validateApiKey(apiKey: string): Promise<SecurityContext> {
    // Implement API key validation logic
    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    // Mock validation - replace with actual implementation
    if (apiKey.startsWith('nw_')) {
      return {
        userId: 'user-from-api-key',
        tenantId: 'tenant-from-api-key',
        roles: ['user'],
        permissions: ['read', 'write'],
        isAuthenticated: true,
      };
    }

    throw new UnauthorizedException('Invalid API key');
  }

  async validateJwtToken(token: string): Promise<SecurityContext> {
    try {
      const secret = this.config.get<string>('JWT_SECRET');
      const payload = jwt.verify(token, secret) as JwtPayload;

      return {
        userId: payload.sub,
        tenantId: payload.tenantId,
        roles: payload.roles,
        permissions: payload.permissions,
        isAuthenticated: true,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async generateJwtToken(userId: string, tenantId: string, roles: string[], permissions: string[]): Promise<string> {
    const secret = this.config.get<string>('JWT_SECRET') || 'default-secret-key-for-development';
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN') || '24h';

    const payload = {
      sub: userId,
      tenantId,
      roles,
      permissions,
    };

    return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  async validatePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  extractTokenFromRequest(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    const apiKey = request.headers['x-api-key'] as string;
    if (apiKey) {
      return apiKey;
    }

    return null;
  }

  checkPermission(context: SecurityContext, requiredPermission: string): void {
    if (!context.isAuthenticated) {
      throw new UnauthorizedException('Authentication required');
    }

    if (!context.permissions.includes(requiredPermission) && !context.permissions.includes('admin')) {
      throw new ForbiddenException(`Permission '${requiredPermission}' required`);
    }
  }

  checkRole(context: SecurityContext, requiredRole: string): void {
    if (!context.isAuthenticated) {
      throw new UnauthorizedException('Authentication required');
    }

    if (!context.roles.includes(requiredRole) && !context.roles.includes('admin')) {
      throw new ForbiddenException(`Role '${requiredRole}' required`);
    }
  }

  validateTenantAccess(context: SecurityContext, resourceTenantId: string): void {
    if (!context.isAuthenticated) {
      throw new UnauthorizedException('Authentication required');
    }

    if (context.tenantId !== resourceTenantId && !context.roles.includes('super-admin')) {
      throw new ForbiddenException('Access denied to this tenant resource');
    }
  }

  async onModuleDestroy() {
    if (this.keyRotationInterval) {
      clearInterval(this.keyRotationInterval);
    }
  }
}
