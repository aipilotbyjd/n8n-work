import { promises as fs } from 'fs';
import path from 'path';
import Mustache from 'mustache';
import { glob } from 'glob';
import chalk from 'chalk';
import ora from 'ora';

export interface NodeTemplateConfig {
  name: string;
  type: 'action' | 'trigger' | 'webhook' | 'credential';
  description: string;
  author: string;
  category: string;
  version: string;
  features: {
    hasCredentials: boolean;
    hasWebhook: boolean;
    hasPolling: boolean;
    hasParameters: boolean;
    hasOutputs: boolean;
    supportsMultipleItems: boolean;
  };
  parameters?: ParameterConfig[];
  credentials?: CredentialConfig[];
  outputs?: OutputConfig[];
}

export interface ParameterConfig {
  name: string;
  displayName: string;
  type: 'string' | 'number' | 'boolean' | 'options' | 'collection' | 'fixedCollection';
  required: boolean;
  default?: any;
  description: string;
  options?: Array<{ name: string; value: any; description?: string }>;
  placeholder?: string;
  validation?: ValidationConfig;
}

export interface CredentialConfig {
  name: string;
  displayName: string;
  properties: Array<{
    name: string;
    displayName: string;
    type: 'string' | 'password' | 'hidden';
    required: boolean;
    default?: string;
  }>;
  authenticate?: {
    type: 'api_key' | 'oauth2' | 'basic_auth';
    properties: Record<string, any>;
  };
}

export interface OutputConfig {
  name: string;
  displayName: string;
  type: string;
  description: string;
}

export interface ValidationConfig {
  type: 'regex' | 'length' | 'range' | 'custom';
  value: any;
  message: string;
}

export class NodeTemplateGenerator {
  private templatesPath: string;
  private outputPath: string;

  constructor(templatesPath: string = './templates', outputPath: string = './generated') {
    this.templatesPath = templatesPath;
    this.outputPath = outputPath;
  }

  async generateNode(config: NodeTemplateConfig): Promise<string[]> {
    const spinner = ora(`Generating ${config.type} node: ${config.name}`).start();
    
    try {
      // Ensure output directory exists
      const nodeOutputPath = path.join(this.outputPath, config.name);
      await fs.mkdir(nodeOutputPath, { recursive: true });

      // Load templates based on node type
      const templates = await this.loadTemplates(config.type);
      const generatedFiles: string[] = [];

      // Generate files from templates
      for (const template of templates) {
        const outputFile = await this.generateFileFromTemplate(template, config, nodeOutputPath);
        generatedFiles.push(outputFile);
      }

      // Generate additional files based on features
      if (config.features.hasCredentials && config.credentials) {
        const credentialFiles = await this.generateCredentialFiles(config, nodeOutputPath);
        generatedFiles.push(...credentialFiles);
      }

      if (config.features.hasWebhook) {
        const webhookFiles = await this.generateWebhookFiles(config, nodeOutputPath);
        generatedFiles.push(...webhookFiles);
      }

      // Generate test files
      const testFiles = await this.generateTestFiles(config, nodeOutputPath);
      generatedFiles.push(...testFiles);

      // Generate documentation
      const docFiles = await this.generateDocumentation(config, nodeOutputPath);
      generatedFiles.push(...docFiles);

      spinner.succeed(chalk.green(`Generated ${config.type} node: ${config.name}`));
      return generatedFiles;
    } catch (error) {
      spinner.fail(chalk.red(`Failed to generate node: ${error.message}`));
      throw error;
    }
  }

  private async loadTemplates(nodeType: string): Promise<TemplateInfo[]> {
    const templatePattern = path.join(this.templatesPath, nodeType, '**/*.mustache');
    const templateFiles = await glob(templatePattern);
    
    const templates: TemplateInfo[] = [];
    
    for (const templateFile of templateFiles) {
      const content = await fs.readFile(templateFile, 'utf-8');
      const relativePath = path.relative(path.join(this.templatesPath, nodeType), templateFile);
      const outputPath = relativePath.replace('.mustache', '');
      
      templates.push({
        templatePath: templateFile,
        outputPath,
        content
      });
    }
    
    return templates;
  }

  private async generateFileFromTemplate(
    template: TemplateInfo, 
    config: NodeTemplateConfig, 
    outputDir: string
  ): Promise<string> {
    const templateData = this.prepareTemplateData(config);
    const rendered = Mustache.render(template.content, templateData);
    
    const outputFile = path.join(outputDir, template.outputPath);
    const outputFileDir = path.dirname(outputFile);
    
    // Ensure directory exists
    await fs.mkdir(outputFileDir, { recursive: true });
    
    // Write rendered content
    await fs.writeFile(outputFile, rendered, 'utf-8');
    
    return outputFile;
  }

