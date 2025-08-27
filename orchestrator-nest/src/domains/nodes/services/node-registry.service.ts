import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { NodeType } from "../entities/node-type.entity";

@Injectable()
export class NodeRegistryService {
  private readonly logger = new Logger(NodeRegistryService.name);
  private readonly registeredNodes = new Map<string, NodeType>();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async registerNode(node: NodeType): Promise<void> {
    this.logger.log(`Registering node: ${node.name}`);

    this.registeredNodes.set(node.name, node);

    this.eventEmitter.emit("node.registered", {
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.nodeType,
    });
  }

  async unregisterNode(nodeName: string): Promise<void> {
    this.logger.log(`Unregistering node: ${nodeName}`);

    this.registeredNodes.delete(nodeName);

    this.eventEmitter.emit("node.unregistered", {
      nodeName,
    });
  }

  getRegisteredNode(nodeName: string): NodeType | undefined {
    return this.registeredNodes.get(nodeName);
  }

  getAllRegisteredNodes(): NodeType[] {
    return Array.from(this.registeredNodes.values());
  }

  isNodeRegistered(nodeName: string): boolean {
    return this.registeredNodes.has(nodeName);
  }

  getNodesByCategory(category: string): NodeType[] {
    return Array.from(this.registeredNodes.values()).filter(
      (node) => node.category === category,
    );
  }

  searchNodes(query: string): NodeType[] {
    const searchTerm = query.toLowerCase();
    return Array.from(this.registeredNodes.values()).filter(
      (node) =>
        node.name.toLowerCase().includes(searchTerm) ||
        node.displayName.toLowerCase().includes(searchTerm) ||
        node.description?.toLowerCase().includes(searchTerm) ||
        node.keywords?.some((keyword) =>
          keyword.toLowerCase().includes(searchTerm),
        ),
    );
  }

  getNodeStats(): {
    totalNodes: number;
    builtInNodes: number;
    customNodes: number;
    nodesByCategory: Record<string, number>;
  } {
    const nodes = Array.from(this.registeredNodes.values());
    const builtInNodes = nodes.filter((node) => node.isBuiltIn).length;
    const customNodes = nodes.filter((node) => !node.isBuiltIn).length;

    const nodesByCategory = nodes.reduce(
      (acc, node) => {
        acc[node.category] = (acc[node.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalNodes: nodes.length,
      builtInNodes,
      customNodes,
      nodesByCategory,
    };
  }

  validateNodeDefinition(definition: any): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!definition.inputs || !Array.isArray(definition.inputs)) {
      errors.push("Node definition must have inputs array");
    }

    if (!definition.outputs || !Array.isArray(definition.outputs)) {
      errors.push("Node definition must have outputs array");
    }

    if (!definition.properties || !Array.isArray(definition.properties)) {
      errors.push("Node definition must have properties array");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
