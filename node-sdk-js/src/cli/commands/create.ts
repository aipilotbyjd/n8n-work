import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import Mustache from 'mustache';
import { sanitizeFileName } from '@/utils';

interface CreateNodeOptions {
  type: 'action' | 'trigger' | 'webhook';
  description?: string;
  output: string;
}

const nodeTemplates = {
  action: `import {
  INodeType,
  IExecutionContext,
  IWorkflowData,
  INodeExecutionData,
  NodeBase,
} from '@n8n-work/node-sdk';

export class {{className}} extends NodeBase {
  nodeType: INodeType = {
    name: '{{nodeName}}',
    displayName: '{{displayName}}',
    description: '{{description}}',
    version: 1,
    group: 'action',
    defaults: {
      name: '{{displayName}}',
      color: '#772244',
    },
    inputs: [
      {
        type: 'main',
        displayName: 'Input',
      },
    ],
    outputs: [
      {
        type: 'main',
        displayName: 'Output',
      },
    ],
    properties: [
      {
        name: 'message',
        displayName: 'Message',
        type: 'string',
        default: 'Hello World!',
        placeholder: 'Enter your message...',
        description: 'The message to process',
        required: true,
      },
    ],
  };

  async execute(
    context: IExecutionContext,
    data: IWorkflowData
  ): Promise<INodeExecutionData[]> {
    const message = this.getParameter<string>(data.parameters, 'message', '');
    
    this.validateRequiredParameters(data.parameters, ['message']);

    const results: INodeExecutionData[] = [];

    for (const item of data.inputData) {
      const processedMessage = this.interpolate(message, item.json);
      
      results.push(
        this.createExecutionData({
          ...item.json,
          processedMessage,
          timestamp: new Date().toISOString(),
        })
      );
    }

    return results;
  }
}`,

  trigger: `import {
  INodeType,
  IExecutionContext,
  IWorkflowData,
  INodeExecutionData,
  TriggerNode,
} from '@n8n-work/node-sdk';

export class {{className}} extends TriggerNode {
  nodeType: INodeType = {
    name: '{{nodeName}}',
    displayName: '{{displayName}}',
    description: '{{description}}',
    version: 1,
    group: 'trigger',
    defaults: {
      name: '{{displayName}}',
      color: '#227744',
    },
    inputs: [],
    outputs: [
      {
        type: 'main',
        displayName: 'Output',
      },
    ],
    properties: [
      {
        name: 'interval',
        displayName: 'Polling Interval (minutes)',
        type: 'number',
        default: 5,
        description: 'How often to check for new data',
        required: true,
        typeOptions: {
          minValue: 1,
          maxValue: 1440,
        },
      },
    ],
    polling: {
      default: 5,
      min: 1,
      max: 1440,
    },
  };

  async poll(
    context: IExecutionContext,
    data: IWorkflowData
  ): Promise<INodeExecutionData[]> {
    const interval = this.getParameter<number>(data.parameters, 'interval', 5);

    // TODO: Implement your polling logic here
    // This is a basic example that returns static data
    
    const results: INodeExecutionData[] = [
      this.createExecutionData({
        triggerTime: new Date().toISOString(),
        interval,
        source: '{{nodeName}}',
      }),
    ];

    return results;
  }
}`,

  webhook: `import {
  INodeType,
  IExecutionContext,
  IWorkflowData,
  INodeExecutionData,
  TriggerNode,
} from '@n8n-work/node-sdk';

export class {{className}} extends TriggerNode {
  nodeType: INodeType = {
    name: '{{nodeName}}',
    displayName: '{{displayName}}',
    description: '{{description}}',
    version: 1,
    group: 'trigger',
    defaults: {
      name: '{{displayName}}',
      color: '#447722',
    },
    inputs: [],
    outputs: [
      {
        type: 'main',
        displayName: 'Output',
      },
    ],
    properties: [
      {
        name: 'path',
        displayName: 'Webhook Path',
        type: 'string',
        default: '',
        placeholder: '/webhook/{{nodeName}}',
        description: 'The path for the webhook URL',
      },
      {
        name: 'httpMethod',
        displayName: 'HTTP Method',
        type: 'select',
        default: 'POST',
        options: [
          { name: 'GET', value: 'GET' },
          { name: 'POST', value: 'POST' },
          { name: 'PUT', value: 'PUT' },
          { name: 'DELETE', value: 'DELETE' },
          { name: 'PATCH', value: 'PATCH' },
        ],
        description: 'The HTTP method to accept',
        required: true,
      },
    ],
    webhooks: [
      {
        name: 'default',
        httpMethod: '*',
        responseMode: 'onReceived',
      },
    ],
  };

  async poll(
    context: IExecutionContext,
    data: IWorkflowData
  ): Promise<INodeExecutionData[]> {
    // Webhooks don't use polling
    return [];
  }

  async webhook(
    context: IExecutionContext,
    data: IWorkflowData
  ): Promise<INodeExecutionData[]> {
    const path = this.getParameter<string>(data.parameters, 'path', '');
    const httpMethod = this.getParameter<string>(data.parameters, 'httpMethod', 'POST');

    // TODO: Process webhook payload
    // The webhook payload would be available in data.inputData
    
    const results: INodeExecutionData[] = [];

    for (const item of data.inputData) {
      results.push(
        this.createExecutionData({
          ...item.json,
          webhookPath: path,
          method: httpMethod,
          receivedAt: new Date().toISOString(),
        })
      );
    }

    return results;
  }
}`,
};

