import { Logger } from 'pino';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface NodeDefinition {
  type: string;
  displayName: string;
  description: string;
  version: number;
  defaults: Record<string, any>;
  inputs: number;
  outputs: number;
  icon: string;
  group: string[];
  properties: NodeProperty[];
  credentials?: CredentialReference[];
  webhooks?: WebhookDefinition[];
  execute: NodeExecuteFunction;
}

export interface NodeProperty {
  displayName: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'collection' | 'options' | 'json';
  default: any;
  required?: boolean;
  description?: string;
  options?: Array<{ name: string; value: any; description?: string }>;
  displayOptions?: {
    show?: Record<string, any[]>;
    hide?: Record<string, any[]>;
  };
}

export interface CredentialReference {
  name: string;
  required?: boolean;
}

export interface WebhookDefinition {
  name: string;
  httpMethod: string;
  path: string;
  responseMode?: 'onReceived' | 'lastNode';
}

export interface NodeExecuteContext {
  inputData: any[];
  parameters: Record<string, any>;
  credentials?: Record<string, any>;
  workflowId?: string;
  executionId?: string;
  nodeId?: string;
  logger: Logger;
}

export type NodeExecuteFunction = (context: NodeExecuteContext) => Promise<any[]>;

export interface NodeManifest {
  signature?: string;
  publisher?: string;
  version: string;
  nodes: string[];
  credentials?: string[];
  dependencies?: Record<string, string>;
}

export class NodeRegistry {
  private nodes = new Map<string, NodeDefinition>();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async loadBuiltInNodes(): Promise<void> {
    this.logger.info('Loading built-in nodes...');

    const nodesDir = path.join(__dirname, '..', 'nodes');
    
    try {
      // Load HTTP node
      const httpNode = await this.loadHttpNode();
      this.registerNode(httpNode);

      // Load Slack node
      const slackNode = await this.loadSlackNode();
      this.registerNode(slackNode);

      // Load webhook node
      const webhookNode = await this.loadWebhookNode();
      this.registerNode(webhookNode);

      // Load set node (data manipulation)
      const setNode = await this.loadSetNode();
      this.registerNode(setNode);

      // Load if node (conditional logic)
      const ifNode = await this.loadIfNode();
      this.registerNode(ifNode);

      this.logger.info({ nodeCount: this.nodes.size }, 'Built-in nodes loaded successfully');
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to load built-in nodes');
      throw error;
    }
  }

  private async loadHttpNode(): Promise<NodeDefinition> {
    return {
      type: 'http',
      displayName: 'HTTP Request',
      description: 'Makes HTTP requests and returns the response',
      version: 1,
      defaults: {
        name: 'HTTP Request',
      },
      inputs: 1,
      outputs: 1,
      icon: 'fa:globe',
      group: ['integration'],
      properties: [
        {
          displayName: 'Request Method',
          name: 'method',
          type: 'options',
          default: 'GET',
          required: true,
          options: [
            { name: 'GET', value: 'GET' },
            { name: 'POST', value: 'POST' },
            { name: 'PUT', value: 'PUT' },
            { name: 'DELETE', value: 'DELETE' },
            { name: 'PATCH', value: 'PATCH' },
          ],
        },
        {
          displayName: 'URL',
          name: 'url',
          type: 'string',
          default: '',
          required: true,
          description: 'The URL to make the request to',
        },
        {
          displayName: 'Headers',
          name: 'headers',
          type: 'json',
          default: '{}',
          description: 'Headers to send with the request',
        },
        {
          displayName: 'Body',
          name: 'body',
          type: 'json',
          default: '{}',
          displayOptions: {
            show: {
              method: ['POST', 'PUT', 'PATCH'],
            },
          },
          description: 'Body data to send with the request',
        },
      ],
      execute: async (context: NodeExecuteContext) => {
        const { parameters, inputData, logger } = context;
        const axios = await import('axios');
        
        try {
          const response = await axios.default({
            method: parameters.method,
            url: parameters.url,
            headers: JSON.parse(parameters.headers || '{}'),
            data: parameters.body ? JSON.parse(parameters.body) : undefined,
            timeout: 30000,
          });

          return [{
            json: {
              statusCode: response.status,
              headers: response.headers,
              body: response.data,
            },
          }];
        } catch (error) {
          logger.error({ error: error.message, url: parameters.url }, 'HTTP request failed');
          throw new Error(`HTTP request failed: ${error.message}`);
        }
      },
    };
  }

