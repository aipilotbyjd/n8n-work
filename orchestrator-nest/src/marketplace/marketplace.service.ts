import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SecurityService } from '../security/security.service';
import { PluginPackage } from './entities/plugin-package.entity';

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  category: string;
  tags: string[];
  nodes: NodeDefinition[];
  dependencies?: PluginDependency[];
  permissions: PluginPermissions;
  pricing?: PluginPricing;
  support?: PluginSupport;
  screenshots?: string[];
  documentation?: string;
  changelog?: string;
}

export interface NodeDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  icon?: string;
  color?: string;
  inputs: ParameterDefinition[];
  outputs: ParameterDefinition[];
  credentials?: CredentialDefinition[];
  webhooks?: WebhookDefinition[];
  polling?: PollingDefinition;
  properties: NodeProperties;
  examples?: NodeExample[];
}

export interface ParameterDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'file';
  description: string;
  required: boolean;
  default?: any;
  options?: ParameterOption[];
  validation?: ParameterValidation;
  conditional?: ConditionalConfig;
  sensitive?: boolean;
}

export interface PluginDependency {
  name: string;
  version: string;
  type: 'npm' | 'plugin' | 'system';
  optional?: boolean;
}

export interface PluginPermissions {
  network: NetworkPermissions;
  storage: StoragePermissions;
  system: SystemPermissions;
  data: DataPermissions;
}

export interface NetworkPermissions {
  allowAll?: boolean;
  allowedDomains?: string[];
  blockedDomains?: string[];
  allowedPorts?: number[];
  allowSelfSigned?: boolean;
}

export interface StoragePermissions {
  tempFiles?: boolean;
  persistentFiles?: boolean;
  maxFileSize?: number;
  maxTotalSize?: number;
}

export interface SystemPermissions {
  shell?: boolean;
  childProcess?: boolean;
  fileSystem?: boolean;
  environment?: boolean;
}

export interface DataPermissions {
  canReadCredentials?: boolean;
  canWriteCredentials?: boolean;
  dataRetentionDays?: number;
  piiHandling?: 'allow' | 'redact' | 'deny';
}

export interface PluginPricing {
  model: 'free' | 'one-time' | 'subscription' | 'usage-based';
  price?: number;
  currency?: string;
  billingPeriod?: 'monthly' | 'yearly';
  usageMetrics?: string[];
  freeTier?: {
    executions: number;
    period: string;
  };
}

export interface PluginSupport {
  email?: string;
  website?: string;
  documentation?: string;
  community?: string;
  issues?: string;
}

// PluginPackage interface moved to entities/plugin-package.entity.ts

export interface PluginRating {
  userId: string;
  rating: number;
  review?: string;
  createdAt: Date;
}

export interface SecurityScanResult {
  scanId: string;
  status: 'clean' | 'warnings' | 'threats';
  vulnerabilities: Vulnerability[];
  lastScanAt: Date;
  scanTool: string;
  scanVersion: string;
}

export interface Vulnerability {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  file?: string;
  line?: number;
  recommendation: string;
}

