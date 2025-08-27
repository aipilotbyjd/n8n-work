import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Execution } from "./entities/execution-engine.entity";
import { CreateExecutionEngineDto } from "./dto/create-execution-engine.dto";
import { UpdateExecutionEngineDto } from "./dto/update-execution-engine.dto";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";

@Injectable()
export class ExecutionEngineService {
  constructor(
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
  ) {}

  async create(
    createExecutionEngineDto: CreateExecutionEngineDto,
    user: AuthUser,
  ): Promise<Execution> {
    const execution = this.executionRepository.create({
      ...createExecutionEngineDto,
      createdBy: user.id,
      tenantId: user.tenantId,
    });

    return this.executionRepository.save(execution);
  }

  async findOne(id: string, user: AuthUser): Promise<Execution> {
    const execution = await this.executionRepository.findOne({
      where: { id, tenantId: user.tenantId },
    });

    if (!execution) {
      throw new NotFoundException(`Execution with ID "${id}" not found`);
    }

    return execution;
  }

  async update(
    id: string,
    updateExecutionEngineDto: UpdateExecutionEngineDto,
    user: AuthUser,
  ): Promise<Execution> {
    const execution = await this.findOne(id, user);

    Object.assign(execution, updateExecutionEngineDto);

    return this.executionRepository.save(execution);
  }
}
