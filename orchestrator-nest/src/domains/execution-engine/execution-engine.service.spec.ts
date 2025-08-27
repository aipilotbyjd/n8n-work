import { Test, TestingModule } from "@nestjs/testing";
import { ExecutionEngineService } from "./execution-engine.service";

describe("ExecutionEngineService", () => {
  let service: ExecutionEngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExecutionEngineService],
    }).compile();

    service = module.get<ExecutionEngineService>(ExecutionEngineService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
