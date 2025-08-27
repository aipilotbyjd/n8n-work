import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Execution } from './entities/execution-engine.entity';
import { ExecutionEngineController } from './execution-engine.controller';
import { ExecutionEngineService } from './execution-engine.service';

@Module({
  imports: [TypeOrmModule.forFeature([Execution])],
  controllers: [ExecutionEngineController],
  providers: [ExecutionEngineService],
})
export class ExecutionEngineModule {}
