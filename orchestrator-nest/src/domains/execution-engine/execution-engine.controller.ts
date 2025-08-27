import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { ExecutionEngineService } from './execution-engine.service';
import { CreateExecutionEngineDto } from './dto/create-execution-engine.dto';
import { UpdateExecutionEngineDto } from './dto/update-execution-engine.dto';
import { Execution } from './entities/execution-engine.entity';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { GetCurrentUser } from '../auth/decorators/get-current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Execution Engine')
@Controller('execution-engine')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
export class ExecutionEngineController {
  constructor(private readonly executionEngineService: ExecutionEngineService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new execution' })
  @ApiResponse({
    status: 201,
    description: 'The execution has been successfully created.',
    type: Execution,
  })
  create(
    @Body() createExecutionEngineDto: CreateExecutionEngineDto,
    @GetCurrentUser() user: AuthUser,
  ): Promise<Execution> {
    return this.executionEngineService.create(createExecutionEngineDto, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an execution by ID' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'The execution.', type: Execution })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @GetCurrentUser() user: AuthUser,
  ): Promise<Execution> {
    return this.executionEngineService.findOne(id, user);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an execution' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'The updated execution.', type: Execution })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateExecutionEngineDto: UpdateExecutionEngineDto,
    @GetCurrentUser() user: AuthUser,
  ): Promise<Execution> {
    return this.executionEngineService.update(id, updateExecutionEngineDto, user);
  }
}