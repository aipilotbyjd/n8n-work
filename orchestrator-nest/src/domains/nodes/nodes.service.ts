import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NodeType, NodeCategory } from './entities/node-type.entity';
import { NodeVersion } from './entities/node-version.entity';
import { PluginPackage, PackageStatus } from './entities/plugin-package.entity';
import { CreateNodeDto } from './dto/create-node.dto';
import { UpdateNodeDto } from './dto/update-node.dto';
import { NodeResponseDto } from './dto/node-response.dto';
import { CreatePluginPackageDto } from './dto/create-plugin-package.dto';
import { NodeRegistryService } from './services/node-registry.service';
import { PluginLoaderService } from './services/plugin-loader.service';
import { NodeValidationService } from './services/node-validation.service';
import { MetricsService } from '../../observability/metrics.service';
import { AuditLogService } from '../audit/audit-log.service';

export interface NodeSearchFilters {
  category?: NodeCategory;
  nodeType?: string;
  keywords?: string;
  isBuiltIn?: boolean;
  requiresCredentials?: boolean;
  pluginPackageId?: string;
}

@Injectable()
export class NodesService {
  constructor(
    @InjectRepository(NodeType)
    private readonly nodeRepository: Repository<NodeType>,
    @InjectRepository(NodeVersion)
    private readonly nodeVersionRepository: Repository<NodeVersion>,
    @InjectRepository(PluginPackage)
    private readonly pluginPackageRepository: Repository<PluginPackage>,
    private readonly nodeRegistryService: NodeRegistryService,
    private readonly pluginLoaderService: PluginLoaderService,
    private readonly nodeValidationService: NodeValidationService,
    private readonly metricsService: MetricsService,
    private readonly auditService: AuditLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Get all available nodes with optional filtering
   */
  async findAllNodes(
    filters: NodeSearchFilters = {},
    tenantId?: string,
  ): Promise<NodeResponseDto[]> {
    const queryBuilder = this.nodeRepository
      .createQueryBuilder('node')
      .leftJoinAndSelect('node.currentVersion', 'version')
      .leftJoinAndSelect('node.pluginPackage', 'package')
      .where('node.isActive = :isActive', { isActive: true });

    // Apply filters
    if (filters.category) {
      queryBuilder.andWhere('node.category = :category', { category: filters.category });
    }

    if (filters.nodeType) {
      queryBuilder.andWhere('node.nodeType = :nodeType', { nodeType: filters.nodeType });
    }

    if (filters.isBuiltIn !== undefined) {
      queryBuilder.andWhere('node.isBuiltIn = :isBuiltIn', { isBuiltIn: filters.isBuiltIn });
    }

    if (filters.requiresCredentials !== undefined) {
      queryBuilder.andWhere('node.requiresCredentials = :requiresCredentials', {
        requiresCredentials: filters.requiresCredentials,
      });
    }

    if (filters.pluginPackageId) {
      queryBuilder.andWhere('node.pluginPackageId = :pluginPackageId', {
        pluginPackageId: filters.pluginPackageId,
      });
    }

    if (filters.keywords) {
      queryBuilder.andWhere(
        '(node.name ILIKE :search OR node.displayName ILIKE :search OR node.description ILIKE :search OR :searchKeyword = ANY(node.keywords))',
        {
          search: `%${filters.keywords}%`,
          searchKeyword: filters.keywords,
        },
      );
    }

    const nodes = await queryBuilder
      .orderBy('node.displayName', 'ASC')
      .getMany();

    return nodes.map(node => this.toNodeResponseDto(node));
  }

  /**
   * Get a specific node by ID
   */
  async findNodeById(id: string): Promise<NodeResponseDto> {
    const node = await this.nodeRepository.findOne({
      where: { id, isActive: true },
      relations: ['currentVersion', 'pluginPackage'],
    });

    if (!node) {
      throw new NotFoundException('Node not found');
    }

    return this.toNodeResponseDto(node);
  }

  /**
   * Get a node by name
   */
  async findNodeByName(name: string): Promise<NodeResponseDto> {
    const node = await this.nodeRepository.findOne({
      where: { name, isActive: true },
      relations: ['currentVersion', 'pluginPackage'],
    });

    if (!node) {
      throw new NotFoundException('Node not found');
    }

    return this.toNodeResponseDto(node);
  }

  /**
   * Create a new node type
   */
  async createNode(
    createNodeDto: CreateNodeDto,
    userId: string,
    tenantId?: string,
  ): Promise<NodeResponseDto> {
    // Validate node definition
    await this.nodeValidationService.validateNodeDefinition(createNodeDto.definition);

    // Check if node with same name already exists
    const existingNode = await this.nodeRepository.findOne({
      where: { name: createNodeDto.name },
    });

    if (existingNode) {
      throw new BadRequestException('Node with this name already exists');
    }

    // Create node type
    const node = this.nodeRepository.create({
      ...createNodeDto,
      isBuiltIn: false,
      createdBy: userId,
      updatedBy: userId,
    });

    const savedNode = await this.nodeRepository.save(node);

    // Create initial version
    const nodeVersion = this.nodeVersionRepository.create({
      nodeTypeId: savedNode.id,
      version: '1.0.0',
      code: createNodeDto.code || '',
      definition: createNodeDto.definition,
      isActive: true,
      isStable: false,
      createdBy: userId,
    });

    const savedVersion = await this.nodeVersionRepository.save(nodeVersion);

    // Update node with current version
    savedNode.currentVersionId = savedVersion.id;
    savedNode.currentVersion = savedVersion;
    await this.nodeRepository.save(savedNode);

    // Register node in the registry
    await this.nodeRegistryService.registerNode(savedNode);

    // Emit event
    this.eventEmitter.emit('node.created', {
      nodeId: savedNode.id,
      nodeName: savedNode.name,
      userId,
      tenantId,
    });

    // Log audit event
    if (tenantId) {
      await this.auditService.log({
        action: 'node.created',
        resourceType: 'node',
        resourceId: savedNode.id,
        tenantId,
        userId,
        metadata: { nodeName: savedNode.name, nodeType: savedNode.nodeType },
      });
    }

    // Update metrics
    this.metricsService.incrementCounter('nodes_created_total', {
      node_type: savedNode.nodeType,
      category: savedNode.category,
    });

    return this.toNodeResponseDto(savedNode);
  }

  /**
   * Update a node type
   */
  async updateNode(
    id: string,
    updateNodeDto: UpdateNodeDto,
    userId: string,
    tenantId?: string,
  ): Promise<NodeResponseDto> {
    const node = await this.nodeRepository.findOne({
      where: { id, isActive: true },
      relations: ['currentVersion'],
    });

    if (!node) {
      throw new NotFoundException('Node not found');
    }

    // Built-in nodes cannot be updated
    if (node.isBuiltIn) {
      throw new BadRequestException('Built-in nodes cannot be updated');
    }

    // Validate new definition if provided
    if (updateNodeDto.definition) {
      await this.nodeValidationService.validateNodeDefinition(updateNodeDto.definition);
    }

    // Update node
    Object.assign(node, updateNodeDto);
    node.updatedAt = new Date();

    const savedNode = await this.nodeRepository.save(node);

    // Re-register node if definition changed
    if (updateNodeDto.definition) {
      await this.nodeRegistryService.registerNode(savedNode);
    }

    // Emit event
    this.eventEmitter.emit('node.updated', {
      nodeId: savedNode.id,
      nodeName: savedNode.name,
      userId,
      tenantId,
    });

    // Log audit event
    if (tenantId) {
      await this.auditService.log({
        action: 'node.updated',
        resourceType: 'node',
        resourceId: savedNode.id,
        tenantId,
        userId,
        metadata: { nodeName: savedNode.name },
      });
    }

    return this.toNodeResponseDto(savedNode);
  }

  /**
   * Delete a node type
   */
  async deleteNode(id: string, userId: string, tenantId?: string): Promise<void> {
    const node = await this.nodeRepository.findOne({
      where: { id, isActive: true },
    });

    if (!node) {
      throw new NotFoundException('Node not found');
    }

    // Built-in nodes cannot be deleted
    if (node.isBuiltIn) {
      throw new BadRequestException('Built-in nodes cannot be deleted');
    }

    // Soft delete (mark as inactive)
    node.isActive = false;
    await this.nodeRepository.save(node);

    // Unregister from node registry
    await this.nodeRegistryService.unregisterNode(node.name);

    // Emit event
    this.eventEmitter.emit('node.deleted', {
      nodeId: id,
      nodeName: node.name,
      userId,
      tenantId,
    });

    // Log audit event
    if (tenantId) {
      await this.auditService.log({
        action: 'node.deleted',
        resourceType: 'node',
        resourceId: id,
        tenantId,
        userId,
        metadata: { nodeName: node.name },
      });
    }

    // Update metrics
    this.metricsService.incrementCounter('nodes_deleted_total', {
      node_type: node.nodeType,
      category: node.category,
    });
  }

  /**
   * Get available node categories
   */
  async getNodeCategories(): Promise<{ category: NodeCategory; count: number }[]> {
    const result = await this.nodeRepository
      .createQueryBuilder('node')
      .select('node.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('node.isActive = :isActive', { isActive: true })
      .groupBy('node.category')
      .orderBy('count', 'DESC')
      .getRawMany();

    return result.map(item => ({
      category: item.category,
      count: parseInt(item.count, 10),
    }));
  }

  /**
   * Install a plugin package
   */
  async installPlugin(
    packageName: string,
    version?: string,
    tenantId?: string,
    userId?: string,
  ): Promise<PluginPackage> {
    return this.pluginLoaderService.installPlugin(packageName, version, tenantId, userId);
  }

  /**
   * Uninstall a plugin package
   */
  async uninstallPlugin(
    packageId: string,
    tenantId?: string,
    userId?: string,
  ): Promise<void> {
    return this.pluginLoaderService.uninstallPlugin(packageId, tenantId, userId);
  }

  /**
   * Get installed plugin packages
   */
  async getInstalledPlugins(tenantId?: string): Promise<PluginPackage[]> {
    return this.pluginPackageRepository.find({
      where: { status: PackageStatus.PUBLISHED },
      relations: ['nodeTypes'],
      order: { displayName: 'ASC' },
    });
  }

  /**
   * Search nodes in the registry
   */
  async searchNodes(
    query: string,
    filters: NodeSearchFilters = {},
  ): Promise<NodeResponseDto[]> {
    return this.findAllNodes({ ...filters, keywords: query });
  }

  /**
   * Get node execution statistics
   */
  async getNodeStats(nodeId: string): Promise<any> {
    // This would integrate with the execution service to get usage stats
    // For now, return basic info
    const node = await this.findNodeById(nodeId);
    return {
      nodeId,
      name: node.name,
      downloadCount: node.downloadCount || 0,
      rating: node.rating || 0,
      ratingCount: node.ratingCount || 0,
      // Add execution statistics from execution service
      // This would call the execution service to get real statistics
      node.executionStats = {
        totalExecutions: Math.floor(Math.random() * 1000),
        successRate: Math.random() * 100,
        avgExecutionTime: Math.floor(Math.random() * 5000),
        lastExecuted: new Date(),
      };
    };
  }

  /**
   * Convert node entity to response DTO
   */
  private toNodeResponseDto(node: NodeType): NodeResponseDto {
    return {
      id: node.id,
      name: node.name,
      displayName: node.displayName,
      description: node.description,
      icon: node.icon,
      nodeType: node.nodeType,
      category: node.category,
      definition: node.definition,
      properties: node.properties,
      credentials: node.credentials,
      keywords: node.keywords || [],
      isActive: node.isActive,
      isBuiltIn: node.isBuiltIn,
      isBeta: node.isBeta,
      requiresCredentials: node.requiresCredentials,
      version: node.currentVersion?.version || node.version,
      downloadCount: node.downloadCount,
      rating: node.rating,
      ratingCount: node.ratingCount,
      pluginPackage: node.pluginPackage
        ? {
            id: node.pluginPackage.id,
            name: node.pluginPackage.name,
            displayName: node.pluginPackage.displayName,
            version: node.pluginPackage.version,
            author: node.pluginPackage.author,
            isOfficial: node.pluginPackage.isOfficial,
          }
        : undefined,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    };
  }
}