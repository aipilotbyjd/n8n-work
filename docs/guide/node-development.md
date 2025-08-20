# Node Development Guide

Learn how to create custom nodes for the N8N-Work platform. This comprehensive guide covers everything from basic node structure to advanced features and best practices.

## Overview

Custom nodes extend the N8N-Work platform by adding new functionality that can be used in workflows. Each node performs a specific task, such as:

- Integrating with external APIs
- Processing and transforming data
- Triggering workflows based on events
- Implementing custom business logic

## Node Types

### 1. Regular Nodes
Standard nodes that process data and can be placed anywhere in a workflow.

### 2. Trigger Nodes
Nodes that start workflow execution based on external events or schedules.

### 3. Credential Nodes
Nodes that handle authentication and credential management for services.

## Getting Started

### Prerequisites

- Node.js 18+ installed
- TypeScript knowledge
- Understanding of N8N-Work platform concepts

### Setting Up Development Environment

```bash
# Create a new node project
npx @n8n-work/node-dev create my-custom-node

# Navigate to project directory
cd my-custom-node

# Install dependencies
npm install

# Start development server
npm run dev
```

### Project Structure

```
my-custom-node/
├── src/
│   ├── nodes/
│   │   └── MyCustomNode/
│   │       ├── MyCustomNode.node.ts
│   │       └── MyCustomNode.node.json
│   ├── credentials/
│   │   └── MyServiceCredentials.credentials.ts
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Creating Your First Node

### Basic Node Structure

```typescript
// src/nodes/MyCustomNode/MyCustomNode.node.ts
import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class MyCustomNode implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'My Custom Node',
    name: 'myCustomNode',
    icon: 'file:MyCustomNode.svg',
    group: ['input'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'A custom node for demonstration',
    defaults: {
      name: 'My Custom Node',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'myServiceCredentials',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Get Data',
            value: 'getData',
            description: 'Retrieve data from the service',
            action: 'Get data from service',
          },
          {
            name: 'Send Data',
            value: 'sendData',
            description: 'Send data to the service',
            action: 'Send data to service',
          },
        ],
        default: 'getData',
      },
      {
        displayName: 'Resource ID',
        name: 'resourceId',
        type: 'string',
        default: '',
        required: true,
        description: 'The ID of the resource to work with',
        displayOptions: {
          show: {
            operation: ['getData'],
          },
        },
      },
      {
        displayName: 'Data',
        name: 'data',
        type: 'json',
        default: '{}',
        required: true,
        description: 'The data to send',
        displayOptions: {
          show: {
            operation: ['sendData'],
          },
        },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const operation = this.getNodeParameter('operation', 0) as string;
    const credentials = await this.getCredentials('myServiceCredentials');

    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        let responseData;

        if (operation === 'getData') {
          const resourceId = this.getNodeParameter('resourceId', i) as string;
          responseData = await this.getData(credentials, resourceId);
        } else if (operation === 'sendData') {
          const data = this.getNodeParameter('data', i) as object;
          responseData = await this.sendData(credentials, data);
        }

        returnData.push({
          json: responseData,
          pairedItem: {
            item: i,
          },
        });
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: error.message },
            pairedItem: {
              item: i,
            },
          });
          continue;
        }
        throw new NodeOperationError(this.getNode(), error);
      }
    }

    return [returnData];
  }

  private async getData(credentials: any, resourceId: string): Promise<any> {
    const response = await this.helpers.httpRequest({
      method: 'GET',
      url: `${credentials.baseUrl}/api/data/${resourceId}`,
      headers: {
        'Authorization': `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    return response;
  }

  private async sendData(credentials: any, data: object): Promise<any> {
    const response = await this.helpers.httpRequest({
      method: 'POST',
      url: `${credentials.baseUrl}/api/data`,
      headers: {
        'Authorization': `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: data,
    });

    return response;
  }
}
```

### Node Description File

```json
// src/nodes/MyCustomNode/MyCustomNode.node.json
{
  "displayName": "My Custom Node",
  "name": "myCustomNode",
  "icon": "file:MyCustomNode.svg",
  "group": ["input"],
  "version": 1,
  "subtitle": "={{$parameter[\"operation\"]}}",
  "description": "A custom node for demonstration purposes",
  "defaults": {
    "name": "My Custom Node"
  },
  "inputs": ["main"],
  "outputs": ["main"],
  "credentials": [
    {
      "name": "myServiceCredentials",
      "required": true
    }
  ]
}
```

## Advanced Node Features

### Dynamic Parameters

```typescript
properties: [
  {
    displayName: 'Resource',
    name: 'resource',
    type: 'options',
    typeOptions: {
      loadOptionsMethod: 'getResources',
    },
    default: '',
    description: 'The resource to work with',
  },
  {
    displayName: 'Field',
    name: 'field',
    type: 'options',
    typeOptions: {
      loadOptionsMethod: 'getFields',
      loadOptionsDependsOn: ['resource'],
    },
    default: '',
    description: 'The field to work with',
  },
];

