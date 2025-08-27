import { Module } from "@nestjs/common";
import { NestEngineService } from "../nest-engine/nest-engine.service";
import { ExecutionEngineFactory } from "./execution-engine.factory";

@Module({
  providers: [NestEngineService, ExecutionEngineFactory],
  exports: [ExecutionEngineFactory],
})
export class ExecutionEngineModule {}
