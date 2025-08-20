import {
  INodeType,
  IExecutionContext,
  IWorkflowData,
  INodeExecutionData,
  TriggerNode,
} from '@n8n-work/node-sdk';

/**
 * Example Webhook Trigger Node that demonstrates how to create
 * a node that receives webhook events from external services
 */
export class WebhookTriggerNode extends TriggerNode {
  nodeType: INodeType = {
    name: 'webhookTrigger',
    displayName: 'Webhook Trigger',
    description: 'Receive webhook events from external services',
    version: 1,
    group: 'trigger',
    defaults: {
      name: 'Webhook Trigger',
      color: '#FF6B6B',
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
        name: 'webhookPath',
        displayName: 'Webhook Path',
        type: 'string',
        default: '',
        placeholder: '/webhook/my-service',
        description: 'The path for the webhook URL (leave empty for auto-generated)',
      },
      {
        name: 'httpMethod',
        displayName: 'HTTP Method',
        type: 'multiselect',
        default: ['POST'],
        options: [
          { name: 'GET', value: 'GET' },
          { name: 'POST', value: 'POST' },
          { name: 'PUT', value: 'PUT' },
          { name: 'DELETE', value: 'DELETE' },
          { name: 'PATCH', value: 'PATCH' },
        ],
        required: true,
        description: 'HTTP methods to accept for this webhook',
      },
      {
        name: 'responseMode',
        displayName: 'Response Mode',
        type: 'select',
        default: 'onReceived',
        options: [
          { name: 'Immediately', value: 'onReceived', description: 'Respond immediately when webhook is received' },
          { name: 'When Workflow Finishes', value: 'lastNode', description: 'Respond when the entire workflow completes' },
          { name: 'Custom Response', value: 'responseNode', description: 'Use a custom response from the workflow' },
        ],
        description: 'How to respond to the webhook',
      },
      {
        name: 'responseData',
        displayName: 'Response Data',
        type: 'json',
        default: '{"status": "received"}',
        description: 'Custom response data to send back',
        displayOptions: {
          show: {
            responseMode: ['onReceived'],
          },
        },
        typeOptions: {
          multipleLines: true,
        },
      },
      {
        name: 'responseStatusCode',
        displayName: 'Response Status Code',
        type: 'number',
        default: 200,
        description: 'HTTP status code for the response',
        typeOptions: {
          minValue: 100,
          maxValue: 599,
        },
      },
      {
        name: 'responseHeaders',
        displayName: 'Response Headers',
        type: 'json',
        default: '{"Content-Type": "application/json"}',
        description: 'Headers to include in the response',
        typeOptions: {
          multipleLines: true,
        },
      },
      {
        name: 'authentication',
        displayName: 'Authentication',
        type: 'select',
        default: 'none',
        options: [
          { name: 'None', value: 'none' },
          { name: 'Header Auth', value: 'headerAuth' },
          { name: 'Query Auth', value: 'queryAuth' },
          { name: 'Webhook Signature', value: 'webhookSignature' },
        ],
        description: 'Authentication method for the webhook',
      },
      {
        name: 'authHeaderName',
        displayName: 'Auth Header Name',
        type: 'string',
        default: 'Authorization',
        description: 'Name of the authentication header',
        displayOptions: {
          show: {
            authentication: ['headerAuth'],
          },
        },
      },
      {
        name: 'authHeaderValue',
        displayName: 'Auth Header Value',
        type: 'string',
        default: '',
        description: 'Expected value of the authentication header',
        typeOptions: {
          password: true,
        },
        displayOptions: {
          show: {
            authentication: ['headerAuth'],
          },
        },
      },
      {
        name: 'signatureSecret',
        displayName: 'Signature Secret',
        type: 'string',
        default: '',
        description: 'Secret key for validating webhook signatures',
        typeOptions: {
          password: true,
        },
        displayOptions: {
          show: {
            authentication: ['webhookSignature'],
          },
        },
      },
      {
        name: 'signatureHeader',
        displayName: 'Signature Header',
        type: 'string',
        default: 'x-signature',
        description: 'Header containing the webhook signature',
        displayOptions: {
          show: {
            authentication: ['webhookSignature'],
          },
        },
      },
    ],
    webhooks: [
      {
        name: 'default',
        httpMethod: '*',
        responseMode: 'onReceived',
        path: '',
      },
    ],
    documentation: {
      description: 'Receive webhook events from external services like GitHub, Slack, or custom applications',
      examples: [
        {
          name: 'GitHub webhook',
          description: 'Receive GitHub webhook events for repository changes',
          parameters: {
            webhookPath: '/webhook/github',
            httpMethod: ['POST'],
            authentication: 'webhookSignature',
            signatureSecret: 'your-github-secret',
            signatureHeader: 'x-hub-signature-256',
          },
          workflow: {},
        },
        {
          name: 'Slack webhook',
          description: 'Receive Slack webhook events for interactive components',
          parameters: {
            webhookPath: '/webhook/slack',
            httpMethod: ['POST'],
            authentication: 'headerAuth',
            authHeaderName: 'Authorization',
            authHeaderValue: 'Bearer your-slack-token',
          },
          workflow: {},
        },
      ],
    },
    tags: ['webhook', 'trigger', 'http', 'event'],
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
    const authentication = this.getParameter<string>(data.parameters, 'authentication', 'none');
    const responseMode = this.getParameter<string>(data.parameters, 'responseMode', 'onReceived');
    const responseData = this.getParameter<object>(data.parameters, 'responseData', { status: 'received' });
    const responseStatusCode = this.getParameter<number>(data.parameters, 'responseStatusCode', 200);
    const responseHeaders = this.getParameter<object>(data.parameters, 'responseHeaders', {});

