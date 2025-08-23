import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';

@Module({
  controllers: [WebhooksController],
  providers: [],
  exports: [],
})
export class WebhooksModule {}
