import { Injectable } from '@nestjs/common';

@Injectable()
export class ModelManagerService {
  async validateConfig(modelConfig: any): Promise<boolean> {
    // TODO: implement
    return true;
  }

  async unloadModel(agent: any): Promise<void> {
    // TODO: implement
  }

  async loadModel(agent: any): Promise<void> {
    // TODO: implement
  }
}