// Load options methods
methods = {
  loadOptions: {
    async getResources(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
      const credentials = await this.getCredentials('myServiceCredentials');
      
      const response = await this.helpers.httpRequest({
        method: 'GET',
        url: `${credentials.baseUrl}/api/resources`,
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
        },
      });

      return response.map((resource: any) => ({
        name: resource.name,
        value: resource.id,
      }));
    },

    async getFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
      const resourceId = this.getCurrentNodeParameter('resource') as string;
      const credentials = await this.getCredentials('myServiceCredentials');

      const response = await this.helpers.httpRequest({
        method: 'GET',
        url: `${credentials.baseUrl}/api/resources/${resourceId}/fields`,
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
        },
      });

      return response.map((field: any) => ({
        name: field.label,
        value: field.name,
      }));
    },
  },
};
```

### Binary Data Handling

```typescript
// Processing binary data
async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  const returnData: INodeExecutionData[] = [];

  for (let i = 0; i < items.length; i++) {
    const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
    const binaryData = items[i].binary?.[binaryPropertyName];

    if (!binaryData) {
      throw new NodeOperationError(this.getNode(), `No binary data found for property "${binaryPropertyName}"`);
    }

    // Process the binary data
    const processedData = await this.processBinaryData(binaryData);

    returnData.push({
      json: { processed: true, size: processedData.length },
      binary: {
        [binaryPropertyName]: {
          data: processedData.toString('base64'),
          mimeType: binaryData.mimeType,
          fileExtension: binaryData.fileExtension,
        },
      },
      pairedItem: { item: i },
    });
  }

  return [returnData];
}

private async processBinaryData(binaryData: IBinaryData): Promise<Buffer> {
  // Get binary data as buffer
  const buffer = await this.helpers.getBinaryDataBuffer(0, binaryData.id);
  
  // Process the buffer (example: resize image, convert format, etc.)
  const processedBuffer = this.transformBuffer(buffer);
  
  return processedBuffer;
}
```

### Pagination Support

```typescript
async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  const returnData: INodeExecutionData[] = [];

  for (let i = 0; i < items.length; i++) {
    const limit = this.getNodeParameter('limit', i, 100) as number;
    const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;

    let allData: any[] = [];
    let hasMore = true;
    let offset = 0;

    while (hasMore) {
      const response = await this.makeApiCall({
        limit: returnAll ? 100 : limit,
        offset,
      });

      allData.push(...response.data);

      if (returnAll) {
        hasMore = response.hasMore;
        offset += response.data.length;
      } else {
        hasMore = false;
      }

      // Prevent infinite loops
      if (allData.length >= 10000) {
        break;
      }
    }

    for (const item of allData) {
      returnData.push({
        json: item,
        pairedItem: { item: i },
      });
    }
  }

  return [returnData];
}
```

## Creating Trigger Nodes

### Webhook Trigger

```typescript
import {
  IWebhookFunctions,
  IWebhookResponseData,
  ITriggerFunctions,
  ITriggerResponse,
} from 'n8n-workflow';

