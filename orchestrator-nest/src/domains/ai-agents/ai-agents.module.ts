import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AIAgentsController } from './ai-agents.controller';
import { AIAgentsService } from './ai-agents.service';
import { AIAgent } from './entities/ai-agent.entity';
import { AIAgentExecution } from './entities/ai-agent-execution.entity';
import { AIGatewayService } from './services/ai-gateway.service';
import { ModelManagerService } from './services/model-manager.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AIAgent, AIAgentExecution]),
    AuditModule,
  ],
  controllers: [AIAgentsController],
  providers: [AIAgentsService, AIGatewayService, ModelManagerService],
  exports: [AIAgentsService],
})
export class AiAgentsModule {}