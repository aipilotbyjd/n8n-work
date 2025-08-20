# Node SDK

The N8N-Work Node SDK is a comprehensive TypeScript toolkit for building custom nodes that extend the platform's capabilities. Whether you need to integrate with a specific API, create custom data transformations, or build trigger nodes for your services, the SDK provides everything you need.

## Overview

The Node SDK offers:

- **🏗️ Complete Type System**: Fully typed interfaces for all node components
- **🔧 Base Classes**: Pre-built base classes for different node types
- **🛠️ CLI Tools**: Command-line interface for project management and development
- **📝 Code Generation**: Templates and scaffolding for rapid development
- **✅ Validation**: Built-in validation for node definitions and parameters
- **🧪 Testing Support**: Jest configuration and testing utilities
- **📚 Examples**: Complete example nodes demonstrating best practices

## Quick Start

### Installation

Install the SDK globally to access the CLI tools:

```bash
npm install -g @n8n-work/node-sdk
```

### Create Your First Node Project

```bash
# Initialize a new node project
n8n-work init my-awesome-nodes

# Navigate to the project
cd my-awesome-nodes

# Create your first node
n8n-work create weather-api --type=action --description="Fetch weather data"
```

### Implement Your Node

The CLI generates a complete node template. Here's what a simple HTTP API node looks like:

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
    description: 'Fetch weather data from OpenWeatherMap',
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

### Test and Build

```bash
# Run tests
npm test

# Build the project
npm run build

# Validate the node implementation
npm run validate
```

## Node Types

The SDK supports three main types of nodes:

### Action Nodes

Action nodes process input data and produce output. They're the most common type of node.

```typescript
import { NodeBase } from '@n8n-work/node-sdk';

export class MyActionNode extends NodeBase {
  nodeType: INodeType = {
    name: 'myAction',
    displayName: 'My Action',
    group: 'action',
    // ... configuration
  };

  async execute(context, data) {
    // Process data and return results
    return [this.createExecutionData({ processed: true })];
  }
}
```

### HTTP Nodes

HTTP nodes make requests to external APIs. They extend the `HttpRequestNode` base class:

```typescript
import { HttpRequestNode } from '@n8n-work/node-sdk';

export class MyHttpNode extends HttpRequestNode {
  async execute(context, data) {
    const response = await this.makeHttpRequest({
      method: 'GET',
      url: 'https://api.example.com/data'
    }, context);
    
    return [this.processHttpResponse(response)];
  }
}
```

### Trigger Nodes

Trigger nodes start workflows based on external events:

```typescript
import { TriggerNode } from '@n8n-work/node-sdk';

export class MyTriggerNode extends TriggerNode {
  async poll(context, data) {
    // Check for new data periodically
    const newItems = await this.checkForNewData();
    return this.createExecutionDataArray(newItems);
  }

  async webhook(context, data) {
    // Handle incoming webhook
    return [this.createExecutionData(data.inputData[0].json)];
  }
}
```

## Key Features

### Type Safety

The SDK is built with TypeScript and provides complete type safety:

```typescript
// Fully typed parameter access
const url = this.getParameter<string>(data.parameters, 'url');
const timeout = this.getParameter<number>(data.parameters, 'timeout', 5000);

// Type-safe node definition
const nodeType: INodeType = {
  name: 'myNode',
  properties: [
    {
      name: 'url',
      type: 'string',
      required: true,
      validation: {
        type: 'regex',
        pattern: '^https?://.+',
        errorMessage: 'Must be a valid URL'
      }
    }
  ]
};
```

### Parameter Validation

Built-in validation ensures data integrity:

```typescript
// Validate required parameters
this.validateRequiredParameters(data.parameters, ['apiKey', 'endpoint']);

// Custom validation
const result = validateParameter(value, parameterDefinition);
if (!result.valid) {
  throw new Error(result.error);
}
```

### Error Handling

Robust error handling with context:

```typescript
try {
  const response = await this.makeHttpRequest(config, context);
  return [this.processHttpResponse(response)];
} catch (error) {
  return [this.createExecutionData(
    { error: true, message: error.message },
    this.createError('API request failed', 'HTTP_ERROR', 500)
  )];
}
```

### Data Interpolation

Template string interpolation with special variables:

```typescript
// Basic interpolation
const message = this.interpolate('Hello {{name}}!', { name: 'World' });

// Special variables
const timestamp = this.interpolate('{{$now}}', {}); // Current ISO timestamp
const uuid = this.interpolate('{{$uuid}}', {});     // Generated UUID
```

## CLI Commands

The SDK includes a comprehensive CLI for development:

### Project Management

```bash
# Initialize new project
n8n-work init [name] [options]

# Start development server
n8n-work dev
```

### Node Development

```bash
# Create new node
n8n-work create <name> --type=<action|trigger|webhook>

# Build nodes
n8n-work build [--watch]

# Test nodes
n8n-work test [--watch] [--coverage]

# Validate nodes
n8n-work validate [--strict]

# Publish nodes
n8n-work publish [--dry-run]
```

## Examples and Templates

The SDK includes comprehensive examples:

- **Basic Action Node**: Simple data processing
- **HTTP API Integration**: External API calls with authentication
- **Webhook Trigger**: Receiving and processing webhooks
- **Polling Trigger**: Periodic data checking
- **Data Transformation**: Complex data manipulation

## Best Practices

### Security

- Never log sensitive data like API keys
- Validate and sanitize all user inputs
- Use secure defaults for all parameters
- Implement proper authentication handling

### Performance

- Implement request timeout and retry logic
- Use connection pooling for HTTP requests
- Cache expensive operations when appropriate
- Handle large datasets efficiently

### Testing

- Write comprehensive unit tests
- Test error scenarios and edge cases
- Use mocking for external dependencies
- Validate all parameter combinations

### Documentation

- Provide clear descriptions for all parameters
- Include usage examples and troubleshooting
- Document any special requirements or limitations
- Keep documentation up to date with code changes

## Next Steps

Ready to start building? Here are your next steps:

1. **[Installation](/sdk/installation)** - Set up your development environment
2. **[Quick Start](/sdk/quick-start)** - Build your first node in minutes
3. **[Node Types](/sdk/node-types)** - Learn about different node types
4. **[CLI Reference](/sdk/cli)** - Master the command-line tools
5. **[Publishing](/sdk/publishing)** - Share your nodes with the community

## Support

- 📖 **Documentation**: Complete API reference and guides
- 💬 **Discord**: [Join our developer community](https://discord.gg/n8n-work)
- 🐛 **Issues**: [Report bugs on GitHub](https://github.com/n8n-work/node-sdk-js/issues)
- 📧 **SDK Support**: [sdk-support@n8n-work.com](mailto:sdk-support@n8n-work.com)
