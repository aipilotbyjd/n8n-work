import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Cron, CronExpression } from "@nestjs/schedule";
import { MetricsService } from "./metrics.service";
import { AlertingService } from "./alerting.service";

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
  type: "availability" | "latency" | "throughput" | "error_rate" | "custom";
  metric: string;
  filters: Record<string, string>;
  goodEventQuery: string;
  totalEventQuery: string;
}

interface SLOObjective {
  displayName: string;
  target: number; // 0.999 for 99.9%
  window: string; // '30d', '7d', '1h'
  severity: "critical" | "warning" | "info";
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
  status: "healthy" | "warning" | "critical";
  lastUpdated: Date;
}

interface ObjectiveStatus {
  displayName: string;
  target: number;
  current: number;
  compliance: number;
  status: "ok" | "warning" | "breached";
}

@Injectable()
export class SLOService implements OnModuleInit {
  private readonly logger = new Logger(SLOService.name);
  private sloDefinitions: Map<string, SLODefinition> = new Map();
  private sloStatuses: Map<string, SLOStatus> = new Map();
  private alertStates: Map<string, AlertState> = new Map();

  constructor(
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly metricsService: MetricsService,
    private readonly alertingService: AlertingService,
  ) {}

  async onModuleInit() {
    await this.initializeSLOs();
    this.logger.log("SLO monitoring service initialized");
  }

  private async initializeSLOs() {
    // Platform Overhead SLO
    this.registerSLO({
      name: "platform_overhead",
      description: "Platform overhead excluding vendor API time",
      service: "orchestrator",
      sli: {
        type: "latency",
        metric: "n8n_work_request_duration_seconds",
        filters: { service: "orchestrator" },
        goodEventQuery:
          'sum(rate(n8n_work_request_duration_seconds_bucket{le="0.15"}[5m]))',
        totalEventQuery:
          "sum(rate(n8n_work_request_duration_seconds_count[5m]))",
      },
      objectives: [
        {
          displayName: "95th percentile < 150ms",
          target: 0.95,
          window: "30d",
          severity: "critical",
        },
      ],
      alertPolicy: {
        burnRateThreshold: 2.0,
        lookbackDuration: "1h",
        alertChannels: ["slack", "pagerduty"],
        escalationPolicy: "sre-team",
      },
      tags: { tier: "platform", component: "api" },
    });

    // Workflow Start Time SLO
    this.registerSLO({
      name: "workflow_start_time",
      description: "Time from webhook to first step execution",
      service: "engine",
      sli: {
        type: "latency",
        metric: "n8n_work_workflow_start_duration_seconds",
        filters: { service: "engine" },
        goodEventQuery:
          'sum(rate(n8n_work_workflow_start_duration_seconds_bucket{le="0.5"}[5m]))',
        totalEventQuery:
          "sum(rate(n8n_work_workflow_start_duration_seconds_count[5m]))",
      },
      objectives: [
        {
          displayName: "95th percentile < 500ms",
          target: 0.95,
          window: "30d",
          severity: "critical",
        },
      ],
      alertPolicy: {
        burnRateThreshold: 2.0,
        lookbackDuration: "1h",
        alertChannels: ["slack", "pagerduty"],
      },
      tags: { tier: "execution", component: "engine" },
    });

    // Step Execution SLO
    this.registerSLO({
      name: "step_execution_time",
      description: "Built-in node execution time",
      service: "node-runner",
      sli: {
        type: "latency",
        metric: "n8n_work_step_execution_duration_seconds",
        filters: { service: "node-runner", node_type: "builtin" },
        goodEventQuery:
          'sum(rate(n8n_work_step_execution_duration_seconds_bucket{le="2.0",node_type="builtin"}[5m]))',
        totalEventQuery:
          'sum(rate(n8n_work_step_execution_duration_seconds_count{node_type="builtin"}[5m]))',
      },
      objectives: [
        {
          displayName: "95th percentile < 2s for built-in nodes",
          target: 0.95,
          window: "30d",
          severity: "warning",
        },
      ],
      alertPolicy: {
        burnRateThreshold: 3.0,
        lookbackDuration: "2h",
        alertChannels: ["slack"],
      },
      tags: { tier: "execution", component: "node-runner" },
    });

    // System Availability SLO
    this.registerSLO({
      name: "system_availability",
      description: "Overall system availability",
      service: "platform",
      sli: {
        type: "availability",
        metric: "n8n_work_request_total",
        filters: {},
        goodEventQuery: 'sum(rate(n8n_work_request_total{status!~"5.."}[5m]))',
        totalEventQuery: "sum(rate(n8n_work_request_total[5m]))",
      },
      objectives: [
        {
          displayName: "99.95% availability single-region",
          target: 0.9995,
          window: "30d",
          severity: "critical",
        },
        {
          displayName: "99.9% availability over 7 days",
          target: 0.999,
          window: "7d",
          severity: "warning",
        },
      ],
      alertPolicy: {
        burnRateThreshold: 1.5,
        lookbackDuration: "30m",
        alertChannels: ["slack", "pagerduty", "email"],
        escalationPolicy: "on-call-engineer",
      },
      tags: { tier: "platform", component: "all" },
    });

    // Error Rate SLO
    this.registerSLO({
      name: "error_rate",
      description: "System error rate threshold",
      service: "platform",
      sli: {
        type: "error_rate",
        metric: "n8n_work_request_total",
        filters: {},
        goodEventQuery:
          'sum(rate(n8n_work_request_total{status!~"[45].."}[5m]))',
        totalEventQuery: "sum(rate(n8n_work_request_total[5m]))",
      },
      objectives: [
        {
          displayName: "Error rate < 0.05%",
          target: 0.9995,
          window: "15m",
          severity: "warning",
        },
      ],
      alertPolicy: {
        burnRateThreshold: 10.0,
        lookbackDuration: "15m",
        alertChannels: ["slack"],
      },
      tags: { tier: "platform", component: "all" },
    });
  }

