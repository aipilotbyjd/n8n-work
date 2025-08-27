
import { Module } from '@nestjs/common';
import { NestEngineService } from './nest-engine.service';
import { NestEngineController } from './nest-engine.controller';

@Module({
  providers: [NestEngineService],
  controllers: [NestEngineController],
  exports: [NestEngineService],
})
export class NestEngineModule {}