    const results: INodeExecutionData[] = [];

    for (const item of data.inputData) {
      try {
        // Validate authentication if required
        if (authentication !== 'none') {
          const isValid = await this.validateAuthentication(data.parameters, item.json);
          if (!isValid) {
            throw new Error('Webhook authentication failed');
          }
        }

        // Parse webhook headers
        const webhookHeaders = this.parseWebhookHeaders(
          (item.json.headers as Record<string, string>) || {}
        );

        // Extract webhook payload
        const payload = item.json.body || item.json;

        // Create execution data
        const executionData = this.createExecutionData({
          webhookId: context.stepId,
          timestamp: new Date().toISOString(),
          headers: webhookHeaders,
          payload,
          method: item.json.method || 'POST',
          url: item.json.url || '',
          query: item.json.query || {},
          authentication: {
            type: authentication,
            validated: true,
          },
          response: {
            mode: responseMode,
            statusCode: responseStatusCode,
            headers: responseHeaders,
            data: responseData,
          },
        });

        results.push(executionData);

      } catch (error: any) {
        // Create error result but still return it for webhook response
        results.push(
          this.createExecutionData(
            {
              webhookId: context.stepId,
              timestamp: new Date().toISOString(),
              error: true,
              errorMessage: error.message,
              response: {
                statusCode: 401,
                data: { error: error.message },
              },
            },
            this.createError(
              `Webhook processing failed: ${error.message}`,
              'WEBHOOK_ERROR',
              401
            )
          )
        );
      }
    }

    return results;
  }

  /**
   * Validate webhook authentication
   */
  private async validateAuthentication(
    parameters: any,
    payload: any
  ): Promise<boolean> {
    const authentication = this.getParameter<string>(parameters, 'authentication', 'none');

    switch (authentication) {
      case 'headerAuth': {
        const headerName = this.getParameter<string>(parameters, 'authHeaderName', 'Authorization');
        const expectedValue = this.getParameter<string>(parameters, 'authHeaderValue', '');
        const headers = payload.headers || {};
        
        const actualValue = headers[headerName] || headers[headerName.toLowerCase()];
        return actualValue === expectedValue;
      }

      case 'queryAuth': {
        const queryParamName = this.getParameter<string>(parameters, 'authQueryParam', 'token');
        const expectedValue = this.getParameter<string>(parameters, 'authQueryValue', '');
        const query = payload.query || {};
        
        return query[queryParamName] === expectedValue;
      }

      case 'webhookSignature': {
        const secret = this.getParameter<string>(parameters, 'signatureSecret', '');
        const signatureHeader = this.getParameter<string>(parameters, 'signatureHeader', 'x-signature');
        const headers = payload.headers || {};
        
        const signature = headers[signatureHeader] || headers[signatureHeader.toLowerCase()];
        const rawPayload = JSON.stringify(payload.body || payload);
        
        return this.validateWebhookSignature(rawPayload, signature, secret);
      }

      default:
        return true;
    }
  }

  /**
   * Test the webhook configuration
   */
  async test(
    context: IExecutionContext,
    data: IWorkflowData
  ): Promise<boolean> {
    try {
      // Create a mock webhook payload for testing
      const mockPayload = {
        test: true,
        timestamp: new Date().toISOString(),
        source: 'webhook-test',
      };

      const mockData: IWorkflowData = {
        ...data,
        inputData: [
          {
            json: {
              body: mockPayload,
              headers: { 'content-type': 'application/json' },
              method: 'POST',
            },
          },
        ],
      };

      const result = await this.webhook(context, mockData);
      
      // Test is successful if we get a result without errors
      return result.length > 0 && !result[0].error;
      
    } catch (error) {
      return false;
    }
  }
}
