import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { Subscription } from "./entities/subscription.entity";
import { Invoice } from "./entities/invoice.entity";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, Invoice]),
    EventEmitterModule,
    AuditModule,
  ],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
