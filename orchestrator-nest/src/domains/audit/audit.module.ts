import { Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';

@Module({
  controllers: [],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditModule {}