  private prepareTemplateData(config: NodeTemplateConfig): any {
    return {
      ...config,
      className: this.toPascalCase(config.name),
      constantName: this.toConstantCase(config.name),
      camelName: this.toCamelCase(config.name),
      kebabName: this.toKebabCase(config.name),
      timestamp: new Date().toISOString(),
      year: new Date().getFullYear(),
      // Helper functions for templates
      helpers: {
        json: () => (text: string, render: (text: string) => string) => {
          return JSON.stringify(JSON.parse(render(text)), null, 2);
        },
        uppercase: () => (text: string, render: (text: string) => string) => {
          return render(text).toUpperCase();
        },
        lowercase: () => (text: string, render: (text: string) => string) => {
          return render(text).toLowerCase();
        }
      }
    };
  }

  private async generateCredentialFiles(config: NodeTemplateConfig, outputDir: string): Promise<string[]> {
    const files: string[] = [];
    
    if (!config.credentials) return files;
    
    for (const credential of config.credentials) {
      const credentialTemplate = await this.loadCredentialTemplate();
      const credentialData = { ...config, credential };
      const rendered = Mustache.render(credentialTemplate, credentialData);
      
      const fileName = `${this.toKebabCase(credential.name)}.credential.ts`;
      const filePath = path.join(outputDir, 'credentials', fileName);
      
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, rendered, 'utf-8');
      files.push(filePath);
    }
    
