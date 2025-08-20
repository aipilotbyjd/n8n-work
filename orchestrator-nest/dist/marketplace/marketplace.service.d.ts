import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { SecurityService } from '../security/security.service';
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
export interface PluginPackage {
    id: string;
    manifest: PluginManifest;
    status: 'draft' | 'pending' | 'approved' | 'rejected' | 'published' | 'deprecated';
    signature: string;
    signatureAlgorithm: string;
    packageUrl?: string;
    publisherId: string;
    publisherVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
    approvedAt?: Date;
    approvedBy?: string;
    rejectionReason?: string;
    downloadCount: number;
    ratings: PluginRating[];
    averageRating: number;
    securityScan?: SecurityScanResult;
    compatibility?: CompatibilityInfo;
}
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
export declare class MarketplaceService {
    private readonly pluginRepository;
    private readonly eventEmitter;
    private readonly configService;
    private readonly securityService;
    private readonly logger;
    private readonly pluginRegistry;
    private readonly installedPlugins;
    constructor(pluginRepository: Repository<PluginPackage>, eventEmitter: EventEmitter2, configService: ConfigService, securityService: SecurityService);
    publishPlugin(publisherId: string, packageBuffer: Buffer, signature: string): Promise<PluginPackage>;
    searchPlugins(query: SearchQuery): Promise<SearchResult>;
    installPlugin(userId: string, tenantId: string, pluginId: string, version?: string): Promise<InstalledPlugin>;
    uninstallPlugin(userId: string, tenantId: string, pluginId: string): Promise<void>;
    reviewPlugin(reviewerId: string, pluginId: string, action: 'approve' | 'reject', reason?: string): Promise<PluginPackage>;
    ratePlugin(userId: string, pluginId: string, rating: number, review?: string): Promise<void>;
    getPluginAnalytics(pluginId: string, timeRange: 'day' | 'week' | 'month' | 'year'): Promise<PluginAnalytics>;
    private verifyPackageSignature;
    private extractManifest;
    private validateManifest;
    private validateNodeDefinition;
    private validatePermissions;
    private performSecurityScan;
    private storePackageFile;
    private getFacets;
    private getPluginById;
    private checkInstallationPermissions;
    private checkCompatibility;
    private downloadPackage;
    private extractAndDeployPlugin;
    private cleanupPluginInstallation;
    private isPublisherVerified;
    private isReviewer;
    private getPublisherPublicKey;
    private checkUninstallPermissions;
    private getInstallationCount;
    private getActiveUserCount;
    private getExecutionCount;
    private getErrorCount;
    private getRevenue;
    private getRatingDistribution;
}
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
    categories: Array<{
        name: string;
        count: number;
    }>;
    authors: Array<{
        name: string;
        count: number;
    }>;
    tags: Array<{
        name: string;
        count: number;
    }>;
    priceRanges: Array<{
        range: string;
        count: number;
    }>;
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
export {};
