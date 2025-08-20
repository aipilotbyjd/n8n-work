import {
  INodeType,
  INodeExecutionFunctions,
  IExecutionContext,
  IWorkflowData,
  INodeExecutionData,
  NodeParameters,
  JsonObject,
  INodeExecutionError,
} from '@/types';

/**
 * Abstract base class for all node implementations
 */
export abstract class NodeBase implements INodeExecutionFunctions {
  /**
   * Node type definition
   */
  public abstract nodeType: INodeType;

  /**
   * Execute the node with the given context and data
   */
  public abstract execute(
    context: IExecutionContext,
    data: IWorkflowData
  ): Promise<INodeExecutionData[]>;

  /**
   * Optional polling function for trigger nodes
   */
  public async poll?(
    context: IExecutionContext,
    data: IWorkflowData
  ): Promise<INodeExecutionData[]>;

  /**
   * Optional webhook function for webhook nodes
   */
  public async webhook?(
    context: IExecutionContext,
    data: IWorkflowData
  ): Promise<INodeExecutionData[]>;

  /**
   * Optional test function for validating node configuration
   */
  public async test?(
    context: IExecutionContext,
    data: IWorkflowData
  ): Promise<boolean>;

  /**
   * Helper method to get parameter value with type safety
   */
  protected getParameter<T = any>(
    parameters: NodeParameters,
    name: string,
    defaultValue?: T
  ): T {
    const value = parameters[name];
    return value !== undefined ? (value as T) : (defaultValue as T);
  }

  /**
   * Helper method to validate required parameters
   */
  protected validateRequiredParameters(
    parameters: NodeParameters,
    required: string[]
  ): void {
    const missing = required.filter(param => 
      parameters[param] === undefined || parameters[param] === null || parameters[param] === ''
    );
    
    if (missing.length > 0) {
      throw new Error(`Missing required parameters: ${missing.join(', ')}`);
    }
  }

  /**
   * Helper method to create error result
   */
  protected createError(
    message: string,
    code?: string,
    httpCode?: number,
    context?: JsonObject
  ): INodeExecutionError {
    return {
      message,
      code,
      httpCode,
      context,
      stack: new Error().stack,
    };
  }

  /**
   * Helper method to create execution data
   */
  protected createExecutionData(
    json: JsonObject,
    error?: INodeExecutionError
  ): INodeExecutionData {
    return {
      json,
      error,
    };
  }

  /**
   * Helper method to create multiple execution data items
   */
  protected createExecutionDataArray(items: JsonObject[]): INodeExecutionData[] {
    return items.map(item => this.createExecutionData(item));
  }

  /**
   * Helper method to interpolate template strings
   */
  protected interpolate(template: string, data: JsonObject): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const value = this.getNestedValue(data, key.trim());
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Helper method to get nested object values
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Helper method to merge input data
   */
  protected mergeInputData(inputData: INodeExecutionData[]): JsonObject {
    const merged: JsonObject = {};
    
    inputData.forEach((item, index) => {
      Object.keys(item.json).forEach(key => {
        const value = item.json[key];
        if (merged[key] !== undefined) {
          // If key exists, create array or add to existing array
          if (Array.isArray(merged[key])) {
            (merged[key] as any[]).push(value);
          } else {
            merged[key] = [merged[key], value];
          }
        } else {
          merged[key] = value;
        }
      });
    });

    return merged;
  }

  /**
   * Helper method to validate JSON schema
   */
  protected validateJsonSchema(data: any, schema: JsonObject): boolean {
    // Basic JSON schema validation - would use a proper library in production
    try {
      if (schema.type === 'object' && typeof data !== 'object') {
        return false;
      }
      if (schema.type === 'string' && typeof data !== 'string') {
        return false;
      }
      if (schema.type === 'number' && typeof data !== 'number') {
        return false;
      }
      if (schema.type === 'boolean' && typeof data !== 'boolean') {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }
}
