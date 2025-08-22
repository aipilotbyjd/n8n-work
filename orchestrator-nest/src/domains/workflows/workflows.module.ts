import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workflow } from './entities/workflow.entity';
import { WorkflowsService } from './workflows.service';
import { WorkflowCompilerService } from './workflow-compiler.service';
import { WorkflowValidationService } from './workflow-validation.service';

@Module({
  imports: [TypeOrmModule.forFeature([Workflow])],
  controllers: [],
  providers: [
    WorkflowsService,
    WorkflowCompilerService,
    WorkflowValidationService,
  ],
  exports: [
    WorkflowsService,
    WorkflowCompilerService,
    WorkflowValidationService,
  ],
})
export class WorkflowsModule {}
