import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
  ParseBoolPipe,
  DefaultValuePipe,
  ParseIntPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Tenant } from "../../common/decorators/tenant.decorator";
import { NodesService } from "./nodes.service";
import { CreateNodeDto } from "./dto/create-node.dto";
import { UpdateNodeDto } from "./dto/update-node.dto";
import { NodeResponseDto } from "./dto/node-response.dto";
import { NodeSearchFilters } from "./dto/node-search-filters.dto";
import { CreatePluginPackageDto } from "./dto/create-plugin-package.dto";

@ApiTags("Nodes")
@Controller("nodes")
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth("JWT-auth")
export class NodesController {
  constructor(private readonly nodesService: NodesService) {}

  @Post()
  @ApiOperation({
    summary: "Create a new node type",
    description: "Creates a new custom node type for workflow execution.",
  })
  @ApiCreatedResponse({
    description: "Node type created successfully",
    type: NodeResponseDto,
  })
  @ApiBadRequestResponse({ description: "Invalid node configuration" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  async createNode(
    @Body() createNodeDto: CreateNodeDto,
    @CurrentUser() user: any,
    @Tenant() tenantId: string,
  ): Promise<NodeResponseDto> {
    return this.nodesService.createNode(createNodeDto, user.id, tenantId);
  }

  @Get()
  @ApiOperation({
    summary: "Get all available node types",
    description: "Retrieves all node types available to the current tenant.",
  })
  @ApiQuery({
    name: "category",
    required: false,
    description: "Filter by node category",
  })
  @ApiQuery({
    name: "search",
    required: false,
    description: "Search node types by name or keywords",
  })
  @ApiQuery({
    name: "isBuiltIn",
    required: false,
    type: Boolean,
    description: "Filter built-in vs custom nodes",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Number of results to return",
  })
  @ApiQuery({
    name: "offset",
    required: false,
    type: Number,
    description: "Number of results to skip",
  })
  @ApiOkResponse({
    description: "List of node types",
    type: [NodeResponseDto],
  })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  async findAllNodes(
    @Tenant() tenantId: string,
    @Query() filters: NodeSearchFilters,
  ): Promise<NodeResponseDto[]> {
    return this.nodesService.findAllNodes(filters, tenantId);
  }

  @Get("categories")
  @ApiOperation({
    summary: "Get node categories",
    description: "Retrieves all available node categories.",
  })
  @ApiOkResponse({
    description: "List of node categories",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          displayName: { type: "string" },
          description: { type: "string" },
          icon: { type: "string" },
          nodeCount: { type: "number" },
        },
      },
    },
  })
  async getNodeCategories(@Tenant() tenantId: string) {
    return this.nodesService.getNodeCategories(tenantId);
  }

  @Get("built-in")
  @ApiOperation({
    summary: "Get built-in node types",
    description: "Retrieves all built-in node types provided by the platform.",
  })
  @ApiOkResponse({
    description: "List of built-in node types",
    type: [NodeResponseDto],
  })
  async getBuiltInNodes(): Promise<NodeResponseDto[]> {
    return this.nodesService.getBuiltInNodes();
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get a node type by ID",
    description: "Retrieves detailed information about a specific node type.",
  })
  @ApiParam({ name: "id", description: "Node type UUID" })
  @ApiQuery({
    name: "includeVersions",
    required: false,
    type: Boolean,
    description: "Include version history",
  })
  @ApiOkResponse({
    description: "Node type details",
    type: NodeResponseDto,
  })
  @ApiNotFoundResponse({ description: "Node type not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  async findOneNode(
    @Param("id") id: string,
    @Tenant() tenantId: string,
    @Query("includeVersions", new DefaultValuePipe(false), ParseBoolPipe)
    includeVersions = false,
  ): Promise<NodeResponseDto> {
    return this.nodesService.findOneNode(id, tenantId, includeVersions);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update a node type",
    description: "Updates an existing custom node type configuration.",
  })
  @ApiParam({ name: "id", description: "Node type UUID" })
  @ApiOkResponse({
    description: "Node type updated successfully",
    type: NodeResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid update data or built-in node",
  })
  @ApiNotFoundResponse({ description: "Node type not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  async updateNode(
    @Param("id") id: string,
    @Body() updateNodeDto: UpdateNodeDto,
    @CurrentUser() user: any,
    @Tenant() tenantId: string,
  ): Promise<NodeResponseDto> {
    return this.nodesService.updateNode(id, updateNodeDto, user.id, tenantId);
  }

  @Delete(":id")
  @ApiOperation({
    summary: "Delete a node type",
    description:
      "Soft-deletes a custom node type (built-in nodes cannot be deleted).",
  })
  @ApiParam({ name: "id", description: "Node type UUID" })
  @ApiNoContentResponse({ description: "Node type deleted successfully" })
  @ApiBadRequestResponse({
    description: "Cannot delete built-in node or node in use",
  })
  @ApiNotFoundResponse({ description: "Node type not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNode(
    @Param("id") id: string,
    @CurrentUser() user: any,
    @Tenant() tenantId: string,
  ): Promise<void> {
    return this.nodesService.deleteNode(id, user.id, tenantId);
  }

  @Post(":id/versions")
  @ApiOperation({
    summary: "Create a new version of a node type",
    description: "Creates a new version of an existing node type.",
  })
  @ApiParam({ name: "id", description: "Node type UUID" })
  @ApiCreatedResponse({
    description: "Node version created successfully",
    schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        version: { type: "string" },
        isActive: { type: "boolean" },
        isStable: { type: "boolean" },
      },
    },
  })
  async createNodeVersion(
    @Param("id") id: string,
    @Body() versionData: { version: string; code: string; definition: any },
    @CurrentUser() user: any,
    @Tenant() tenantId: string,
  ) {
    return this.nodesService.createNodeVersion(
      id,
      versionData,
      user.id,
      tenantId,
    );
  }

  @Get(":id/versions")
  @ApiOperation({
    summary: "Get node type versions",
    description: "Retrieves all versions of a specific node type.",
  })
  @ApiParam({ name: "id", description: "Node type UUID" })
  @ApiOkResponse({
    description: "List of node versions",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          version: { type: "string" },
          isActive: { type: "boolean" },
          isStable: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
    },
  })
  async getNodeVersions(@Param("id") id: string, @Tenant() tenantId: string) {
    return this.nodesService.getNodeVersions(id, tenantId);
  }

  @Post(":id/test")
  @ApiOperation({
    summary: "Test a node type",
    description: "Tests a node type with sample input data.",
  })
  @ApiParam({ name: "id", description: "Node type UUID" })
  @ApiOkResponse({
    description: "Node test result",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        output: { type: "object" },
        executionTime: { type: "number" },
        error: { type: "string" },
      },
    },
  })
  async testNode(
    @Param("id") id: string,
    @Body() testData: { input: any; configuration?: any },
    @Tenant() tenantId: string,
  ) {
    return this.nodesService.testNode(
      id,
      testData.input,
      testData.configuration,
      tenantId,
    );
  }

  @Post("packages")
  @ApiOperation({
    summary: "Install a plugin package",
    description: "Installs a plugin package containing multiple node types.",
  })
  @ApiCreatedResponse({
    description: "Plugin package installed successfully",
    schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        version: { type: "string" },
        nodeCount: { type: "number" },
        status: { type: "string" },
      },
    },
  })
  async installPluginPackage(
    @Body() createPluginDto: CreatePluginPackageDto,
    @CurrentUser() user: any,
    @Tenant() tenantId: string,
  ) {
    return this.nodesService.installPluginPackage(
      createPluginDto,
      user.id,
      tenantId,
    );
  }

  @Get("packages/installed")
  @ApiOperation({
    summary: "Get installed plugin packages",
    description: "Retrieves all installed plugin packages for the tenant.",
  })
  @ApiOkResponse({
    description: "List of installed plugin packages",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          version: { type: "string" },
          description: { type: "string" },
          author: { type: "string" },
          nodeCount: { type: "number" },
          status: { type: "string" },
          installedAt: { type: "string", format: "date-time" },
        },
      },
    },
  })
  async getInstalledPackages(@Tenant() tenantId: string) {
    return this.nodesService.getInstalledPackages(tenantId);
  }

  @Delete("packages/:packageId")
  @ApiOperation({
    summary: "Uninstall a plugin package",
    description: "Uninstalls a plugin package and all its node types.",
  })
  @ApiParam({ name: "packageId", description: "Plugin package UUID" })
  @ApiNoContentResponse({
    description: "Plugin package uninstalled successfully",
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async uninstallPluginPackage(
    @Param("packageId") packageId: string,
    @CurrentUser() user: any,
    @Tenant() tenantId: string,
  ): Promise<void> {
    return this.nodesService.uninstallPluginPackage(
      packageId,
      user.id,
      tenantId,
    );
  }

  @Get("registry/available")
  @ApiOperation({
    summary: "Get available nodes from registry",
    description: "Retrieves available node packages from the public registry.",
  })
  @ApiQuery({
    name: "search",
    required: false,
    description: "Search packages by name or description",
  })
  @ApiQuery({
    name: "category",
    required: false,
    description: "Filter by category",
  })
  @ApiOkResponse({
    description: "List of available packages",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          version: { type: "string" },
          description: { type: "string" },
          author: { type: "string" },
          category: { type: "string" },
          downloads: { type: "number" },
          rating: { type: "number" },
          verified: { type: "boolean" },
        },
      },
    },
  })
  async getAvailablePackages(
    @Query("search") search?: string,
    @Query("category") category?: string,
  ) {
    return this.nodesService.getAvailablePackages(search, category);
  }
}
