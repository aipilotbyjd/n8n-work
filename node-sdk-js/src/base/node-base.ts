import { EventEmitter } from 'events';
import { Logger } from 'pino';
import { NodeExecutionContext, NodeExecutionResult } from '../types/execution.types';
import { NodeCredentials } from '../types/credential.types';
import { NodeParameters } from '../types/parameter.types';
import { SchemaValidator } from '../validation/schema-validator';
import { createLogger } from '../utils/logger';

/**
 * Base class for all N8N-Work nodes
 * Provides common functionality and standardized interface
 */
export abstract class NodeBase extends EventEmitter {
  protected readonly logger: Logger;
  protected readonly validator: SchemaValidator;
  protected context: NodeExecutionContext | null = null;
  
  public readonly name: string;
  public readonly displayName: string;
  public readonly description: string;
  public readonly version: number;
  public readonly group: string;
  public readonly icon: string;
  public readonly defaults: Record<string, any>;
  
  constructor(definition: NodeDefinition) {
    super();
    
    this.name = definition.name;
    this.displayName = definition.displayName;
    this.description = definition.description;
    this.version = definition.version;
    this.group = definition.group || 'General';
    this.icon = definition.icon || 'default';
    this.defaults = definition.defaults || {};
    
    this.logger = createLogger(this.name);
    this.validator = new SchemaValidator();
    
    // Validate node definition
    this.validateDefinition(definition);
  }

  /**
   * Main execution method - must be implemented by subclasses
   */
  abstract execute(
    inputData: any,
    parameters: NodeParameters,
    credentials?: NodeCredentials,
  ): Promise<any>;

  /**
   * Get node schema for validation and UI generation
   */
  abstract getSchema(): NodeSchema;

