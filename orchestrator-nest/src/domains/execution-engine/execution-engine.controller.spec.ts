import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionEngineController } from './execution-engine.controller';

describe('ExecutionEngineController', () => {
  let controller: ExecutionEngineController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExecutionEngineController],
    }).compile();

    controller = module.get<ExecutionEngineController>(ExecutionEngineController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
