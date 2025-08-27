import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, FindManyOptions, In } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ConfigService } from "@nestjs/config";
import {
  Plugin,
  PluginStatus,
  PluginVisibility,
} from "./entities/plugin.entity";
import {
  PluginInstallation,
  InstallationStatus,
} from "./entities/plugin-installation.entity";
import { PluginReview } from "./entities/plugin-review.entity";
import { CreatePluginDto } from "./dto/create-plugin.dto";
import { InstallPluginDto } from "./dto/install-plugin.dto";
import { PluginFilterDto } from "./dto/plugin-filter.dto";
import { PluginSecurityService } from "./services/plugin-security.service";
import { PluginValidationService } from "./services/plugin-validation.service";
import { PluginSandboxService } from "./services/plugin-sandbox.service";
import { PluginRegistryService } from "./services/plugin-registry.service";
import { AuditService } from "../audit/audit.service";

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: {
    name: string;
    email: string;
    url?: string;
  };
  license: string;
  homepage?: string;
  repository?: string;
  keywords: string[];

  engine: {
    type: "node" | "python" | "docker";
    version: string;
  };

  dependencies: Record<string, string>;
  peerDependencies?: Record<string, string>;

  permissions: {
    network?: string[];
    filesystem?: string[];
    database?: boolean;
    credentials?: boolean;
    webhooks?: boolean;
  };

  nodes?: NodeDefinition[];
  credentials?: CredentialTypeDefinition[];
  triggers?: TriggerDefinition[];

  configuration?: {
    schema: any;
    default: any;
  };

  lifecycle?: {
    install?: string;
    uninstall?: string;
    upgrade?: string;
  };
}

export interface NodeDefinition {
  type: string;
  displayName: string;
  name: string;
  group: string;
  version: number;
  description: string;
  defaults: Record<string, any>;
  inputs: string[];
  outputs: string[];
  properties: PropertyDefinition[];
  credentials?: CredentialReference[];
  webhooks?: WebhookDefinition[];
}

export interface PropertyDefinition {
  displayName: string;
  name: string;
  type: string;
  default?: any;
  required?: boolean;
  description?: string;
  options?: Array<{ name: string; value: any }>;
  displayOptions?: {
    show?: Record<string, any[]>;
    hide?: Record<string, any[]>;
  };
}

@Injectable()
export class PluginMarketplaceService {
  private readonly logger = new Logger(PluginMarketplaceService.name);

  constructor(
    @InjectRepository(Plugin)
    private readonly pluginRepository: Repository<Plugin>,
    @InjectRepository(PluginInstallation)
    private readonly installationRepository: Repository<PluginInstallation>,
    @InjectRepository(PluginReview)
    private readonly reviewRepository: Repository<PluginReview>,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly securityService: PluginSecurityService,
    private readonly validationService: PluginValidationService,
    private readonly sandboxService: PluginSandboxService,
    private readonly registryService: PluginRegistryService,
    private readonly auditService: AuditService,
  ) {}

  // Plugin Management
  async submitPlugin(
    createPluginDto: CreatePluginDto,
    authorId: string,
    packageFile: Buffer,
  ): Promise<Plugin> {
    this.logger.log(
      `Submitting plugin: ${createPluginDto.name} by user: ${authorId}`,
    );

    // Extract and validate manifest
    const manifest = await this.extractManifest(packageFile);
    await this.validationService.validateManifest(manifest);

    // Security scan
    const securityReport = await this.securityService.scanPackage(
      packageFile,
      manifest,
    );
    if (securityReport.hasVulnerabilities) {
      throw new BadRequestException("Plugin failed security scan", {
        cause: securityReport.vulnerabilities,
      });
    }

    // Create plugin record
    const plugin = this.pluginRepository.create({
      ...createPluginDto,
      authorId,
      manifest,
      securityReport,
      status: PluginStatus.PENDING_REVIEW,
      packageHash: await this.calculateHash(packageFile),
    });

    const savedPlugin = await this.pluginRepository.save(plugin);

    // Store package file
    await this.registryService.storePackage(savedPlugin.id, packageFile);

    await this.auditService.log({
      action: "plugin.submitted",
      userId: authorId,
      resourceId: savedPlugin.id,
      details: { name: savedPlugin.name, version: savedPlugin.version },
    });

    this.eventEmitter.emit("plugin.submitted", {
      plugin: savedPlugin,
      authorId,
    });

    return savedPlugin;
  }