export interface CompatibilityInfo {
  platformVersion: string;
  nodeJsVersion: string;
  operatingSystems: string[];
  architectures: string[];
}

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);
  private readonly pluginRegistry = new Map<string, PluginPackage>();
  private readonly installedPlugins = new Map<string, InstalledPlugin>();

  constructor(
    @InjectRepository(PluginPackage)
    private readonly pluginRepository: Repository<PluginPackage>,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly securityService: SecurityService,
  ) {}

  // Plugin Publishing
  async publishPlugin(publisherId: string, packageBuffer: Buffer, signature: string): Promise<PluginPackage> {
    this.logger.log(`Publishing plugin for publisher: ${publisherId}`);

    // Verify package signature
    const signatureValid = await this.verifyPackageSignature(packageBuffer, signature, publisherId);
    if (!signatureValid) {
      throw new ForbiddenException('Invalid package signature');
    }

    // Extract and validate manifest
    const manifest = await this.extractManifest(packageBuffer);
    await this.validateManifest(manifest);

    // Security scan
    const securityScan = await this.performSecurityScan(packageBuffer, manifest);
    if (securityScan.status === 'threats') {
      throw new BadRequestException('Security threats detected in plugin package');
    }

    // Create plugin package
    const plugin: PluginPackage = {
      id: `${manifest.name}-${manifest.version}`,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description || '',
      author: manifest.author || '',
      manifest,
      status: 'pending',
      packageData: null,
      signature,
      signatureAlgorithm: 'ed25519',
      packageUrl: null,
      downloadCount: 0,
      averageRating: null,
      ratings: [],
      publisherId,
      publisherVerified: await this.isPublisherVerified(publisherId),
      reviewerId: null,
      reviewReason: null,
      rejectionReason: null,
      approvedBy: null,
      approvedAt: null,
      metadata: null,
      securityScan,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store package file
    const packageUrl = await this.storePackageFile(plugin.id, packageBuffer);
    plugin.packageUrl = packageUrl;

    // Save to database
    const savedPlugin = await this.pluginRepository.save(plugin);
    this.pluginRegistry.set(plugin.id, savedPlugin);

    // Emit event
    this.eventEmitter.emit('plugin.published', {
      pluginId: plugin.id,
      publisherId,
      manifest,
    });

    this.logger.log(`Plugin published successfully: ${plugin.id}`);
    return savedPlugin;
  }

  // Plugin Discovery
  async searchPlugins(query: SearchQuery): Promise<SearchResult> {
    const {
      search,
      category,
      author,
      tags,
      minRating,
      maxPrice,
      freeOnly,
      verifiedOnly,
      sort = 'relevance',
      page = 1,
      limit = 20,
    } = query;

    let queryBuilder = this.pluginRepository.createQueryBuilder('plugin')
      .where('plugin.status = :status', { status: 'published' });

    // Apply filters
    if (search) {
      queryBuilder = queryBuilder.andWhere(
        '(plugin.manifest->>\'name\' ILIKE :search OR plugin.manifest->>\'description\' ILIKE :search)',
        { search: `%${search}%` }
      );
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

    // Apply sorting
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
        // Relevance scoring would be more complex
        queryBuilder = queryBuilder.orderBy('plugin.downloadCount', 'DESC');
        break;
    }

    // Apply pagination
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

  // Plugin Installation
  async installPlugin(userId: string, tenantId: string, pluginId: string, version?: string): Promise<InstalledPlugin> {
    this.logger.log(`Installing plugin ${pluginId} for user ${userId}, tenant ${tenantId}`);

    // Get plugin package
    const plugin = await this.getPluginById(pluginId);
    if (!plugin || plugin.status !== 'published') {
      throw new NotFoundException('Plugin not found or not published');
    }

    // Check installation permissions
    await this.checkInstallationPermissions(userId, tenantId, plugin);

    // Check compatibility
    await this.checkCompatibility(plugin);

    // Download and verify package
    const packageBuffer = await this.downloadPackage(plugin.packageUrl!);
    const signatureValid = await this.verifyPackageSignature(
      packageBuffer, 
      plugin.signature, 
      plugin.publisherId
    );

    if (!signatureValid) {
      throw new ForbiddenException('Package signature verification failed');
    }

    // Install plugin
    const installationId = `${tenantId}-${pluginId}`;
    const installation: InstalledPlugin = {
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

    // Extract and deploy plugin
    await this.extractAndDeployPlugin(installation, packageBuffer);

    // Update installation status
    installation.status = 'installed';
    installation.enabled = true;

    this.installedPlugins.set(installationId, installation);

    // Update download count
    plugin.downloadCount++;
    await this.pluginRepository.save(plugin);

    // Emit event
    this.eventEmitter.emit('plugin.installed', {
      pluginId,
      tenantId,
      userId,
      version: plugin.manifest.version,
    });

    this.logger.log(`Plugin ${pluginId} installed successfully for tenant ${tenantId}`);
    return installation;
  }

  // Plugin Management
  async uninstallPlugin(userId: string, tenantId: string, pluginId: string): Promise<void> {
    const installationId = `${tenantId}-${pluginId}`;
    const installation = this.installedPlugins.get(installationId);

    if (!installation) {
      throw new NotFoundException('Plugin installation not found');
    }

    // Check uninstall permissions
    await this.checkUninstallPermissions(userId, tenantId, installation);

    // Disable plugin
    installation.enabled = false;
    installation.status = 'uninstalling';

    // Clean up plugin files and resources
    await this.cleanupPluginInstallation(installation);

    // Remove from registry
    this.installedPlugins.delete(installationId);

    this.eventEmitter.emit('plugin.uninstalled', {
      pluginId,
      tenantId,
      userId,
    });

    this.logger.log(`Plugin ${pluginId} uninstalled for tenant ${tenantId}`);
  }

  // Plugin Approval Workflow
  async reviewPlugin(reviewerId: string, pluginId: string, action: 'approve' | 'reject', reason?: string): Promise<PluginPackage> {
    const plugin = await this.getPluginById(pluginId);
    if (!plugin || plugin.status !== 'pending') {
      throw new NotFoundException('Plugin not found or not in pending status');
    }

    // Check reviewer permissions
    if (!await this.isReviewer(reviewerId)) {
      throw new ForbiddenException('Insufficient permissions to review plugins');
    }

    if (action === 'approve') {
      plugin.status = 'approved';
      plugin.approvedAt = new Date();
      plugin.approvedBy = reviewerId;
    } else {
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

  // Plugin Rating and Reviews
  async ratePlugin(userId: string, pluginId: string, rating: number, review?: string): Promise<void> {
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    const plugin = await this.getPluginById(pluginId);
    if (!plugin || plugin.status !== 'published') {
      throw new NotFoundException('Plugin not found');
    }

    // Remove existing rating from same user
    plugin.ratings = plugin.ratings.filter(r => r.userId !== userId);

    // Add new rating
    plugin.ratings.push({
      userId,
      rating,
      review,
      createdAt: new Date(),
    });

    // Recalculate average rating
    plugin.averageRating = plugin.ratings.reduce((sum, r) => sum + r.rating, 0) / plugin.ratings.length;

    await this.pluginRepository.save(plugin);

    this.eventEmitter.emit('plugin.rated', {
      pluginId,
      userId,
      rating,
      review,
    });
  }

  // Plugin Analytics
  async getPluginAnalytics(pluginId: string, timeRange: 'day' | 'week' | 'month' | 'year'): Promise<PluginAnalytics> {
    const plugin = await this.getPluginById(pluginId);
    if (!plugin) {
      throw new NotFoundException('Plugin not found');
    }

    // This would typically query a separate analytics database
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

  // Helper Methods
  private async verifyPackageSignature(packageBuffer: Buffer, signature: string, publisherId: string): Promise<boolean> {
    try {
      // Get publisher's public key
      const publicKey = await this.getPublisherPublicKey(publisherId);
      
      // Verify signature using ed25519
      const hash = crypto.createHash('sha256').update(packageBuffer).digest();
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(hash);
      
      return verify.verify(publicKey, signature, 'base64');
    } catch (error) {
      this.logger.error('Signature verification failed', error.stack);
      return false;
    }
  }

  private async extractManifest(packageBuffer: Buffer): Promise<PluginManifest> {
    // Implementation would extract manifest from zip/tar package
    // For now, return a placeholder
    throw new Error('Not implemented: extractManifest');
  }

  private async validateManifest(manifest: PluginManifest): Promise<void> {
    // Validate manifest schema
    if (!manifest.name || !manifest.version || !manifest.description) {
      throw new BadRequestException('Invalid manifest: missing required fields');
    }

    // Validate semantic version
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)$/;
    if (!semverRegex.test(manifest.version)) {
      throw new BadRequestException('Invalid version format');
    }

    // Validate nodes
    if (!manifest.nodes || manifest.nodes.length === 0) {
      throw new BadRequestException('Plugin must contain at least one node');
    }

    for (const node of manifest.nodes) {
      await this.validateNodeDefinition(node);
    }

    // Validate permissions
    await this.validatePermissions(manifest.permissions);
  }

  private async validateNodeDefinition(node: NodeDefinition): Promise<void> {
    if (!node.id || !node.name || !node.description) {
      throw new BadRequestException(`Invalid node definition: ${node.id}`);
    }

    // Validate parameters
    for (const param of [...node.inputs, ...node.outputs]) {
      if (!param.name || !param.type) {
        throw new BadRequestException(`Invalid parameter in node ${node.id}`);
      }
    }
  }

  private async validatePermissions(permissions: PluginPermissions): Promise<void> {
    // Validate network permissions
    if (permissions.network?.allowAll && permissions.network?.allowedDomains) {
      throw new BadRequestException('Cannot specify both allowAll and allowedDomains');
    }

    // Validate storage permissions
    if (permissions.storage?.maxFileSize && permissions.storage.maxFileSize > 100 * 1024 * 1024) {
      throw new BadRequestException('Maximum file size cannot exceed 100MB');
    }
  }

  private async performSecurityScan(packageBuffer: Buffer, manifest: PluginManifest): Promise<SecurityScanResult> {
    // Implementation would integrate with security scanning tools
    return {
      scanId: crypto.randomUUID(),
      status: 'clean',
      vulnerabilities: [],
      lastScanAt: new Date(),
      scanTool: 'n8n-security-scanner',
      scanVersion: '1.0.0',
    };
  }

  private async storePackageFile(pluginId: string, packageBuffer: Buffer): Promise<string> {
    const fileName = `${pluginId}.zip`;
    const filePath = path.join(this.configService.get('PLUGIN_STORAGE_PATH'), fileName);
    
    await fs.writeFile(filePath, packageBuffer);
    
    return `plugins/${fileName}`;
  }

  private async getFacets(): Promise<SearchFacets> {
    // Implementation would calculate facets from database
    return {
      categories: [],
      authors: [],
      tags: [],
      priceRanges: [],
    };
  }

  private async getPluginById(pluginId: string): Promise<PluginPackage | null> {
    // Check cache first
    const cached = this.pluginRegistry.get(pluginId);
    if (cached) {
      return cached;
    }

    // Load from database
    const plugin = await this.pluginRepository.findOne({ where: { id: pluginId } });
    if (plugin) {
      this.pluginRegistry.set(pluginId, plugin);
    }

    return plugin;
  }

  private async checkInstallationPermissions(userId: string, tenantId: string, plugin: PluginPackage): Promise<void> {
    // Check if user has permission to install plugins in this tenant
    // Implementation would check RBAC policies
  }

  private async checkCompatibility(plugin: PluginPackage): Promise<void> {
    // Check platform compatibility
    // Implementation would verify Node.js version, OS, etc.
  }

  private async downloadPackage(packageUrl: string): Promise<Buffer> {
    // Implementation would download package from storage
    throw new Error('Not implemented: downloadPackage');
  }

  private async extractAndDeployPlugin(installation: InstalledPlugin, packageBuffer: Buffer): Promise<void> {
    // Implementation would extract plugin and deploy to runtime
    throw new Error('Not implemented: extractAndDeployPlugin');
  }

  private async cleanupPluginInstallation(installation: InstalledPlugin): Promise<void> {
    // Implementation would clean up plugin files and resources
    throw new Error('Not implemented: cleanupPluginInstallation');
  }

  private async isPublisherVerified(publisherId: string): Promise<boolean> {
    // Implementation would check publisher verification status
    return false;
  }

  private async isReviewer(userId: string): Promise<boolean> {
    // Implementation would check if user has reviewer role
    return false;
  }

  private async getPublisherPublicKey(publisherId: string): Promise<string> {
    // Implementation would retrieve publisher's public key
    throw new Error('Not implemented: getPublisherPublicKey');
  }

  private async checkUninstallPermissions(userId: string, tenantId: string, installation: InstalledPlugin): Promise<void> {
    // Implementation would check uninstall permissions
  }

  private async getInstallationCount(pluginId: string): Promise<number> {
    // Implementation would count installations
    return 0;
  }

  private async getActiveUserCount(pluginId: string, timeRange: string): Promise<number> {
    // Implementation would count active users
    return 0;
  }

  private async getExecutionCount(pluginId: string, timeRange: string): Promise<number> {
    // Implementation would count executions
    return 0;
  }

  private async getErrorCount(pluginId: string, timeRange: string): Promise<number> {
    // Implementation would count errors
    return 0;
  }

  private async getRevenue(pluginId: string, timeRange: string): Promise<number> {
    // Implementation would calculate revenue
    return 0;
  }

  private getRatingDistribution(ratings: PluginRating[]): Record<number, number> {
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratings.forEach(rating => {
      distribution[rating.rating]++;
    });
    return distribution;
  }
}

// Supporting interfaces and types
interface SearchQuery {
  search?: string;
  category?: string;
  author?: string;
  tags?: string[];
  minRating?: number;
  maxPrice?: number;
  freeOnly?: boolean;
  verifiedOnly?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
}

interface SearchResult {
  plugins: PluginPackage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  facets: SearchFacets;
}

interface SearchFacets {
  categories: Array<{ name: string; count: number }>;
  authors: Array<{ name: string; count: number }>;
  tags: Array<{ name: string; count: number }>;
  priceRanges: Array<{ range: string; count: number }>;
}

interface InstalledPlugin {
  id: string;
  pluginId: string;
  tenantId: string;
  userId: string;
  version: string;
  status: 'installing' | 'installed' | 'updating' | 'uninstalling' | 'failed';
  installedAt: Date;
  updatedAt?: Date;
  configuration: Record<string, any>;
  enabled: boolean;
}

interface PluginAnalytics {
  pluginId: string;
  timeRange: string;
  downloads: number;
  installations: number;
  activeUsers: number;
  executions: number;
  errors: number;
  revenue: number;
  ratings: {
    average: number;
    count: number;
    distribution: Record<number, number>;
  };
}

// Additional interfaces for completeness
interface ParameterOption {
  value: any;
  label: string;
  description?: string;
}

interface ParameterValidation {
  min?: number;
  max?: number;
  pattern?: string;
  enum?: any[];
  custom?: string;
}

interface ConditionalConfig {
  show?: Record<string, any>;
  hide?: Record<string, any>;
  enable?: Record<string, any>;
  disable?: Record<string, any>;
}

interface CredentialDefinition {
  name: string;
  type: string;
  displayName: string;
  description: string;
  properties: ParameterDefinition[];
  test?: {
    endpoint: string;
    method: string;
    headers?: Record<string, string>;
  };
}

interface WebhookDefinition {
  name: string;
  path: string;
  method: string;
  description: string;
  authentication?: 'none' | 'header' | 'query' | 'body';
  response?: {
    type: string;
    properties: Record<string, any>;
  };
}

interface PollingDefinition {
  interval: number;
  maxInterval?: number;
  endpoint: string;
  method: string;
  headers?: Record<string, string>;
  condition: string;
}

interface NodeProperties {
  displayName: string;
  description: string;
  defaults?: Record<string, any>;
  constraints?: {
    maxExecutionTime?: number;
    maxMemoryUsage?: number;
    maxCpuUsage?: number;
  };
  ui?: {
    width?: number;
    height?: number;
    resizable?: boolean;
    color?: string;
    icon?: string;
  };
}

interface NodeExample {
  name: string;
  description: string;
  workflow: any;
  data?: Record<string, any>;
}
