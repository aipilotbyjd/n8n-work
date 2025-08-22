import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { AlertingService } from './alerting.service';

@Module({
  controllers: [MetricsController],
  providers: [MetricsService, AlertingService],
  exports: [MetricsService, AlertingService],
})
export class ObservabilityModule {}