  async approvePlugin(
    pluginId: string,
    reviewerId: string,
    notes?: string,
  ): Promise<Plugin> {
    const plugin = await this.findPluginById(pluginId);

    if (plugin.status !== PluginStatus.PENDING_REVIEW) {
      throw new BadRequestException("Plugin is not pending review");
    }

    // Final security and validation checks
    const packageBuffer = await this.registryService.getPackage(pluginId);
    await this.performFinalChecks(plugin, packageBuffer);

    plugin.status = PluginStatus.PUBLISHED;
    plugin.reviewedBy = reviewerId;
    plugin.reviewedAt = new Date();
    plugin.reviewNotes = notes;

    const savedPlugin = await this.pluginRepository.save(plugin);

    await this.auditService.log({
      action: "plugin.approved",
      userId: reviewerId,
      resourceId: pluginId,
      details: { name: plugin.name, notes },
    });

    this.eventEmitter.emit("plugin.approved", {
      plugin: savedPlugin,
      reviewerId,
    });

    return savedPlugin;
  }

  async rejectPlugin(
    pluginId: string,
    reviewerId: string,
    reason: string,
  ): Promise<Plugin> {
    const plugin = await this.findPluginById(pluginId);

    plugin.status = PluginStatus.REJECTED;
    plugin.reviewedBy = reviewerId;
    plugin.reviewedAt = new Date();
    plugin.reviewNotes = reason;

    const savedPlugin = await this.pluginRepository.save(plugin);

    await this.auditService.log({
      action: "plugin.rejected",
      userId: reviewerId,
      resourceId: pluginId,
      details: { name: plugin.name, reason },
    });

    this.eventEmitter.emit("plugin.rejected", {
      plugin: savedPlugin,
      reviewerId,
      reason,
    });

    return savedPlugin;
  }

  // Plugin Discovery
  async searchPlugins(filters: PluginFilterDto): Promise<{
    plugins: Plugin[];
    total: number;
    facets: any;
  }> {
    const queryBuilder = this.pluginRepository
      .createQueryBuilder("plugin")
      .leftJoinAndSelect("plugin.author", "author")
      .leftJoinAndSelect("plugin.reviews", "reviews")
      .where("plugin.status = :status", { status: PluginStatus.PUBLISHED });

    // Apply filters
    if (filters.category) {
      queryBuilder.andWhere("plugin.category = :category", {
        category: filters.category,
      });
    }

    if (filters.tags?.length) {
      queryBuilder.andWhere("plugin.tags && :tags", { tags: filters.tags });
    }

    if (filters.search) {
      queryBuilder.andWhere(
        "(plugin.name ILIKE :search OR plugin.description ILIKE :search OR plugin.keywords ILIKE :search)",
        { search: `%${filters.search}%` },
      );
    }

    if (filters.minRating) {
      queryBuilder.andWhere("plugin.averageRating >= :minRating", {
        minRating: filters.minRating,
      });
    }

    if (filters.license) {
      queryBuilder.andWhere("plugin.license = :license", {
        license: filters.license,
      });
    }

    // Sorting
    switch (filters.sortBy) {
      case "popularity":
        queryBuilder.orderBy("plugin.downloadCount", "DESC");
        break;
      case "rating":
        queryBuilder.orderBy("plugin.averageRating", "DESC");
        break;
      case "newest":
        queryBuilder.orderBy("plugin.createdAt", "DESC");
        break;
      case "updated":
        queryBuilder.orderBy("plugin.updatedAt", "DESC");
        break;
      default:
        queryBuilder.orderBy("plugin.downloadCount", "DESC");
    }

    // Pagination
    const total = await queryBuilder.getCount();
    const plugins = await queryBuilder
      .skip(filters.offset || 0)
      .take(filters.limit || 20)
      .getMany();

    // Calculate facets for filtering UI
    const facets = await this.calculateFacets();

    return { plugins, total, facets };
  }

