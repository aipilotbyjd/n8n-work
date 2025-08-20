# N8N-Work Node SDK

A comprehensive TypeScript SDK for creating custom nodes for the N8N-Work workflow automation platform. This SDK provides all the tools, types, and utilities needed to build professional-grade workflow nodes with ease.

## Features

- 🏗️ **Complete Type System**: Fully typed interfaces for all node components
- 🔧 **Base Classes**: Pre-built base classes for different node types (Action, HTTP, Trigger)
- 🛠️ **CLI Tools**: Command-line interface for project initialization, node generation, testing, and publishing
- 📝 **Code Generation**: Templates and scaffolding for rapid node development
- ✅ **Validation**: Built-in validation for node definitions and parameters
- 🧪 **Testing Support**: Jest configuration and testing utilities
- 📚 **Examples**: Complete example nodes demonstrating best practices
- 🔄 **Hot Reload**: Development server with live reloading

## Installation

```bash
npm install -g @n8n-work/node-sdk
```

## Quick Start

### 1. Initialize a New Project

```bash
# Create a new node project
n8n-work init my-awesome-nodes

# Or with options
n8n-work init my-awesome-nodes --template=http --dir=./my-project
```

### 2. Create Your First Node

```bash
cd my-awesome-nodes
n8n-work create weather-api --type=action --description="Fetch weather data from API"
```

### 3. Implement Your Node

Edit the generated `src/nodes/weather-api.ts`:

```typescript
import {
  INodeType,
  IExecutionContext,
  IWorkflowData,
  INodeExecutionData,
  HttpRequestNode,
} from '@n8n-work/node-sdk';

export class WeatherApiNode extends HttpRequestNode {
  nodeType: INodeType = {
    name: 'weatherApi',
    displayName: 'Weather API',
    description: 'Fetch weather data from OpenWeatherMap API',
    version: 1,
    group: 'action',
    defaults: {
      name: 'Weather API',
      color: '#4A90E2',
    },
    inputs: [{ type: 'main', displayName: 'Input' }],
    outputs: [{ type: 'main', displayName: 'Output' }],
    properties: [
      {
        name: 'city',
        displayName: 'City',
        type: 'string',
        required: true,
        placeholder: 'London',
        description: 'City name to get weather for',
      },
      {
        name: 'apiKey',
        displayName: 'API Key',
        type: 'string',
        required: true,
        typeOptions: { password: true },
        description: 'OpenWeatherMap API key',
      },
    ],
  };

  async execute(
    context: IExecutionContext,
    data: IWorkflowData
  ): Promise<INodeExecutionData[]> {
    const city = this.getParameter<string>(data.parameters, 'city');
    const apiKey = this.getParameter<string>(data.parameters, 'apiKey');
    
    this.validateRequiredParameters(data.parameters, ['city', 'apiKey']);

    const response = await this.makeHttpRequest({
      method: 'GET',
      url: `https://api.openweathermap.org/data/2.5/weather`,
      params: { q: city, appid: apiKey, units: 'metric' },
    }, context);

    return [this.processHttpResponse(response)];
  }
}
```

### 4. Test Your Node

```bash
npm test
```

### 5. Build and Validate

```bash
npm run build
npm run validate
```

## CLI Commands

### Project Management

```bash
# Initialize new project
n8n-work init [name] [options]
  --template <template>  # basic, http, trigger
  --dir <directory>      # target directory
  --skip-install         # skip npm install

# Start development server
n8n-work dev
  --port <port>          # server port (default: 3000)
  --host <host>          # server host (default: localhost)
```

### Node Development

```bash
# Create new node
n8n-work create <name> [options]
  --type <type>          # action, trigger, webhook
  --description <desc>   # node description
  --output <path>        # output directory

# Build nodes
n8n-work build [options]
  --watch               # watch for changes
  --output <path>       # output directory
  --minify              # minify output

# Test nodes
n8n-work test [pattern] [options]
  --watch               # watch for changes
  --coverage            # generate coverage report

# Validate nodes
n8n-work validate [files...] [options]
  --strict              # enable strict validation

# Publish nodes
n8n-work publish [options]
  --registry <url>      # registry URL
  --tag <tag>           # publishing tag
  --dry-run             # perform dry run
```

## Node Types

### Action Nodes

Action nodes process input data and produce output data. They extend the `NodeBase` class:

```typescript
import { NodeBase, INodeType, IExecutionContext, IWorkflowData, INodeExecutionData } from '@n8n-work/node-sdk';

export class MyActionNode extends NodeBase {
  nodeType: INodeType = {
    name: 'myAction',
    displayName: 'My Action',
    description: 'Process data',
    version: 1,
    group: 'action',
    // ... configuration
  };

  async execute(context: IExecutionContext, data: IWorkflowData): Promise<INodeExecutionData[]> {
    // Implementation
  }
}
```

### HTTP Nodes

HTTP nodes make HTTP requests to external APIs. They extend the `HttpRequestNode` class:

```typescript
import { HttpRequestNode } from '@n8n-work/node-sdk';

export class MyHttpNode extends HttpRequestNode {
  async execute(context: IExecutionContext, data: IWorkflowData): Promise<INodeExecutionData[]> {
    const response = await this.makeHttpRequest({
      method: 'GET',
      url: 'https://api.example.com/data'
    }, context);
    
    return [this.processHttpResponse(response)];
  }
}
```

### Trigger Nodes

Trigger nodes start workflows based on external events. They extend the `TriggerNode` class:

```typescript
import { TriggerNode } from '@n8n-work/node-sdk';