  private async loadSlackNode(): Promise<NodeDefinition> {
    return {
      type: 'slack',
      displayName: 'Slack',
      description: 'Send messages to Slack',
      version: 1,
      defaults: {
        name: 'Slack',
      },
      inputs: 1,
      outputs: 1,
      icon: 'fab:slack',
      group: ['communication'],
      properties: [
        {
          displayName: 'Webhook URL',
          name: 'webhookUrl',
          type: 'string',
          default: '',
          required: true,
          description: 'Slack webhook URL',
        },
        {
          displayName: 'Channel',
          name: 'channel',
          type: 'string',
          default: '#general',
          description: 'Channel or user to send message to',
        },
        {
          displayName: 'Message',
          name: 'text',
          type: 'string',
          default: '',
          required: true,
          description: 'Message to send',
        },
        {
          displayName: 'Username',
          name: 'username',
          type: 'string',
          default: 'N8N-Work Bot',
          description: 'Username to display as sender',
        },
      ],
      execute: async (context: NodeExecuteContext) => {
        const { parameters, inputData, logger } = context;
        const axios = await import('axios');

        try {
          const payload = {
            channel: parameters.channel,
            text: parameters.text,
            username: parameters.username,
          };

          const response = await axios.default.post(parameters.webhookUrl, payload);

          return [{
            json: {
              success: true,
              response: response.data,
            },
          }];
        } catch (error) {
          logger.error({ error: error.message }, 'Slack message failed');
          throw new Error(`Slack message failed: ${error.message}`);
        }
      },
    };
  }

  private async loadWebhookNode(): Promise<NodeDefinition> {
    return {
      type: 'webhook',
      displayName: 'Webhook',
      description: 'Receives webhook requests',
      version: 1,
      defaults: {
        name: 'Webhook',
      },
      inputs: 0,
      outputs: 1,
      icon: 'fa:code-branch',
      group: ['trigger'],
      properties: [
        {
          displayName: 'HTTP Method',
          name: 'httpMethod',
          type: 'options',
          default: 'POST',
          options: [
            { name: 'GET', value: 'GET' },
            { name: 'POST', value: 'POST' },
            { name: 'PUT', value: 'PUT' },
            { name: 'DELETE', value: 'DELETE' },
          ],
        },
        {
          displayName: 'Path',
          name: 'path',
          type: 'string',
          default: 'webhook',
          description: 'Webhook path (will be added to base URL)',
        },
      ],
      webhooks: [
        {
          name: 'default',
          httpMethod: '={{$parameter["httpMethod"]}}',
          path: '={{$parameter["path"]}}',
          responseMode: 'onReceived',
        },
      ],
      execute: async (context: NodeExecuteContext) => {
        // Webhook nodes typically don't execute directly
        // They are triggered by incoming HTTP requests
        return context.inputData || [];
      },
    };
  }

  private async loadSetNode(): Promise<NodeDefinition> {
    return {
      type: 'set',
      displayName: 'Set',
      description: 'Set values on items and optionally remove other values',
      version: 1,
      defaults: {
        name: 'Set',
      },
      inputs: 1,
      outputs: 1,
      icon: 'fa:pen',
      group: ['data'],
      properties: [
        {
          displayName: 'Keep Only Set',
          name: 'keepOnlySet',
          type: 'boolean',
          default: false,
          description: 'If only the values set on this node should be kept and all others removed',
        },
        {
          displayName: 'Values to Set',
          name: 'values',
          type: 'json',
          default: '{}',
          description: 'Values to set on the items',
        },
      ],
      execute: async (context: NodeExecuteContext) => {
        const { parameters, inputData } = context;
        const valuesToSet = JSON.parse(parameters.values || '{}');
        
        return inputData.map((item) => {
          const newItem = parameters.keepOnlySet ? {} : { ...item.json };
          
          // Set the new values
          Object.assign(newItem, valuesToSet);
          
          return { json: newItem };
        });
      },
    };
  }

