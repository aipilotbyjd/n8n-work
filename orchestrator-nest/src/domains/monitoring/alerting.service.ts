import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Alert } from "./entities/alert.entity";
import { AuditLogService } from "../audit/audit-log.service";

@Injectable()
export class AlertingService {
  constructor(
    @InjectRepository(Alert)
    private alertRepository: Repository<Alert>,
    private eventEmitter: EventEmitter2,
    private auditLogService: AuditLogService,
  ) {}

  /**
   * Get alerts for tenant
   */
  async getAlerts(
    tenantId: string,
    status?: string,
    severity?: string,
    limit: number = 50,
  ): Promise<Alert[]> {
    const query = this.alertRepository
      .createQueryBuilder("alert")
      .where("alert.tenantId = :tenantId", { tenantId })
      .orderBy("alert.createdAt", "DESC")
      .limit(limit);

    if (status) {
      query.andWhere("alert.status = :status", { status });
    }

    if (severity) {
      query.andWhere("alert.severity = :severity", { severity });
    }

    return query.getMany();
  }

  /**
   * Create a new alert rule
   */
  async createAlertRule(
    tenantId: string,
    createAlertDto: any,
    userId: string,
  ): Promise<Alert> {
    const alert = this.alertRepository.create({
      tenantId,
      title: createAlertDto.title,
      description: createAlertDto.description,
      severity: createAlertDto.severity || "medium",
      status: "active",
      alertType: createAlertDto.type || "system",
      conditions: createAlertDto.conditions,
      actions: createAlertDto.actions,
      metadata: createAlertDto.metadata,
      createdBy: userId,
    });

    const savedAlert = await this.alertRepository.save(alert);

    // Emit alert rule created event
    this.eventEmitter.emit("alert.rule.created", {
      tenantId,
      alertId: savedAlert.id,
      createdBy: userId,
    });

    // Log audit event
    await this.auditLogService.log(
      "alert.rule.created",
      "alert",
      savedAlert.id,
      userId,
      { title: savedAlert.title, severity: savedAlert.severity },
    );

    return savedAlert;
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(
    tenantId: string,
    alertId: string,
    userId: string,
  ): Promise<Alert> {
    const alert = await this.alertRepository.findOne({
      where: { id: alertId, tenantId },
    });

    if (!alert) {
      throw new NotFoundException("Alert not found");
    }

    alert.status = "acknowledged";
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();

    const savedAlert = await this.alertRepository.save(alert);

    // Emit alert acknowledged event
    this.eventEmitter.emit("alert.acknowledged", {
      tenantId,
      alertId: savedAlert.id,
      acknowledgedBy: userId,
    });

    // Log audit event
    await this.auditLogService.log(
      "alert.acknowledged",
      "alert",
      savedAlert.id,
      userId,
      { title: savedAlert.title },
    );

    return savedAlert;
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(
    tenantId: string,
    alertId: string,
    userId: string,
  ): Promise<Alert> {
    const alert = await this.alertRepository.findOne({
      where: { id: alertId, tenantId },
    });

    if (!alert) {
      throw new NotFoundException("Alert not found");
    }

    alert.status = "resolved";
    alert.resolvedBy = userId;
    alert.resolvedAt = new Date();

    const savedAlert = await this.alertRepository.save(alert);

    // Emit alert resolved event
    this.eventEmitter.emit("alert.resolved", {
      tenantId,
      alertId: savedAlert.id,
      resolvedBy: userId,
    });

    // Log audit event
    await this.auditLogService.log({
      action: "alert.resolved",
      resourceType: "alert",
      resourceId: savedAlert.id,
      userId,
      tenantId,
      newValues: { title: savedAlert.title },
    });

    return savedAlert;
  }

  /**
   * Trigger an alert
   */
  async triggerAlert(
    tenantId: string,
    alertData: {
      title: string;
      description: string;
      severity: string;
      alertType: string;
      source: string;
      metadata?: any;
    },
  ): Promise<Alert> {
    const alert = this.alertRepository.create({
      tenantId,
      title: alertData.title,
      description: alertData.description,
      severity: alertData.severity,
      status: "active",
      alertType: alertData.alertType,
      source: alertData.source,
      metadata: alertData.metadata,
      triggeredAt: new Date(),
    });

    const savedAlert = await this.alertRepository.save(alert);

    // Emit alert triggered event
    this.eventEmitter.emit("alert.triggered", {
      tenantId,
      alertId: savedAlert.id,
      severity: savedAlert.severity,
      title: savedAlert.title,
    });

    return savedAlert;
  }

  /**
   * Check alert conditions and trigger alerts if needed
   */
  async checkAlertConditions(tenantId: string, metrics: any): Promise<void> {
    // Get active alert rules
    const alertRules = await this.alertRepository.find({
      where: { tenantId, status: "active" },
    });

    for (const rule of alertRules) {
      const shouldTrigger = this.evaluateAlertConditions(
        rule.conditions,
        metrics,
      );

      if (shouldTrigger) {
        await this.triggerAlert(tenantId, {
          title: `Alert: ${rule.title}`,
          description: rule.description,
          severity: rule.severity,
          alertType: rule.alertType,
          source: "system",
          metadata: { ruleId: rule.id, metrics },
        });
      }
    }
  }

  /**
   * Evaluate alert conditions against metrics
   */
  private evaluateAlertConditions(conditions: any, metrics: any): boolean {
    if (!conditions || !metrics) return false;

    // Simple condition evaluation - can be extended
    for (const condition of conditions) {
      const { metric, operator, threshold } = condition;
      const value = this.getMetricValue(metrics, metric);

      switch (operator) {
        case "gt":
          if (value <= threshold) return false;
          break;
        case "gte":
          if (value < threshold) return false;
          break;
        case "lt":
          if (value >= threshold) return false;
          break;
        case "lte":
          if (value > threshold) return false;
          break;
        case "eq":
          if (value !== threshold) return false;
          break;
        case "ne":
          if (value === threshold) return false;
          break;
        default:
          return false;
      }
    }

    return true;
  }

  /**
   * Get metric value from metrics object
   */
  private getMetricValue(metrics: any, metricPath: string): number {
    return metricPath.split(".").reduce((obj, key) => obj?.[key], metrics) || 0;
  }

  /**
   * Get alert summary for dashboard
   */
  async getAlertSummary(tenantId: string): Promise<any> {
    const alerts = await this.alertRepository.find({
      where: { tenantId },
      order: { createdAt: "DESC" },
    });

    return {
      total: alerts.length,
      active: alerts.filter((a) => a.status === "active").length,
      acknowledged: alerts.filter((a) => a.status === "acknowledged").length,
      resolved: alerts.filter((a) => a.status === "resolved").length,
      bySeverity: {
        critical: alerts.filter((a) => a.severity === "critical").length,
        high: alerts.filter((a) => a.severity === "high").length,
        medium: alerts.filter((a) => a.severity === "medium").length,
        low: alerts.filter((a) => a.severity === "low").length,
      },
      recent: alerts.slice(0, 5),
    };
  }
}