const testTemplate = `import { {{className}} } from '../{{fileName}}';
import {
  IExecutionContext,
  IWorkflowData,
  INodeExecutionData,
} from '@n8n-work/node-sdk';

describe('{{className}}', () => {
  let node: {{className}};
  let mockContext: IExecutionContext;

  beforeEach(() => {
    node = new {{className}}();
    mockContext = {
      executionId: 'test-execution-id',
      workflowId: 'test-workflow-id',
      stepId: 'test-step-id',
      mode: 'test',
      timestamp: new Date(),
    };
  });

  it('should execute successfully with valid parameters', async () => {
    const data: IWorkflowData = {
      inputData: [
        {
          json: {
            testData: 'test value',
          },
        },
      ],
      parameters: {
        {{#isAction}}
        message: 'Test message: {{testData}}',
        {{/isAction}}
        {{#isTrigger}}
        interval: 5,
        {{/isTrigger}}
        {{#isWebhook}}
        path: '/test-webhook',
        httpMethod: 'POST',
        {{/isWebhook}}
      },
    };

    {{#isAction}}
    const result = await node.execute(mockContext, data);
    {{/isAction}}
    {{#isTrigger}}
    const result = await node.poll(mockContext, data);
    {{/isTrigger}}
    {{#isWebhook}}
    const result = await node.webhook(mockContext, data);
    {{/isWebhook}}

    expect(result).toHaveLength(1);
    expect(result[0].json).toBeDefined();
    {{#isAction}}
    expect(result[0].json.processedMessage).toBe('Test message: test value');
    {{/isAction}}
  });

  it('should handle empty input data', async () => {
    const data: IWorkflowData = {
      inputData: [],
      parameters: {
        {{#isAction}}
        message: 'Test message',
        {{/isAction}}
        {{#isTrigger}}
        interval: 5,
        {{/isTrigger}}
        {{#isWebhook}}
        path: '/test-webhook',
        httpMethod: 'POST',
        {{/isWebhook}}
      },
    };

    {{#isAction}}
    const result = await node.execute(mockContext, data);
    expect(result).toHaveLength(0);
    {{/isAction}}
    {{#isTrigger}}
    const result = await node.poll(mockContext, data);
    expect(result).toHaveLength(1);
    {{/isTrigger}}
    {{#isWebhook}}
    const result = await node.webhook(mockContext, data);
    expect(result).toHaveLength(0);
    {{/isWebhook}}
  });

  {{#isAction}}
  it('should throw error for missing required parameters', async () => {
    const data: IWorkflowData = {
      inputData: [{ json: {} }],
      parameters: {},
    };

    await expect(node.execute(mockContext, data)).rejects.toThrow(
      'Missing required parameters: message'
    );
  });
  {{/isAction}}
});`;

export async function createNode(name: string, options: CreateNodeOptions): Promise<void> {
  const spinner = ora('Creating node...').start();

  try {
    // Validate node name
    if (!name || !/^[a-zA-Z][a-zA-Z0-9-]*$/.test(name)) {
      throw new Error('Node name must start with a letter and contain only letters, numbers, and hyphens');
    }

    // Generate file names
    const className = name
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
    
    const fileName = sanitizeFileName(name);
    const nodeName = name.toLowerCase();
    const displayName = name
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

    // Ensure output directory exists
    await fs.mkdir(options.output, { recursive: true });

    const nodeFilePath = path.join(options.output, `${fileName}.ts`);
    const testFilePath = path.join(options.output, `${fileName}.test.ts`);

    // Check if files already exist
    try {
      await fs.access(nodeFilePath);
      throw new Error(`Node file already exists: ${nodeFilePath}`);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Prepare template data
    const templateData = {
      className,
      fileName,
      nodeName,
      displayName,
      description: options.description || `${displayName} node for N8N-Work`,
      isAction: options.type === 'action',
      isTrigger: options.type === 'trigger',
      isWebhook: options.type === 'webhook',
    };

    // Generate node file
    const nodeTemplate = nodeTemplates[options.type];
    const nodeContent = Mustache.render(nodeTemplate, templateData);
    await fs.writeFile(nodeFilePath, nodeContent, 'utf8');

    // Generate test file
    const testContent = Mustache.render(testTemplate, templateData);
    await fs.writeFile(testFilePath, testContent, 'utf8');

    spinner.succeed('Node created successfully!');

    console.log(chalk.green('\\n✓ Created files:'));
    console.log(chalk.gray(`  ${nodeFilePath}`));
    console.log(chalk.gray(`  ${testFilePath}`));

    console.log(chalk.blue('\\n📖 Next steps:'));
    console.log('  1. Implement your node logic in the execute/poll/webhook method');
    console.log('  2. Update the node properties to match your requirements');
    console.log('  3. Run tests with: n8n-work test');
    console.log('  4. Build with: n8n-work build');

  } catch (error) {
    spinner.fail('Failed to create node');
    throw error;
  }
}