export class MyWebhookTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'My Webhook Trigger',
    name: 'myWebhookTrigger',
    icon: 'file:webhook.svg',
    group: ['trigger'],
    version: 1,
    description: 'Triggers workflow on webhook events',
    defaults: {
      name: 'My Webhook Trigger',
    },
    inputs: [],
    outputs: ['main'],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'webhook',
      },
    ],
    properties: [
      {
        displayName: 'Event Type',
        name: 'eventType',
        type: 'options',
        options: [
          { name: 'All Events', value: 'all' },
          { name: 'Create', value: 'create' },
          { name: 'Update', value: 'update' },
          { name: 'Delete', value: 'delete' },
        ],
        default: 'all',
      },
    ],
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const bodyData = this.getBodyData();
    const eventType = this.getNodeParameter('eventType') as string;

    // Filter events if specific type is selected
    if (eventType !== 'all' && bodyData.event_type !== eventType) {
      return {
        noWebhookResponse: true,
      };
    }

    return {
      workflowData: [
        [
          {
            json: bodyData,
          },
        ],
      ],
    };
  }
}
```

### Polling Trigger

```typescript
export class MyPollingTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'My Polling Trigger',
    name: 'myPollingTrigger',
    icon: 'file:polling.svg',
    group: ['trigger'],
    version: 1,
    description: 'Polls for new data at regular intervals',
    defaults: {
      name: 'My Polling Trigger',
    },
    inputs: [],
    outputs: ['main'],
    polling: true,
    properties: [
      {
        displayName: 'Trigger Interval',
        name: 'triggerInterval',
        type: 'number',
        default: 60,
        description: 'Interval in seconds',
      },
    ],
  };

  async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
    const triggerInterval = this.getNodeParameter('triggerInterval') as number;
    const credentials = await this.getCredentials('myServiceCredentials');

    let lastCheckTime = this.getWorkflowStaticData('node').lastCheckTime || new Date().toISOString();

    const triggerData = async () => {
      try {
        const response = await this.helpers.httpRequest({
          method: 'GET',
          url: `${credentials.baseUrl}/api/events`,
          qs: {
            since: lastCheckTime,
          },
          headers: {
            'Authorization': `Bearer ${credentials.accessToken}`,
          },
        });

        if (response.length > 0) {
          // Update last check time
          lastCheckTime = new Date().toISOString();
          this.getWorkflowStaticData('node').lastCheckTime = lastCheckTime;

          // Emit events
          for (const event of response) {
            this.emit([
              [
                {
                  json: event,
                },
              ],
            ]);
          }
        }
      } catch (error) {
        this.logger.error('Error polling for data:', error);
      }
    };

    // Initial check
    await triggerData();

    // Set up interval
    const interval = setInterval(triggerData, triggerInterval * 1000);

    return {
      closeFunction: async () => {
        clearInterval(interval);
      },
    };
  }
}
```

## Credential Management

### Creating Credentials

```typescript
// src/credentials/MyServiceCredentials.credentials.ts
import {
  IAuthenticateGeneric,
  ICredentialDataDecryptedObject,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class MyServiceCredentials implements ICredentialType {
  name = 'myServiceCredentials';
  displayName = 'My Service Credentials';
  documentationUrl = 'https://docs.myservice.com/api';
  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://api.myservice.com',
      required: true,
    },
    {
      displayName: 'Access Token',
      name: 'accessToken',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      required: true,
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        'Authorization': '=Bearer {{$credentials.accessToken}}',
      },
    },
  };

  test: ICredentialTestFunctions = {
    async testCredentials(
      this: ICredentialTestFunctions,
      credentials: ICredentialDataDecryptedObject,
    ): Promise<NodeApiTest> {
      try {
        const response = await this.helpers.httpRequest({
          method: 'GET',
          url: `${credentials.baseUrl}/api/user`,
          headers: {
            'Authorization': `Bearer ${credentials.accessToken}`,
          },
        });

        return {
          status: 'OK',
          message: 'Authentication successful',
        };
      } catch (error) {
        return {
          status: 'Error',
          message: error.message,
        };
      }
    },
  };
}
```

### OAuth2 Credentials

```typescript
export class MyServiceOAuth2Credentials implements ICredentialType {
  name = 'myServiceOAuth2';
  displayName = 'My Service OAuth2';
  extends = ['oAuth2Api'];
  properties: INodeProperties[] = [
    {
      displayName: 'Grant Type',
      name: 'grantType',
      type: 'hidden',
      default: 'authorizationCode',
    },
    {
      displayName: 'Client ID',
      name: 'clientId',
      type: 'string',
      default: '',
      required: true,
    },
    {
      displayName: 'Client Secret',
      name: 'clientSecret',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      required: true,
    },
    {
      displayName: 'Authorization URL',
      name: 'authUrl',
      type: 'string',
      default: 'https://api.myservice.com/oauth/authorize',
      required: true,
    },
    {
      displayName: 'Access Token URL',
      name: 'accessTokenUrl',
      type: 'string',
      default: 'https://api.myservice.com/oauth/token',
      required: true,
    },
    {
      displayName: 'Scope',
      name: 'scope',
      type: 'string',
      default: 'read write',
    },
  ];
}
```

## Testing Nodes

### Unit Testing

```typescript
// tests/MyCustomNode.test.ts
import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { MyCustomNode } from '../src/nodes/MyCustomNode/MyCustomNode.node';

