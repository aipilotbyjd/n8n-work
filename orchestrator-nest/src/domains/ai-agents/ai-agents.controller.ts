import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AIAgentsService } from './ai-agents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { GetCurrentUser } from '../auth/decorators/get-current-user.decorator';
import { GetCurrentTenant } from '../auth/decorators/get-current-tenant.decorator';

@ApiTags('ai-agents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('ai-agents')
export class AiAgentsController {
  constructor(private readonly aiAgentsService: AIAgentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new AI agent' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'AI agent created successfully',
  })
  async createAgent(
    @GetCurrentTenant() tenantId: string,
    @GetCurrentUser('id') userId: string,
    @Body() createAgentDto: any,
  ) {
    return this.aiAgentsService.createAgent(tenantId, createAgentDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all AI agents for tenant' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns all AI agents',
  })
  async getAgents(@GetCurrentTenant() tenantId: string) {
    return this.aiAgentsService.getAgents(tenantId);
  }

  @Get(':agentId')
  @ApiOperation({ summary: 'Get AI agent by ID' })
  @ApiParam({
    name: 'agentId',
    description: 'AI agent ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns AI agent details',
  })
  async getAgent(
    @GetCurrentTenant() tenantId: string,
    @Param('agentId') agentId: string,
  ) {
    return this.aiAgentsService.getAgent(tenantId, agentId);
  }

  @Put(':agentId')
  @ApiOperation({ summary: 'Update an AI agent' })
  @ApiParam({
    name: 'agentId',
    description: 'AI agent ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'AI agent updated successfully',
  })
  async updateAgent(
    @GetCurrentTenant() tenantId: string,
    @GetCurrentUser('id') userId: string,
    @Param('agentId') agentId: string,
    @Body() updateAgentDto: any,
  ) {
    return this.aiAgentsService.updateAgent(tenantId, agentId, updateAgentDto, userId);
  }

  @Delete(':agentId')
  @ApiOperation({ summary: 'Delete an AI agent' })
  @ApiParam({
    name: 'agentId',
    description: 'AI agent ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'AI agent deleted successfully',
  })
  async deleteAgent(
    @GetCurrentTenant() tenantId: string,
    @GetCurrentUser('id') userId: string,
    @Param('agentId') agentId: string,
  ) {
    return this.aiAgentsService.deleteAgent(tenantId, agentId, userId);
  }

  @Post(':agentId/execute')
  @ApiOperation({ summary: 'Execute an AI agent' })
  @ApiParam({
    name: 'agentId',
    description: 'AI agent ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'AI agent execution started',
  })
  async executeAgent(
    @GetCurrentTenant() tenantId: string,
    @GetCurrentUser('id') userId: string,
    @Param('agentId') agentId: string,
    @Body() executionData: any,
  ) {
    return this.aiAgentsService.executeAgent(tenantId, agentId, executionData, userId);
  }

  @Get(':agentId/executions')
  @ApiOperation({ summary: 'Get AI agent execution history' })
  @ApiParam({
    name: 'agentId',
    description: 'AI agent ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns AI agent execution history',
  })
  async getAgentExecutions(
    @GetCurrentTenant() tenantId: string,
    @Param('agentId') agentId: string,
  ) {
    return this.aiAgentsService.getAgentExecutions(tenantId, agentId);
  }

  @Get('executions/:executionId')
  @ApiOperation({ summary: 'Get AI agent execution details' })
  @ApiParam({
    name: 'executionId',
    description: 'Execution ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns execution details',
  })
  async getAgentExecution(
    @GetCurrentTenant() tenantId: string,
    @Param('executionId') executionId: string,
  ) {
    return this.aiAgentsService.getAgentExecution(tenantId, executionId);
  }

  @Post(':agentId/train')
  @ApiOperation({ summary: 'Train an AI agent with new data' })
  @ApiParam({
    name: 'agentId',
    description: 'AI agent ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'AI agent training started',
  })
  async trainAgent(
    @GetCurrentTenant() tenantId: string,
    @GetCurrentUser('id') userId: string,
    @Param('agentId') agentId: string,
    @Body() trainingData: any,
  ) {
    return this.aiAgentsService.trainAgent(tenantId, agentId, trainingData, userId);
  }

  @Get(':agentId/capabilities')
  @ApiOperation({ summary: 'Get AI agent capabilities' })
  @ApiParam({
    name: 'agentId',
    description: 'AI agent ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns AI agent capabilities',
  })
  async getAgentCapabilities(
    @GetCurrentTenant() tenantId: string,
    @Param('agentId') agentId: string,
  ) {
    return this.aiAgentsService.getAgentCapabilities(tenantId, agentId);
  }

  @Get('analytics/performance')
  @ApiOperation({ summary: 'Get AI agents performance analytics' })
  @ApiQuery({
    name: 'startDate',
    description: 'Start date for analytics',
    required: false,
  })
  @ApiQuery({
    name: 'endDate',
    description: 'End date for analytics',
    required: false,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns AI agents performance analytics',
  })
  async getPerformanceAnalytics(
    @GetCurrentTenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.aiAgentsService.getPerformanceAnalytics(tenantId, startDate, endDate);
  }
}