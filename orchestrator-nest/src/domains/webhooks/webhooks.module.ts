import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";
import { Webhook } from "./entities/webhook.entity";
import { WebhookExecution } from "./entities/webhook-execution.entity";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Webhook, WebhookExecution]),
    EventEmitterModule,
    AuditModule,
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
