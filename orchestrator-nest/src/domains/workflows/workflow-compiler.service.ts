import { Injectable } from '@nestjs/common';
import { Workflow } from './entities/workflow.entity';

@Injectable()
export class WorkflowCompilerService {
  compileWorkflow(workflow: Workflow): any {
    // Compile workflow to execution format
    return {
      id: workflow.id,
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings,
      compiled: true,
      compiledAt: new Date()
    };
  }

  validateCompiledWorkflow(compiled: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!compiled.nodes || compiled.nodes.length === 0) {
      errors.push('Compiled workflow must have nodes');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}