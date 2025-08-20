import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { NodeBase } from './NodeBase';
import {
  IExecutionContext,
  IWorkflowData,
  INodeExecutionData,
  JsonObject,
  IBinaryDataEntry,
} from '@/types';

/**
 * Base class for nodes that make HTTP requests
 */
export abstract class HttpRequestNode extends NodeBase {
  /**
   * Make HTTP request with standard configuration
   */
  protected async makeHttpRequest(
    config: AxiosRequestConfig,
    context: IExecutionContext
  ): Promise<AxiosResponse> {
    const requestConfig: AxiosRequestConfig = {
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: () => true, // Don't throw on HTTP error codes
      ...config,
      headers: {
        'User-Agent': 'N8N-Work/1.0',
        'X-Execution-Id': context.executionId,
        'X-Workflow-Id': context.workflowId,
        ...config.headers,
      },
    };

    try {
      const response = await axios(requestConfig);
      return response;
    } catch (error: any) {
      throw new Error(`HTTP request failed: ${error.message}`);
    }
  }

  /**
   * Process HTTP response and create execution data
   */
  protected processHttpResponse(
    response: AxiosResponse,
    includeHeaders: boolean = false
  ): INodeExecutionData {
    const json: JsonObject = {
      statusCode: response.status,
      statusMessage: response.statusText,
      body: response.data,
    };

    if (includeHeaders) {
      json.headers = response.headers;
    }

    // Handle binary responses
    let binary: { [key: string]: IBinaryDataEntry } | undefined;
    if (response.headers['content-type']?.startsWith('application/octet-stream') ||
        response.headers['content-type']?.startsWith('image/') ||
        response.headers['content-type']?.startsWith('video/') ||
        response.headers['content-type']?.startsWith('audio/')) {
      
      const buffer = Buffer.isBuffer(response.data) 
        ? response.data 
        : Buffer.from(response.data);

      binary = {
        data: {
          data: buffer,
          mimeType: response.headers['content-type'] || 'application/octet-stream',
          fileName: this.extractFileNameFromHeaders(response.headers),
          fileSize: buffer.length,
        },
      };
    }

    return {
      json,
      binary,
    };
  }

  /**
   * Extract filename from response headers
   */
  private extractFileNameFromHeaders(headers: any): string | undefined {
    const contentDisposition = headers['content-disposition'];
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      return match ? match[1] : undefined;
    }
    return undefined;
  }

  /**
   * Build query string from parameters
   */
  protected buildQueryString(params: JsonObject): string {
    const queryParts: string[] = [];
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(v => {
            queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
          });
        } else {
          queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
        }
      }
    });

    return queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  }

  /**
   * Handle authentication for HTTP requests
   */
  protected applyAuthentication(
    config: AxiosRequestConfig,
    authType: string,
    credentials: JsonObject
  ): AxiosRequestConfig {
    switch (authType) {
      case 'bearer':
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${credentials.token}`,
        };
        break;

      case 'basic':
        config.auth = {
          username: credentials.username as string,
          password: credentials.password as string,
        };
        break;

      case 'apiKey':
        if (credentials.location === 'header') {
          config.headers = {
            ...config.headers,
            [credentials.name as string]: credentials.value,
          };
        } else if (credentials.location === 'query') {
          config.params = {
            ...config.params,
            [credentials.name as string]: credentials.value,
          };
        }
        break;

      case 'oauth2':
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${credentials.accessToken}`,
        };
        break;

      default:
        // No authentication or unsupported type
        break;
    }

    return config;
  }

  /**
   * Retry HTTP request with exponential backoff
   */
  protected async retryHttpRequest(
    config: AxiosRequestConfig,
    context: IExecutionContext,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<AxiosResponse> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.makeHttpRequest(config, context);
      } catch (error: any) {
        lastError = error;

        if (attempt === maxRetries) {
          throw lastError;
        }

        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Retry on network errors, timeouts, and 5xx status codes
    if (error.code === 'ECONNRESET' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ENOTFOUND') {
      return true;
    }

    if (error.response?.status >= 500) {
      return true;
    }

    return false;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
