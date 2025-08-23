import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class CredentialEncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Encrypt credential data
   */
  async encrypt(data: any, tenantId: string): Promise<string> {
    try {
      const jsonData = JSON.stringify(data);
      const key = this.getEncryptionKey(tenantId);
      
      // Generate random IV
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipher(this.algorithm, key);
      cipher.setAAD(Buffer.from(tenantId, 'utf8'));
      
      // Encrypt data
      let encrypted = cipher.update(jsonData, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const tag = cipher.getAuthTag();
      
      // Combine IV, tag, and encrypted data
      const result = {
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        encrypted,
      };
      
      return Buffer.from(JSON.stringify(result)).toString('base64');
    } catch (error) {
      throw new Error(`Failed to encrypt credential data: ${error.message}`);
    }
  }

  /**
   * Decrypt credential data
   */
  async decrypt(encryptedData: string, tenantId: string): Promise<any> {
    try {
      const key = this.getEncryptionKey(tenantId);
      
      // Parse encrypted data
      const dataBuffer = Buffer.from(encryptedData, 'base64');
      const { iv, tag, encrypted } = JSON.parse(dataBuffer.toString('utf8'));
      
      // Create decipher
      const decipher = crypto.createDecipher(this.algorithm, key);
      decipher.setAAD(Buffer.from(tenantId, 'utf8'));
      decipher.setAuthTag(Buffer.from(tag, 'hex'));
      
      // Decrypt data
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error(`Failed to decrypt credential data: ${error.message}`);
    }
  }

  /**
   * Get encryption key for tenant
   */
  private getEncryptionKey(tenantId: string): Buffer {
    const masterKey = this.configService.get<string>('ENCRYPTION_KEY');
    if (!masterKey || masterKey.length !== 32) {
      throw new Error('Invalid encryption key configuration');
    }

    // Derive tenant-specific key using PBKDF2
    return crypto.pbkdf2Sync(
      masterKey,
      tenantId,
      100000, // iterations
      this.keyLength,
      'sha256',
    );
  }

  /**
   * Generate secure random string for OAuth state
   */
  generateSecureRandomString(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
}