import { Logger } from 'pino';
import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import { EventEmitter } from 'events';
import * as os from 'os';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

export interface ResourceQuota {
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxDiskMB: number;
  maxNetworkMbps: number;
  maxExecutionTime: number; // seconds
  maxFileDescriptors: number;
  maxProcesses: number;
  maxThreads: number;
  maxOpenFiles: number;
  maxNetworkConnections: number;
}

export interface ResourceUsage {
  memoryMB: number;
  cpuPercent: number;
  diskMB: number;
  networkMbps: number;
  executionTime: number;
  fileDescriptors: number;
  processes: number;
  threads: number;
  openFiles: number;
  networkConnections: number;
  timestamp: string;
}

export interface ResourceAlert {
  id: string;
  type: 'warning' | 'critical' | 'violation';
  resource: keyof ResourceQuota;
  currentValue: number;
  limitValue: number;
  percentageUsed: number;
  timestamp: string;
  executionId: string;
  message: string;
  action?: 'throttle' | 'terminate' | 'alert';
}

export interface MonitoringConfig {
  samplingIntervalMs: number;
  alertThresholds: {
    warningPercent: number;
    criticalPercent: number;
  };
  enableResourceEnforcement: boolean;
  enablePredictiveAnalytics: boolean;
  historicalDataRetentionHours: number;
  enableRealTimeAlerts: boolean;
}

export interface ResourceTrend {
  resource: keyof ResourceQuota;
  trend: 'increasing' | 'decreasing' | 'stable';
  changeRate: number; // per minute
  predictedValue: number; // in next 5 minutes
  confidence: number; // 0-1
}

export class ResourceMonitor extends EventEmitter {
  private logger: Logger;
  private config: MonitoringConfig;
  private activeMonitors = new Map<string, ResourceMonitorInstance>();
  private resourceHistory = new Map<string, ResourceUsage[]>();
  private alerts = new Map<string, ResourceAlert[]>();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(logger: Logger, config: MonitoringConfig) {
    super();
    this.logger = logger;
    this.config = {
      samplingIntervalMs: 1000,
      alertThresholds: {
        warningPercent: 75,
        criticalPercent: 90
      },
      enableResourceEnforcement: true,
      enablePredictiveAnalytics: false,
      historicalDataRetentionHours: 24,
      enableRealTimeAlerts: true,
      ...config
    };

    this.startCleanupTask();
  }

  /**
   * Start monitoring resources for an execution
   */
  startMonitoring(executionId: string, quota: ResourceQuota, processId?: number): ResourceMonitorInstance {
    const monitor = new ResourceMonitorInstance(
      executionId,
      quota,
      this.logger,
      this.config,
      processId
    );

    // Set up event listeners
    monitor.on('usage', (usage: ResourceUsage) => {
      this.recordUsage(executionId, usage);
      this.checkQuotaViolations(executionId, usage, quota);
      this.emit('usage', executionId, usage);
    });

    monitor.on('alert', (alert: ResourceAlert) => {
      this.recordAlert(executionId, alert);
      this.emit('alert', executionId, alert);
    });

    monitor.on('violation', (violation: ResourceAlert) => {
      this.handleViolation(executionId, violation);
      this.emit('violation', executionId, violation);
    });

    this.activeMonitors.set(executionId, monitor);
    monitor.start();

    this.logger.info({
      executionId,
      quota,
      processId
    }, 'Started resource monitoring');

    return monitor;
  }

  /**
   * Stop monitoring for an execution
   */
  stopMonitoring(executionId: string): void {
    const monitor = this.activeMonitors.get(executionId);
    if (monitor) {
      monitor.stop();
      this.activeMonitors.delete(executionId);

      this.logger.info({ executionId }, 'Stopped resource monitoring');
    }
  }

  /**
   * Get current resource usage for an execution
   */
  getCurrentUsage(executionId: string): ResourceUsage | null {
    const monitor = this.activeMonitors.get(executionId);
    return monitor ? monitor.getCurrentUsage() : null;
  }

