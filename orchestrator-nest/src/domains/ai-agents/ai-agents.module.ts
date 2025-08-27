import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { AiAgentsController } from "./ai-agents.controller";
import { AIAgentsService } from "./ai-agents.service";
import { AIAgent } from "./entities/ai-agent.entity";
import { AIAgentExecution } from "./entities/ai-agent-execution.entity";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([AIAgent, AIAgentExecution]),
    EventEmitterModule,
    AuditModule,
  ],
  controllers: [AiAgentsController],
  providers: [AIAgentsService],
  exports: [AIAgentsService],
})
export class AiAgentsModule {}
