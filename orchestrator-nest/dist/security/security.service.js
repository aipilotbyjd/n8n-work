"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var SecurityService_1;
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const Vault = __importStar(require("node-vault"));
const AWS = __importStar(require("aws-sdk"));
const crypto = __importStar(require("crypto"));
const event_emitter_1 = require("@nestjs/event-emitter");
const cache_manager_1 = require("cache-manager");
const cache_manager_2 = require("@nestjs/cache-manager");
const common_2 = require("@nestjs/common");
let SecurityService = SecurityService_1 = class SecurityService {
    config;
    eventEmitter;
    cache;
    logger = new common_1.Logger(SecurityService_1.name);
    vault;
    kms;
    encryptionKey;
    keyRotationInterval;
    constructor(config, eventEmitter, cache) {
        this.config = config;
        this.eventEmitter = eventEmitter;
        this.cache = cache;
        this.initializeKMS();
        this.initializeVault();
    }
    async onModuleInit() {
        await this.initializeSecurity();
        this.startKeyRotation();
    }
    async initializeKMS() {
        if (this.config.get('security.kms.provider') === 'aws') {
            this.kms = new AWS.KMS({
                region: this.config.get('aws.region'),
                accessKeyId: this.config.get('aws.accessKeyId'),
                secretAccessKey: this.config.get('aws.secretAccessKey'),
            });
            this.logger.log('AWS KMS initialized');
        }
    }
    async initializeVault() {
        try {
            this.vault = Vault({
                endpoint: this.config.get('vault.endpoint', 'http://localhost:8200'),
                token: this.config.get('vault.token'),
            });
            await this.vault.health();
            this.logger.log('Vault connection established');
            await this.setupVaultPolicies();
        }
        catch (error) {
            this.logger.error('Failed to initialize Vault', error);
        }
    }
    async initializeSecurity() {
        this.encryptionKey = await this.getMasterEncryptionKey();
        await this.setupSecurityPolicies();
        await this.initializeAuditLogging();
        this.logger.log('Security service initialized');
    }
    async setupVaultPolicies() {
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
            }
            catch (error) {
                this.logger.warn(`Failed to setup vault policy '${name}'`, error);
            }
        }
    }
    generateVaultPolicy(policy) {
        let rules = '';
        for (const [path, permissions] of Object.entries(policy.path)) {
            rules += `path "${path}" {\n`;
            rules += `  capabilities = ${JSON.stringify(permissions.capabilities)}\n`;
            rules += `}\n\n`;
        }
        return rules;
    }
    async setupSecurityPolicies() {
        const defaultPolicies = {
            passwordPolicy: {
                minLength: 12,
                requireUppercase: true,
                requireLowercase: true,
                requireNumbers: true,
                requireSymbols: true,
                maxAge: 90,
            },
            sessionPolicy: {
                maxDuration: 24 * 60 * 60,
                idleTimeout: 2 * 60 * 60,
                requireMFA: false,
            },
            apiKeyPolicy: {
                maxDuration: 365 * 24 * 60 * 60,
                rotationRequired: true,
                rotationInterval: 90 * 24 * 60 * 60,
            },
            rateLimitPolicy: {
                default: { windowMs: 60000, max: 1000 },
                auth: { windowMs: 60000, max: 10 },
                webhook: { windowMs: 60000, max: 10000 },
            },
        };
        await this.storeSecretInVault('shared/security-policies', defaultPolicies);
    }
    async initializeAuditLogging() {
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
    async getMasterEncryptionKey() {
        try {
            const vaultKey = await this.getSecretFromVault('shared/master-key');
            if (vaultKey) {
                return vaultKey.key;
            }
            const newKey = crypto.randomBytes(32).toString('hex');
            await this.storeSecretInVault('shared/master-key', { key: newKey });
            this.logger.log('New master encryption key generated');
            return newKey;
        }
        catch (error) {
            this.logger.error('Failed to get master encryption key', error);
            return this.config.get('security.masterKey') || crypto.randomBytes(32).toString('hex');
        }
    }
    async encryptData(data, keyId) {
        try {
            if (this.kms && keyId) {
                const result = await this.kms.encrypt({
                    KeyId: keyId,
                    Plaintext: Buffer.from(data),
                }).promise();
                return result.CiphertextBlob?.toString('base64') || '';
            }
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
            cipher.setAAD(Buffer.from('n8n-work-data'));
            let encrypted = cipher.update(data, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            const authTag = cipher.getAuthTag();
            return JSON.stringify({
                iv: iv.toString('hex'),
                data: encrypted,
                authTag: authTag.toString('hex'),
            });
        }
        catch (error) {
            this.logger.error('Encryption failed', error);
            throw new Error('Failed to encrypt data');
        }
    }
    async decryptData(encryptedData, keyId) {
        try {
            if (this.kms && keyId) {
                const result = await this.kms.decrypt({
                    CiphertextBlob: Buffer.from(encryptedData, 'base64'),
                }).promise();
                return result.Plaintext?.toString() || '';
            }
            const { iv, data, authTag } = JSON.parse(encryptedData);
            const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
            decipher.setAAD(Buffer.from('n8n-work-data'));
            decipher.setAuthTag(Buffer.from(authTag, 'hex'));
            let decrypted = decipher.update(data, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }
        catch (error) {
            this.logger.error('Decryption failed', error);
            throw new Error('Failed to decrypt data');
        }
    }
    async storeSecretInVault(path, secret) {
        try {
            await this.vault.write(`secret/data/${path}`, { data: secret });
            this.logger.debug(`Secret stored in vault: ${path}`);
        }
        catch (error) {
            this.logger.error(`Failed to store secret in vault: ${path}`, error);
            throw error;
        }
    }
    async getSecretFromVault(path) {
        try {
            const cacheKey = `vault:${path}`;
            const cached = await this.cache.get(cacheKey);
            if (cached) {
                return cached;
            }
            const result = await this.vault.read(`secret/data/${path}`);
            const secret = result.data.data;
            await this.cache.set(cacheKey, secret, 300);
            return secret;
        }
        catch (error) {
            if (error.response?.statusCode === 404) {
                return null;
            }
            this.logger.error(`Failed to get secret from vault: ${path}`, error);
            throw error;
        }
    }
    async rotateKey(keyPath) {
        try {
            const newKey = crypto.randomBytes(32).toString('hex');
            const currentTime = Date.now();
            await this.storeSecretInVault(`${keyPath}/v${currentTime}`, { key: newKey });
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
        }
        catch (error) {
            this.logger.error(`Failed to rotate key: ${keyPath}`, error);
            throw error;
        }
    }
    startKeyRotation() {
        const rotationInterval = this.config.get('security.keyRotationInterval', 24 * 60 * 60 * 1000);
        this.keyRotationInterval = setInterval(async () => {
            try {
                await this.rotateKey('shared/master-key');
            }
            catch (error) {
                this.logger.error('Scheduled key rotation failed', error);
            }
        }, rotationInterval);
        this.logger.log(`Key rotation scheduled every ${rotationInterval}ms`);
    }
    async validatePII(data) {
        const piiPatterns = {
            email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
            phone: /\b(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
            ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
            creditCard: /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g,
            ipAddress: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
        };
        const detectedTypes = [];
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
    async redactPII(data) {
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
    async generateAPIKey(tenantId, userId, permissions) {
        const keyData = {
            tenantId,
            userId,
            permissions,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        };
        const token = crypto.randomBytes(32).toString('hex');
        const keyId = `api_key_${crypto.randomUUID()}`;
        await this.storeSecretInVault(`api-keys/${keyId}`, keyData);
        return keyId;
    }
    async validateAPIKey(keyId) {
        try {
            const keyData = await this.getSecretFromVault(`api-keys/${keyId}`);
            if (!keyData) {
                throw new Error('API key not found');
            }
            if (new Date(keyData.expiresAt) < new Date()) {
                throw new Error('API key expired');
            }
            return keyData;
        }
        catch (error) {
            this.logger.error(`API key validation failed: ${keyId}`, error);
            throw error;
        }
    }
    async auditLog(event) {
        const auditEntry = {
            timestamp: new Date().toISOString(),
            eventId: crypto.randomUUID(),
            ...event,
        };
        try {
            await this.storeSecretInVault(`audit-logs/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${auditEntry.eventId}`, auditEntry);
            this.eventEmitter.emit('audit.logged', auditEntry);
            this.logger.debug('Audit log recorded', { eventId: auditEntry.eventId });
        }
        catch (error) {
            this.logger.error('Failed to record audit log', error);
        }
    }
    async onModuleDestroy() {
        if (this.keyRotationInterval) {
            clearInterval(this.keyRotationInterval);
        }
    }
};
exports.SecurityService = SecurityService;
exports.SecurityService = SecurityService = SecurityService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_2.Inject)(cache_manager_2.CACHE_MANAGER)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        event_emitter_1.EventEmitter2, typeof (_a = typeof cache_manager_1.Cache !== "undefined" && cache_manager_1.Cache) === "function" ? _a : Object])
], SecurityService);
//# sourceMappingURL=security.service.js.map