    return files;
  }

  private async generateWebhookFiles(config: NodeTemplateConfig, outputDir: string): Promise<string[]> {
    const webhookTemplate = await this.loadWebhookTemplate();
    const rendered = Mustache.render(webhookTemplate, config);
    
    const fileName = `${this.toKebabCase(config.name)}.webhook.ts`;
    const filePath = path.join(outputDir, fileName);
    
    await fs.writeFile(filePath, rendered, 'utf-8');
    return [filePath];
  }

  private async generateTestFiles(config: NodeTemplateConfig, outputDir: string): Promise<string[]> {
    const files: string[] = [];
    
    // Unit test
    const unitTestTemplate = await this.loadUnitTestTemplate();
    const unitTestRendered = Mustache.render(unitTestTemplate, config);
    const unitTestPath = path.join(outputDir, '__tests__', `${this.toKebabCase(config.name)}.test.ts`);
    
    await fs.mkdir(path.dirname(unitTestPath), { recursive: true });
    await fs.writeFile(unitTestPath, unitTestRendered, 'utf-8');
    files.push(unitTestPath);
    
    // Integration test
    const integrationTestTemplate = await this.loadIntegrationTestTemplate();
    const integrationTestRendered = Mustache.render(integrationTestTemplate, config);
    const integrationTestPath = path.join(outputDir, '__tests__', `${this.toKebabCase(config.name)}.integration.test.ts`);
    
    await fs.writeFile(integrationTestPath, integrationTestRendered, 'utf-8');
    files.push(integrationTestPath);
    
    return files;
  }

  private async generateDocumentation(config: NodeTemplateConfig, outputDir: string): Promise<string[]> {
    const files: string[] = [];
    
    // README
    const readmeTemplate = await this.loadReadmeTemplate();
    const readmeRendered = Mustache.render(readmeTemplate, config);
    const readmePath = path.join(outputDir, 'README.md');
    
    await fs.writeFile(readmePath, readmeRendered, 'utf-8');
    files.push(readmePath);
    
    // API Documentation
    const apiDocTemplate = await this.loadApiDocTemplate();
    const apiDocRendered = Mustache.render(apiDocTemplate, config);
    const apiDocPath = path.join(outputDir, 'docs', 'api.md');
    
    await fs.mkdir(path.dirname(apiDocPath), { recursive: true });
    await fs.writeFile(apiDocPath, apiDocRendered, 'utf-8');
    files.push(apiDocPath);
    
    return files;
  }

  // Template loaders (simplified - in real implementation these would load from files)
  private async loadCredentialTemplate(): Promise<string> {
    return `import { ICredentialType, INodeProperties } from '@n8n-work/node-sdk';

export class {{credential.name}}Api implements ICredentialType {
  name = '{{credential.name}}';
  displayName = '{{credential.displayName}}';

  properties: INodeProperties[] = [
    {{#credential.properties}}
    {
      displayName: '{{displayName}}',
      name: '{{name}}',
      type: '{{type}}',
      required: {{required}},
      {{#default}}default: '{{default}}',{{/default}}
    },
    {{/credential.properties}}
  ];
}`;
  }

  private async loadWebhookTemplate(): Promise<string> {
    return `import { IWebhookFunctions, IWebhookResponseData } from '@n8n-work/node-sdk';

export async function webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
  const bodyData = this.getBodyData();
  const headerData = this.getHeaderData();
  const queryData = this.getQueryData();

  // Process webhook data
  const workflowData = this.getWorkflowStaticData('node');

  return {
    workflowData: [
      {
        json: {
          body: bodyData,
          headers: headerData,
          query: queryData,
        },
      },
    ],
  };
}`;
  }

  private async loadUnitTestTemplate(): Promise<string> {
    return `import { {{className}} } from '../{{kebabName}}.node';

describe('{{className}}', () => {
  let node: {{className}};

  beforeEach(() => {
    node = new {{className}}();
  });

  it('should be defined', () => {
    expect(node).toBeDefined();
  });

  it('should have correct node properties', () => {
    expect(node.description.displayName).toBe('{{name}}');
    expect(node.description.name).toBe('{{kebabName}}');
    expect(node.description.group).toContain('{{category}}');
  });

  // Add more specific tests based on node functionality
});`;
  }

  private async loadIntegrationTestTemplate(): Promise<string> {
    return `import { {{className}} } from '../{{kebabName}}.node';
import { IExecuteFunctions } from '@n8n-work/node-sdk';

describe('{{className}} Integration Tests', () => {
  let node: {{className}};
  let executeFunctions: jest.Mocked<IExecuteFunctions>;

  beforeEach(() => {
    node = new {{className}}();
    executeFunctions = createMockExecuteFunctions();
  });

  it('should execute successfully with valid input', async () => {
    // Setup test data
    const inputData = [{ json: { test: 'data' } }];
    executeFunctions.getInputData.mockReturnValue(inputData);

    // Execute node
    const result = await node.execute.call(executeFunctions);

    // Verify results
    expect(result).toBeDefined();
    expect(result[0]).toHaveLength(1);
  });
});

function createMockExecuteFunctions(): jest.Mocked<IExecuteFunctions> {
  return {
    getInputData: jest.fn(),
    getNodeParameter: jest.fn(),
    getCredentials: jest.fn(),
    helpers: {
      request: jest.fn(),
    },
  } as any;
}`;
  }

  private async loadReadmeTemplate(): Promise<string> {
    return `# {{name}}

{{description}}

## Overview

This node allows you to {{description}}.

## Configuration

### Parameters

{{#parameters}}
- **{{displayName}}** ({{type}}{{#required}}, required{{/required}}): {{description}}
{{/parameters}}

{{#features.hasCredentials}}
### Credentials

This node requires credentials to authenticate with the service.

{{#credentials}}
- **{{displayName}}**: {{#properties}}{{displayName}}{{#unless @last}}, {{/unless}}{{/properties}}
{{/credentials}}
{{/features.hasCredentials}}

## Usage

1. Configure the required parameters
{{#features.hasCredentials}}2. Set up your credentials{{/features.hasCredentials}}
3. Execute the node

## Examples

### Basic Usage

\`\`\`json
{
  "nodes": [
    {
      "parameters": {
        // Add example parameters here
      },
      "type": "{{kebabName}}",
      "typeVersion": 1,
      "position": [250, 300]
    }
  ]
}
\`\`\`

## Support

For support and questions, please refer to the documentation or open an issue.

## License

MIT
`;
  }

  private async loadApiDocTemplate(): Promise<string> {
    return `# {{name}} API Documentation

## Node Properties

- **Name**: {{kebabName}}
- **Display Name**: {{name}}
- **Type**: {{type}}
- **Category**: {{category}}
- **Version**: {{version}}

## Parameters

{{#parameters}}
### {{displayName}}

- **Name**: {{name}}
- **Type**: {{type}}
- **Required**: {{required}}
- **Description**: {{description}}
{{#default}}
- **Default**: {{default}}
{{/default}}
{{#options}}
- **Options**:
  {{#.}}
  - {{name}}: {{value}} - {{description}}
  {{/.}}
{{/options}}

{{/parameters}}

## Methods

### execute()

Executes the node with the provided input data.

**Returns**: Promise<INodeExecutionData[][]>

## Error Handling

The node handles the following error scenarios:
- Invalid parameters
- Authentication failures
- Network timeouts
- API rate limits

## Rate Limiting

This node respects API rate limits and will retry requests when appropriate.
`;
  }

  // Utility functions
  private toPascalCase(str: string): string {
    return str.replace(/(?:^|[\s-_])(\w)/g, (_, letter) => letter.toUpperCase());
  }

  private toCamelCase(str: string): string {
    const pascal = this.toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }

  private toKebabCase(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[\s_]+/g, '-');
  }

  private toConstantCase(str: string): string {
    return this.toKebabCase(str).toUpperCase().replace(/-/g, '_');
  }
}

interface TemplateInfo {
  templatePath: string;
  outputPath: string;
  content: string;
}

export { NodeTemplateGenerator };