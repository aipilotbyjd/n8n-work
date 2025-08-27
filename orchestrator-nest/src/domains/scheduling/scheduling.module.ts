import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule as NestScheduleModule } from "@nestjs/schedule";
import { SchedulingController } from "./scheduling.controller";
import { SchedulingService } from "./scheduling.service";
import { Schedule } from "./entities/schedule.entity";
import { ScheduledExecution } from "./entities/scheduled-execution.entity";
import { CronParserService } from "./services/cron-parser.service";
import { ScheduleValidationService } from "./services/schedule-validation.service";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Schedule, ScheduledExecution]),
    EventEmitterModule,
    NestScheduleModule.forRoot(),
    AuditModule,
  ],
  controllers: [SchedulingController],
  providers: [SchedulingService, CronParserService, ScheduleValidationService],
  exports: [SchedulingService, CronParserService, ScheduleValidationService],
})
export class SchedulingModule {}