  /**
   * Execute the node with full context and error handling
   */
  async executeWithContext(
    context: NodeExecutionContext,
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    this.context = context;
    
    try {
      this.logger.info('Starting node execution', {
        stepId: context.stepId,
        nodeType: context.nodeType,
      });

      // Validate input parameters
      await this.validateInput(context.parameters);

      // Validate credentials if required
      if (context.credentials && this.requiresCredentials()) {
        await this.validateCredentials(context.credentials);
      }

      // Parse input data
      const inputData = context.inputData ? JSON.parse(context.inputData) : {};

      // Execute the node
      const result = await this.execute(
        inputData,
        context.parameters,
        context.credentials,
      );

      // Validate output
      await this.validateOutput(result);

      const executionTime = Date.now() - startTime;

      this.logger.info('Node execution completed', {
        stepId: context.stepId,
        executionTime,
        success: true,
      });

      return {
        success: true,
        outputData: JSON.stringify(result),
        errorMessage: '',
        errorCode: '',
        retryable: false,
        metrics: {
          executionTimeMs: executionTime,
          memoryUsedBytes: this.getMemoryUsage(),
          cpuTimeMs: 0,
          networkRequests: this.getNetworkRequestCount(),
          networkBytesSent: this.getNetworkBytesSent(),
          networkBytesReceived: this.getNetworkBytesReceived(),
          fileOperations: this.getFileOperationCount(),
        },
        logs: this.getLogs(),
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      this.logger.error('Node execution failed', {
        stepId: context.stepId,
        error: error.message,
        executionTime,
      });

      return {
        success: false,
        outputData: '',
        errorMessage: error.message,
        errorCode: error.code || 'NODE_EXECUTION_ERROR',
        retryable: this.isRetryableError(error),
        metrics: {
          executionTimeMs: executionTime,
          memoryUsedBytes: this.getMemoryUsage(),
          cpuTimeMs: 0,
          networkRequests: this.getNetworkRequestCount(),
          networkBytesSent: this.getNetworkBytesSent(),
          networkBytesReceived: this.getNetworkBytesReceived(),
          fileOperations: this.getFileOperationCount(),
        },
        logs: this.getLogs(),
      };
    }
  }

  /**
   * Validate node definition
   */
  protected validateDefinition(definition: NodeDefinition): void {
    if (!definition.name) {
      throw new Error('Node name is required');
    }
    
    if (!definition.displayName) {
      throw new Error('Node display name is required');
    }
    
    if (!definition.description) {
      throw new Error('Node description is required');
    }
    
    if (!definition.version || definition.version < 1) {
      throw new Error('Node version must be >= 1');
    }
  }

  /**
   * Validate input parameters against schema
   */
  protected async validateInput(parameters: NodeParameters): Promise<void> {
    const schema = this.getSchema();
    const result = await this.validator.validateParameters(parameters, schema.parameters);
    
    if (!result.valid) {
      throw new Error(`Parameter validation failed: ${result.errors.join(', ')}`);
    }
  }

  /**
   * Validate credentials if required
   */
  protected async validateCredentials(credentials: NodeCredentials): Promise<void> {
    const schema = this.getSchema();
    
    if (schema.credentials) {
      const result = await this.validator.validateCredentials(credentials, schema.credentials);
      
      if (!result.valid) {
        throw new Error(`Credential validation failed: ${result.errors.join(', ')}`);
      }
    }
  }

  /**
   * Validate output data against schema
   */
  protected async validateOutput(output: any): Promise<void> {
    const schema = this.getSchema();
    
    if (schema.outputs) {
      const result = await this.validator.validateOutput(output, schema.outputs);
      
      if (!result.valid) {
        this.logger.warn('Output validation failed', { errors: result.errors });
      }
    }
  }

  /**
   * Check if the node requires credentials
   */
  protected requiresCredentials(): boolean {
    const schema = this.getSchema();
    return schema.credentials && schema.credentials.required === true;
  }

  /**
   * Determine if an error should trigger a retry
   */
  protected isRetryableError(error: any): boolean {
    // Network errors are generally retryable
    if (error.code === 'ECONNRESET' || 
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND') {
      return true;
    }

    // HTTP 5xx errors are retryable
    if (error.response && error.response.status >= 500) {
      return true;
    }

    // Rate limit errors are retryable
    if (error.response && error.response.status === 429) {
      return true;
    }

    return false;
  }

  /**
   * Utility methods for metrics collection
   */
  protected getMemoryUsage(): number {
    return process.memoryUsage().heapUsed;
  }

  protected getNetworkRequestCount(): number {
    // Implementation would track network requests
    return 0;
  }

  protected getNetworkBytesSent(): number {
    // Implementation would track bytes sent
    return 0;
  }

  protected getNetworkBytesReceived(): number {
    // Implementation would track bytes received
    return 0;
  }

  protected getFileOperationCount(): number {
    // Implementation would track file operations
    return 0;
  }

  protected getLogs(): string[] {
    // Implementation would return captured logs
    return [];
  }

  /**
   * Helper methods for common operations
   */
  
  /**
   * Make HTTP request with automatic retries and error handling
   */
  protected async makeHttpRequest(options: HttpRequestOptions): Promise<any> {
    const axios = require('axios');
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const response = await axios({
          ...options,
          timeout: options.timeout || 30000,
        });

        return response.data;
      } catch (error) {
        attempt++;
        
        if (attempt >= maxRetries || !this.isRetryableError(error)) {
          throw error;
        }

        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Get parameter value with default fallback
   */
  protected getParameter<T = any>(
    parameters: NodeParameters,
    key: string,
    defaultValue?: T,
  ): T {
    const value = parameters[key];
    
    if (value === undefined || value === null) {
      return defaultValue !== undefined ? defaultValue : this.defaults[key];
    }
    
    return value as T;
  }

  /**
   * Get credential value securely
   */
  protected getCredential(
    credentials: NodeCredentials,
    key: string,
  ): string | undefined {
    return credentials?.[key];
  }

  /**
   * Transform input data based on mapping configuration
   */
  protected transformInput(
    data: any,
    mapping: Record<string, string>,
  ): any {
    if (!data || !mapping) {
      return data;
    }

    const transformed: any = {};

    for (const [targetKey, sourcePath] of Object.entries(mapping)) {
      const value = this.getNestedValue(data, sourcePath);
      if (value !== undefined) {
        this.setNestedValue(transformed, targetKey, value);
      }
    }

    return transformed;
  }

  /**
   * Get nested property value using dot notation
   */
  protected getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Set nested property value using dot notation
   */
  protected setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    
    const target = keys.reduce((current, key) => {
      if (!current[key]) {
        current[key] = {};
      }
      return current[key];
    }, obj);

    target[lastKey] = value;
  }

  /**
   * Batch process items with concurrency control
   */
  protected async batchProcess<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    concurrency: number = 5,
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(item => processor(item)),
      );
      results.push(...batchResults);
    }

    return results;
  }
}

// Type definitions
export interface NodeDefinition {
  name: string;
  displayName: string;
  description: string;
  version: number;
  group?: string;
  icon?: string;
  defaults?: Record<string, any>;
}

export interface NodeSchema {
  parameters: ParameterSchema[];
  credentials?: CredentialSchema;
  outputs?: OutputSchema[];
}

export interface ParameterSchema {
  name: string;
  displayName: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'collection';
  required?: boolean;
  default?: any;
  description?: string;
  options?: ParameterOption[];
}

export interface ParameterOption {
  name: string;
  value: any;
  description?: string;
}

export interface CredentialSchema {
  name: string;
  displayName: string;
  required: boolean;
  properties: CredentialProperty[];
}

export interface CredentialProperty {
  name: string;
  displayName: string;
  type: 'string' | 'password';
  required: boolean;
}

export interface OutputSchema {
  name: string;
  displayName: string;
  type: string;
  description?: string;
}

export interface HttpRequestOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  data?: any;
  timeout?: number;
  auth?: {
    username: string;
    password: string;
  };
}
