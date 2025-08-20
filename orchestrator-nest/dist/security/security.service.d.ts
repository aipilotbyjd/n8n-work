import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cache } from 'cache-manager';
export declare class SecurityService implements OnModuleInit {
    private readonly config;
    private readonly eventEmitter;
    private readonly cache;
    private readonly logger;
    private vault;
    private kms;
    private encryptionKey;
    private keyRotationInterval;
    constructor(config: ConfigService, eventEmitter: EventEmitter2, cache: Cache);
    onModuleInit(): Promise<void>;
    private initializeKMS;
    private initializeVault;
    private initializeSecurity;
    private setupVaultPolicies;
    private generateVaultPolicy;
    private setupSecurityPolicies;
    private initializeAuditLogging;
    getMasterEncryptionKey(): Promise<string>;
    encryptData(data: string, keyId?: string): Promise<string>;
    decryptData(encryptedData: string, keyId?: string): Promise<string>;
    storeSecretInVault(path: string, secret: any): Promise<void>;
    getSecretFromVault(path: string): Promise<any>;
    rotateKey(keyPath: string): Promise<void>;
    private startKeyRotation;
    validatePII(data: any): Promise<{
        hasPII: boolean;
        detectedTypes: string[];
    }>;
    redactPII(data: any): Promise<any>;
    generateAPIKey(tenantId: string, userId: string, permissions: string[]): Promise<string>;
    validateAPIKey(keyId: string): Promise<any>;
    auditLog(event: {
        action: string;
        resource: string;
        userId?: string;
        tenantId?: string;
        ipAddress?: string;
        userAgent?: string;
        metadata?: any;
        success: boolean;
        error?: string;
    }): Promise<void>;
    onModuleDestroy(): Promise<void>;
}
