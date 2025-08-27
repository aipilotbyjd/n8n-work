import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogService } from "./audit-log.service";
import { AuditLogEntry } from "./audit-log.entity";

@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntry])],
  controllers: [],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditModule {}