describe('MyCustomNode', () => {
  let node: MyCustomNode;
  let mockExecuteFunctions: Partial<IExecuteFunctions>;

  beforeEach(() => {
    node = new MyCustomNode();
    mockExecuteFunctions = {
      getInputData: jest.fn(),
      getNodeParameter: jest.fn(),
      getCredentials: jest.fn(),
      continueOnFail: jest.fn().mockReturnValue(false),
      helpers: {
        httpRequest: jest.fn(),
      },
    };
  });

  test('should execute getData operation successfully', async () => {
    // Arrange
    const inputData: INodeExecutionData[] = [{ json: {} }];
    const credentials = { baseUrl: 'https://api.test.com', accessToken: 'token' };
    const resourceId = 'test-resource';

    (mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue(inputData);
    (mockExecuteFunctions.getNodeParameter as jest.Mock)
      .mockReturnValueOnce('getData')
      .mockReturnValueOnce(resourceId);
    (mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue(credentials);
    (mockExecuteFunctions.helpers!.httpRequest as jest.Mock).mockResolvedValue({
      id: resourceId,
      name: 'Test Resource',
    });

    // Act
    const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(1);
    expect(result[0][0].json).toEqual({
      id: resourceId,
      name: 'Test Resource',
    });
  });

  test('should handle errors gracefully', async () => {
    // Arrange
    const inputData: INodeExecutionData[] = [{ json: {} }];
    const error = new Error('API Error');

    (mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue(inputData);
    (mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValue('getData');
    (mockExecuteFunctions.getCredentials as jest.Mock).mockRejectedValue(error);
    (mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

    // Act
    const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

    // Assert
    expect(result[0][0].json).toEqual({ error: 'API Error' });
  });
});
```

### Integration Testing

```typescript
// tests/integration/MyCustomNode.integration.test.ts
import { N8nWorkClient } from '@n8n-work/api-client';
import nock from 'nock';

describe('MyCustomNode Integration', () => {
  let client: N8nWorkClient;

  beforeEach(() => {
    client = new N8nWorkClient({
      accessToken: 'test-token',
      baseUrl: 'http://localhost:5678',
    });
  });

  afterEach(() => {
    nock.cleanAll();
  });

  test('should integrate with real API', async () => {
    // Mock external API
    nock('https://api.myservice.com')
      .get('/api/data/test-resource')
      .reply(200, {
        id: 'test-resource',
        name: 'Test Resource',
        value: 123,
      });

    // Create test workflow
    const workflow = await client.workflows.create({
      name: 'Test Workflow',
      definition: {
        nodes: [
          {
            id: 'start',
            type: 'start',
            name: 'Start',
            parameters: {},
            position: [100, 100],
          },
          {
            id: 'myCustomNode',
            type: 'myCustomNode',
            name: 'My Custom Node',
            parameters: {
              operation: 'getData',
              resourceId: 'test-resource',
            },
            position: [300, 100],
          },
        ],
        connections: [
          {
            from: 'start',
            to: 'myCustomNode',
            fromOutput: 'main',
            toInput: 'main',
          },
        ],
      },
    });

    // Execute workflow
    const execution = await client.workflows.execute(workflow.id);
    const result = await client.executions.get(execution.executionId);

    // Verify results
    expect(result.status).toBe('success');
    expect(result.outputData).toMatchObject({
      id: 'test-resource',
      name: 'Test Resource',
      value: 123,
    });
  });
});
```

## Performance Optimization

### Efficient HTTP Requests

```typescript
// Batch multiple requests
private async batchRequests(items: any[]): Promise<any[]> {
  const BATCH_SIZE = 10;
  const results: any[] = [];

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    
    const promises = batch.map(item => 
      this.helpers.httpRequest({
        method: 'GET',
        url: `${this.credentials.baseUrl}/api/data/${item.id}`,
        headers: this.getHeaders(),
      })
    );

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
  }

  return results;
}

// Implement request caching
private cache = new Map<string, { data: any; timestamp: number }>();

private async cachedRequest(url: string, ttl: number = 300000): Promise<any> {
  const now = Date.now();
  const cached = this.cache.get(url);

  if (cached && (now - cached.timestamp) < ttl) {
    return cached.data;
  }

  const response = await this.helpers.httpRequest({
    method: 'GET',
    url,
    headers: this.getHeaders(),
  });

  this.cache.set(url, { data: response, timestamp: now });
  return response;
}
```

### Memory Management

```typescript
// Stream large datasets
private async processLargeDataset(items: INodeExecutionData[]): Promise<INodeExecutionData[]> {
  const CHUNK_SIZE = 100;
  const results: INodeExecutionData[] = [];

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const processedChunk = await this.processChunk(chunk);
    
    results.push(...processedChunk);

    // Allow garbage collection
    if (i % (CHUNK_SIZE * 10) === 0) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }

  return results;
}

// Clean up resources
async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const cleanup: (() => void)[] = [];

  try {
    // Your node logic here
    const result = await this.processData();
    return result;
  } finally {
    // Clean up resources
    cleanup.forEach(fn => fn());
  }
}
```

## Best Practices

### 1. Error Handling

```typescript
// Comprehensive error handling
async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  const returnData: INodeExecutionData[] = [];

  for (let i = 0; i < items.length; i++) {
    try {
      const result = await this.processItem(items[i]);
      returnData.push(result);
    } catch (error) {
      // Log error details
      this.logger.error(`Error processing item ${i}:`, {
        error: error.message,
        stack: error.stack,
        item: items[i].json,
      });

      if (this.continueOnFail()) {
        // Return error information in output
        returnData.push({
          json: {
            error: true,
            message: error.message,
            originalData: items[i].json,
          },
          pairedItem: { item: i },
        });
      } else {
        // Throw descriptive error
        throw new NodeOperationError(
          this.getNode(),
          `Failed to process item: ${error.message}`,
          { itemIndex: i }
        );
      }
    }
  }

  return [returnData];
}
```

### 2. Input Validation

```typescript
// Validate input parameters
private validateParameters(): void {
  const operation = this.getNodeParameter('operation', 0) as string;
  const resourceId = this.getNodeParameter('resourceId', 0) as string;

  if (!operation) {
    throw new NodeOperationError(this.getNode(), 'Operation parameter is required');
  }

  if (operation === 'getData' && !resourceId) {
    throw new NodeOperationError(this.getNode(), 'Resource ID is required for getData operation');
  }

  // Validate resource ID format
  if (resourceId && !/^[a-zA-Z0-9-_]+$/.test(resourceId)) {
    throw new NodeOperationError(this.getNode(), 'Invalid resource ID format');
  }
}

// Validate input data
private validateInputData(data: any): void {
  const requiredFields = ['id', 'name', 'type'];
  
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null) {
      throw new NodeOperationError(this.getNode(), `Required field '${field}' is missing`);
    }
  }

  // Validate data types
  if (typeof data.id !== 'string') {
    throw new NodeOperationError(this.getNode(), 'Field "id" must be a string');
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    throw new NodeOperationError(this.getNode(), 'Invalid email format');
  }
}
```

### 3. Documentation

```typescript
// Comprehensive node description
description: INodeTypeDescription = {
  displayName: 'My Custom Node',
  name: 'myCustomNode',
  icon: 'file:MyCustomNode.svg',
  group: ['input'],
  version: 1,
  subtitle: '={{$parameter["operation"]}}',
  description: 'Integrates with My Service API to manage resources and data',
  
  // Detailed documentation
  defaults: {
    name: 'My Custom Node',
  },
  inputs: ['main'],
  outputs: ['main'],
  
  // Help information
  documentationUrl: 'https://docs.n8n-work.com/nodes/my-custom-node',
  
  properties: [
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      options: [
        {
          name: 'Get Data',
          value: 'getData',
          description: 'Retrieve data from My Service',
          action: 'Get data from My Service',
        },
      ],
      default: 'getData',
      description: 'Choose the operation to perform',
    },
    // ... more properties with detailed descriptions
  ],
};
```

### 4. TypeScript Best Practices

```typescript
// Use proper types
interface MyServiceResponse {
  id: string;
  name: string;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface MyServiceCreateRequest {
  name: string;
  data: Record<string, any>;
  tags?: string[];
}

// Type-safe parameter access
private getTypedParameter<T>(name: string, index: number, defaultValue?: T): T {
  return this.getNodeParameter(name, index, defaultValue) as T;
}

// Use enums for constants
enum Operations {
  GET_DATA = 'getData',
  SEND_DATA = 'sendData',
  UPDATE_DATA = 'updateData',
  DELETE_DATA = 'deleteData',
}
```

## Publishing Nodes

### Package Configuration

```json
{
  "name": "@mycompany/n8n-nodes-myservice",
  "version": "1.0.0",
  "description": "N8N nodes for My Service integration",
  "keywords": ["n8n", "n8n-community-node-package"],
  "license": "MIT",
  "homepage": "https://github.com/mycompany/n8n-nodes-myservice",
  "author": {
    "name": "My Company",
    "email": "dev@mycompany.com"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/mycompany/n8n-nodes-myservice.git"
  },
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "n8n": {
    "n8nNodesApiVersion": 1,
    "credentials": [
      "dist/credentials/MyServiceCredentials.credentials.js"
    ],
    "nodes": [
      "dist/nodes/MyCustomNode/MyCustomNode.node.js"
    ]
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "format": "prettier --write .",
    "lint": "eslint . --ext .ts",
    "test": "jest"
  },
  "files": [
    "dist",
    "docs"
  ],
  "devDependencies": {
    "@types/node": "^18.0.0",
    "n8n-workflow": "latest",
    "typescript": "^4.8.0"
  }
}
```

### Build and Release

```bash
# Build the package
npm run build

# Test the package
npm test

# Publish to npm
npm publish
```

## Community Guidelines

### 1. Code Quality
- Follow TypeScript best practices
- Include comprehensive tests
- Use meaningful variable and function names
- Add proper error handling

### 2. Documentation
- Provide clear node descriptions
- Include usage examples
- Document all parameters
- Add troubleshooting guides

### 3. Maintenance
- Keep dependencies updated
- Respond to issues and PRs
- Follow semantic versioning
- Maintain backward compatibility

## Next Steps

- **[Deployment Guide](/guide/deployment)** - Deploy your custom nodes
- **[API Reference](/api/index)** - Detailed API documentation
- **[Community](/resources/community)** - Join the developer community
- **[Examples](/guide/examples)** - View example implementations
