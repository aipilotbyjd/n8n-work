import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HealthCheck } from './entities/health-check.entity';

@Injectable()
export class HealthCheckService {
  constructor(
    @InjectRepository(HealthCheck)
    private healthCheckRepository: Repository<HealthCheck>,
  ) { }

  /**
   * Get overall system health status
   */
  async getSystemHealth(): Promise<any> {
    const checks = await this.performHealthChecks();
    const overallStatus = checks.every(check => check.status === 'healthy') ? 'healthy' : 'unhealthy';

    return {
      status: overallStatus,
      timestamp: new Date(),
      checks: checks.reduce((acc, check) => {
        acc[check.name] = {
          status: check.status,
          responseTime: check.responseTime,
          message: check.message,
        };
        return acc;
      }, {}),
    };
  }

  /**
   * Get detailed health check results
   */
  async getDetailedHealth(tenantId: string): Promise<any> {
    const systemHealth = await this.getSystemHealth();
    const recentChecks = await this.healthCheckRepository.find({
      where: { tenantId },
      order: { timestamp: 'DESC' },
      take: 50,
    });

    return {
      ...systemHealth,
      history: recentChecks,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
    };
  }

  /**
   * Perform health checks on various components
   */
  private async performHealthChecks(): Promise<any[]> {
    const checks = [];

    // Database health check
    checks.push(await this.checkDatabase());

    // Memory health check
    checks.push(await this.checkMemory());

    // Disk space health check
    checks.push(await this.checkDiskSpace());

    // External services health check
    checks.push(await this.checkExternalServices());

    return checks;
  }

  /**
   * Check database connectivity and performance
   */
  private async checkDatabase(): Promise<any> {
    const startTime = Date.now();

    try {
      // Simple query to test database connectivity
      await this.healthCheckRepository.query('SELECT 1');
      const responseTime = Date.now() - startTime;

      return {
        name: 'database',
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        responseTime,
        message: responseTime < 1000 ? 'Database is responsive' : 'Database is slow',
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `Database error: ${error.message}`,
      };
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemory(): Promise<any> {
    const memoryUsage = process.memoryUsage();
    const usedMemoryMB = memoryUsage.heapUsed / 1024 / 1024;
    const totalMemoryMB = memoryUsage.heapTotal / 1024 / 1024;
    const memoryUsagePercent = (usedMemoryMB / totalMemoryMB) * 100;

    let status = 'healthy';
    let message = 'Memory usage is normal';

    if (memoryUsagePercent > 90) {
      status = 'unhealthy';
      message = 'Memory usage is critically high';
    } else if (memoryUsagePercent > 75) {
      status = 'degraded';
      message = 'Memory usage is high';
    }

    return {
      name: 'memory',
      status,
      responseTime: 0,
      message,
      details: {
        usedMB: Math.round(usedMemoryMB),
        totalMB: Math.round(totalMemoryMB),
        usagePercent: Math.round(memoryUsagePercent),
      },
    };
  }

  /**
   * Check disk space
   */
  private async checkDiskSpace(): Promise<any> {
    // Mock disk space check - in real implementation, would check actual disk usage
    const diskUsagePercent = Math.random() * 100;

    let status = 'healthy';
    let message = 'Disk space is sufficient';

    if (diskUsagePercent > 95) {
      status = 'unhealthy';
      message = 'Disk space is critically low';
    } else if (diskUsagePercent > 85) {
      status = 'degraded';
      message = 'Disk space is getting low';
    }

    return {
      name: 'disk_space',
      status,
      responseTime: 0,
      message,
      details: {
        usagePercent: Math.round(diskUsagePercent),
      },
    };
  }

  /**
   * Check external services
   */
  private async checkExternalServices(): Promise<any> {
    // Mock external services check
    const services = ['redis', 'email_service', 'notification_service'];
    const failedServices = [];

    // Simulate some service checks
    for (const service of services) {
      if (Math.random() > 0.95) { // 5% chance of failure
        failedServices.push(service);
      }
    }

    let status = 'healthy';
    let message = 'All external services are healthy';

    if (failedServices.length > 0) {
      status = failedServices.length === services.length ? 'unhealthy' : 'degraded';
      message = `Failed services: ${failedServices.join(', ')}`;
    }

    return {
      name: 'external_services',
      status,
      responseTime: 0,
      message,
      details: {
        total: services.length,
        healthy: services.length - failedServices.length,
        failed: failedServices,
      },
    };
  }

  /**
   * Record health check result
   */
  async recordHealthCheck(
    tenantId: string,
    checkName: string,
    status: string,
    responseTime: number,
    message?: string,
    details?: any,
  ): Promise<void> {
    const healthCheck = this.healthCheckRepository.create({
      tenantId,
      checkName,
      status,
      responseTime,
      message,
      details,
      timestamp: new Date(),
    });

    await this.healthCheckRepository.save(healthCheck);
  }

  /**
   * Get health check history for a specific check
   */
  async getHealthCheckHistory(
    tenantId: string,
    checkName: string,
    limit: number = 100,
  ): Promise<HealthCheck[]> {
    return this.healthCheckRepository.find({
      where: { tenantId, checkName },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Calculate uptime percentage for a given period
   */
  async calculateUptime(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const healthChecks = await this.healthCheckRepository.find({
      where: {
        tenantId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        } as any,
      },
    });

    if (healthChecks.length === 0) return 100;

    const healthyChecks = healthChecks.filter(check => check.status === 'healthy');
    return (healthyChecks.length / healthChecks.length) * 100;
  }
}