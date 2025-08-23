import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SystemMetric } from './entities/system-metric.entity';
import { AuditLogService } from '../audit/audit-log.service';

@Injectable()
export class MetricsCollectorService {
  constructor(
    @InjectRepository(SystemMetric)
    private systemMetricRepository: Repository<SystemMetric>,
    private eventEmitter: EventEmitter2,
    private auditLogService: AuditLogService,
  ) {}

  /**
   * Get system metrics for a time period
   */
  async getSystemMetrics(
    tenantId: string,
    startTime?: string,
    endTime?: string,
    interval?: string,
  ): Promise<any> {
    const start = startTime ? new Date(startTime) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = endTime ? new Date(endTime) : new Date();

    const metrics = await this.systemMetricRepository.find({
      where: {
        tenantId,
        timestamp: {
          gte: start,
          lte: end,
        } as any,
      },
      order: { timestamp: 'ASC' },
    });

    return this.aggregateMetrics(metrics, interval || '5m');
  }

  /**
   * Get application-specific metrics
   */
  async getApplicationMetrics(
    tenantId: string,
    startTime?: string,
    endTime?: string,
  ): Promise<any> {
    const start = startTime ? new Date(startTime) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = endTime ? new Date(endTime) : new Date();

    // Mock application metrics - in real implementation, this would query actual metrics
    return {
      workflowExecutions: {
        total: 1250,
        successful: 1180,
        failed: 70,
        successRate: 94.4,
      },
      apiRequests: {
        total: 15000,
        averageResponseTime: 120,
        errorRate: 2.1,
      },
      activeUsers: 45,
      activeWorkflows: 125,
      resourceUsage: {
        cpu: 65.2,
        memory: 78.5,
        disk: 45.8,
        network: 12.3,
      },
      timeRange: {
        start,
        end,
      },
    };
  }

  /**
   * Record custom metrics
   */
  async recordCustomMetrics(
    tenantId: string,
    metricsData: any,
    userId: string,
  ): Promise<void> {
    const metric = this.systemMetricRepository.create({
      tenantId,
      metricName: metricsData.name,
      metricType: 'custom',
      value: metricsData.value,
      unit: metricsData.unit || 'count',
      tags: metricsData.tags || {},
      metadata: { recordedBy: userId, ...metricsData.metadata },
      timestamp: new Date(),
    });

    await this.systemMetricRepository.save(metric);

    // Emit metrics recorded event
    this.eventEmitter.emit('metrics.recorded', {
      tenantId,
      metricName: metricsData.name,
      value: metricsData.value,
      recordedBy: userId,
    });

    // Log audit event
    await this.auditLogService.log(
      'metrics.recorded',
      'system_metric',
      metric.id,
      userId,
      { name: metricsData.name, value: metricsData.value },
    );
  }

  /**
   * Collect and store system metrics
   */
  async collectSystemMetrics(tenantId: string): Promise<void> {
    const timestamp = new Date();

    // Collect CPU metrics
    const cpuMetric = this.systemMetricRepository.create({
      tenantId,
      metricName: 'cpu_usage',
      metricType: 'system',
      value: this.getCpuUsage(),
      unit: 'percent',
      timestamp,
    });

    // Collect Memory metrics
    const memoryMetric = this.systemMetricRepository.create({
      tenantId,
      metricName: 'memory_usage',
      metricType: 'system',
      value: this.getMemoryUsage(),
      unit: 'percent',
      timestamp,
    });

    // Collect Disk metrics
    const diskMetric = this.systemMetricRepository.create({
      tenantId,
      metricName: 'disk_usage',
      metricType: 'system',
      value: this.getDiskUsage(),
      unit: 'percent',
      timestamp,
    });

    // Collect Network metrics
    const networkMetric = this.systemMetricRepository.create({
      tenantId,
      metricName: 'network_io',
      metricType: 'system',
      value: this.getNetworkIO(),
      unit: 'mbps',
      timestamp,
    });

    await this.systemMetricRepository.save([
      cpuMetric,
      memoryMetric,
      diskMetric,
      networkMetric,
    ]);
  }

  /**
   * Aggregate metrics by time interval
   */
  private aggregateMetrics(metrics: SystemMetric[], interval: string): any {
    const intervalMs = this.parseInterval(interval);
    const aggregated = new Map();

    metrics.forEach(metric => {
      const bucketTime = Math.floor(metric.timestamp.getTime() / intervalMs) * intervalMs;
      const bucketKey = `${metric.metricName}_${bucketTime}`;

      if (!aggregated.has(bucketKey)) {
        aggregated.set(bucketKey, {
          metricName: metric.metricName,
          timestamp: new Date(bucketTime),
          values: [],
          unit: metric.unit,
        });
      }

      aggregated.get(bucketKey).values.push(metric.value);
    });

    // Calculate statistics for each bucket
    return Array.from(aggregated.values()).map(bucket => ({
      ...bucket,
      avg: bucket.values.reduce((a, b) => a + b, 0) / bucket.values.length,
      min: Math.min(...bucket.values),
      max: Math.max(...bucket.values),
      count: bucket.values.length,
    }));
  }

  /**
   * Parse interval string to milliseconds
   */
  private parseInterval(interval: string): number {
    const match = interval.match(/^(\d+)([smhd])$/);
    if (!match) return 5 * 60 * 1000; // Default 5 minutes

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 5 * 60 * 1000;
    }
  }

  /**
   * Get current CPU usage (mock implementation)
   */
  private getCpuUsage(): number {
    return Math.random() * 100;
  }

  /**
   * Get current memory usage (mock implementation)
   */
  private getMemoryUsage(): number {
    return Math.random() * 100;
  }

  /**
   * Get current disk usage (mock implementation)
   */
  private getDiskUsage(): number {
    return Math.random() * 100;
  }

  /**
   * Get current network I/O (mock implementation)
   */
  private getNetworkIO(): number {
    return Math.random() * 1000;
  }
}