  async getPlugin(pluginId: string, includeManifest = false): Promise<Plugin> {
    const relations = ["author", "reviews", "reviews.user"];

    const plugin = await this.pluginRepository.findOne({
      where: { id: pluginId, status: PluginStatus.PUBLISHED },
      relations,
    });

    if (!plugin) {
      throw new NotFoundException(`Plugin ${pluginId} not found`);
    }

    if (!includeManifest) {
      delete plugin.manifest;
    }

    return plugin;
  }

  async getFeaturedPlugins(): Promise<Plugin[]> {
    return this.pluginRepository.find({
      where: {
        status: PluginStatus.PUBLISHED,
        featured: true,
      },
      relations: ["author"],
      order: { downloadCount: "DESC" },
      take: 12,
    });
  }

  async getPopularPlugins(limit = 20): Promise<Plugin[]> {
    return this.pluginRepository.find({
      where: { status: PluginStatus.PUBLISHED },
      relations: ["author"],
      order: { downloadCount: "DESC" },
      take: limit,
    });
  }

  async getRecentPlugins(limit = 20): Promise<Plugin[]> {
    return this.pluginRepository.find({
      where: { status: PluginStatus.PUBLISHED },
      relations: ["author"],
      order: { createdAt: "DESC" },
      take: limit,
    });
  }

  // Plugin Installation
  async installPlugin(
    pluginId: string,
    installDto: InstallPluginDto,
    tenantId: string,
    userId: string,
  ): Promise<PluginInstallation> {
    const plugin = await this.getPlugin(pluginId, true);

    // Check if already installed
    const existingInstallation = await this.installationRepository.findOne({
      where: { pluginId, tenantId },
    });

    if (
      existingInstallation &&
      existingInstallation.status === InstallationStatus.INSTALLED
    ) {
      throw new BadRequestException("Plugin is already installed");
    }

    // Validate dependencies
    await this.validateDependencies(plugin.manifest, tenantId);

    // Check permissions
    await this.validatePermissions(plugin.manifest, tenantId);

    // Create installation record
    const installation = this.installationRepository.create({
      pluginId,
      tenantId,
      userId,
      version: plugin.version,
      config: installDto.config || {},
      status: InstallationStatus.INSTALLING,
    });

    const savedInstallation =
      await this.installationRepository.save(installation);

    // Perform installation asynchronously
    this.performInstallation(plugin, savedInstallation).catch((error) => {
      this.logger.error(`Installation failed for plugin ${pluginId}:`, error);
    });

    return savedInstallation;
  }

  async uninstallPlugin(
    pluginId: string,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const installation = await this.installationRepository.findOne({
      where: { pluginId, tenantId },
      relations: ["plugin"],
    });

    if (!installation) {
      throw new NotFoundException("Plugin installation not found");
    }

    if (installation.status !== InstallationStatus.INSTALLED) {
      throw new BadRequestException("Plugin is not installed");
    }

    installation.status = InstallationStatus.UNINSTALLING;
    await this.installationRepository.save(installation);

    try {
      // Run uninstall lifecycle
      await this.sandboxService.runLifecycleHook(
        installation.plugin,
        "uninstall",
        installation.config,
      );

      // Remove from sandbox
      await this.sandboxService.removePlugin(pluginId, tenantId);

      // Update installation status
      installation.status = InstallationStatus.UNINSTALLED;
      installation.uninstalledAt = new Date();
      installation.uninstalledBy = userId;
      await this.installationRepository.save(installation);

      await this.auditService.log({
        action: "plugin.uninstalled",
        tenantId,
        userId,
        resourceId: pluginId,
        details: { name: installation.plugin.name },
      });

      this.eventEmitter.emit("plugin.uninstalled", {
        plugin: installation.plugin,
        installation,
        tenantId,
        userId,
      });
    } catch (error) {
      installation.status = InstallationStatus.ERROR;
      installation.errorMessage = error.message;
      await this.installationRepository.save(installation);
      throw error;
    }
  }

  async getInstalledPlugins(tenantId: string): Promise<PluginInstallation[]> {
    return this.installationRepository.find({
      where: {
        tenantId,
        status: InstallationStatus.INSTALLED,
      },
      relations: ["plugin", "plugin.author"],
      order: { installedAt: "DESC" },
    });
  }

