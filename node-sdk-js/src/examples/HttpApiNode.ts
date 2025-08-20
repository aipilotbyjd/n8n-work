import {
  INodeType,
  IExecutionContext,
  IWorkflowData,
  INodeExecutionData,
  HttpRequestNode,
} from '@n8n-work/node-sdk';

/**
 * Example HTTP API Node that demonstrates how to create a node 
 * that makes HTTP requests to external APIs
 */
export class HttpApiNode extends HttpRequestNode {
  nodeType: INodeType = {
    name: 'httpApi',
    displayName: 'HTTP API',
    description: 'Make HTTP requests to external APIs',
    version: 1,
    group: 'action',
    defaults: {
      name: 'HTTP API',
      color: '#4A90E2',
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
        name: 'method',
        displayName: 'HTTP Method',
        type: 'select',
        default: 'GET',
        options: [
          { name: 'GET', value: 'GET' },
          { name: 'POST', value: 'POST' },
          { name: 'PUT', value: 'PUT' },
          { name: 'DELETE', value: 'DELETE' },
          { name: 'PATCH', value: 'PATCH' },
        ],
        required: true,
        description: 'The HTTP method to use',
      },
      {
        name: 'url',
        displayName: 'URL',
        type: 'string',
        default: '',
        placeholder: 'https://api.example.com/data',
        required: true,
        description: 'The URL to make the request to',
      },
      {
        name: 'headers',
        displayName: 'Headers',
        type: 'json',
        default: '{}',
        description: 'HTTP headers to send with the request',
        typeOptions: {
          multipleLines: true,
        },
      },
      {
        name: 'body',
        displayName: 'Request Body',
        type: 'json',
        default: '{}',
        description: 'The request body (for POST, PUT, PATCH)',
        displayOptions: {
          show: {
            method: ['POST', 'PUT', 'PATCH'],
          },
        },
        typeOptions: {
          multipleLines: true,
        },
      },
      {
        name: 'queryParams',
        displayName: 'Query Parameters',
        type: 'json',
        default: '{}',
        description: 'Query parameters to append to the URL',
        typeOptions: {
          multipleLines: true,
        },
      },
      {
        name: 'timeout',
        displayName: 'Timeout (ms)',
        type: 'number',
        default: 30000,
        description: 'Request timeout in milliseconds',
        typeOptions: {
          minValue: 1000,
          maxValue: 300000,
        },
      },
      {
        name: 'followRedirects',
        displayName: 'Follow Redirects',
        type: 'boolean',
        default: true,
        description: 'Whether to follow HTTP redirects',
      },
      {
        name: 'includeHeaders',
        displayName: 'Include Response Headers',
        type: 'boolean',
        default: false,
        description: 'Include response headers in the output',
      },
    ],
    credentials: [
      {
        name: 'httpBasicAuth',
      },
      {
        name: 'httpHeaderAuth',
      },
      {
        name: 'httpBearerAuth',
      },
    ],
    documentation: {
      description: 'Make HTTP requests to external APIs and process the responses',
      examples: [
        {
          name: 'GET request with query parameters',
          description: 'Fetch data from an API with query parameters',
          parameters: {
            method: 'GET',
            url: 'https://jsonplaceholder.typicode.com/posts',
            queryParams: '{"userId": 1}',
          },
          workflow: {},
        },
        {
          name: 'POST request with JSON body',
          description: 'Create a new resource via API',
          parameters: {
            method: 'POST',
            url: 'https://jsonplaceholder.typicode.com/posts',
            headers: '{"Content-Type": "application/json"}',
            body: '{"title": "My Post", "body": "Post content", "userId": 1}',
          },
          workflow: {},
        },
      ],
    },
    tags: ['http', 'api', 'request', 'rest'],
  };

  async execute(
    context: IExecutionContext,
    data: IWorkflowData
  ): Promise<INodeExecutionData[]> {
    // Validate required parameters
    this.validateRequiredParameters(data.parameters, ['method', 'url']);

    const method = this.getParameter<string>(data.parameters, 'method', 'GET');
    const url = this.getParameter<string>(data.parameters, 'url');
    const headers = this.getParameter<object>(data.parameters, 'headers', {});
    const body = this.getParameter<object>(data.parameters, 'body', {});
    const queryParams = this.getParameter<object>(data.parameters, 'queryParams', {});
    const timeout = this.getParameter<number>(data.parameters, 'timeout', 30000);
    const followRedirects = this.getParameter<boolean>(data.parameters, 'followRedirects', true);
    const includeHeaders = this.getParameter<boolean>(data.parameters, 'includeHeaders', false);

    const results: INodeExecutionData[] = [];

    for (const item of data.inputData) {
      try {
        // Interpolate URL with input data
        const interpolatedUrl = this.interpolate(url, item.json);
        
        // Build full URL with query parameters
        const queryString = this.buildQueryString(queryParams as any);
        const fullUrl = interpolatedUrl + queryString;

        // Prepare request configuration
        const requestConfig: any = {
          method: method.toUpperCase(),
          url: fullUrl,
          headers: headers || {},
          timeout,
          maxRedirects: followRedirects ? 5 : 0,
        };

        // Add body for methods that support it
        if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && body) {
          requestConfig.data = body;
        }

        // Apply authentication if credentials are provided
        if (data.credentials) {
          this.applyAuthentication(requestConfig, data.credentials.type, data.credentials.data);
        }

        // Make the HTTP request
        const response = await this.makeHttpRequest(requestConfig, context);

        // Process response
        const executionData = this.processHttpResponse(response, includeHeaders);
        
        // Add input data context
        executionData.json = {
          ...item.json,
          httpResponse: executionData.json,
        };

        results.push(executionData);

      } catch (error: any) {
        // Create error result
        results.push(
          this.createExecutionData(
            {
              ...item.json,
              error: true,
              errorMessage: error.message,
            },
            this.createError(
              `HTTP request failed: ${error.message}`,
              'HTTP_REQUEST_ERROR',
              error.response?.status
            )
          )
        );
      }
    }

    return results;
  }

  /**
   * Test the node configuration
   */
  async test(
    context: IExecutionContext,
    data: IWorkflowData
  ): Promise<boolean> {
    try {
      const url = this.getParameter<string>(data.parameters, 'url');
      const method = this.getParameter<string>(data.parameters, 'method', 'GET');
      
      if (!url) {
        throw new Error('URL is required for testing');
      }

      // Make a simple test request
      const requestConfig: any = {
        method: method.toUpperCase(),
        url,
        timeout: 5000,
      };

      const response = await this.makeHttpRequest(requestConfig, context);
      
      // Consider 2xx and 3xx status codes as successful
      return response.status >= 200 && response.status < 400;
      
    } catch (error) {
      return false;
    }
  }
}
