import { Injectable } from '@nestjs/common';
import { CreateWorkflowDto } from './dto/create-workflow.dto';

@Injectable()
export class WorkflowValidationService {
  validateWorkflow(workflow: CreateWorkflowDto): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validation
    if (!workflow.nodes || workflow.nodes.length === 0) {
      errors.push('Workflow must have at least one node');
    }

    // Validate node connections
    if (workflow.connections) {
      for (const connection of workflow.connections) {
        const sourceExists = workflow.nodes.some(node => node.id === connection.sourceNodeId);
        const targetExists = workflow.nodes.some(node => node.id === connection.targetNodeId);

        if (!sourceExists) {
          errors.push(`Source node ${connection.sourceNodeId} not found`);
        }
        if (!targetExists) {
          errors.push(`Target node ${connection.targetNodeId} not found`);
        }
      }
    }

    // Check for circular dependencies
    if (this.hasCircularDependency(workflow.nodes, workflow.connections)) {
      errors.push('Workflow contains circular dependencies');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private hasCircularDependency(nodes: any[], connections: any[]): boolean {
    // Simple cycle detection using DFS
    const graph = new Map<string, string[]>();
    
    // Build adjacency list
    for (const node of nodes) {
      graph.set(node.id, []);
    }
    
    for (const connection of connections) {
      const targets = graph.get(connection.sourceNodeId) || [];
      targets.push(connection.targetNodeId);
      graph.set(connection.sourceNodeId, targets);
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) {
        return true;
      }
      if (visited.has(nodeId)) {
        return false;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = graph.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (hasCycle(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of graph.keys()) {
      if (hasCycle(nodeId)) {
        return true;
      }
    }

    return false;
  }
}