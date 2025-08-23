import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Tenant } from './entities/tenant.entity';
import { TenantService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant]),
    EventEmitterModule,
    AuditModule,
  ],
  controllers: [TenantsController],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantsModule {}
