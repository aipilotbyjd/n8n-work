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
import { MonitoringService } from './monitoring.service';
import { MetricsCollectorService } from './metrics-collector.service';
import { AlertingService } from './alerting.service';
import { HealthCheckService } from './health-check.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { GetCurrentUser } from '../../auth/decorators/get-current-user.decorator';
import { GetCurrentTenant } from '../../auth/decorators/get-current-tenant.decorator';

@ApiTags('monitoring')
@ApiBearerAuth()
@Controller('monitoring')
export class MonitoringController {
  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly metricsCollectorService: MetricsCollectorService,
    private readonly alertingService: AlertingService,
    private readonly healthCheckService: HealthCheckService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Get system health status' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns system health status',
  })
  async getHealthStatus() {
    return this.healthCheckService.getSystemHealth();
  }

  @Get('health/detailed')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({ summary: 'Get detailed health check results' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns detailed health check results',
  })
  async getDetailedHealth(@GetCurrentTenant() tenantId: string) {
    return this.healthCheckService.getDetailedHealth(tenantId);
  }

  @Get('metrics/system')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({ summary: 'Get system metrics' })
  @ApiQuery({
    name: 'startTime',
    description: 'Start time for metrics',
    required: false,
  })
  @ApiQuery({
    name: 'endTime',
    description: 'End time for metrics',
    required: false,
  })
  @ApiQuery({
    name: 'interval',
    description: 'Metrics interval',
    required: false,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns system metrics',
  })
  async getSystemMetrics(
    @GetCurrentTenant() tenantId: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('interval') interval?: string,
  ) {
    return this.metricsCollectorService.getSystemMetrics(
      tenantId,
      startTime,
      endTime,
      interval,
    );
  }

  @Get('metrics/application')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({ summary: 'Get application metrics' })
  @ApiQuery({
    name: 'startTime',
    description: 'Start time for metrics',
    required: false,
  })
  @ApiQuery({
    name: 'endTime',
    description: 'End time for metrics',
    required: false,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns application metrics',
  })
  async getApplicationMetrics(
    @GetCurrentTenant() tenantId: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    return this.metricsCollectorService.getApplicationMetrics(
      tenantId,
      startTime,
      endTime,
    );
  }

  @Get('metrics/performance')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({ summary: 'Get performance metrics' })
  @ApiQuery({
    name: 'type',
    description: 'Performance metric type',
    required: false,
  })
  @ApiQuery({
    name: 'period',
    description: 'Time period',
    required: false,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns performance metrics',
  })
  async getPerformanceMetrics(
    @GetCurrentTenant() tenantId: string,
    @Query('type') type?: string,
    @Query('period') period?: string,
  ) {
    return this.monitoringService.getPerformanceMetrics(tenantId, type, period);
  }

  @Get('alerts')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({ summary: 'Get alerts for tenant' })
  @ApiQuery({
    name: 'status',
    description: 'Alert status filter',
    required: false,
  })
  @ApiQuery({
    name: 'severity',
    description: 'Alert severity filter',
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of alerts to return',
    required: false,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns alerts',
  })
  async getAlerts(
    @GetCurrentTenant() tenantId: string,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('limit') limit?: string,
  ) {
    return this.alertingService.getAlerts(tenantId, status, severity, parseInt(limit) || 50);
  }

  @Post('alerts')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({ summary: 'Create a new alert rule' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Alert rule created successfully',
  })
  async createAlertRule(
    @GetCurrentTenant() tenantId: string,
    @GetCurrentUser('id') userId: string,
    @Body() createAlertDto: any,
  ) {
    return this.alertingService.createAlertRule(tenantId, createAlertDto, userId);
  }

  @Put('alerts/:alertId/acknowledge')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({ summary: 'Acknowledge an alert' })
  @ApiParam({
    name: 'alertId',
    description: 'Alert ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Alert acknowledged successfully',
  })
  async acknowledgeAlert(
    @GetCurrentTenant() tenantId: string,
    @GetCurrentUser('id') userId: string,
    @Param('alertId') alertId: string,
  ) {
    return this.alertingService.acknowledgeAlert(tenantId, alertId, userId);
  }

  @Put('alerts/:alertId/resolve')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({ summary: 'Resolve an alert' })
  @ApiParam({
    name: 'alertId',
    description: 'Alert ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Alert resolved successfully',
  })
  async resolveAlert(
    @GetCurrentTenant() tenantId: string,
    @GetCurrentUser('id') userId: string,
    @Param('alertId') alertId: string,
  ) {
    return this.alertingService.resolveAlert(tenantId, alertId, userId);
  }

  @Get('dashboard')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({ summary: 'Get monitoring dashboard data' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns monitoring dashboard data',
  })
  async getMonitoringDashboard(@GetCurrentTenant() tenantId: string) {
    return this.monitoringService.getMonitoringDashboard(tenantId);
  }

  @Get('reports/uptime')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({ summary: 'Get uptime report' })
  @ApiQuery({
    name: 'startDate',
    description: 'Start date for report',
    required: false,
  })
  @ApiQuery({
    name: 'endDate',
    description: 'End date for report',
    required: false,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns uptime report',
  })
  async getUptimeReport(
    @GetCurrentTenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.monitoringService.getUptimeReport(tenantId, startDate, endDate);
  }

  @Get('reports/performance')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({ summary: 'Get performance report' })
  @ApiQuery({
    name: 'startDate',
    description: 'Start date for report',
    required: false,
  })
  @ApiQuery({
    name: 'endDate',
    description: 'End date for report',
    required: false,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns performance report',
  })
  async getPerformanceReport(
    @GetCurrentTenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.monitoringService.getPerformanceReport(tenantId, startDate, endDate);
  }

  @Post('metrics/custom')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({ summary: 'Record custom metrics' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Custom metrics recorded successfully',
  })
  async recordCustomMetrics(
    @GetCurrentTenant() tenantId: string,
    @GetCurrentUser('id') userId: string,
    @Body() metricsData: any,
  ) {
    return this.metricsCollectorService.recordCustomMetrics(tenantId, metricsData, userId);
  }

  @Get('logs/errors')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({ summary: 'Get error logs' })
  @ApiQuery({
    name: 'startTime',
    description: 'Start time for logs',
    required: false,
  })
  @ApiQuery({
    name: 'endTime',
    description: 'End time for logs',
    required: false,
  })
  @ApiQuery({
    name: 'level',
    description: 'Log level filter',
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of logs to return',
    required: false,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns error logs',
  })
  async getErrorLogs(
    @GetCurrentTenant() tenantId: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('level') level?: string,
    @Query('limit') limit?: string,
  ) {
    return this.monitoringService.getErrorLogs(
      tenantId,
      startTime,
      endTime,
      level,
      parseInt(limit) || 100,
    );
  }
}