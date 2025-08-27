import { Injectable, Logger } from "@nestjs/common";
import { IExecutionEngine } from "../execution-engine/interfaces/execution-engine.interface";

@Injectable()
export class NestEngineService implements IExecutionEngine {
  private readonly logger = new Logger(NestEngineService.name);

  async execute(
    workflowId: string,
    executionId: string,
    payload: any,
  ): Promise<void> {
    this.logger.log(
      `Executing workflow ${workflowId} (Execution ID: ${executionId}) with Nest Engine`,
    );
    // Simulate actual workflow execution
    await new Promise((resolve) => setTimeout(resolve, 1000));
    this.logger.log(
      `Nest Engine simulated execution for workflow ${workflowId} completed.`,
    );
  }
}
