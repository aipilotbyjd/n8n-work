import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { MarketplaceController } from "./marketplace.controller";
import { MarketplaceService } from "./marketplace.service";
import { MarketplaceItem } from "./entities/marketplace-item.entity";
import { MarketplaceReview } from "./entities/marketplace-review.entity";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([MarketplaceItem, MarketplaceReview]),
    EventEmitterModule,
    AuditModule,
  ],
  controllers: [MarketplaceController],
  providers: [MarketplaceService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
