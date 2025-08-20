import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MetricsService } from './metrics.service';
import { AlertingService } from './alerting.service';
interface SLODefinition {
    name: string;
    description: string;
    service: string;
    sli: SLIDefinition;
    objectives: SLOObjective[];
    alertPolicy: AlertPolicy;
    tags: Record<string, string>;
}
interface SLIDefinition {
    type: 'availability' | 'latency' | 'throughput' | 'error_rate' | 'custom';
    metric: string;
    filters: Record<string, string>;
    goodEventQuery: string;
    totalEventQuery: string;
}
interface SLOObjective {
    displayName: string;
    target: number;
    window: string;
    severity: 'critical' | 'warning' | 'info';
}
interface AlertPolicy {
    burnRateThreshold: number;
    lookbackDuration: string;
    alertChannels: string[];
    escalationPolicy?: string;
}
interface SLOStatus {
    name: string;
    currentSLI: number;
    objectives: ObjectiveStatus[];
    errorBudget: {
        remaining: number;
        consumed: number;
        burnRate: number;
    };
    status: 'healthy' | 'warning' | 'critical';
    lastUpdated: Date;
}
interface ObjectiveStatus {
    displayName: string;
    target: number;
    current: number;
    compliance: number;
    status: 'ok' | 'warning' | 'breached';
}
export declare class SLOService implements OnModuleInit {
    private readonly config;
    private readonly eventEmitter;
    private readonly metricsService;
    private readonly alertingService;
    private readonly logger;
    private sloDefinitions;
    private sloStatuses;
    private alertStates;
    constructor(config: ConfigService, eventEmitter: EventEmitter2, metricsService: MetricsService, alertingService: AlertingService);
    onModuleInit(): Promise<void>;
    private initializeSLOs;
    registerSLO(definition: SLODefinition): void;
    private initializeSLOStatus;
    evaluateSLOs(): Promise<void>;
    private evaluateSLO;
    private calculateSLI;
    private calculateCompliance;
    private buildWindowQuery;
    private calculateErrorBudget;
    private determineSLOStatus;
    private checkAlerts;
    private shouldFireAlert;
    private fireAlert;
    private resolveAlert;
    private buildAlertMessage;
    private getAlertSeverity;
    private updateSLOMetrics;
    private extractScalarValue;
    getSLOStatus(name: string): SLOStatus | undefined;
    getAllSLOStatuses(): SLOStatus[];
    getSLODefinition(name: string): SLODefinition | undefined;
    generateSLOReport(timeRange?: string): Promise<SLOReport>;
}
interface SLOReport {
    timeRange: string;
    generatedAt: Date;
    summary: {
        totalSLOs: number;
        healthySLOs: number;
        warningSLOs: number;
        criticalSLOs: number;
    };
    slos: {
        name: string;
        status: string;
        currentSLI: number;
        errorBudgetRemaining: number;
        objectives: {
            displayName: string;
            target: number;
            current: number;
            compliance: number;
            status: string;
        }[];
    }[];
}
export {};