  /**
   * Get resource usage history for an execution
   */
  getUsageHistory(executionId: string, since?: Date): ResourceUsage[] {
    const history = this.resourceHistory.get(executionId) || [];

    if (since) {
      return history.filter(usage => new Date(usage.timestamp) >= since);
    }

    return history;
  }

  /**
   * Get alerts for an execution
   */
  getAlerts(executionId: string, type?: string): ResourceAlert[] {
    const alerts = this.alerts.get(executionId) || [];

    if (type) {
      return alerts.filter(alert => alert.type === type);
    }

    return alerts;
  }

  /**
   * Get resource trends for an execution
   */
  getResourceTrends(executionId: string): ResourceTrend[] {
    if (!this.config.enablePredictiveAnalytics) {
      return [];
    }

    const history = this.getUsageHistory(executionId);
    if (history.length < 10) {
      return []; // Need at least 10 data points for trend analysis
    }

    const trends: ResourceTrend[] = [];
    const resources: (keyof ResourceQuota)[] = [
      'maxMemoryMB', 'maxCpuPercent', 'maxDiskMB', 'maxNetworkMbps'
    ];

    for (const resource of resources) {
      const trend = this.calculateTrend(history, resource);
      if (trend) {
        trends.push(trend);
      }
    }

    return trends;
  }

  /**
   * Get system-wide resource statistics
   */
  getSystemStats(): {
    activeMonitors: number;
    totalAlerts: number;
    criticalAlerts: number;
    systemLoad: {
      cpu: number;
      memory: number;
      disk: number;
    };
    averageResourceUsage: Partial<ResourceUsage>;
  } {
    const totalAlerts = Array.from(this.alerts.values())
      .reduce((sum, alerts) => sum + alerts.length, 0);

    const criticalAlerts = Array.from(this.alerts.values())
      .reduce((sum, alerts) => sum + alerts.filter(a => a.type === 'critical').length, 0);

    // Calculate system load
    const systemLoad = {
      cpu: os.loadavg()[0] * 100 / os.cpus().length,
      memory: (1 - os.freemem() / os.totalmem()) * 100,
      disk: 0 // Would need disk usage calculation
    };

    // Calculate average resource usage across all active monitors
    const allCurrentUsage = Array.from(this.activeMonitors.values())
      .map(monitor => monitor.getCurrentUsage())
      .filter(usage => usage !== null) as ResourceUsage[];

    const averageResourceUsage: Partial<ResourceUsage> = {};
    if (allCurrentUsage.length > 0) {
      averageResourceUsage.memoryMB = allCurrentUsage.reduce((sum, u) => sum + u.memoryMB, 0) / allCurrentUsage.length;
      averageResourceUsage.cpuPercent = allCurrentUsage.reduce((sum, u) => sum + u.cpuPercent, 0) / allCurrentUsage.length;
      averageResourceUsage.diskMB = allCurrentUsage.reduce((sum, u) => sum + u.diskMB, 0) / allCurrentUsage.length;
      averageResourceUsage.networkMbps = allCurrentUsage.reduce((sum, u) => sum + u.networkMbps, 0) / allCurrentUsage.length;
    }

    return {
      activeMonitors: this.activeMonitors.size,
      totalAlerts,
      criticalAlerts,
      systemLoad,
      averageResourceUsage
    };
  }

  /**
   * Enforce resource limits (kill processes exceeding limits)
   */
  async enforceResourceLimits(executionId: string): Promise<void> {
    if (!this.config.enableResourceEnforcement) {
      return;
    }

    const monitor = this.activeMonitors.get(executionId);
    if (!monitor) {
      return;
    }

    await monitor.enforceResourceLimits();
  }

  /**
   * Cleanup old data and stopped monitors
   */
  cleanup(): void {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - this.config.historicalDataRetentionHours);

