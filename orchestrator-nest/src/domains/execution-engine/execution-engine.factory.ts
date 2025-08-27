import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IExecutionEngine } from "./interfaces/execution-engine.interface";
import { NestEngineService } from "../nest-engine/nest-engine.service";

@Injectable()
export class ExecutionEngineFactory {
  private readonly logger = new Logger(ExecutionEngineFactory.name);

  constructor(private readonly nestEngineService: NestEngineService) {}

  getEngine(): IExecutionEngine {
    this.logger.log(`Using execution engine: nest`);
    return this.nestEngineService;
  }
}
