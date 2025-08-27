import {
  Controller,
  Get,
  Post,
  Body,
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
import { ExecutionsService } from "./executions.service";
import { StartExecutionDto } from "./dto/start-execution.dto";
import { ExecutionResponseDto } from "./dto/execution-response.dto";
import { ExecutionFilterDto } from "./dto/execution-filter.dto";
import { RetryExecutionDto } from "./dto/retry-execution.dto";
import { ExecutionStatus, ExecutionMode } from "./entities/execution.entity";

@ApiTags("Executions")
@Controller("executions")
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth("JWT-auth")
export class ExecutionsController {
  constructor(private readonly executionsService: ExecutionsService) {}

  @Post()
  @ApiOperation({
    summary: "Start a workflow execution",
    description: "Starts a new workflow execution with optional input data.",
  })
  @ApiCreatedResponse({
    description: "Execution started successfully",
    type: ExecutionResponseDto,
  })
  @ApiBadRequestResponse({ description: "Invalid execution request" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  async startExecution(
    @Body() startExecutionDto: StartExecutionDto,
    @CurrentUser() user: any,
    @Tenant() tenantId: string,
  ): Promise<ExecutionResponseDto> {
    return this.executionsService.startExecution(
      startExecutionDto,
      tenantId,
      user.id,
    );
  }

  @Get()
  @ApiOperation({
    summary: "Get workflow executions",
    description:
      "Retrieves a list of workflow executions with optional filtering.",
  })
  @ApiQuery({
    name: "workflowId",
    required: false,
    description: "Filter by workflow ID",
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ExecutionStatus,
    description: "Filter by execution status",
  })
  @ApiQuery({
    name: "mode",
    required: false,
    enum: ExecutionMode,
    description: "Filter by execution mode",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Number of results to return",
    example: 50,
  })
  @ApiQuery({
    name: "offset",
    required: false,
    type: Number,
    description: "Number of results to skip",
    example: 0,
  })
  @ApiQuery({
    name: "includeData",
    required: false,
    type: Boolean,
    description: "Include execution data in response",
  })
  @ApiOkResponse({
    description: "List of executions",
    type: [ExecutionResponseDto],
  })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  async findExecutions(
    @Tenant() tenantId: string,
    @Query("workflowId") workflowId?: string,
    @Query("status") status?: ExecutionStatus,
    @Query("mode") mode?: ExecutionMode,
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit = 50,
    @Query("offset", new DefaultValuePipe(0), ParseIntPipe) offset = 0,
    @Query("includeData", new DefaultValuePipe(false), ParseBoolPipe)
    includeData = false,
  ): Promise<ExecutionResponseDto[]> {
    const filters: ExecutionFilterDto = {
      workflowId,
      status,
      mode,
      limit,
      offset,
      includeData,
    };
    return this.executionsService.findExecutions(tenantId, filters);
  }

  @Get("stats")
  @ApiOperation({
    summary: "Get execution statistics",
    description: "Retrieves execution statistics for the tenant.",
  })
  @ApiQuery({
    name: "workflowId",
    required: false,
    description: "Filter stats by workflow ID",
  })
  @ApiQuery({
    name: "days",
    required: false,
    type: Number,
    description: "Number of days to include",
    example: 30,
  })
  @ApiOkResponse({
    description: "Execution statistics",
    schema: {
      type: "object",
      properties: {
        totalExecutions: { type: "number" },
        successfulExecutions: { type: "number" },
        failedExecutions: { type: "number" },
        averageExecutionTime: { type: "number" },
        executionsByStatus: { type: "object" },
        executionsByMode: { type: "object" },
        dailyStats: { type: "array", items: { type: "object" } },
      },
    },
  })
  async getExecutionStats(
    @Tenant() tenantId: string,
    @Query("workflowId") workflowId?: string,
    @Query("days", new DefaultValuePipe(30), ParseIntPipe) days = 30,
  ) {
    return this.executionsService.getExecutionStats(tenantId, workflowId, days);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get execution details",
    description: "Retrieves detailed information about a specific execution.",
  })
  @ApiParam({ name: "id", description: "Execution UUID" })
  @ApiQuery({
    name: "includeData",
    required: false,
    type: Boolean,
    description: "Include execution data",
  })
  @ApiQuery({
    name: "includeLogs",
    required: false,
    type: Boolean,
    description: "Include execution logs",
  })
  @ApiOkResponse({
    description: "Execution details",
    type: ExecutionResponseDto,
  })
  @ApiNotFoundResponse({ description: "Execution not found" })
  async getExecution(
    @Param("id") id: string,
    @Tenant() tenantId: string,
    @Query("includeData", new DefaultValuePipe(true), ParseBoolPipe)
    includeData = true,
    @Query("includeLogs", new DefaultValuePipe(false), ParseBoolPipe)
    includeLogs = false,
  ): Promise<ExecutionResponseDto> {
    return this.executionsService.getExecution(
      id,
      tenantId,
      includeData,
      includeLogs,
    );
  }

  @Post(":id/stop")
  @ApiOperation({
    summary: "Stop a running execution",
    description: "Stops a currently running execution.",
  })
  @ApiParam({ name: "id", description: "Execution UUID" })
  @ApiOkResponse({
    description: "Execution stopped successfully",
    type: ExecutionResponseDto,
  })
  @ApiNotFoundResponse({ description: "Execution not found" })
  @ApiBadRequestResponse({ description: "Execution cannot be stopped" })
  async stopExecution(
    @Param("id") id: string,
    @CurrentUser() user: any,
    @Tenant() tenantId: string,
  ): Promise<ExecutionResponseDto> {
    return this.executionsService.stopExecution(id, tenantId, user.id);
  }

  @Post(":id/retry")
  @ApiOperation({
    summary: "Retry a failed execution",
    description: "Retries a failed execution, optionally from a specific node.",
  })
  @ApiParam({ name: "id", description: "Execution UUID" })
  @ApiOkResponse({
    description: "Execution retry started",
    type: ExecutionResponseDto,
  })
  @ApiNotFoundResponse({ description: "Execution not found" })
  @ApiBadRequestResponse({ description: "Execution cannot be retried" })
  async retryExecution(
    @Param("id") id: string,
    @Body() retryExecutionDto: RetryExecutionDto,
    @CurrentUser() user: any,
    @Tenant() tenantId: string,
  ): Promise<ExecutionResponseDto> {
    return this.executionsService.retryExecution(
      id,
      retryExecutionDto,
      tenantId,
      user.id,
    );
  }

  @Delete(":id")
  @ApiOperation({
    summary: "Delete an execution",
    description: "Deletes an execution and all associated data.",
  })
  @ApiParam({ name: "id", description: "Execution UUID" })
  @ApiNoContentResponse({ description: "Execution deleted successfully" })
  @ApiNotFoundResponse({ description: "Execution not found" })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteExecution(
    @Param("id") id: string,
    @CurrentUser() user: any,
    @Tenant() tenantId: string,
  ): Promise<void> {
    return this.executionsService.deleteExecution(id, tenantId, user.id);
  }

  @Get(":id/logs")
  @ApiOperation({
    summary: "Get execution logs",
    description: "Retrieves detailed logs for a specific execution.",
  })
  @ApiParam({ name: "id", description: "Execution UUID" })
  @ApiQuery({
    name: "level",
    required: false,
    description: "Filter by log level",
  })
  @ApiQuery({
    name: "nodeId",
    required: false,
    description: "Filter by node ID",
  })
  @ApiOkResponse({
    description: "Execution logs",
    schema: {
      type: "object",
      properties: {
        executionId: { type: "string" },
        logs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              timestamp: { type: "string", format: "date-time" },
              level: { type: "string" },
              message: { type: "string" },
              nodeId: { type: "string" },
              data: { type: "object" },
            },
          },
        },
      },
    },
  })
  async getExecutionLogs(
    @Param("id") id: string,
    @Tenant() tenantId: string,
    @Query("level") level?: string,
    @Query("nodeId") nodeId?: string,
  ) {
    return this.executionsService.getExecutionLogs(id, tenantId, level, nodeId);
  }

  @Get(":id/timeline")
  @ApiOperation({
    summary: "Get execution timeline",
    description: "Retrieves a timeline of events for a specific execution.",
  })
  @ApiParam({ name: "id", description: "Execution UUID" })
  @ApiOkResponse({
    description: "Execution timeline",
    schema: {
      type: "object",
      properties: {
        executionId: { type: "string" },
        timeline: {
          type: "array",
          items: {
            type: "object",
            properties: {
              timestamp: { type: "string", format: "date-time" },
              event: { type: "string" },
              nodeId: { type: "string" },
              nodeName: { type: "string" },
              status: { type: "string" },
              duration: { type: "number" },
              data: { type: "object" },
            },
          },
        },
      },
    },
  })
  async getExecutionTimeline(
    @Param("id") id: string,
    @Tenant() tenantId: string,
  ) {
    return this.executionsService.getExecutionTimeline(id, tenantId);
  }

  @Post("bulk/delete")
  @ApiOperation({
    summary: "Bulk delete executions",
    description: "Deletes multiple executions based on criteria.",
  })
  @ApiOkResponse({
    description: "Bulk deletion completed",
    schema: {
      type: "object",
      properties: {
        deletedCount: { type: "number" },
        criteria: { type: "object" },
      },
    },
  })
  async bulkDeleteExecutions(
    @Body() criteria: ExecutionFilterDto,
    @CurrentUser() user: any,
    @Tenant() tenantId: string,
  ) {
    return this.executionsService.bulkDeleteExecutions(
      criteria,
      tenantId,
      user.id,
    );
  }

  @Post("bulk/retry")
  @ApiOperation({
    summary: "Bulk retry executions",
    description: "Retries multiple failed executions.",
  })
  @ApiOkResponse({
    description: "Bulk retry initiated",
    schema: {
      type: "object",
      properties: {
        retriedCount: { type: "number" },
        skippedCount: { type: "number" },
        executionIds: { type: "array", items: { type: "string" } },
      },
    },
  })
  async bulkRetryExecutions(
    @Body() criteria: ExecutionFilterDto,
    @CurrentUser() user: any,
    @Tenant() tenantId: string,
  ) {
    return this.executionsService.bulkRetryExecutions(
      criteria,
      tenantId,
      user.id,
    );
  }
}
