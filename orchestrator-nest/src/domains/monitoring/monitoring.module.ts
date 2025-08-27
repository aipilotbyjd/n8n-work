import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { MonitoringController } from "./monitoring.controller";
import { MonitoringService } from "./monitoring.service";
import { MetricsCollectorService } from "./metrics-collector.service";
import { AlertingService } from "./alerting.service";
import { HealthCheckService } from "./health-check.service";
import { SystemMetric } from "./entities/system-metric.entity";
import { Alert } from "./entities/alert.entity";
import { HealthCheck } from "./entities/health-check.entity";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([SystemMetric, Alert, HealthCheck]),
    EventEmitterModule,
    AuditModule,
  ],
  controllers: [MonitoringController],
  providers: [
    MonitoringService,
    MetricsCollectorService,
    AlertingService,
    HealthCheckService,
  ],
  exports: [
    MonitoringService,
    MetricsCollectorService,
    AlertingService,
    HealthCheckService,
  ],
})
export class MonitoringModule {}
