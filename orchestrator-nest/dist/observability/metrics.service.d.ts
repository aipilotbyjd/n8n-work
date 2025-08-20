export declare class MetricsService {
    private readonly httpRequestsTotal;
    private readonly httpRequestDuration;
    private readonly workflowExecutionsTotal;
    private readonly activeWorkflows;
    constructor();
    incrementHttpRequests(method: string, route: string, statusCode: number): void;
    observeHttpDuration(method: string, route: string, duration: number): void;
    incrementWorkflowExecutions(tenantId: string, status: string): void;
    setActiveWorkflows(tenantId: string, count: number): void;
    getMetrics(): Promise<string>;
    getContentType(): string;
}