  private async loadIfNode(): Promise<NodeDefinition> {
    return {
      type: 'if',
      displayName: 'IF',
      description: 'Conditional logic to route data to different paths',
      version: 1,
      defaults: {
        name: 'IF',
      },
      inputs: 1,
      outputs: 2,
      icon: 'fa:code-branch',
      group: ['logic'],
      properties: [
        {
          displayName: 'Value 1',
          name: 'value1',
          type: 'string',
          default: '',
          description: 'First value to compare',
        },
        {
          displayName: 'Operation',
          name: 'operation',
          type: 'options',
          default: 'equal',
          options: [
            { name: 'Equal', value: 'equal' },
            { name: 'Not Equal', value: 'notEqual' },
            { name: 'Contains', value: 'contains' },
            { name: 'Greater Than', value: 'greaterThan' },
            { name: 'Less Than', value: 'lessThan' },
          ],
        },
        {
          displayName: 'Value 2',
          name: 'value2',
          type: 'string',
          default: '',
          description: 'Second value to compare',
        },
      ],
      execute: async (context: NodeExecuteContext) => {
        const { parameters, inputData } = context;
        const { value1, operation, value2 } = parameters;
        
        let result = false;
        
        switch (operation) {
          case 'equal':
            result = value1 === value2;
            break;
          case 'notEqual':
            result = value1 !== value2;
            break;
          case 'contains':
            result = String(value1).includes(String(value2));
            break;
          case 'greaterThan':
            result = Number(value1) > Number(value2);
            break;
          case 'lessThan':
            result = Number(value1) < Number(value2);
            break;
        }
        
        // Return data on the appropriate output (0 = true, 1 = false)
        if (result) {
          return [inputData, []];
        } else {
          return [[], inputData];
        }
      },
    };
  }

  registerNode(node: NodeDefinition): void {
    this.logger.info({ nodeType: node.type, version: node.version }, 'Registering node');
    this.nodes.set(node.type, node);
  }

  getNode(type: string): NodeDefinition | undefined {
    return this.nodes.get(type);
  }

  getAllNodes(): NodeDefinition[] {
    return Array.from(this.nodes.values());
  }

  getNodeTypes(): string[] {
    return Array.from(this.nodes.keys());
  }

  async loadExternalNode(manifestPath: string): Promise<void> {
    try {
      const manifestContent = await fs.readFile(manifestPath, 'utf8');
      const manifest: NodeManifest = JSON.parse(manifestContent);
      
      // Implement external node loading with signature verification
      try {
        // Verify node package signature
        const isValid = await this.verifyNodeSignature(nodePath);
        if (!isValid) {
          throw new Error('Node signature verification failed');
        }
        
        // Load and register the external node
        const nodeModule = await import(nodePath);
        if (nodeModule && typeof nodeModule.default === 'function') {
          const nodeInstance = new nodeModule.default();
          this.registeredNodes.set(nodeInstance.nodeType.name, nodeInstance);
          this.logger.info(`Loaded external node: ${nodeInstance.nodeType.name}`);
        } else {
          throw new Error('Invalid node module format');
        }
      } catch (error) {
        this.logger.error(`Failed to load external node from ${nodePath}: ${error.message}`);
        throw error;
      }
      this.logger.info({ manifest }, 'Loading external node');
      
    } catch (error) {
      this.logger.error({ error: error.message, manifestPath }, 'Failed to load external node');
      throw error;
    }
  }
}
