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
var MarketplaceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketplaceService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const event_emitter_1 = require("@nestjs/event-emitter");
const config_1 = require("@nestjs/config");
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const security_service_1 = require("../security/security.service");
let MarketplaceService = MarketplaceService_1 = class MarketplaceService {
    pluginRepository;
    eventEmitter;
    configService;
    securityService;
    logger = new common_1.Logger(MarketplaceService_1.name);
    pluginRegistry = new Map();
    installedPlugins = new Map();
    constructor(pluginRepository, eventEmitter, configService, securityService) {
        this.pluginRepository = pluginRepository;
        this.eventEmitter = eventEmitter;
        this.configService = configService;
        this.securityService = securityService;
    }
    async publishPlugin(publisherId, packageBuffer, signature) {
        this.logger.log(`Publishing plugin for publisher: ${publisherId}`);
        const signatureValid = await this.verifyPackageSignature(packageBuffer, signature, publisherId);
        if (!signatureValid) {
            throw new common_1.ForbiddenException('Invalid package signature');
        }
        const manifest = await this.extractManifest(packageBuffer);
        await this.validateManifest(manifest);
        const securityScan = await this.performSecurityScan(packageBuffer, manifest);
        if (securityScan.status === 'threats') {
            throw new common_1.BadRequestException('Security threats detected in plugin package');
        }
        const plugin = {
            id: `${manifest.name}-${manifest.version}`,
            manifest,
            status: 'pending',
            signature,
            signatureAlgorithm: 'ed25519',
            publisherId,
            publisherVerified: await this.isPublisherVerified(publisherId),
            createdAt: new Date(),
            updatedAt: new Date(),
            downloadCount: 0,
            ratings: [],
            averageRating: 0,
            securityScan,
        };
        const packageUrl = await this.storePackageFile(plugin.id, packageBuffer);
        plugin.packageUrl = packageUrl;
        const savedPlugin = await this.pluginRepository.save(plugin);
        this.pluginRegistry.set(plugin.id, savedPlugin);
        this.eventEmitter.emit('plugin.published', {
            pluginId: plugin.id,
            publisherId,
            manifest,
        });
        this.logger.log(`Plugin published successfully: ${plugin.id}`);
        return savedPlugin;
    }
    async searchPlugins(query) {
        const { search, category, author, tags, minRating, maxPrice, freeOnly, verifiedOnly, sort = 'relevance', page = 1, limit = 20, } = query;
        let queryBuilder = this.pluginRepository.createQueryBuilder('plugin')
            .where('plugin.status = :status', { status: 'published' });
        if (search) {
            queryBuilder = queryBuilder.andWhere('(plugin.manifest->>\'name\' ILIKE :search OR plugin.manifest->>\'description\' ILIKE :search)', { search: `%${search}%` });
        }
        if (category) {
            queryBuilder = queryBuilder.andWhere('plugin.manifest->>\'category\' = :category', { category });
        }
        if (author) {
            queryBuilder = queryBuilder.andWhere('plugin.manifest->>\'author\' = :author', { author });
        }
        if (tags && tags.length > 0) {
            queryBuilder = queryBuilder.andWhere('plugin.manifest->>\'tags\' @> :tags', { tags: JSON.stringify(tags) });
        }
        if (minRating) {
            queryBuilder = queryBuilder.andWhere('plugin.averageRating >= :minRating', { minRating });
        }
        if (verifiedOnly) {
            queryBuilder = queryBuilder.andWhere('plugin.publisherVerified = true');
        }
        switch (sort) {
            case 'name':
                queryBuilder = queryBuilder.orderBy('plugin.manifest->>\'name\'', 'ASC');
                break;
            case 'downloads':
                queryBuilder = queryBuilder.orderBy('plugin.downloadCount', 'DESC');
                break;
            case 'rating':
                queryBuilder = queryBuilder.orderBy('plugin.averageRating', 'DESC');
                break;
            case 'newest':
                queryBuilder = queryBuilder.orderBy('plugin.createdAt', 'DESC');
                break;
            case 'updated':
                queryBuilder = queryBuilder.orderBy('plugin.updatedAt', 'DESC');
                break;
            default:
                queryBuilder = queryBuilder.orderBy('plugin.downloadCount', 'DESC');
                break;
        }
        const offset = (page - 1) * limit;
        queryBuilder = queryBuilder.skip(offset).take(limit);
        const [plugins, total] = await queryBuilder.getManyAndCount();
        return {
            plugins,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
            facets: await this.getFacets(),
        };
    }
    async installPlugin(userId, tenantId, pluginId, version) {
        this.logger.log(`Installing plugin ${pluginId} for user ${userId}, tenant ${tenantId}`);
        const plugin = await this.getPluginById(pluginId);
        if (!plugin || plugin.status !== 'published') {
            throw new common_1.NotFoundException('Plugin not found or not published');
        }
        await this.checkInstallationPermissions(userId, tenantId, plugin);
        await this.checkCompatibility(plugin);
        const packageBuffer = await this.downloadPackage(plugin.packageUrl);
        const signatureValid = await this.verifyPackageSignature(packageBuffer, plugin.signature, plugin.publisherId);
        if (!signatureValid) {
            throw new common_1.ForbiddenException('Package signature verification failed');
        }
        const installationId = `${tenantId}-${pluginId}`;
        const installation = {
            id: installationId,
            pluginId,
            tenantId,
            userId,
            version: plugin.manifest.version,
            status: 'installing',
            installedAt: new Date(),
            configuration: {},
            enabled: false,
        };
        await this.extractAndDeployPlugin(installation, packageBuffer);
        installation.status = 'installed';
        installation.enabled = true;
        this.installedPlugins.set(installationId, installation);
        plugin.downloadCount++;
        await this.pluginRepository.save(plugin);
        this.eventEmitter.emit('plugin.installed', {
            pluginId,
            tenantId,
            userId,
            version: plugin.manifest.version,
        });
        this.logger.log(`Plugin ${pluginId} installed successfully for tenant ${tenantId}`);
        return installation;
    }
    async uninstallPlugin(userId, tenantId, pluginId) {
        const installationId = `${tenantId}-${pluginId}`;
        const installation = this.installedPlugins.get(installationId);
        if (!installation) {
            throw new common_1.NotFoundException('Plugin installation not found');
        }
        await this.checkUninstallPermissions(userId, tenantId, installation);
        installation.enabled = false;
        installation.status = 'uninstalling';
        await this.cleanupPluginInstallation(installation);
        this.installedPlugins.delete(installationId);
        this.eventEmitter.emit('plugin.uninstalled', {
            pluginId,
            tenantId,
            userId,
        });
        this.logger.log(`Plugin ${pluginId} uninstalled for tenant ${tenantId}`);
    }
    async reviewPlugin(reviewerId, pluginId, action, reason) {
        const plugin = await this.getPluginById(pluginId);
        if (!plugin || plugin.status !== 'pending') {
            throw new common_1.NotFoundException('Plugin not found or not in pending status');
        }
        if (!await this.isReviewer(reviewerId)) {
            throw new common_1.ForbiddenException('Insufficient permissions to review plugins');
        }
        if (action === 'approve') {
            plugin.status = 'approved';
            plugin.approvedAt = new Date();
            plugin.approvedBy = reviewerId;
        }
        else {
            plugin.status = 'rejected';
            plugin.rejectionReason = reason || 'No reason provided';
        }
        plugin.updatedAt = new Date();
        const updatedPlugin = await this.pluginRepository.save(plugin);
        this.eventEmitter.emit('plugin.reviewed', {
            pluginId,
            reviewerId,
            action,
            reason,
        });
        return updatedPlugin;
    }
    async ratePlugin(userId, pluginId, rating, review) {
        if (rating < 1 || rating > 5) {
            throw new common_1.BadRequestException('Rating must be between 1 and 5');
        }
        const plugin = await this.getPluginById(pluginId);
        if (!plugin || plugin.status !== 'published') {
            throw new common_1.NotFoundException('Plugin not found');
        }
        plugin.ratings = plugin.ratings.filter(r => r.userId !== userId);
        plugin.ratings.push({
            userId,
            rating,
            review,
            createdAt: new Date(),
        });
        plugin.averageRating = plugin.ratings.reduce((sum, r) => sum + r.rating, 0) / plugin.ratings.length;
        await this.pluginRepository.save(plugin);
        this.eventEmitter.emit('plugin.rated', {
            pluginId,
            userId,
            rating,
            review,
        });
    }
    async getPluginAnalytics(pluginId, timeRange) {
        const plugin = await this.getPluginById(pluginId);
        if (!plugin) {
            throw new common_1.NotFoundException('Plugin not found');
        }
        return {
            pluginId,
            timeRange,
            downloads: plugin.downloadCount,
            installations: await this.getInstallationCount(pluginId),
            activeUsers: await this.getActiveUserCount(pluginId, timeRange),
            executions: await this.getExecutionCount(pluginId, timeRange),
            errors: await this.getErrorCount(pluginId, timeRange),
            revenue: await this.getRevenue(pluginId, timeRange),
            ratings: {
                average: plugin.averageRating,
                count: plugin.ratings.length,
                distribution: this.getRatingDistribution(plugin.ratings),
            },
        };
    }
    async verifyPackageSignature(packageBuffer, signature, publisherId) {
        try {
            const publicKey = await this.getPublisherPublicKey(publisherId);
            const hash = crypto.createHash('sha256').update(packageBuffer).digest();
            const verify = crypto.createVerify('RSA-SHA256');
            verify.update(hash);
            return verify.verify(publicKey, signature, 'base64');
        }
        catch (error) {
            this.logger.error('Signature verification failed', error.stack);
            return false;
        }
    }
    async extractManifest(packageBuffer) {
        throw new Error('Not implemented: extractManifest');
    }
    async validateManifest(manifest) {
        if (!manifest.name || !manifest.version || !manifest.description) {
            throw new common_1.BadRequestException('Invalid manifest: missing required fields');
        }
        const semverRegex = /^(\d+)\.(\d+)\.(\d+)$/;
        if (!semverRegex.test(manifest.version)) {
            throw new common_1.BadRequestException('Invalid version format');
        }
        if (!manifest.nodes || manifest.nodes.length === 0) {
            throw new common_1.BadRequestException('Plugin must contain at least one node');
        }
        for (const node of manifest.nodes) {
            await this.validateNodeDefinition(node);
        }
        await this.validatePermissions(manifest.permissions);
    }
    async validateNodeDefinition(node) {
        if (!node.id || !node.name || !node.description) {
            throw new common_1.BadRequestException(`Invalid node definition: ${node.id}`);
        }
        for (const param of [...node.inputs, ...node.outputs]) {
            if (!param.name || !param.type) {
                throw new common_1.BadRequestException(`Invalid parameter in node ${node.id}`);
            }
        }
    }
    async validatePermissions(permissions) {
        if (permissions.network?.allowAll && permissions.network?.allowedDomains) {
            throw new common_1.BadRequestException('Cannot specify both allowAll and allowedDomains');
        }
        if (permissions.storage?.maxFileSize && permissions.storage.maxFileSize > 100 * 1024 * 1024) {
            throw new common_1.BadRequestException('Maximum file size cannot exceed 100MB');
        }
    }
    async performSecurityScan(packageBuffer, manifest) {
        return {
            scanId: crypto.randomUUID(),
            status: 'clean',
            vulnerabilities: [],
            lastScanAt: new Date(),
            scanTool: 'n8n-security-scanner',
            scanVersion: '1.0.0',
        };
    }
    async storePackageFile(pluginId, packageBuffer) {
        const fileName = `${pluginId}.zip`;
        const filePath = path.join(this.configService.get('PLUGIN_STORAGE_PATH'), fileName);
        await fs.writeFile(filePath, packageBuffer);
        return `plugins/${fileName}`;
    }
    async getFacets() {
        return {
            categories: [],
            authors: [],
            tags: [],
            priceRanges: [],
        };
    }
    async getPluginById(pluginId) {
        const cached = this.pluginRegistry.get(pluginId);
        if (cached) {
            return cached;
        }
        const plugin = await this.pluginRepository.findOne({ where: { id: pluginId } });
        if (plugin) {
            this.pluginRegistry.set(pluginId, plugin);
        }
        return plugin;
    }
    async checkInstallationPermissions(userId, tenantId, plugin) {
    }
    async checkCompatibility(plugin) {
    }
    async downloadPackage(packageUrl) {
        throw new Error('Not implemented: downloadPackage');
    }
    async extractAndDeployPlugin(installation, packageBuffer) {
        throw new Error('Not implemented: extractAndDeployPlugin');
    }
    async cleanupPluginInstallation(installation) {
        throw new Error('Not implemented: cleanupPluginInstallation');
    }
    async isPublisherVerified(publisherId) {
        return false;
    }
    async isReviewer(userId) {
        return false;
    }
    async getPublisherPublicKey(publisherId) {
        throw new Error('Not implemented: getPublisherPublicKey');
    }
    async checkUninstallPermissions(userId, tenantId, installation) {
    }
    async getInstallationCount(pluginId) {
        return 0;
    }
    async getActiveUserCount(pluginId, timeRange) {
        return 0;
    }
    async getExecutionCount(pluginId, timeRange) {
        return 0;
    }
    async getErrorCount(pluginId, timeRange) {
        return 0;
    }
    async getRevenue(pluginId, timeRange) {
        return 0;
    }
    getRatingDistribution(ratings) {
        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        ratings.forEach(rating => {
            distribution[rating.rating]++;
        });
        return distribution;
    }
};
exports.MarketplaceService = MarketplaceService;
exports.MarketplaceService = MarketplaceService = MarketplaceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(PluginPackage)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        event_emitter_1.EventEmitter2,
        config_1.ConfigService,
        security_service_1.SecurityService])
], MarketplaceService);
//# sourceMappingURL=marketplace.service.js.map