  async updatePlugin(
    pluginId: string,
    tenantId: string,
    userId: string,
  ): Promise<PluginInstallation> {
    const installation = await this.installationRepository.findOne({
      where: { pluginId, tenantId },
      relations: ["plugin"],
    });

    if (!installation || installation.status !== InstallationStatus.INSTALLED) {
      throw new NotFoundException("Plugin installation not found");
    }

    // Get latest version
    const latestPlugin = await this.pluginRepository.findOne({
      where: {
        name: installation.plugin.name,
        status: PluginStatus.PUBLISHED,
      },
      order: { version: "DESC" },
    });

    if (!latestPlugin || latestPlugin.version === installation.version) {
      throw new BadRequestException("No update available");
    }

    installation.status = InstallationStatus.UPDATING;
    await this.installationRepository.save(installation);

    try {
      // Perform update
      await this.performUpdate(installation, latestPlugin);

      installation.version = latestPlugin.version;
      installation.status = InstallationStatus.INSTALLED;
      installation.updatedAt = new Date();
      await this.installationRepository.save(installation);

      this.eventEmitter.emit("plugin.updated", {
        plugin: latestPlugin,
        installation,
        tenantId,
        userId,
      });

      return installation;
    } catch (error) {
      installation.status = InstallationStatus.ERROR;
      installation.errorMessage = error.message;
      await this.installationRepository.save(installation);
      throw error;
    }
  }

  // Plugin Reviews
  async addReview(
    pluginId: string,
    userId: string,
    rating: number,
    comment?: string,
  ): Promise<PluginReview> {
    const plugin = await this.getPlugin(pluginId);

    // Check if user has already reviewed
    const existingReview = await this.reviewRepository.findOne({
      where: { pluginId, userId },
    });

    if (existingReview) {
      throw new BadRequestException("User has already reviewed this plugin");
    }

    const review = this.reviewRepository.create({
      pluginId,
      userId,
      rating,
      comment,
    });

    const savedReview = await this.reviewRepository.save(review);

    // Update plugin average rating
    await this.updatePluginRating(pluginId);

    this.eventEmitter.emit("plugin.reviewed", {
      plugin,
      review: savedReview,
    });

    return savedReview;
  }

  // Private helper methods
  private async extractManifest(packageFile: Buffer): Promise<PluginManifest> {
    // Extract manifest from package file (zip, tar.gz, etc.)
    // This is a simplified implementation
    return JSON.parse(packageFile.toString("utf8"));
  }

