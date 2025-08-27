import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Patch,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { ExecutionEngineService } from "./execution-engine.service";
import { CreateExecutionEngineDto } from "./dto/create-execution-engine.dto";
import { UpdateExecutionEngineDto } from "./dto/update-execution-engine.dto";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Execution } from "./entities/execution-engine.entity";

@ApiTags("Execution Engine")
@Controller("execution-engine")
@ApiBearerAuth()
export class ExecutionEngineController {
  constructor(
    private readonly executionEngineService: ExecutionEngineService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a new execution" })
  @ApiResponse({
    status: 201,
    description: "The execution has been successfully created.",
    type: Execution,
  })
  create(
    @Body() createExecutionEngineDto: CreateExecutionEngineDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Execution> {
    return this.executionEngineService.create(createExecutionEngineDto, user);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get an execution by ID" })
  @ApiResponse({ status: 200, description: "The execution.", type: Execution })
  findOne(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<Execution> {
    return this.executionEngineService.findOne(id, user);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update an execution" })
  @ApiResponse({
    status: 200,
    description: "The updated execution.",
    type: Execution,
  })
  update(
    @Param("id") id: string,
    @Body() updateExecutionEngineDto: UpdateExecutionEngineDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Execution> {
    return this.executionEngineService.update(
      id,
      updateExecutionEngineDto,
      user,
    );
  }
}
