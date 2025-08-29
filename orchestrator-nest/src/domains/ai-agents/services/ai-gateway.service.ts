import { Injectable } from '@nestjs/common';

@Injectable()
export class AIGatewayService {
  async cancelExecution(executionId: string): Promise<void> {
    // TODO: implement
  }

  async healthCheck(agent: any): Promise<boolean> {
    // TODO: implement
    return true;
  }

  async execute(agent: any, execution: any): Promise<any> {
    // TODO: implement
    return {
      output: {},
      metrics: {},
    };
  }
}