  private async calculateHash(data: Buffer): Promise<string> {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  private async performFinalChecks(
    plugin: Plugin,
    packageBuffer: Buffer,
  ): Promise<void> {
    // Perform final security and validation checks before approval
    const securityReport = await this.securityService.scanPackage(
      packageBuffer,
      plugin.manifest,
    );
    if (securityReport.hasVulnerabilities) {
      throw new BadRequestException("Plugin failed final security scan");
    }
  }

  private async calculateFacets(): Promise<any> {
    // Calculate facets for search filtering UI
    return {
      categories: await this.getCategories(),
      licenses: await this.getLicenses(),
      tags: await this.getPopularTags(),
    };
  }

  private async validateDependencies(
    manifest: PluginManifest,
    tenantId: string,
  ): Promise<void> {
    for (const [name, version] of Object.entries(manifest.dependencies)) {
      const isInstalled = await this.isDependencyInstalled(
        name,
        version,
        tenantId,
      );
      if (!isInstalled) {
        throw new BadRequestException(`Missing dependency: ${name}@${version}`);
      }
    }
  }

  private async validatePermissions(
    manifest: PluginManifest,
    tenantId: string,
  ): Promise<void> {
    // Validate that tenant has required permissions for plugin
    const requiredPermissions = manifest.permissions;
    const tenantPermissions = await this.getTenantPermissions(tenantId);

    // Check each permission type
    if (requiredPermissions.database && !tenantPermissions.allowDatabase) {
      throw new BadRequestException("Plugin requires database access");
    }

    if (
      requiredPermissions.network?.length &&
      !tenantPermissions.allowNetwork
    ) {
      throw new BadRequestException("Plugin requires network access");
    }
  }

  private async performInstallation(
    plugin: Plugin,
    installation: PluginInstallation,
  ): Promise<void> {
    try {
      // Download and verify package
      const packageBuffer = await this.registryService.getPackage(plugin.id);
      const manifest = plugin.manifest as PluginManifest;

      // Create sandbox environment
      await this.sandboxService.createEnvironment(
        plugin,
        installation.tenantId,
      );

      // Install dependencies
      await this.sandboxService.installDependencies(manifest.dependencies);

      // Deploy plugin code
      await this.sandboxService.deployPlugin(packageBuffer, manifest);

      // Run install lifecycle hook
      await this.sandboxService.runLifecycleHook(
        plugin,
        "install",
        installation.config,
      );

      // Register nodes and credentials
      await this.registryService.registerPlugin(plugin, installation.tenantId);

      // Update installation status
      installation.status = InstallationStatus.INSTALLED;
      installation.installedAt = new Date();
      await this.installationRepository.save(installation);

      // Update download count
      await this.pluginRepository.increment(
        { id: plugin.id },
        "downloadCount",
        1,
      );

      await this.auditService.log({
        action: "plugin.installed",
        tenantId: installation.tenantId,
        userId: installation.userId,
        resourceId: plugin.id,
        details: { name: plugin.name, version: plugin.version },
      });

      this.eventEmitter.emit("plugin.installed", {
        plugin,
        installation,
      });
    } catch (error) {
      installation.status = InstallationStatus.ERROR;
      installation.errorMessage = error.message;
      await this.installationRepository.save(installation);
      throw error;
    }
  }

  private async performUpdate(
    installation: PluginInstallation,
    newPlugin: Plugin,
  ): Promise<void> {
    const manifest = newPlugin.manifest as PluginManifest;

    // Run upgrade lifecycle hook
    if (manifest.lifecycle?.upgrade) {
      await this.sandboxService.runLifecycleHook(
        newPlugin,
        "upgrade",
        installation.config,
      );
    }

    // Update plugin code in sandbox
    const packageBuffer = await this.registryService.getPackage(newPlugin.id);
    await this.sandboxService.updatePlugin(
      packageBuffer,
      manifest,
      installation.tenantId,
    );

    // Update registry
    await this.registryService.updatePlugin(newPlugin, installation.tenantId);
  }

  private async updatePluginRating(pluginId: string): Promise<void> {
    const reviews = await this.reviewRepository.find({
      where: { pluginId },
    });

    const averageRating =
      reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
    const reviewCount = reviews.length;

    await this.pluginRepository.update(pluginId, {
      averageRating,
      reviewCount,
    });
  }

  private async findPluginById(id: string): Promise<Plugin> {
    const plugin = await this.pluginRepository.findOne({
      where: { id },
      relations: ["author"],
    });

    if (!plugin) {
      throw new NotFoundException(`Plugin ${id} not found`);
    }

    return plugin;
  }

  private async getCategories(): Promise<string[]> {
    const result = await this.pluginRepository
      .createQueryBuilder("plugin")
      .select("DISTINCT plugin.category", "category")
      .where("plugin.status = :status", { status: PluginStatus.PUBLISHED })
      .getRawMany();

    return result.map((r) => r.category).filter(Boolean);
  }

  private async getLicenses(): Promise<string[]> {
    const result = await this.pluginRepository
      .createQueryBuilder("plugin")
      .select("DISTINCT plugin.license", "license")
      .where("plugin.status = :status", { status: PluginStatus.PUBLISHED })
      .getRawMany();

    return result.map((r) => r.license).filter(Boolean);
  }

  private async getPopularTags(): Promise<string[]> {
    // This would need a more complex query to get popular tags
    return [];
  }

  private async isDependencyInstalled(
    name: string,
    version: string,
    tenantId: string,
  ): Promise<boolean> {
    // Check if dependency is installed in tenant
    return true; // Simplified implementation
  }

  private async getTenantPermissions(tenantId: string): Promise<any> {
    // Get tenant permissions configuration
    return {
      allowDatabase: true,
      allowNetwork: true,
      allowFilesystem: false,
    };
  }
}
