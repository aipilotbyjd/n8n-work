import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './entities/tenant.entity';
import { TenantService } from './tenants.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant])],
  controllers: [],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantsModule {}