    // Clean up old usage history
    for (const [executionId, history] of this.resourceHistory) {
      const filteredHistory = history.filter(usage =>
        new Date(usage.timestamp) >= cutoff
      );

      if (filteredHistory.length === 0) {
        this.resourceHistory.delete(executionId);
      } else {
        this.resourceHistory.set(executionId, filteredHistory);
      }
    }

    // Clean up old alerts
    for (const [executionId, alerts] of this.alerts) {
      const filteredAlerts = alerts.filter(alert =>
        new Date(alert.timestamp) >= cutoff
      );

      if (filteredAlerts.length === 0) {
        this.alerts.delete(executionId);
      } else {
        this.alerts.set(executionId, filteredAlerts);
      }
    }

    this.logger.debug('Resource monitor cleanup completed');
  }

  /**
   * Shutdown resource monitor
   */
  shutdown(): void {
    // Stop all active monitors
    for (const [executionId, monitor] of this.activeMonitors) {
      monitor.stop();
    }
    this.activeMonitors.clear();

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.logger.info('Resource monitor shut down');
  }

  // Private methods

  private recordUsage(executionId: string, usage: ResourceUsage): void {
    const history = this.resourceHistory.get(executionId) || [];
    history.push(usage);

    // Keep only recent history to prevent memory issues
    const maxHistorySize = Math.ceil(this.config.historicalDataRetentionHours * 3600 * 1000 / this.config.samplingIntervalMs);
    if (history.length > maxHistorySize) {
      history.splice(0, history.length - maxHistorySize);
    }

    this.resourceHistory.set(executionId, history);
  }

  private recordAlert(executionId: string, alert: ResourceAlert): void {
    const alerts = this.alerts.get(executionId) || [];
    alerts.push(alert);
    this.alerts.set(executionId, alerts);

    if (this.config.enableRealTimeAlerts) {
      this.logger.warn({
        executionId,
        alertId: alert.id,
        type: alert.type,
        resource: alert.resource,
        usage: alert.percentageUsed
      }, alert.message);
    }
  }

  private checkQuotaViolations(executionId: string, usage: ResourceUsage, quota: ResourceQuota): void {
    const violations: ResourceAlert[] = [];

    // Check each resource against quota
    const checks = [
      { resource: 'maxMemoryMB' as const, current: usage.memoryMB, limit: quota.maxMemoryMB },
      { resource: 'maxCpuPercent' as const, current: usage.cpuPercent, limit: quota.maxCpuPercent },
      { resource: 'maxDiskMB' as const, current: usage.diskMB, limit: quota.maxDiskMB },
      { resource: 'maxNetworkMbps' as const, current: usage.networkMbps, limit: quota.maxNetworkMbps },
      { resource: 'maxExecutionTime' as const, current: usage.executionTime, limit: quota.maxExecutionTime },
      { resource: 'maxFileDescriptors' as const, current: usage.fileDescriptors, limit: quota.maxFileDescriptors },
      { resource: 'maxProcesses' as const, current: usage.processes, limit: quota.maxProcesses }
    ];

    for (const check of checks) {
      const percentageUsed = (check.current / check.limit) * 100;

      if (percentageUsed >= 100) {
        violations.push({
          id: `viol_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'violation',
          resource: check.resource,
          currentValue: check.current,
          limitValue: check.limit,
          percentageUsed,
          timestamp: new Date().toISOString(),
          executionId,
          message: `${check.resource} quota exceeded: ${check.current} > ${check.limit}`,
          action: 'terminate'
        });
      } else if (percentageUsed >= this.config.alertThresholds.criticalPercent) {
        violations.push({
          id: `crit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'critical',
          resource: check.resource,
          currentValue: check.current,
          limitValue: check.limit,
          percentageUsed,
          timestamp: new Date().toISOString(),
          executionId,
          message: `${check.resource} usage critical: ${percentageUsed.toFixed(1)}%`,
          action: 'throttle'
        });
      } else if (percentageUsed >= this.config.alertThresholds.warningPercent) {
        violations.push({
          id: `warn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'warning',
          resource: check.resource,
          currentValue: check.current,
          limitValue: check.limit,
          percentageUsed,
          timestamp: new Date().toISOString(),
          executionId,
          message: `${check.resource} usage warning: ${percentageUsed.toFixed(1)}%`,
          action: 'alert'
        });
      }
    }

    // Emit violations
    for (const violation of violations) {
      this.emit('alert', executionId, violation);
      if (violation.type === 'violation') {
        this.emit('violation', executionId, violation);
      }
    }
  }

  private handleViolation(executionId: string, violation: ResourceAlert): void {
    this.logger.error({
      executionId,
      violation
    }, 'Resource quota violation detected');

    if (this.config.enableResourceEnforcement && violation.action === 'terminate') {
      // Terminate the execution
      this.enforceResourceLimits(executionId).catch(error => {
        this.logger.error({ error: error.message }, 'Failed to enforce resource limits');
      });
    }
  }

  private calculateTrend(history: ResourceUsage[], resource: keyof ResourceQuota): ResourceTrend | null {
    if (history.length < 10) return null;

    // Get the actual usage values for the resource
    const values = history.map(usage => {
      switch (resource) {
        case 'maxMemoryMB': return usage.memoryMB;
        case 'maxCpuPercent': return usage.cpuPercent;
        case 'maxDiskMB': return usage.diskMB;
        case 'maxNetworkMbps': return usage.networkMbps;
        default: return 0;
      }
    });

    // Simple linear regression to determine trend
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Predict value in 5 minutes (assuming 1 sample per second)
    const futureX = n + 300; // 5 minutes = 300 seconds
    const predictedValue = slope * futureX + intercept;

    // Calculate confidence based on R-squared
    const yMean = sumY / n;
    const totalSumSquares = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const residualSumSquares = y.reduce((sum, yi, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);
    const rSquared = 1 - (residualSumSquares / totalSumSquares);

    // Determine trend direction
    let trend: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(slope) < 0.01) {
      trend = 'stable';
    } else if (slope > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }

    return {
      resource,
      trend,
      changeRate: slope * 60, // per minute
      predictedValue: Math.max(0, predictedValue),
      confidence: Math.max(0, Math.min(1, rSquared))
    };
  }

  private startCleanupTask(): void {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }
}

export class ResourceMonitorInstance extends EventEmitter {
  private executionId: string;
  private quota: ResourceQuota;
  private logger: Logger;
  private config: MonitoringConfig;
  private processId?: number;
  private isRunning = false;
  private monitoringInterval?: NodeJS.Timeout;
  private startTime: Date;
  private currentUsage: ResourceUsage | null = null;

  constructor(
    executionId: string,
    quota: ResourceQuota,
    logger: Logger,
    config: MonitoringConfig,
    processId?: number
  ) {
    super();
    this.executionId = executionId;
    this.quota = quota;
    this.logger = logger;
    this.config = config;
    this.processId = processId;
    this.startTime = new Date();
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.monitoringInterval = setInterval(() => {
      this.collectResourceUsage().catch(error => {
        this.logger.error({ error: error.message }, 'Failed to collect resource usage');
      });
    }, this.config.samplingIntervalMs);

    this.logger.debug({ executionId: this.executionId }, 'Resource monitoring started');
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.logger.debug({ executionId: this.executionId }, 'Resource monitoring stopped');
  }

  getCurrentUsage(): ResourceUsage | null {
    return this.currentUsage;
  }

  async enforceResourceLimits(): Promise<void> {
    if (!this.processId) {
      this.logger.warn({ executionId: this.executionId }, 'Cannot enforce limits: no process ID');
      return;
    }

    try {
      // Kill the process and its children
      if (process.platform === 'win32') {
        await execAsync(`taskkill /F /T /PID ${this.processId}`);
      } else {
        await execAsync(`kill -9 -${this.processId}`); // Kill process group
      }

      this.logger.info({
        executionId: this.executionId,
        processId: this.processId
      }, 'Process terminated due to resource limit violation');
    } catch (error) {
      this.logger.error({
        error: error.message,
        processId: this.processId
      }, 'Failed to terminate process');
    }
  }

  private async collectResourceUsage(): Promise<void> {
    try {
      const usage: ResourceUsage = {
        memoryMB: 0,
        cpuPercent: 0,
        diskMB: 0,
        networkMbps: 0,
        executionTime: (Date.now() - this.startTime.getTime()) / 1000,
        fileDescriptors: 0,
        processes: 0,
        threads: 0,
        openFiles: 0,
        networkConnections: 0,
        timestamp: new Date().toISOString()
      };

      if (this.processId) {
        // Collect process-specific metrics
        usage.memoryMB = await this.getProcessMemoryUsage();
        usage.cpuPercent = await this.getProcessCpuUsage();
        usage.fileDescriptors = await this.getProcessFileDescriptors();
        usage.processes = await this.getProcessCount();
        usage.threads = await this.getThreadCount();
      } else {
        // Collect system-wide metrics (fallback)
        usage.memoryMB = (os.totalmem() - os.freemem()) / (1024 * 1024);
        usage.cpuPercent = os.loadavg()[0] * 100 / os.cpus().length;
      }

      this.currentUsage = usage;
      this.emit('usage', usage);
    } catch (error) {
      this.logger.error({ error: error.message }, 'Error collecting resource usage');
    }
  }

  private async getProcessMemoryUsage(): Promise<number> {
    if (!this.processId) return 0;

    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync(`wmic process where ProcessId=${this.processId} get WorkingSetSize /format:csv`);
        const lines = stdout.trim().split('\n');
        if (lines.length > 2) {
          const memory = parseInt(lines[2].split(',')[1]) || 0;
          return memory / (1024 * 1024); // Convert to MB
        }
      } else {
        const { stdout } = await execAsync(`ps -o rss= -p ${this.processId}`);
        const memory = parseInt(stdout.trim()) || 0;
        return memory / 1024; // Convert from KB to MB
      }
    } catch (error) {
      // Process might have ended
    }

    return 0;
  }

  private async getProcessCpuUsage(): Promise<number> {
    if (!this.processId) return 0;

    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync(`wmic process where ProcessId=${this.processId} get PageFileUsage,UserModeTime,KernelModeTime /format:csv`);
        // Windows CPU calculation would be more complex
        return 0;
      } else {
        const { stdout } = await execAsync(`ps -o %cpu= -p ${this.processId}`);
        return parseFloat(stdout.trim()) || 0;
      }
    } catch (error) {
      // Process might have ended
    }

    return 0;
  }

  private async getProcessFileDescriptors(): Promise<number> {
    if (!this.processId || process.platform === 'win32') return 0;

    try {
      const { stdout } = await execAsync(`ls -1 /proc/${this.processId}/fd 2>/dev/null | wc -l`);
      return parseInt(stdout.trim()) || 0;
    } catch (error) {
      return 0;
    }
  }

  private async getProcessCount(): Promise<number> {
    if (!this.processId) return 0;

    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync(`wmic process where ParentProcessId=${this.processId} get ProcessId /format:csv`);
        return stdout.split('\n').length - 3; // Account for headers
      } else {
        const { stdout } = await execAsync(`pgrep -P ${this.processId} | wc -l`);
        return parseInt(stdout.trim()) || 0;
      }
    } catch (error) {
      return 0;
    }
  }

  private async getThreadCount(): Promise<number> {
    if (!this.processId) return 0;

    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync(`wmic process where ProcessId=${this.processId} get ThreadCount /format:csv`);
        const lines = stdout.trim().split('\n');
        if (lines.length > 2) {
          return parseInt(lines[2].split(',')[1]) || 0;
        }
      } else {
        const { stdout } = await execAsync(`ps -o nlwp= -p ${this.processId}`);
        return parseInt(stdout.trim()) || 0;
      }
    } catch (error) {
      return 0;
    }

    return 0;
  }
}