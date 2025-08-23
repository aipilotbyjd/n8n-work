import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MetricPoint } from './entities/metric-point.entity';
import { Alert } from './entities/alert.entity';
import { Dashboard } from './entities/dashboard.entity';
import { TimeSeriesService } from './services/time-series.service';
import { AlertingService } from './services/alerting.service';
import { WebSocketGateway } from './gateways/monitoring.gateway';

export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    cores: number;
    load: number[];
  };
  memory: {
    used: number;
    total: number;
    usage: number;
  };
  disk: {
    used: number;
    total: number;
    usage: number;
  };
  network: {
    inbound: number;
    outbound: number;
  };
}

export interface WorkflowMetrics {
  timestamp: Date;
  tenantId: string;
  workflowId?: string;
  executionId?: string;
  metrics: {
    executionsTotal: number;
    executionsSuccess: number;
    executionsFailed: number;
    executionDuration: number;
    nodesExecuted: number;
    errorsTotal: number;
    activeExecutions: number;
    queuedExecutions: number;
  };
}

export interface AIMetrics {
  timestamp: Date;
  tenantId: string;
  agentId: string;
  executionId: string;
  metrics: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    executionTime: number;
    modelLatency: number;
    queueTime: number;
    memoryUsage: number;
    gpuUsage?: number;
    cost: number;
  };
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly metrics = new Map<string, any[]>();
  private readonly alertThresholds = new Map<string, any>();

  constructor(
    @InjectRepository(MetricPoint)
    private readonly metricRepository: Repository<MetricPoint>,
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
    @InjectRepository(Dashboard)
    private readonly dashboardRepository: Repository<Dashboard>,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly timeSeriesService: TimeSeriesService,
    private readonly alertingService: AlertingService,
    private readonly wsGateway: WebSocketGateway,
  ) {
    this.initializeAlertThresholds();
  }

  // System Metrics Collection
  @Cron(CronExpression.EVERY_30_SECONDS)
  async collectSystemMetrics(): Promise<void> {
    try {
      const metrics = await this.gatherSystemMetrics();
      await this.recordMetrics('system', metrics);
      
      // Check for system alerts
      await this.checkSystemAlerts(metrics);
      
      // Broadcast to real-time dashboard
      this.wsGateway.broadcastSystemMetrics(metrics);
    } catch (error) {
      this.logger.error('Failed to collect system metrics:', error);
    }
  }

  // Workflow Metrics Events
  @OnEvent('workflow.execution.started')
  async onWorkflowStarted(event: any): Promise<void> {
    await this.recordWorkflowEvent('execution_started', event);
    await this.updateWorkflowMetrics(event.tenantId, event.workflowId);
  }

  @OnEvent('workflow.execution.completed')
  async onWorkflowCompleted(event: any): Promise<void> {
    const metrics: WorkflowMetrics = {
      timestamp: new Date(),
      tenantId: event.tenantId,
      workflowId: event.workflowId,
      executionId: event.executionId,
      metrics: {
        executionsTotal: 1,
        executionsSuccess: 1,
        executionsFailed: 0,
        executionDuration: event.duration || 0,
        nodesExecuted: event.nodesExecuted || 0,
        errorsTotal: 0,
        activeExecutions: await this.getActiveExecutionsCount(event.tenantId),
        queuedExecutions: await this.getQueuedExecutionsCount(event.tenantId),
      },
    };

    await this.recordMetrics('workflow', metrics);
    await this.checkWorkflowAlerts(metrics);
    this.wsGateway.broadcastWorkflowMetrics(event.tenantId, metrics);
  }

  @OnEvent('workflow.execution.failed')
  async onWorkflowFailed(event: any): Promise<void> {
    const metrics: WorkflowMetrics = {
      timestamp: new Date(),
      tenantId: event.tenantId,
      workflowId: event.workflowId,
      executionId: event.executionId,
      metrics: {
        executionsTotal: 1,
        executionsSuccess: 0,
        executionsFailed: 1,
        executionDuration: event.duration || 0,
        nodesExecuted: event.nodesExecuted || 0,
        errorsTotal: 1,
        activeExecutions: await this.getActiveExecutionsCount(event.tenantId),
        queuedExecutions: await this.getQueuedExecutionsCount(event.tenantId),
      },
    };

    await this.recordMetrics('workflow', metrics);
    await this.checkWorkflowAlerts(metrics);
    this.wsGateway.broadcastWorkflowMetrics(event.tenantId, metrics);

    // Create incident alert for failures
    await this.alertingService.createAlert({
      type: 'workflow_failure',
      severity: 'high',
      tenantId: event.tenantId,
      title: `Workflow execution failed: ${event.workflowId}`,
      description: `Execution ${event.executionId} failed with error: ${event.error}`,
      metadata: {
        workflowId: event.workflowId,
        executionId: event.executionId,
        error: event.error,
      },
    });
  }

  // AI Metrics Events
  @OnEvent('ai_execution.completed')
  async onAIExecutionCompleted(event: any): Promise<void> {
    const metrics: AIMetrics = {
      timestamp: new Date(),
      tenantId: event.execution.tenantId,
      agentId: event.execution.agentId,
      executionId: event.execution.id,
      metrics: event.result.metrics,
    };

    await this.recordMetrics('ai', metrics);
    await this.checkAIAlerts(metrics);
    this.wsGateway.broadcastAIMetrics(event.execution.tenantId, metrics);
  }

  @OnEvent('ai_execution.failed')
  async onAIExecutionFailed(event: any): Promise<void> {
    await this.alertingService.createAlert({
      type: 'ai_execution_failure',
      severity: 'medium',
      tenantId: event.execution.tenantId,
      title: `AI execution failed: ${event.agent.name}`,
      description: `AI agent execution failed: ${event.error.message}`,
      metadata: {
        agentId: event.agent.id,
        executionId: event.execution.id,
        error: event.error,
      },
    });
  }

  // Real-time Metrics Query
  async getRealtimeMetrics(tenantId: string, metricType: string, timeRange: string) {
    const endTime = new Date();
    const startTime = this.calculateStartTime(endTime, timeRange);

    return this.timeSeriesService.query({
      tenantId,
      metricType,
      startTime,
      endTime,
      aggregation: 'avg',
      interval: this.calculateInterval(timeRange),
    });
  }

  async getDashboard(dashboardId: string, tenantId: string) {
    const dashboard = await this.dashboardRepository.findOne({
      where: { id: dashboardId, tenantId },
      relations: ['widgets', 'alerts'],
    });

    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    // Fetch real-time data for each widget
    const widgets = await Promise.all(
      dashboard.widgets.map(async (widget) => ({
        ...widget,
        data: await this.getWidgetData(widget, tenantId),
      })),
    );

    return {
      ...dashboard,
      widgets,
      lastUpdated: new Date(),
    };
  }

  async createDashboard(tenantId: string, dashboardConfig: any) {
    const dashboard = this.dashboardRepository.create({
      ...dashboardConfig,
      tenantId,
    });

    return this.dashboardRepository.save(dashboard);
  }

  // Predictive Analytics
  async predictWorkflowFailures(tenantId: string, workflowId?: string) {
    const historicalData = await this.getHistoricalFailureData(tenantId, workflowId);
    
    // Simple anomaly detection (in production, use proper ML models)
    const recentFailureRate = this.calculateRecentFailureRate(historicalData);
    const historicalAverage = this.calculateHistoricalAverage(historicalData);
    
    const anomalyScore = recentFailureRate / historicalAverage;
    
    if (anomalyScore > 2.0) { // Threshold for anomaly
      await this.alertingService.createAlert({
        type: 'predictive_failure',
        severity: 'warning',
        tenantId,
        title: 'Potential workflow failure predicted',
        description: `Anomaly detected: failure rate is ${anomalyScore.toFixed(2)}x higher than normal`,
        metadata: {
          workflowId,
          anomalyScore,
          recentFailureRate,
          historicalAverage,
        },
      });
    }

    return {
      anomalyScore,
      recentFailureRate,
      historicalAverage,
      recommendation: this.generateRecommendation(anomalyScore),
    };
  }

  async getCapacityForecast(tenantId: string, days: number = 30) {
    const historicalUsage = await this.getResourceUsageHistory(tenantId, days);
    
    // Linear regression for simple forecasting (use proper ML in production)
    const forecast = this.calculateLinearTrend(historicalUsage);
    
    return {
      currentUsage: historicalUsage[historicalUsage.length - 1],
      forecastedUsage: forecast,
      capacityWarnings: this.generateCapacityWarnings(forecast),
      recommendations: this.generateScalingRecommendations(forecast),
    };
  }

  // Alert Management
  async getActiveAlerts(tenantId: string) {
    return this.alertRepository.find({
      where: { 
        tenantId, 
        status: 'active',
      },
      order: { createdAt: 'DESC' },
    });
  }

  async acknowledgeAlert(alertId: string, tenantId: string, userId: string) {
    const alert = await this.alertRepository.findOne({
      where: { id: alertId, tenantId },
    });

    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    alert.status = 'acknowledged';
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();

    await this.alertRepository.save(alert);
    
    this.wsGateway.broadcastAlertUpdate(tenantId, alert);
    
    return alert;
  }

  // Private helper methods
  private async gatherSystemMetrics(): Promise<SystemMetrics> {
    // In production, use proper system monitoring libraries
    const os = require('os');
    const process = require('process');

    return {
      timestamp: new Date(),
      cpu: {
        usage: process.cpuUsage().user / 1000000, // Convert to seconds
        cores: os.cpus().length,
        load: os.loadavg(),
      },
      memory: {
        used: process.memoryUsage().heapUsed,
        total: os.totalmem(),
        usage: (process.memoryUsage().heapUsed / os.totalmem()) * 100,
      },
      disk: {
        used: 0, // Implement disk usage monitoring
        total: 0,
        usage: 0,
      },
      network: {
        inbound: 0, // Implement network monitoring
        outbound: 0,
      },
    };
  }

  private async recordMetrics(type: string, metrics: any): Promise<void> {
    const metricPoint = this.metricRepository.create({
      type,
      timestamp: metrics.timestamp,
      tenantId: metrics.tenantId || 'system',
      labels: this.extractLabels(metrics),
      values: this.extractValues(metrics),
      metadata: metrics,
    });

    await this.metricRepository.save(metricPoint);
    
    // Also store in time-series database for efficient querying
    await this.timeSeriesService.write(metricPoint);
  }

  private async checkSystemAlerts(metrics: SystemMetrics): Promise<void> {
    const thresholds = this.alertThresholds.get('system') || {};

    if (metrics.cpu.usage > (thresholds.cpuUsage || 80)) {
      await this.alertingService.createAlert({
        type: 'high_cpu_usage',
        severity: 'warning',
        tenantId: 'system',
        title: 'High CPU usage detected',
        description: `CPU usage is at ${metrics.cpu.usage.toFixed(2)}%`,
        metadata: metrics,
      });
    }

    if (metrics.memory.usage > (thresholds.memoryUsage || 90)) {
      await this.alertingService.createAlert({
        type: 'high_memory_usage',
        severity: 'critical',
        tenantId: 'system',
        title: 'High memory usage detected',
        description: `Memory usage is at ${metrics.memory.usage.toFixed(2)}%`,
        metadata: metrics,
      });
    }
  }

  private async checkWorkflowAlerts(metrics: WorkflowMetrics): Promise<void> {
    const thresholds = this.alertThresholds.get('workflow') || {};
    const failureRate = metrics.metrics.executionsFailed / metrics.metrics.executionsTotal;

    if (failureRate > (thresholds.failureRate || 0.1)) {
      await this.alertingService.createAlert({
        type: 'high_failure_rate',
        severity: 'warning',
        tenantId: metrics.tenantId,
        title: 'High workflow failure rate',
        description: `Failure rate is at ${(failureRate * 100).toFixed(2)}%`,
        metadata: metrics,
      });
    }
  }

  private async checkAIAlerts(metrics: AIMetrics): Promise<void> {
    const thresholds = this.alertThresholds.get('ai') || {};

    if (metrics.metrics.executionTime > (thresholds.executionTime || 30000)) {
      await this.alertingService.createAlert({
        type: 'slow_ai_execution',
        severity: 'warning',
        tenantId: metrics.tenantId,
        title: 'Slow AI execution detected',
        description: `AI execution took ${metrics.metrics.executionTime}ms`,
        metadata: metrics,
      });
    }

    if (metrics.metrics.cost > (thresholds.costPerExecution || 1.0)) {
      await this.alertingService.createAlert({
        type: 'high_ai_cost',
        severity: 'info',
        tenantId: metrics.tenantId,
        title: 'High AI execution cost',
        description: `AI execution cost was $${metrics.metrics.cost}`,
        metadata: metrics,
      });
    }
  }

  private initializeAlertThresholds(): void {
    this.alertThresholds.set('system', {
      cpuUsage: 80,
      memoryUsage: 90,
      diskUsage: 85,
    });

    this.alertThresholds.set('workflow', {
      failureRate: 0.1,
      executionTime: 60000,
      queueLength: 100,
    });

    this.alertThresholds.set('ai', {
      executionTime: 30000,
      costPerExecution: 1.0,
      tokenUsage: 10000,
    });
  }

  private extractLabels(metrics: any): Record<string, string> {
    const labels: Record<string, string> = {};
    
    if (metrics.tenantId) labels.tenantId = metrics.tenantId;
    if (metrics.workflowId) labels.workflowId = metrics.workflowId;
    if (metrics.agentId) labels.agentId = metrics.agentId;
    
    return labels;
  }

  private extractValues(metrics: any): Record<string, number> {
    const values: Record<string, number> = {};
    
    if (metrics.metrics) {
      Object.entries(metrics.metrics).forEach(([key, value]) => {
        if (typeof value === 'number') {
          values[key] = value;
        }
      });
    }
    
    return values;
  }

  private calculateStartTime(endTime: Date, timeRange: string): Date {
    const start = new Date(endTime);
    
    switch (timeRange) {
      case '1h': start.setHours(start.getHours() - 1); break;
      case '6h': start.setHours(start.getHours() - 6); break;
      case '24h': start.setDate(start.getDate() - 1); break;
      case '7d': start.setDate(start.getDate() - 7); break;
      case '30d': start.setDate(start.getDate() - 30); break;
      default: start.setHours(start.getHours() - 1);
    }
    
    return start;
  }

  private calculateInterval(timeRange: string): string {
    switch (timeRange) {
      case '1h': return '1m';
      case '6h': return '5m';
      case '24h': return '1h';
      case '7d': return '1h';
      case '30d': return '1d';
      default: return '1m';
    }
  }

  private async getActiveExecutionsCount(tenantId: string): Promise<number> {
    // Implementation would query execution repository
    return 0;
  }

  private async getQueuedExecutionsCount(tenantId: string): Promise<number> {
    // Implementation would query execution queue
    return 0;
  }

  private async recordWorkflowEvent(eventType: string, event: any): Promise<void> {
    // Record individual workflow events for detailed analysis
    await this.timeSeriesService.writeEvent({
      type: 'workflow_event',
      eventType,
      timestamp: new Date(),
      tenantId: event.tenantId,
      metadata: event,
    });
  }

  private async updateWorkflowMetrics(tenantId: string, workflowId: string): Promise<void> {
    // Update aggregated workflow metrics
    // This would typically be done using a background job
  }

  private async getWidgetData(widget: any, tenantId: string): Promise<any> {
    // Fetch data for dashboard widgets based on widget configuration
    return this.getRealtimeMetrics(tenantId, widget.metricType, widget.timeRange);
  }

  private async getHistoricalFailureData(tenantId: string, workflowId?: string): Promise<any[]> {
    // Fetch historical failure data for predictive analysis
    return [];
  }

  private calculateRecentFailureRate(data: any[]): number {
    // Calculate failure rate for recent period
    return 0;
  }

  private calculateHistoricalAverage(data: any[]): number {
    // Calculate historical average failure rate
    return 0;
  }

  private generateRecommendation(anomalyScore: number): string {
    if (anomalyScore > 3.0) {
      return 'Consider reviewing recent workflow changes and monitoring error logs';
    } else if (anomalyScore > 2.0) {
      return 'Monitor closely for potential issues';
    }
    return 'No action required';
  }

  private async getResourceUsageHistory(tenantId: string, days: number): Promise<any[]> {
    // Fetch resource usage history for capacity planning
    return [];
  }

  private calculateLinearTrend(data: any[]): any {
    // Simple linear regression for forecasting
    return {};
  }

  private generateCapacityWarnings(forecast: any): string[] {
    // Generate capacity warnings based on forecast
    return [];
  }

  private generateScalingRecommendations(forecast: any): string[] {
    // Generate scaling recommendations
    return [];
  }
}