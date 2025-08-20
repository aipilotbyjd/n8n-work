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
var SLOService_1;
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SLOService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const event_emitter_1 = require("@nestjs/event-emitter");
const schedule_1 = require("@nestjs/schedule");
const metrics_service_1 = require("./metrics.service");
const alerting_service_1 = require("./alerting.service");
let SLOService = SLOService_1 = class SLOService {
    config;
    eventEmitter;
    metricsService;
    alertingService;
    logger = new common_1.Logger(SLOService_1.name);
    sloDefinitions = new Map();
    sloStatuses = new Map();
    alertStates = new Map();
    constructor(config, eventEmitter, metricsService, alertingService) {
        this.config = config;
        this.eventEmitter = eventEmitter;
        this.metricsService = metricsService;
        this.alertingService = alertingService;
    }
    async onModuleInit() {
        await this.initializeSLOs();
        this.logger.log('SLO monitoring service initialized');
    }
    async initializeSLOs() {
        this.registerSLO({
            name: 'platform_overhead',
            description: 'Platform overhead excluding vendor API time',
            service: 'orchestrator',
            sli: {
                type: 'latency',
                metric: 'n8n_work_request_duration_seconds',
                filters: { service: 'orchestrator' },
                goodEventQuery: 'sum(rate(n8n_work_request_duration_seconds_bucket{le="0.15"}[5m]))',
                totalEventQuery: 'sum(rate(n8n_work_request_duration_seconds_count[5m]))',
            },
            objectives: [
                {
                    displayName: '95th percentile < 150ms',
                    target: 0.95,
                    window: '30d',
                    severity: 'critical',
                },
            ],
            alertPolicy: {
                burnRateThreshold: 2.0,
                lookbackDuration: '1h',
                alertChannels: ['slack', 'pagerduty'],
                escalationPolicy: 'sre-team',
            },
            tags: { tier: 'platform', component: 'api' },
        });
        this.registerSLO({
            name: 'workflow_start_time',
            description: 'Time from webhook to first step execution',
            service: 'engine',
            sli: {
                type: 'latency',
                metric: 'n8n_work_workflow_start_duration_seconds',
                filters: { service: 'engine' },
                goodEventQuery: 'sum(rate(n8n_work_workflow_start_duration_seconds_bucket{le="0.5"}[5m]))',
                totalEventQuery: 'sum(rate(n8n_work_workflow_start_duration_seconds_count[5m]))',
            },
            objectives: [
                {
                    displayName: '95th percentile < 500ms',
                    target: 0.95,
                    window: '30d',
                    severity: 'critical',
                },
            ],
            alertPolicy: {
                burnRateThreshold: 2.0,
                lookbackDuration: '1h',
                alertChannels: ['slack', 'pagerduty'],
            },
            tags: { tier: 'execution', component: 'engine' },
        });
        this.registerSLO({
            name: 'step_execution_time',
            description: 'Built-in node execution time',
            service: 'node-runner',
            sli: {
                type: 'latency',
                metric: 'n8n_work_step_execution_duration_seconds',
                filters: { service: 'node-runner', node_type: 'builtin' },
                goodEventQuery: 'sum(rate(n8n_work_step_execution_duration_seconds_bucket{le="2.0",node_type="builtin"}[5m]))',
                totalEventQuery: 'sum(rate(n8n_work_step_execution_duration_seconds_count{node_type="builtin"}[5m]))',
            },
            objectives: [
                {
                    displayName: '95th percentile < 2s for built-in nodes',
                    target: 0.95,
                    window: '30d',
                    severity: 'warning',
                },
            ],
            alertPolicy: {
                burnRateThreshold: 3.0,
                lookbackDuration: '2h',
                alertChannels: ['slack'],
            },
            tags: { tier: 'execution', component: 'node-runner' },
        });
        this.registerSLO({
            name: 'system_availability',
            description: 'Overall system availability',
            service: 'platform',
            sli: {
                type: 'availability',
                metric: 'n8n_work_request_total',
                filters: {},
                goodEventQuery: 'sum(rate(n8n_work_request_total{status!~"5.."}[5m]))',
                totalEventQuery: 'sum(rate(n8n_work_request_total[5m]))',
            },
            objectives: [
                {
                    displayName: '99.95% availability single-region',
                    target: 0.9995,
                    window: '30d',
                    severity: 'critical',
                },
                {
                    displayName: '99.9% availability over 7 days',
                    target: 0.999,
                    window: '7d',
                    severity: 'warning',
                },
            ],
            alertPolicy: {
                burnRateThreshold: 1.5,
                lookbackDuration: '30m',
                alertChannels: ['slack', 'pagerduty', 'email'],
                escalationPolicy: 'on-call-engineer',
            },
            tags: { tier: 'platform', component: 'all' },
        });
        this.registerSLO({
            name: 'error_rate',
            description: 'System error rate threshold',
            service: 'platform',
            sli: {
                type: 'error_rate',
                metric: 'n8n_work_request_total',
                filters: {},
                goodEventQuery: 'sum(rate(n8n_work_request_total{status!~"[45].."}[5m]))',
                totalEventQuery: 'sum(rate(n8n_work_request_total[5m]))',
            },
            objectives: [
                {
                    displayName: 'Error rate < 0.05%',
                    target: 0.9995,
                    window: '15m',
                    severity: 'warning',
                },
            ],
            alertPolicy: {
                burnRateThreshold: 10.0,
                lookbackDuration: '15m',
                alertChannels: ['slack'],
            },
            tags: { tier: 'platform', component: 'all' },
        });
    }
    registerSLO(definition) {
        this.sloDefinitions.set(definition.name, definition);
        this.initializeSLOStatus(definition);
        this.logger.log(`SLO registered: ${definition.name}`);
    }
    initializeSLOStatus(definition) {
        const status = {
            name: definition.name,
            currentSLI: 0,
            objectives: definition.objectives.map(obj => ({
                displayName: obj.displayName,
                target: obj.target,
                current: 0,
                compliance: 0,
                status: 'ok',
            })),
            errorBudget: {
                remaining: 100,
                consumed: 0,
                burnRate: 0,
            },
            status: 'healthy',
            lastUpdated: new Date(),
        };
        this.sloStatuses.set(definition.name, status);
    }
    async evaluateSLOs() {
        for (const [name, definition] of this.sloDefinitions) {
            try {
                await this.evaluateSLO(name, definition);
            }
            catch (error) {
                this.logger.error(`Failed to evaluate SLO ${name}`, error);
            }
        }
    }
    async evaluateSLO(name, definition) {
        const currentSLI = await this.calculateSLI(definition.sli);
        const status = this.sloStatuses.get(name);
        status.currentSLI = currentSLI;
        status.lastUpdated = new Date();
        for (let i = 0; i < definition.objectives.length; i++) {
            const objective = definition.objectives[i];
            const objectiveStatus = status.objectives[i];
            const compliance = await this.calculateCompliance(definition.sli, objective);
            objectiveStatus.current = compliance;
            objectiveStatus.compliance = (compliance / objective.target) * 100;
            if (compliance >= objective.target) {
                objectiveStatus.status = 'ok';
            }
            else if (compliance >= objective.target * 0.95) {
                objectiveStatus.status = 'warning';
            }
            else {
                objectiveStatus.status = 'breached';
            }
        }
        await this.calculateErrorBudget(status, definition);
        status.status = this.determineSLOStatus(status);
        await this.checkAlerts(name, definition, status);
        this.eventEmitter.emit('slo.evaluated', {
            name,
            status,
            definition,
        });
        this.updateSLOMetrics(name, status);
    }
    async calculateSLI(sli) {
        try {
            const goodEvents = await this.metricsService.query(sli.goodEventQuery);
            const totalEvents = await this.metricsService.query(sli.totalEventQuery);
            const goodValue = this.extractScalarValue(goodEvents);
            const totalValue = this.extractScalarValue(totalEvents);
            if (totalValue === 0)
                return 1;
            return goodValue / totalValue;
        }
        catch (error) {
            this.logger.error('Failed to calculate SLI', error);
            return 0;
        }
    }
    async calculateCompliance(sli, objective) {
        try {
            const windowQuery = this.buildWindowQuery(sli, objective.window);
            const result = await this.metricsService.query(windowQuery);
            return this.extractScalarValue(result);
        }
        catch (error) {
            this.logger.error('Failed to calculate compliance', error);
            return 0;
        }
    }
    buildWindowQuery(sli, window) {
        const goodQuery = sli.goodEventQuery.replace('[5m]', `[${window}]`);
        const totalQuery = sli.totalEventQuery.replace('[5m]', `[${window}]`);
        return `(${goodQuery}) / (${totalQuery})`;
    }
    async calculateErrorBudget(status, definition) {
        const primaryObjective = definition.objectives[0];
        const primaryStatus = status.objectives[0];
        const targetReliability = primaryObjective.target;
        const currentReliability = primaryStatus.current;
        const allowedErrorRate = 1 - targetReliability;
        const currentErrorRate = 1 - currentReliability;
        const budgetConsumed = Math.min(100, (currentErrorRate / allowedErrorRate) * 100);
        const budgetRemaining = Math.max(0, 100 - budgetConsumed);
        const burnRate = currentErrorRate / allowedErrorRate;
        status.errorBudget = {
            remaining: budgetRemaining,
            consumed: budgetConsumed,
            burnRate,
        };
    }
    determineSLOStatus(status) {
        const hasBreachedObjectives = status.objectives.some(obj => obj.status === 'breached');
        const hasWarningObjectives = status.objectives.some(obj => obj.status === 'warning');
        if (hasBreachedObjectives || status.errorBudget.remaining < 10) {
            return 'critical';
        }
        else if (hasWarningObjectives || status.errorBudget.remaining < 25) {
            return 'warning';
        }
        return 'healthy';
    }
    async checkAlerts(name, definition, status) {
        const alertKey = `slo_${name}`;
        const currentState = this.alertStates.get(alertKey) || { firing: false, lastAlert: null };
        const shouldAlert = this.shouldFireAlert(definition, status);
        if (shouldAlert && !currentState.firing) {
            await this.fireAlert(name, definition, status);
            currentState.firing = true;
            currentState.lastAlert = new Date();
            this.logger.warn(`SLO alert fired: ${name}`);
        }
        else if (!shouldAlert && currentState.firing) {
            await this.resolveAlert(name, definition, status);
            currentState.firing = false;
            this.logger.log(`SLO alert resolved: ${name}`);
        }
        this.alertStates.set(alertKey, currentState);
    }
    shouldFireAlert(definition, status) {
        if (status.errorBudget.burnRate > definition.alertPolicy.burnRateThreshold) {
            return true;
        }
        const hasCriticalBreach = definition.objectives.some((obj, i) => obj.severity === 'critical' && status.objectives[i].status === 'breached');
        return hasCriticalBreach;
    }
    async fireAlert(name, definition, status) {
        const alert = {
            title: `SLO Breach: ${definition.description}`,
            message: this.buildAlertMessage(definition, status),
            severity: this.getAlertSeverity(definition, status),
            service: definition.service,
            tags: definition.tags,
            metadata: {
                sloName: name,
                burnRate: status.errorBudget.burnRate,
                errorBudgetRemaining: status.errorBudget.remaining,
                objectives: status.objectives,
            },
        };
        for (const channel of definition.alertPolicy.alertChannels) {
            await this.alertingService.sendAlert(channel, alert);
        }
        this.eventEmitter.emit('slo.alert.fired', {
            sloName: name,
            alert,
            definition,
            status,
        });
    }
    async resolveAlert(name, definition, status) {
        const alert = {
            title: `SLO Recovered: ${definition.description}`,
            message: `SLO ${name} has recovered. Error budget remaining: ${status.errorBudget.remaining.toFixed(2)}%`,
            severity: 'info',
            service: definition.service,
            tags: definition.tags,
        };
        for (const channel of definition.alertPolicy.alertChannels) {
            await this.alertingService.resolveAlert(channel, alert);
        }
        this.eventEmitter.emit('slo.alert.resolved', {
            sloName: name,
            alert,
            definition,
            status,
        });
    }
    buildAlertMessage(definition, status) {
        const breachedObjectives = definition.objectives.filter((obj, i) => status.objectives[i].status === 'breached');
        let message = `SLO "${definition.name}" is breaching:\n\n`;
        for (const obj of breachedObjectives) {
            const objStatus = status.objectives[definition.objectives.indexOf(obj)];
            message += `• ${obj.displayName}: ${(objStatus.current * 100).toFixed(2)}% (target: ${(obj.target * 100).toFixed(2)}%)\n`;
        }
        message += `\nError Budget:\n`;
        message += `• Remaining: ${status.errorBudget.remaining.toFixed(2)}%\n`;
        message += `• Burn Rate: ${status.errorBudget.burnRate.toFixed(2)}x\n`;
        return message;
    }
    getAlertSeverity(definition, status) {
        const hasCriticalBreach = definition.objectives.some((obj, i) => obj.severity === 'critical' && status.objectives[i].status === 'breached');
        if (hasCriticalBreach || status.errorBudget.remaining < 5) {
            return 'critical';
        }
        else if (status.errorBudget.remaining < 20) {
            return 'warning';
        }
        return 'info';
    }
    updateSLOMetrics(name, status) {
        this.metricsService.setGauge('n8n_work_slo_current_sli', status.currentSLI, { slo: name });
        this.metricsService.setGauge('n8n_work_slo_error_budget_remaining', status.errorBudget.remaining, { slo: name });
        this.metricsService.setGauge('n8n_work_slo_burn_rate', status.errorBudget.burnRate, { slo: name });
        for (let i = 0; i < status.objectives.length; i++) {
            const objective = status.objectives[i];
            this.metricsService.setGauge('n8n_work_slo_objective_compliance', objective.compliance, {
                slo: name,
                objective: objective.displayName,
            });
        }
        const statusValue = status.status === 'healthy' ? 1 : status.status === 'warning' ? 0.5 : 0;
        this.metricsService.setGauge('n8n_work_slo_status', statusValue, { slo: name });
    }
    extractScalarValue(queryResult) {
        if (queryResult?.data?.result?.[0]?.value?.[1]) {
            return parseFloat(queryResult.data.result[0].value[1]);
        }
        return 0;
    }
    getSLOStatus(name) {
        return this.sloStatuses.get(name);
    }
    getAllSLOStatuses() {
        return Array.from(this.sloStatuses.values());
    }
    getSLODefinition(name) {
        return this.sloDefinitions.get(name);
    }
    async generateSLOReport(timeRange = '30d') {
        const report = {
            timeRange,
            generatedAt: new Date(),
            summary: {
                totalSLOs: this.sloDefinitions.size,
                healthySLOs: 0,
                warningSLOs: 0,
                criticalSLOs: 0,
            },
            slos: [],
        };
        for (const status of this.sloStatuses.values()) {
            if (status.status === 'healthy')
                report.summary.healthySLOs++;
            else if (status.status === 'warning')
                report.summary.warningSLOs++;
            else
                report.summary.criticalSLOs++;
            report.slos.push({
                name: status.name,
                status: status.status,
                currentSLI: status.currentSLI,
                errorBudgetRemaining: status.errorBudget.remaining,
                objectives: status.objectives.map(obj => ({
                    displayName: obj.displayName,
                    target: obj.target,
                    current: obj.current,
                    compliance: obj.compliance,
                    status: obj.status,
                })),
            });
        }
        return report;
    }
};
exports.SLOService = SLOService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SLOService.prototype, "evaluateSLOs", null);
exports.SLOService = SLOService = SLOService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        event_emitter_1.EventEmitter2,
        metrics_service_1.MetricsService, typeof (_a = typeof alerting_service_1.AlertingService !== "undefined" && alerting_service_1.AlertingService) === "function" ? _a : Object])
], SLOService);
//# sourceMappingURL=slo.service.js.map