  registerSLO(definition: SLODefinition): void {
    this.sloDefinitions.set(definition.name, definition);
    this.initializeSLOStatus(definition);
    this.logger.log(`SLO registered: ${definition.name}`);
  }

  private initializeSLOStatus(definition: SLODefinition): void {
    const status: SLOStatus = {
      name: definition.name,
      currentSLI: 0,
      objectives: definition.objectives.map((obj) => ({
        displayName: obj.displayName,
        target: obj.target,
        current: 0,
        compliance: 0,
        status: "ok",
      })),
      errorBudget: {
        remaining: 100,
        consumed: 0,
        burnRate: 0,
      },
      status: "healthy",
      lastUpdated: new Date(),
    };

    this.sloStatuses.set(definition.name, status);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async evaluateSLOs(): Promise<void> {
    for (const [name, definition] of this.sloDefinitions) {
      try {
        await this.evaluateSLO(name, definition);
      } catch (error) {
        this.logger.error(`Failed to evaluate SLO ${name}`, error);
      }
    }
  }

  private async evaluateSLO(
    name: string,
    definition: SLODefinition,
  ): Promise<void> {
    // Calculate current SLI
    const currentSLI = await this.calculateSLI(definition.sli);

    // Get existing status
    const status = this.sloStatuses.get(name)!;
    status.currentSLI = currentSLI;
    status.lastUpdated = new Date();

    // Evaluate each objective
    for (let i = 0; i < definition.objectives.length; i++) {
      const objective = definition.objectives[i];
      const objectiveStatus = status.objectives[i];

      // Calculate compliance over the window
      const compliance = await this.calculateCompliance(
        definition.sli,
        objective,
      );
      objectiveStatus.current = compliance;
      objectiveStatus.compliance = (compliance / objective.target) * 100;

      // Determine status
      if (compliance >= objective.target) {
        objectiveStatus.status = "ok";
      } else if (compliance >= objective.target * 0.95) {
        objectiveStatus.status = "warning";
      } else {
        objectiveStatus.status = "breached";
      }
    }

    // Calculate error budget
    await this.calculateErrorBudget(status, definition);

    // Determine overall SLO status
    status.status = this.determineSLOStatus(status);

    // Check for alerts
    await this.checkAlerts(name, definition, status);

    // Emit status update event
    this.eventEmitter.emit("slo.evaluated", {
      name,
      status,
      definition,
    });

    // Update metrics
    this.updateSLOMetrics(name, status);
  }

  private async calculateSLI(sli: SLIDefinition): Promise<number> {
    try {
      const goodEvents = await this.metricsService.query(sli.goodEventQuery);
      const totalEvents = await this.metricsService.query(sli.totalEventQuery);

      const goodValue = this.extractScalarValue(goodEvents);
      const totalValue = this.extractScalarValue(totalEvents);

      if (totalValue === 0) return 1; // No events means 100% SLI
      return goodValue / totalValue;
    } catch (error) {
      this.logger.error("Failed to calculate SLI", error);
      return 0;
    }
  }

  private async calculateCompliance(
    sli: SLIDefinition,
    objective: SLOObjective,
  ): Promise<number> {
    try {
      // Query over the objective window
      const windowQuery = this.buildWindowQuery(sli, objective.window);
      const result = await this.metricsService.query(windowQuery);
      return this.extractScalarValue(result);
    } catch (error) {
      this.logger.error("Failed to calculate compliance", error);
      return 0;
    }
  }

  private buildWindowQuery(sli: SLIDefinition, window: string): string {
    // Build Prometheus query for the specific window
    const goodQuery = sli.goodEventQuery.replace("[5m]", `[${window}]`);
    const totalQuery = sli.totalEventQuery.replace("[5m]", `[${window}]`);

    return `(${goodQuery}) / (${totalQuery})`;
  }

  private async calculateErrorBudget(
    status: SLOStatus,
    definition: SLODefinition,
  ): Promise<void> {
    // Calculate error budget for the primary objective (first one)
    const primaryObjective = definition.objectives[0];
    const primaryStatus = status.objectives[0];

    const targetReliability = primaryObjective.target;
    const currentReliability = primaryStatus.current;

    const allowedErrorRate = 1 - targetReliability;
    const currentErrorRate = 1 - currentReliability;

    const budgetConsumed = Math.min(
      100,
      (currentErrorRate / allowedErrorRate) * 100,
    );
    const budgetRemaining = Math.max(0, 100 - budgetConsumed);

    // Calculate burn rate
    const burnRate = currentErrorRate / allowedErrorRate;

    status.errorBudget = {
      remaining: budgetRemaining,
      consumed: budgetConsumed,
      burnRate,
    };
  }

  private determineSLOStatus(
    status: SLOStatus,
  ): "healthy" | "warning" | "critical" {
    const hasBreachedObjectives = status.objectives.some(
      (obj) => obj.status === "breached",
    );
    const hasWarningObjectives = status.objectives.some(
      (obj) => obj.status === "warning",
    );

    if (hasBreachedObjectives || status.errorBudget.remaining < 10) {
      return "critical";
    } else if (hasWarningObjectives || status.errorBudget.remaining < 25) {
      return "warning";
    }

    return "healthy";
  }

  private async checkAlerts(
    name: string,
    definition: SLODefinition,
    status: SLOStatus,
  ): Promise<void> {
    const alertKey = `slo_${name}`;
    const currentState = this.alertStates.get(alertKey) || {
      firing: false,
      lastAlert: null,
    };

    // Check if we should fire an alert
    const shouldAlert = this.shouldFireAlert(definition, status);

    if (shouldAlert && !currentState.firing) {
      // Fire new alert
      await this.fireAlert(name, definition, status);
      currentState.firing = true;
      currentState.lastAlert = new Date();

      this.logger.warn(`SLO alert fired: ${name}`);
    } else if (!shouldAlert && currentState.firing) {
      // Resolve alert
      await this.resolveAlert(name, definition, status);
      currentState.firing = false;

      this.logger.log(`SLO alert resolved: ${name}`);
    }

    this.alertStates.set(alertKey, currentState);
  }

  private shouldFireAlert(
    definition: SLODefinition,
    status: SLOStatus,
  ): boolean {
    // Check burn rate threshold
    if (
      status.errorBudget.burnRate > definition.alertPolicy.burnRateThreshold
    ) {
      return true;
    }

    // Check for critical objective breaches
    const hasCriticalBreach = definition.objectives.some(
      (obj, i) =>
        obj.severity === "critical" &&
        status.objectives[i].status === "breached",
    );

    return hasCriticalBreach;
  }

  private async fireAlert(
    name: string,
    definition: SLODefinition,
    status: SLOStatus,
  ): Promise<void> {
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

    // Send to configured channels
    for (const channel of definition.alertPolicy.alertChannels) {
      await this.alertingService.sendAlert(channel, alert);
    }

    // Emit alert event
    this.eventEmitter.emit("slo.alert.fired", {
      sloName: name,
      alert,
      definition,
      status,
    });
  }

  private async resolveAlert(
    name: string,
    definition: SLODefinition,
    status: SLOStatus,
  ): Promise<void> {
    const alert = {
      title: `SLO Recovered: ${definition.description}`,
      message: `SLO ${name} has recovered. Error budget remaining: ${status.errorBudget.remaining.toFixed(2)}%`,
      severity: "info" as const,
      service: definition.service,
      tags: definition.tags,
    };

    // Send to configured channels
    for (const channel of definition.alertPolicy.alertChannels) {
      await this.alertingService.resolveAlert(channel, alert);
    }

    // Emit resolution event
    this.eventEmitter.emit("slo.alert.resolved", {
      sloName: name,
      alert,
      definition,
      status,
    });
  }

  private buildAlertMessage(
    definition: SLODefinition,
    status: SLOStatus,
  ): string {
    const breachedObjectives = definition.objectives.filter(
      (obj, i) => status.objectives[i].status === "breached",
    );

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

  private getAlertSeverity(
    definition: SLODefinition,
    status: SLOStatus,
  ): "critical" | "warning" | "info" {
    const hasCriticalBreach = definition.objectives.some(
      (obj, i) =>
        obj.severity === "critical" &&
        status.objectives[i].status === "breached",
    );

    if (hasCriticalBreach || status.errorBudget.remaining < 5) {
      return "critical";
    } else if (status.errorBudget.remaining < 20) {
      return "warning";
    }

    return "info";
  }

  private updateSLOMetrics(name: string, status: SLOStatus): void {
    // Update Prometheus metrics
    this.metricsService.setGauge(
      "n8n_work_slo_current_sli",
      status.currentSLI,
      { slo: name },
    );
    this.metricsService.setGauge(
      "n8n_work_slo_error_budget_remaining",
      status.errorBudget.remaining,
      { slo: name },
    );
    this.metricsService.setGauge(
      "n8n_work_slo_burn_rate",
      status.errorBudget.burnRate,
      { slo: name },
    );

    for (let i = 0; i < status.objectives.length; i++) {
      const objective = status.objectives[i];
      this.metricsService.setGauge(
        "n8n_work_slo_objective_compliance",
        objective.compliance,
        {
          slo: name,
          objective: objective.displayName,
        },
      );
    }

    // Status as numeric
    const statusValue =
      status.status === "healthy" ? 1 : status.status === "warning" ? 0.5 : 0;
    this.metricsService.setGauge("n8n_work_slo_status", statusValue, {
      slo: name,
    });
  }

  private extractScalarValue(queryResult: any): number {
    // Extract scalar value from Prometheus query result
    if (queryResult?.data?.result?.[0]?.value?.[1]) {
      return parseFloat(queryResult.data.result[0].value[1]);
    }
    return 0;
  }

  // Public API methods
  getSLOStatus(name: string): SLOStatus | undefined {
    return this.sloStatuses.get(name);
  }

  getAllSLOStatuses(): SLOStatus[] {
    return Array.from(this.sloStatuses.values());
  }

  getSLODefinition(name: string): SLODefinition | undefined {
    return this.sloDefinitions.get(name);
  }

  async generateSLOReport(timeRange: string = "30d"): Promise<SLOReport> {
    const report: SLOReport = {
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
      // Count by status
      if (status.status === "healthy") report.summary.healthySLOs++;
      else if (status.status === "warning") report.summary.warningSLOs++;
      else report.summary.criticalSLOs++;

      // Add to detailed list
      report.slos.push({
        name: status.name,
        status: status.status,
        currentSLI: status.currentSLI,
        errorBudgetRemaining: status.errorBudget.remaining,
        objectives: status.objectives.map((obj) => ({
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
}

interface AlertState {
  firing: boolean;
  lastAlert: Date | null;
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
