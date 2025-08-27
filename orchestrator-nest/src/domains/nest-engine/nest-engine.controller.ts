
import { Controller, Post, Body, Logger } from '@nestjs/common';
import { NestEngineService } from './nest-engine.service';

@Controller('nest-engine')
export class NestEngineController {
  private readonly logger = new Logger(NestEngineController.name);

  constructor(private readonly nestEngineService: NestEngineService) {}

  @Post('execute')
  execute(@Body() execution: any): void {
    this.logger.log('Received execution request');
    this.nestEngineService.execute(execution);
  }
}