export class MyTriggerNode extends TriggerNode {
  async poll(context: IExecutionContext, data: IWorkflowData): Promise<INodeExecutionData[]> {
    // Polling logic
  }

  async webhook(context: IExecutionContext, data: IWorkflowData): Promise<INodeExecutionData[]> {
    // Webhook logic
  }
}
```

## Advanced Features

### Parameter Validation

```typescript
// Built-in validation
this.validateRequiredParameters(data.parameters, ['apiKey', 'endpoint']);

// Custom validation
const result = validateParameter(value, parameterDefinition);
if (!result.valid) {
  throw new Error(result.error);
}
```

### Data Interpolation

```typescript
// Template string interpolation
const url = this.interpolate('https://api.example.com/users/{{userId}}', inputData);

// Special variables
const timestamp = this.interpolate('{{$now}}', {}); // Current ISO timestamp
const uuid = this.interpolate('{{$uuid}}', {});     // Generated UUID
```

### Error Handling

```typescript
try {
  // Node logic
} catch (error) {
  return [this.createExecutionData(
    { error: true, message: error.message },
    this.createError('Node execution failed', 'NODE_ERROR', 500)
  )];
}
```

### Binary Data

```typescript
// Handle binary responses
const response = await this.makeHttpRequest(config, context);
const executionData = this.processHttpResponse(response, true);

// Binary data is automatically detected and stored in executionData.binary
```

### Authentication

```typescript
// Apply authentication to requests
const config = this.applyAuthentication(requestConfig, 'bearer', {
  token: credentials.accessToken
});
```

## Testing

### Unit Tests

```typescript
import { MyNode } from '../my-node';
import { IExecutionContext, IWorkflowData } from '@n8n-work/node-sdk';

describe('MyNode', () => {
  let node: MyNode;
  let context: IExecutionContext;

  beforeEach(() => {
    node = new MyNode();
    context = {
      executionId: 'test-exec',
      workflowId: 'test-workflow',
      stepId: 'test-step',
      mode: 'test',
      timestamp: new Date(),
    };
  });

  it('should process data correctly', async () => {
    const data: IWorkflowData = {
      inputData: [{ json: { test: 'value' } }],
      parameters: { message: 'Hello {{test}}!' },
    };

    const result = await node.execute(context, data);
    
    expect(result).toHaveLength(1);
    expect(result[0].json.processedMessage).toBe('Hello value!');
  });
});
```

### Integration Tests

```typescript
// Test with real HTTP requests
import nock from 'nock';

describe('HTTP Node Integration', () => {
  beforeEach(() => {
    nock('https://api.example.com')
      .get('/data')
      .reply(200, { success: true });
  });

  it('should make real HTTP request', async () => {
    // Test implementation
  });
});
```

## Credentials

### Defining Credential Types

```typescript
import { ICredentialType } from '@n8n-work/node-sdk';

export const MyServiceApi: ICredentialType = {
  name: 'myServiceApi',
  displayName: 'My Service API',
  properties: [
    {
      name: 'apiKey',
      displayName: 'API Key',
      type: 'string',
      typeOptions: { password: true },
      required: true,
    },
  ],
  authenticate: {
    type: 'generic',
    properties: {
      headers: {
        'Authorization': 'Bearer {{apiKey}}',
      },
    },
  },
};
```

### Using Credentials in Nodes

```typescript
nodeType: INodeType = {
  // ... other properties
  credentials: [
    {
      name: 'myServiceApi',
      required: true,
    },
  ],
};

async execute(context, data) {
  const credentials = data.credentials?.data;
  const apiKey = credentials?.apiKey;
  
  // Use credentials in requests
}
```

## Best Practices

### 1. Error Handling
- Always wrap external API calls in try-catch blocks
- Provide meaningful error messages
- Use appropriate HTTP status codes

### 2. Parameter Validation
- Validate all required parameters upfront
- Use type-safe parameter getters
- Provide clear validation error messages

### 3. Performance
- Implement request timeout and retry logic
- Use connection pooling for HTTP requests
- Cache expensive operations when appropriate

### 4. Security
- Never log sensitive data like API keys
- Validate and sanitize all user inputs
- Use secure defaults for all parameters

### 5. Documentation
- Provide comprehensive node documentation
- Include usage examples and troubleshooting
- Document all parameters and their effects

## Publishing

### Prepare for Publishing

```bash
# Run full validation
npm run validate --strict

# Run tests with coverage
npm test --coverage

# Build for production
npm run build
```

### Publish to Registry

```bash
# Dry run first
n8n-work publish --dry-run

# Publish to public registry
n8n-work publish

# Publish to private registry
n8n-work publish --registry=https://npm.mycompany.com
```

## Examples

The SDK includes complete example implementations:

- **HttpApiNode**: Demonstrates HTTP API integration
- **WebhookTriggerNode**: Shows webhook handling with authentication
- **DataTransformNode**: Illustrates data transformation patterns

Check the `src/examples/` directory for full implementations.

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## Support

- 📖 **Documentation**: [Full API Documentation](https://docs.n8n-work.com/sdk)
- 💬 **Community**: [Discord Server](https://discord.gg/n8n-work)
- 🐛 **Issues**: [GitHub Issues](https://github.com/n8n-work/node-sdk-js/issues)
- 📧 **Email**: sdk-support@n8n-work.com

## License

MIT License. See [LICENSE](LICENSE) for details.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and breaking changes.
