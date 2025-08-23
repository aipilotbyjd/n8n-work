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
} from '@nestjs/common';
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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { SchedulingService } from './scheduling.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleResponseDto } from './dto/schedule-response.dto';
import { ScheduleFilterDto } from './dto/schedule-filter.dto';

@ApiTags('Scheduling')
@Controller('schedules')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth('JWT-auth')
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new schedule',
    description: 'Creates a new schedule for workflow execution.',
  })
  @ApiCreatedResponse({
    description: 'Schedule created successfully',
    type: ScheduleResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid schedule configuration' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async createSchedule(
    @Body() createScheduleDto: CreateScheduleDto,
    @CurrentUser() user: any,
    @Tenant() tenantId: string,
  ): Promise<ScheduleResponseDto> {
    return this.schedulingService.createSchedule(createScheduleDto, tenantId, user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all schedules',
    description: 'Retrieves all schedules for the current tenant.',
  })
  @ApiQuery({ name: 'workflowId', required: false, description: 'Filter by workflow ID' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'Filter by active status' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of results to return' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Number of results to skip' })
  @ApiOkResponse({
    description: 'List of schedules',
    type: [ScheduleResponseDto],
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async findAllSchedules(
    @Tenant() tenantId: string,
    @Query() filters: ScheduleFilterDto,
  ): Promise<ScheduleResponseDto[]> {
    return this.schedulingService.findAllSchedules(tenantId, filters);
  }

  @Get('upcoming')
  @ApiOperation({
    summary: 'Get upcoming scheduled executions',
    description: 'Retrieves upcoming scheduled executions within the specified time range.',
  })
  @ApiQuery({
    name: 'hours',
    required: false,
    type: Number,
    description: 'Number of hours to look ahead',
    example: 24,
  })
  @ApiOkResponse({
    description: 'List of upcoming executions',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          scheduleId: { type: 'string' },
          scheduleName: { type: 'string' },
          workflowId: { type: 'string' },
          nextRunAt: { type: 'string', format: 'date-time' },
          cronExpression: { type: 'string' },
        },
      },
    },
  })
  async getUpcomingExecutions(
    @Tenant() tenantId: string,
    @Query('hours', new DefaultValuePipe(24), ParseIntPipe) hours = 24,
  ) {
    return this.schedulingService.getUpcomingExecutions(tenantId, hours);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a schedule by ID',
    description: 'Retrieves a specific schedule by its ID.',
  })
  @ApiParam({ name: 'id', description: 'Schedule UUID' })
  @ApiOkResponse({
    description: 'Schedule details',
    type: ScheduleResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Schedule not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async findOneSchedule(
    @Param('id') id: string,
    @Tenant() tenantId: string,
  ): Promise<ScheduleResponseDto> {
    return this.schedulingService.findOneSchedule(id, tenantId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a schedule',
    description: 'Updates an existing schedule configuration.',
  })
  @ApiParam({ name: 'id', description: 'Schedule UUID' })
  @ApiOkResponse({
    description: 'Schedule updated successfully',
    type: ScheduleResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid update data' })
  @ApiNotFoundResponse({ description: 'Schedule not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async updateSchedule(
    @Param('id') id: string,
    @Body() updateScheduleDto: UpdateScheduleDto,
    @CurrentUser() user: any,
    @Tenant() tenantId: string,
  ): Promise<ScheduleResponseDto> {
    return this.schedulingService.updateSchedule(id, updateScheduleDto, tenantId, user.id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a schedule',
    description: 'Permanently deletes a schedule and cancels pending executions.',
  })
  @ApiParam({ name: 'id', description: 'Schedule UUID' })
  @ApiNoContentResponse({ description: 'Schedule deleted successfully' })
  @ApiNotFoundResponse({ description: 'Schedule not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSchedule(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Tenant() tenantId: string,
  ): Promise<void> {
    return this.schedulingService.deleteSchedule(id, tenantId, user.id);
  }

  @Post(':id/toggle')
  @ApiOperation({
    summary: 'Toggle schedule active status',
    description: 'Activates or deactivates a schedule.',
  })
  @ApiParam({ name: 'id', description: 'Schedule UUID' })
  @ApiQuery({ name: 'isActive', type: Boolean, description: 'New active status' })
  @ApiOkResponse({
    description: 'Schedule status updated',
    type: ScheduleResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Schedule not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async toggleSchedule(
    @Param('id') id: string,
    @Query('isActive', ParseBoolPipe) isActive: boolean,
    @CurrentUser() user: any,
    @Tenant() tenantId: string,
  ): Promise<ScheduleResponseDto> {
    return this.schedulingService.toggleSchedule(id, isActive, tenantId, user.id);
  }

  @Post(':id/trigger')
  @ApiOperation({
    summary: 'Trigger schedule manually',
    description: 'Manually triggers a scheduled workflow execution.',
  })
  @ApiParam({ name: 'id', description: 'Schedule UUID' })
  @ApiOkResponse({
    description: 'Schedule triggered successfully',
    schema: {
      type: 'object',
      properties: {
        executionId: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Schedule not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async triggerSchedule(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Tenant() tenantId: string,
  ) {
    return this.schedulingService.triggerScheduleManually(id, tenantId, user.id);
  }

  @Get(':id/executions')
  @ApiOperation({
    summary: 'Get schedule execution history',
    description: 'Retrieves the execution history for a specific schedule.',
  })
  @ApiParam({ name: 'id', description: 'Schedule UUID' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of results' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Number to skip' })
  @ApiOkResponse({
    description: 'Schedule execution history',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string' },
          scheduledAt: { type: 'string', format: 'date-time' },
          executedAt: { type: 'string', format: 'date-time' },
          duration: { type: 'number' },
          error: { type: 'string' },
        },
      },
    },
  })
  async getScheduleExecutions(
    @Param('id') id: string,
    @Tenant() tenantId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset = 0,
  ) {
    return this.schedulingService.getScheduleExecutions(id, tenantId, limit, offset);
  }

  @Get(':id/stats')
  @ApiOperation({
    summary: 'Get schedule statistics',
    description: 'Retrieves statistics and performance metrics for a schedule.',
  })
  @ApiParam({ name: 'id', description: 'Schedule UUID' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days to analyze' })
  @ApiOkResponse({
    description: 'Schedule statistics',
    schema: {
      type: 'object',
      properties: {
        schedule: { type: 'object' },
        executions: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            successful: { type: 'number' },
            failed: { type: 'number' },
            successRate: { type: 'number' },
          },
        },
        performance: {
          type: 'object',
          properties: {
            avgExecutionTime: { type: 'number' },
            reliability: { type: 'number' },
          },
        },
      },
    },
  })
  async getScheduleStats(
    @Param('id') id: string,
    @Tenant() tenantId: string,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days = 30,
  ) {
    return this.schedulingService.getScheduleStats(id, tenantId, days);
  }

  @Post('validate-cron')
  @ApiOperation({
    summary: 'Validate cron expression',
    description: 'Validates a cron expression and returns the next execution times.',
  })
  @ApiOkResponse({
    description: 'Cron validation result',
    schema: {
      type: 'object',
      properties: {
        isValid: { type: 'boolean' },
        error: { type: 'string' },
        nextExecutions: {
          type: 'array',
          items: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  async validateCronExpression(
    @Body() body: { cronExpression: string; timezone?: string },
  ) {
    return this.schedulingService.validateCronExpression(
      body.cronExpression,
      body.timezone,
    );
  }
}"