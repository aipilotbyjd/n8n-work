import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClickHouse } from 'clickhouse';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly clickhouse: ClickHouse;
  private readonly dataLineageTracker: DataLineageTracker;
  private readonly complianceReporter: ComplianceReporter;
  private readonly businessIntelligence: BusinessIntelligenceEngine;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2
  ) {
    this.clickhouse = new ClickHouse({
      url: this.configService.get('CLICKHOUSE_URL'),
      port: this.configService.get('CLICKHOUSE_PORT', 8123),
      debug: this.configService.get('NODE_ENV') === 'development',
      basicAuth: {
        username: this.configService.get('CLICKHOUSE_USER'),
        password: this.configService.get('CLICKHOUSE_PASSWORD'),
      },
      isUseGzip: true,
      trimQuery: true,
      usePost: false,
    });

    this.dataLineageTracker = new DataLineageTracker(this.clickhouse, this.logger);
    this.complianceReporter = new ComplianceReporter(this.clickhouse, this.logger);
    this.businessIntelligence = new BusinessIntelligenceEngine(this.clickhouse, this.logger);
  }

  async onModuleInit() {
    await this.initializeAnalyticsDatabase();
    this.logger.log('Analytics service initialized with ClickHouse');
  }

  // Initialize ClickHouse schemas and tables
  private async initializeAnalyticsDatabase(): Promise<void> {
    const queries = [
      // Workflow execution events
      `CREATE TABLE IF NOT EXISTS workflow_executions (
        execution_id String,
        workflow_id String,
        tenant_id String,
        user_id String,
        status Enum8('pending' = 1, 'running' = 2, 'success' = 3, 'failed' = 4, 'cancelled' = 5),
        start_time DateTime64(3),
        end_time Nullable(DateTime64(3)),
        duration_ms UInt64,
        trigger_type String,
        trigger_data String,
        node_count UInt32,
        steps_executed UInt32,
        steps_failed UInt32,
        error_message Nullable(String),
        metadata String,
        created_at DateTime64(3) DEFAULT now64(3)
      ) ENGINE = MergeTree()
      PARTITION BY toYYYYMM(start_time)
      ORDER BY (tenant_id, start_time, execution_id)
      TTL start_time + INTERVAL 2 YEAR`,

      // Step execution details
      `CREATE TABLE IF NOT EXISTS step_executions (
        step_id String,
        execution_id String,
        workflow_id String,
        tenant_id String,
        node_id String,
        node_type String,
        status Enum8('pending' = 1, 'running' = 2, 'success' = 3, 'failed' = 4, 'skipped' = 5),
        start_time DateTime64(3),
        end_time Nullable(DateTime64(3)),
        duration_ms UInt64,
        input_size UInt64,
        output_size UInt64,
        memory_used UInt64,
        cpu_time_ms UInt64,
        network_calls UInt32,
        error_message Nullable(String),
        retry_count UInt8,
        async_task_id Nullable(String),
        created_at DateTime64(3) DEFAULT now64(3)
      ) ENGINE = MergeTree()
      PARTITION BY toYYYYMM(start_time)
      ORDER BY (tenant_id, execution_id, step_id, start_time)
      TTL start_time + INTERVAL 2 YEAR`,

      // API usage tracking
      `CREATE TABLE IF NOT EXISTS api_usage (
        request_id String,
        tenant_id String,
        user_id String,
        endpoint String,
        method String,
        status_code UInt16,
        response_time_ms UInt32,
        request_size UInt64,
        response_size UInt64,
        ip_address String,
        user_agent String,
        timestamp DateTime64(3),
        rate_limited Bool,
        authenticated Bool,
        created_at DateTime64(3) DEFAULT now64(3)
      ) ENGINE = MergeTree()
      PARTITION BY toYYYYMM(timestamp)
      ORDER BY (tenant_id, timestamp, request_id)
      TTL timestamp + INTERVAL 1 YEAR`,

      // Resource usage metrics
      `CREATE TABLE IF NOT EXISTS resource_usage (
        tenant_id String,
        resource_type Enum8('cpu' = 1, 'memory' = 2, 'storage' = 3, 'bandwidth' = 4, 'executions' = 5),
        value Float64,
        unit String,
        timestamp DateTime64(3),
        metadata String,
        created_at DateTime64(3) DEFAULT now64(3)
      ) ENGINE = MergeTree()
      PARTITION BY toYYYYMM(timestamp)
      ORDER BY (tenant_id, resource_type, timestamp)
      TTL timestamp + INTERVAL 1 YEAR`,

      // Data lineage tracking
      `CREATE TABLE IF NOT EXISTS data_lineage (
        lineage_id String,
        execution_id String,
        workflow_id String,
        tenant_id String,
        source_step_id String,
        target_step_id String,
        data_type String,
        data_classification Enum8('public' = 1, 'internal' = 2, 'confidential' = 3, 'restricted' = 4),
        transformation_type String,
        schema_version String,
        data_size UInt64,
        checksum String,
        timestamp DateTime64(3),
        retention_policy String,
        created_at DateTime64(3) DEFAULT now64(3)
      ) ENGINE = MergeTree()
      PARTITION BY toYYYYMM(timestamp)
      ORDER BY (tenant_id, workflow_id, timestamp, lineage_id)
      TTL timestamp + INTERVAL 5 YEAR`,

      // Audit log events
      `CREATE TABLE IF NOT EXISTS audit_events (
        event_id String,
        tenant_id String,
        user_id String,
        action String,
        resource_type String,
        resource_id String,
        old_values Nullable(String),
        new_values Nullable(String),
        ip_address String,
        user_agent String,
        session_id String,
        timestamp DateTime64(3),
        risk_score UInt8,
        compliance_tags Array(String),
        created_at DateTime64(3) DEFAULT now64(3)
      ) ENGINE = MergeTree()
      PARTITION BY toYYYYMM(timestamp)
      ORDER BY (tenant_id, timestamp, event_id)
      TTL timestamp + INTERVAL 7 YEAR`,

      // Business metrics aggregations
      `CREATE TABLE IF NOT EXISTS business_metrics (
        metric_name String,
        tenant_id String,
        metric_value Float64,
        dimensions Map(String, String),
        timestamp DateTime64(3),
        aggregation_period Enum8('minute' = 1, 'hour' = 2, 'day' = 3, 'week' = 4, 'month' = 5),
        created_at DateTime64(3) DEFAULT now64(3)
      ) ENGINE = ReplacingMergeTree(created_at)
      PARTITION BY toYYYYMM(timestamp)
      ORDER BY (tenant_id, metric_name, timestamp, aggregation_period)
      TTL timestamp + INTERVAL 3 YEAR`,

      // Error and incident tracking
      `CREATE TABLE IF NOT EXISTS error_events (
        error_id String,
        tenant_id String,
        service String,
        error_type String,
        error_code String,
        error_message String,
        stack_trace Nullable(String),
        context String,
        severity Enum8('low' = 1, 'medium' = 2, 'high' = 3, 'critical' = 4),
        resolved Bool DEFAULT 0,
        timestamp DateTime64(3),
        created_at DateTime64(3) DEFAULT now64(3)
      ) ENGINE = MergeTree()
      PARTITION BY toYYYYMM(timestamp)
      ORDER BY (tenant_id, service, timestamp, error_id)
      TTL timestamp + INTERVAL 2 YEAR`,

      // Performance metrics
      `CREATE TABLE IF NOT EXISTS performance_metrics (
        metric_id String,
        service String,
        metric_name String,
        metric_value Float64,
        tags Map(String, String),
        timestamp DateTime64(3),
        created_at DateTime64(3) DEFAULT now64(3)
      ) ENGINE = MergeTree()
      PARTITION BY toYYYYMM(timestamp)
      ORDER BY (service, metric_name, timestamp)
      TTL timestamp + INTERVAL 1 YEAR`,
    ];

    for (const query of queries) {
      try {
        await this.clickhouse.query(query).toPromise();
        this.logger.debug(`Executed ClickHouse query: ${query.substring(0, 50)}...`);
      } catch (error) {
        this.logger.error(`Failed to execute ClickHouse query: ${error.message}`);
        throw error;
      }
    }

    // Create materialized views for real-time aggregations
    await this.createMaterializedViews();
  }

  // Create materialized views for real-time analytics
  private async createMaterializedViews(): Promise<void> {
    const views = [
      // Real-time workflow execution metrics
      `CREATE MATERIALIZED VIEW IF NOT EXISTS workflow_metrics_mv
      TO business_metrics AS
      SELECT
        'workflow_executions_per_hour' as metric_name,
        tenant_id,
        count() as metric_value,
        map('status', status, 'trigger_type', trigger_type) as dimensions,
        toStartOfHour(start_time) as timestamp,
        'hour' as aggregation_period,
        now64(3) as created_at
      FROM workflow_executions
      GROUP BY tenant_id, status, trigger_type, toStartOfHour(start_time)`,

      // API usage patterns
      `CREATE MATERIALIZED VIEW IF NOT EXISTS api_usage_mv
      TO business_metrics AS
      SELECT
        'api_requests_per_hour' as metric_name,
        tenant_id,
        count() as metric_value,
        map('endpoint', endpoint, 'method', method, 'status_code', toString(status_code)) as dimensions,
        toStartOfHour(timestamp) as timestamp,
        'hour' as aggregation_period,
        now64(3) as created_at
      FROM api_usage
      GROUP BY tenant_id, endpoint, method, status_code, toStartOfHour(timestamp)`,

      // Error rate tracking
      `CREATE MATERIALIZED VIEW IF NOT EXISTS error_rate_mv
      TO business_metrics AS
      SELECT
        'error_rate_per_hour' as metric_name,
        tenant_id,
        count() as metric_value,
        map('service', service, 'error_type', error_type, 'severity', severity) as dimensions,
        toStartOfHour(timestamp) as timestamp,
        'hour' as aggregation_period,
        now64(3) as created_at
      FROM error_events
      GROUP BY tenant_id, service, error_type, severity, toStartOfHour(timestamp)`,
    ];

    for (const view of views) {
      try {
        await this.clickhouse.query(view).toPromise();
        this.logger.debug(`Created materialized view: ${view.substring(0, 50)}...`);
      } catch (error) {
        this.logger.warn(`Failed to create materialized view: ${error.message}`);
      }
    }
  }

  // Event handlers for real-time data ingestion
  @OnEvent('workflow.executed')
  async handleWorkflowExecuted(event: WorkflowExecutedEvent): Promise<void> {
    const query = `INSERT INTO workflow_executions FORMAT JSONEachRow`;
    const data = {
      execution_id: event.executionId,
      workflow_id: event.workflowId,
      tenant_id: event.tenantId,
      user_id: event.userId,
      status: event.status,
      start_time: new Date(event.startTime),
      end_time: event.endTime ? new Date(event.endTime) : null,
      duration_ms: event.durationMs,
      trigger_type: event.triggerType,
      trigger_data: JSON.stringify(event.triggerData),
      node_count: event.nodeCount,
      steps_executed: event.stepsExecuted,
      steps_failed: event.stepsFailed,
      error_message: event.errorMessage,
      metadata: JSON.stringify(event.metadata),
    };

    await this.insertData(query, [data]);
    
    // Track data lineage
    await this.dataLineageTracker.trackWorkflowExecution(event);
  }

  @OnEvent('step.executed')
  async handleStepExecuted(event: StepExecutedEvent): Promise<void> {
    const query = `INSERT INTO step_executions FORMAT JSONEachRow`;
    const data = {
      step_id: event.stepId,
      execution_id: event.executionId,
      workflow_id: event.workflowId,
      tenant_id: event.tenantId,
      node_id: event.nodeId,
      node_type: event.nodeType,
      status: event.status,
      start_time: new Date(event.startTime),
      end_time: event.endTime ? new Date(event.endTime) : null,
      duration_ms: event.durationMs,
      input_size: event.inputSize,
      output_size: event.outputSize,
      memory_used: event.memoryUsed,
      cpu_time_ms: event.cpuTimeMs,
      network_calls: event.networkCalls,
      error_message: event.errorMessage,
      retry_count: event.retryCount,
      async_task_id: event.asyncTaskId,
    };

    await this.insertData(query, [data]);
    
    // Track step-level data lineage
    await this.dataLineageTracker.trackStepExecution(event);
  }

  @OnEvent('api.request')
  async handleApiRequest(event: ApiRequestEvent): Promise<void> {
    const query = `INSERT INTO api_usage FORMAT JSONEachRow`;
    const data = {
      request_id: event.requestId,
      tenant_id: event.tenantId,
      user_id: event.userId,
      endpoint: event.endpoint,
      method: event.method,
      status_code: event.statusCode,
      response_time_ms: event.responseTimeMs,
      request_size: event.requestSize,
      response_size: event.responseSize,
      ip_address: event.ipAddress,
      user_agent: event.userAgent,
      timestamp: new Date(event.timestamp),
      rate_limited: event.rateLimited,
      authenticated: event.authenticated,
    };

    await this.insertData(query, [data]);
  }

  @OnEvent('audit.event')
  async handleAuditEvent(event: AuditEvent): Promise<void> {
    const query = `INSERT INTO audit_events FORMAT JSONEachRow`;
    const data = {
      event_id: event.eventId,
      tenant_id: event.tenantId,
      user_id: event.userId,
      action: event.action,
      resource_type: event.resourceType,
      resource_id: event.resourceId,
      old_values: event.oldValues ? JSON.stringify(event.oldValues) : null,
      new_values: event.newValues ? JSON.stringify(event.newValues) : null,
      ip_address: event.ipAddress,
      user_agent: event.userAgent,
      session_id: event.sessionId,
      timestamp: new Date(event.timestamp),
      risk_score: event.riskScore || 0,
      compliance_tags: event.complianceTags || [],
    };

    await this.insertData(query, [data]);
  }

  // Analytics query methods
  async getWorkflowAnalytics(tenantId: string, timeRange: TimeRange, filters?: AnalyticsFilters): Promise<WorkflowAnalytics> {
    const { startTime, endTime } = this.parseTimeRange(timeRange);
    
    const [executionStats, performanceMetrics, errorRates, topWorkflows] = await Promise.all([
      this.getExecutionStatistics(tenantId, startTime, endTime, filters),
      this.getPerformanceMetrics(tenantId, startTime, endTime, filters),
      this.getErrorRates(tenantId, startTime, endTime, filters),
      this.getTopWorkflows(tenantId, startTime, endTime, filters),
    ]);

    return {
      timeRange,
      executionStats,
      performanceMetrics,
      errorRates,
      topWorkflows,
      generatedAt: new Date(),
    };
  }

  async getUsageAnalytics(tenantId: string, timeRange: TimeRange): Promise<UsageAnalytics> {
    const { startTime, endTime } = this.parseTimeRange(timeRange);
    
    const query = `
      SELECT 
        count() as total_executions,
        countIf(status = 'success') as successful_executions,
        countIf(status = 'failed') as failed_executions,
        avg(duration_ms) as avg_execution_time,
        sum(steps_executed) as total_steps,
        uniq(workflow_id) as unique_workflows,
        uniq(user_id) as unique_users
      FROM workflow_executions 
      WHERE tenant_id = '${tenantId}'
        AND start_time >= '${startTime.toISOString()}'
        AND start_time < '${endTime.toISOString()}'
    `;

    const result = await this.executeQuery(query);
    return this.mapUsageAnalytics(result[0]);
  }

  async getDataLineage(workflowId: string, executionId?: string): Promise<DataLineageGraph> {
    return this.dataLineageTracker.getLineageGraph(workflowId, executionId);
  }

  async getComplianceReport(tenantId: string, timeRange: TimeRange, reportType: ComplianceReportType): Promise<ComplianceReport> {
    return this.complianceReporter.generateReport(tenantId, timeRange, reportType);
  }

  async getBillingData(tenantId: string, timeRange: TimeRange): Promise<BillingData> {
    const { startTime, endTime } = this.parseTimeRange(timeRange);
    
    const queries = {
      executions: `
        SELECT count() as count, sum(duration_ms) as total_duration_ms
        FROM workflow_executions 
        WHERE tenant_id = '${tenantId}'
          AND start_time >= '${startTime.toISOString()}'
          AND start_time < '${endTime.toISOString()}'
      `,
      apiCalls: `
        SELECT count() as count, sum(response_time_ms) as total_response_time_ms
        FROM api_usage 
        WHERE tenant_id = '${tenantId}'
          AND timestamp >= '${startTime.toISOString()}'
          AND timestamp < '${endTime.toISOString()}'
      `,
      storage: `
        SELECT sum(value) as total_bytes
        FROM resource_usage 
        WHERE tenant_id = '${tenantId}'
          AND resource_type = 'storage'
          AND timestamp >= '${startTime.toISOString()}'
          AND timestamp < '${endTime.toISOString()}'
      `,
    };

    const [executionData, apiData, storageData] = await Promise.all([
      this.executeQuery(queries.executions),
      this.executeQuery(queries.apiCalls),
      this.executeQuery(queries.storage),
    ]);

    return {
      tenantId,
      timeRange,
      executions: {
        count: executionData[0]?.count || 0,
        totalDurationMs: executionData[0]?.total_duration_ms || 0,
      },
      apiCalls: {
        count: apiData[0]?.count || 0,
        totalResponseTimeMs: apiData[0]?.total_response_time_ms || 0,
      },
      storage: {
        totalBytes: storageData[0]?.total_bytes || 0,
      },
      generatedAt: new Date(),
    };
  }

  // Real-time dashboard data
  async getDashboardData(tenantId: string): Promise<DashboardData> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const queries = {
      activeExecutions: `
        SELECT count() as count
        FROM workflow_executions 
        WHERE tenant_id = '${tenantId}' AND status IN ('pending', 'running')
      `,
      recentExecutions: `
        SELECT count() as count
        FROM workflow_executions 
        WHERE tenant_id = '${tenantId}'
          AND start_time >= '${oneHourAgo.toISOString()}'
      `,
      errorRate: `
        SELECT 
          countIf(status = 'failed') / count() as error_rate
        FROM workflow_executions 
        WHERE tenant_id = '${tenantId}'
          AND start_time >= '${oneHourAgo.toISOString()}'
      `,
      avgResponseTime: `
        SELECT avg(response_time_ms) as avg_response_time
        FROM api_usage 
        WHERE tenant_id = '${tenantId}'
          AND timestamp >= '${oneHourAgo.toISOString()}'
      `,
    };

    const results = await Promise.all([
      this.executeQuery(queries.activeExecutions),
      this.executeQuery(queries.recentExecutions),
      this.executeQuery(queries.errorRate),
      this.executeQuery(queries.avgResponseTime),
    ]);

    return {
      activeExecutions: results[0][0]?.count || 0,
      executionsLastHour: results[1][0]?.count || 0,
      errorRate: results[2][0]?.error_rate || 0,
      avgResponseTime: results[3][0]?.avg_response_time || 0,
      timestamp: now,
    };
  }

  // Business Intelligence queries
  async getBusinessInsights(tenantId: string, timeRange: TimeRange): Promise<BusinessInsights> {
    return this.businessIntelligence.generateInsights(tenantId, timeRange);
  }

  // Scheduled data cleanup and aggregation tasks
  @Cron(CronExpression.EVERY_HOUR)
  async aggregateHourlyMetrics(): Promise<void> {
    this.logger.debug('Running hourly metrics aggregation');
    
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    
    // Aggregate workflow metrics
    const aggregationQuery = `
      INSERT INTO business_metrics
      SELECT
        'hourly_workflow_summary' as metric_name,
        tenant_id,
        count() as metric_value,
        map('status', status) as dimensions,
        toStartOfHour(start_time) as timestamp,
        'hour' as aggregation_period,
        now64(3) as created_at
      FROM workflow_executions
      WHERE start_time >= '${twoHoursAgo.toISOString()}'
        AND start_time < '${hourAgo.toISOString()}'
      GROUP BY tenant_id, status, toStartOfHour(start_time)
    `;
    
    await this.executeQuery(aggregationQuery);
    this.logger.debug('Completed hourly metrics aggregation');
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldData(): Promise<void> {
    this.logger.debug('Running data cleanup job');
    
    const retentionPolicies = [
      { table: 'workflow_executions', days: 730 }, // 2 years
      { table: 'step_executions', days: 730 }, // 2 years
      { table: 'api_usage', days: 365 }, // 1 year
      { table: 'resource_usage', days: 365 }, // 1 year
      { table: 'audit_events', days: 2555 }, // 7 years
      { table: 'error_events', days: 730 }, // 2 years
      { table: 'performance_metrics', days: 365 }, // 1 year
    ];
    
    for (const policy of retentionPolicies) {
      const cutoffDate = new Date(Date.now() - policy.days * 24 * 60 * 60 * 1000);
      const deleteQuery = `ALTER TABLE ${policy.table} DELETE WHERE created_at < '${cutoffDate.toISOString()}'`;
      
      try {
        await this.executeQuery(deleteQuery);
        this.logger.debug(`Cleaned up old data from ${policy.table}`);
      } catch (error) {
        this.logger.error(`Failed to cleanup ${policy.table}: ${error.message}`);
      }
    }
    
    this.logger.debug('Completed data cleanup job');
  }

  // Helper methods
  private async insertData(query: string, data: any[]): Promise<void> {
    try {
      const stream = this.clickhouse.query(query);
      await stream.stream(data);
    } catch (error) {
      this.logger.error(`Failed to insert data: ${error.message}`);
      throw error;
    }
  }

  private async executeQuery(query: string): Promise<any[]> {
    try {
      const result = await this.clickhouse.query(query).toPromise();
      return result;
    } catch (error) {
      this.logger.error(`Failed to execute query: ${error.message}`);
      throw error;
    }
  }

  private parseTimeRange(timeRange: TimeRange): { startTime: Date; endTime: Date } {
    const now = new Date();
    let startTime: Date;

    switch (timeRange) {
      case 'hour':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startTime = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    return { startTime, endTime: now };
  }

  private async getExecutionStatistics(tenantId: string, startTime: Date, endTime: Date, filters?: AnalyticsFilters): Promise<any> {
    // Implementation for execution statistics
    return {};
  }

  private async getPerformanceMetrics(tenantId: string, startTime: Date, endTime: Date, filters?: AnalyticsFilters): Promise<any> {
    // Implementation for performance metrics
    return {};
  }

  private async getErrorRates(tenantId: string, startTime: Date, endTime: Date, filters?: AnalyticsFilters): Promise<any> {
    // Implementation for error rates
    return {};
  }

  private async getTopWorkflows(tenantId: string, startTime: Date, endTime: Date, filters?: AnalyticsFilters): Promise<any> {
    // Implementation for top workflows
    return {};
  }

  private mapUsageAnalytics(data: any): UsageAnalytics {
    // Implementation for mapping usage analytics
    return {} as UsageAnalytics;
  }
}

// Supporting classes and interfaces
class DataLineageTracker {
  constructor(
    private readonly clickhouse: ClickHouse,
    private readonly logger: Logger
  ) {}

  async trackWorkflowExecution(event: WorkflowExecutedEvent): Promise<void> {
    // Implementation for workflow-level lineage tracking
  }

  async trackStepExecution(event: StepExecutedEvent): Promise<void> {
    // Implementation for step-level lineage tracking
  }

  async getLineageGraph(workflowId: string, executionId?: string): Promise<DataLineageGraph> {
    // Implementation for retrieving lineage graph
    return {} as DataLineageGraph;
  }
}

class ComplianceReporter {
  constructor(
    private readonly clickhouse: ClickHouse,
    private readonly logger: Logger
  ) {}

  async generateReport(tenantId: string, timeRange: TimeRange, reportType: ComplianceReportType): Promise<ComplianceReport> {
    // Implementation for compliance reporting
    return {} as ComplianceReport;
  }
}

class BusinessIntelligenceEngine {
  constructor(
    private readonly clickhouse: ClickHouse,
    private readonly logger: Logger
  ) {}

  async generateInsights(tenantId: string, timeRange: TimeRange): Promise<BusinessInsights> {
    // Implementation for business insights
    return {} as BusinessInsights;
  }
}

// Type definitions
interface WorkflowExecutedEvent {
  executionId: string;
  workflowId: string;
  tenantId: string;
  userId: string;
  status: string;
  startTime: string;
  endTime?: string;
  durationMs: number;
  triggerType: string;
  triggerData: any;
  nodeCount: number;
  stepsExecuted: number;
  stepsFailed: number;
  errorMessage?: string;
  metadata: any;
}

interface StepExecutedEvent {
  stepId: string;
  executionId: string;
  workflowId: string;
  tenantId: string;
  nodeId: string;
  nodeType: string;
  status: string;
  startTime: string;
  endTime?: string;
  durationMs: number;
  inputSize: number;
  outputSize: number;
  memoryUsed: number;
  cpuTimeMs: number;
  networkCalls: number;
  errorMessage?: string;
  retryCount: number;
  asyncTaskId?: string;
}

interface ApiRequestEvent {
  requestId: string;
  tenantId: string;
  userId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  requestSize: number;
  responseSize: number;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  rateLimited: boolean;
  authenticated: boolean;
}

interface AuditEvent {
  eventId: string;
  tenantId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  oldValues?: any;
  newValues?: any;
  ipAddress: string;
  userAgent: string;
  sessionId: string;
  timestamp: string;
  riskScore?: number;
  complianceTags?: string[];
}

type TimeRange = 'hour' | 'day' | 'week' | 'month' | 'year';
type ComplianceReportType = 'gdpr' | 'hipaa' | 'sox' | 'pci-dss';

interface AnalyticsFilters {
  workflowIds?: string[];
  userIds?: string[];
  status?: string[];
  nodeTypes?: string[];
}

interface WorkflowAnalytics {
  timeRange: TimeRange;
  executionStats: any;
  performanceMetrics: any;
  errorRates: any;
  topWorkflows: any;
  generatedAt: Date;
}

interface UsageAnalytics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  avgExecutionTime: number;
  totalSteps: number;
  uniqueWorkflows: number;
  uniqueUsers: number;
}

interface DataLineageGraph {
  nodes: Array<{
    id: string;
    type: string;
    label: string;
    metadata: any;
  }>;
  edges: Array<{
    from: string;
    to: string;
    type: string;
    metadata: any;
  }>;
}

interface ComplianceReport {
  reportType: ComplianceReportType;
  tenantId: string;
  timeRange: TimeRange;
  findings: any[];
  recommendations: string[];
  complianceScore: number;
  generatedAt: Date;
}

interface BillingData {
  tenantId: string;
  timeRange: TimeRange;
  executions: {
    count: number;
    totalDurationMs: number;
  };
  apiCalls: {
    count: number;
    totalResponseTimeMs: number;
  };
  storage: {
    totalBytes: number;
  };
  generatedAt: Date;
}

interface DashboardData {
  activeExecutions: number;
  executionsLastHour: number;
  errorRate: number;
  avgResponseTime: number;
  timestamp: Date;
}

interface BusinessInsights {
  trends: any[];
  anomalies: any[];
  recommendations: string[];
  predictions: any[];
  generatedAt: Date;
}
