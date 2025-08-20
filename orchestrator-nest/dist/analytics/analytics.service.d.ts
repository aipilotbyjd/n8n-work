import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
export declare class AnalyticsService {
    private readonly configService;
    private readonly eventEmitter;
    private readonly logger;
    private readonly clickhouse;
    private readonly dataLineageTracker;
    private readonly complianceReporter;
    private readonly businessIntelligence;
    constructor(configService: ConfigService, eventEmitter: EventEmitter2);
    onModuleInit(): Promise<void>;
    private initializeAnalyticsDatabase;
    private createMaterializedViews;
    handleWorkflowExecuted(event: WorkflowExecutedEvent): Promise<void>;
    handleStepExecuted(event: StepExecutedEvent): Promise<void>;
    handleApiRequest(event: ApiRequestEvent): Promise<void>;
    handleAuditEvent(event: AuditEvent): Promise<void>;
    getWorkflowAnalytics(tenantId: string, timeRange: TimeRange, filters?: AnalyticsFilters): Promise<WorkflowAnalytics>;
    getUsageAnalytics(tenantId: string, timeRange: TimeRange): Promise<UsageAnalytics>;
    getDataLineage(workflowId: string, executionId?: string): Promise<DataLineageGraph>;
    getComplianceReport(tenantId: string, timeRange: TimeRange, reportType: ComplianceReportType): Promise<ComplianceReport>;
    getBillingData(tenantId: string, timeRange: TimeRange): Promise<BillingData>;
    getDashboardData(tenantId: string): Promise<DashboardData>;
    getBusinessInsights(tenantId: string, timeRange: TimeRange): Promise<BusinessInsights>;
    aggregateHourlyMetrics(): Promise<void>;
    cleanupOldData(): Promise<void>;
    private insertData;
    private executeQuery;
    private parseTimeRange;
    private getExecutionStatistics;
    private getPerformanceMetrics;
    private getErrorRates;
    private getTopWorkflows;
    private mapUsageAnalytics;
}
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
export {};
