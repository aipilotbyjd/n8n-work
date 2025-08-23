import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NodesController } from './nodes.controller';
import { NodesService } from './nodes.service';
import { NodeType } from './entities/node-type.entity';
import { NodeVersion } from './entities/node-version.entity';
import { PluginPackage } from './entities/plugin-package.entity';
import { NodeRegistryService } from './services/node-registry.service';
import { PluginLoaderService } from './services/plugin-loader.service';
import { NodeValidationService } from './services/node-validation.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NodeType, NodeVersion, PluginPackage]),
    EventEmitterModule,
    AuditModule,
  ],
  controllers: [NodesController],
  providers: [
    NodesService,
    NodeRegistryService,
    PluginLoaderService,
    NodeValidationService,
  ],
  exports: [
    NodesService,
    NodeRegistryService,
    PluginLoaderService,
    NodeValidationService,
  ],
})
export class NodesModule {}