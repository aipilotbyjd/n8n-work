import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Workflow } from './entities/workflow.entity';
import { WorkflowsService } from './workflows.service';
import { WorkflowCompilerService } from './workflow-compiler.service';
import { WorkflowValidationService } from './workflow-validation.service';
import { TenantsModule } from '../tenants/tenants.module';
import { ObservabilityModule } from '../../observability/observability.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workflow]),
    CacheModule,
    EventEmitterModule,
    TenantsModule,
    ObservabilityModule,
    AuditModule,
  ],
  controllers: [],
  providers: [
    WorkflowsService,
    WorkflowCompilerService,
    WorkflowValidationService,
  ],
  exports: [
    WorkflowsService,
    WorkflowCompilerService,
    WorkflowValidationService,
  ],
})
export class WorkflowsModule {}
