"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsService = void 0;
const common_1 = require("@nestjs/common");
const prom_client_1 = require("prom-client");
let MetricsService = class MetricsService {
    httpRequestsTotal;
    httpRequestDuration;
    workflowExecutionsTotal;
    activeWorkflows;
    constructor() {
        this.httpRequestsTotal = new prom_client_1.Counter({
            name: 'http_requests_total',
            help: 'Total number of HTTP requests',
            labelNames: ['method', 'route', 'status_code'],
        });
        this.httpRequestDuration = new prom_client_1.Histogram({
            name: 'http_request_duration_seconds',
            help: 'Duration of HTTP requests in seconds',
            labelNames: ['method', 'route'],
            buckets: [0.1, 0.5, 1, 2, 5],
        });
        this.workflowExecutionsTotal = new prom_client_1.Counter({
            name: 'workflow_executions_total',
            help: 'Total number of workflow executions',
            labelNames: ['tenant_id', 'status'],
        });
        this.activeWorkflows = new prom_client_1.Gauge({
            name: 'active_workflows',
            help: 'Number of currently active workflows',
            labelNames: ['tenant_id'],
        });
        prom_client_1.register.registerMetric(this.httpRequestsTotal);
        prom_client_1.register.registerMetric(this.httpRequestDuration);
        prom_client_1.register.registerMetric(this.workflowExecutionsTotal);
        prom_client_1.register.registerMetric(this.activeWorkflows);
    }
    incrementHttpRequests(method, route, statusCode) {
        this.httpRequestsTotal.inc({ method, route, status_code: statusCode });
    }
    observeHttpDuration(method, route, duration) {
        this.httpRequestDuration.observe({ method, route }, duration);
    }
    incrementWorkflowExecutions(tenantId, status) {
        this.workflowExecutionsTotal.inc({ tenant_id: tenantId, status });
    }
    setActiveWorkflows(tenantId, count) {
        this.activeWorkflows.set({ tenant_id: tenantId }, count);
    }
    getMetrics() {
        return prom_client_1.register.metrics();
    }
    getContentType() {
        return prom_client_1.register.contentType;
    }
};
exports.MetricsService = MetricsService;
exports.MetricsService = MetricsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], MetricsService);
//# sourceMappingURL=metrics.service.js.map