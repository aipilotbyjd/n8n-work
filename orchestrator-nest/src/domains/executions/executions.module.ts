import { Module } from '@nestjs/common';
import { ExecutionsController } from './executions.controller';

@Module({
  controllers: [ExecutionsController],
  providers: [],
  exports: [],
})
export class ExecutionsModule {}
