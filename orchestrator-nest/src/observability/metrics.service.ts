import { Injectable } from '@nestjs/common';
import { register, Counter, Histogram, Gauge } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly httpRequestsTotal: Counter<string>;
  private readonly httpRequestDuration: Histogram<string>;
  private readonly workflowExecutionsTotal: Counter<string>;
  private readonly activeWorkflows: Gauge<string>;

  constructor() {
    // HTTP metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.1, 0.5, 1, 2, 5],
    });

    // Workflow metrics
    this.workflowExecutionsTotal = new Counter({
      name: 'workflow_executions_total',
      help: 'Total number of workflow executions',
      labelNames: ['tenant_id', 'status'],
    });

    this.activeWorkflows = new Gauge({
      name: 'active_workflows',
      help: 'Number of currently active workflows',
      labelNames: ['tenant_id'],
    });

    // Register all metrics
    register.registerMetric(this.httpRequestsTotal);
    register.registerMetric(this.httpRequestDuration);
    register.registerMetric(this.workflowExecutionsTotal);
    register.registerMetric(this.activeWorkflows);
  }

  incrementHttpRequests(method: string, route: string, statusCode: number): void {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode });
  }

  observeHttpDuration(method: string, route: string, duration: number): void {
    this.httpRequestDuration.observe({ method, route }, duration);
  }

  incrementWorkflowExecutions(tenantId: string, status: string): void {
    this.workflowExecutionsTotal.inc({ tenant_id: tenantId, status });
  }

  setActiveWorkflows(tenantId: string, count: number): void {
    this.activeWorkflows.set({ tenant_id: tenantId }, count);
  }

  getMetrics(): Promise<string> {
    return register.metrics();
  }

  getContentType(): string {
    return register.contentType;
  }
}
