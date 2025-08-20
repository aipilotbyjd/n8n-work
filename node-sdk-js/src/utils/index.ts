import { JsonObject, JsonValue, NodeParameters, INodeParameter } from '@/types';

/**
 * Utility functions for node development
 */

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }

  const cloned = {} as T;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }

  return cloned;
}

/**
 * Merge two objects deeply
 */
export function deepMerge(target: JsonObject, source: JsonObject): JsonObject {
  const result = deepClone(target);

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key]) &&
        typeof result[key] === 'object' &&
        result[key] !== null &&
        !Array.isArray(result[key])
      ) {
        result[key] = deepMerge(result[key] as JsonObject, source[key] as JsonObject);
      } else {
        result[key] = deepClone(source[key]);
      }
    }
  }

  return result;
}

/**
 * Get nested value from object using dot notation
 */
export function getNestedValue(obj: JsonObject, path: string): JsonValue {
  return path.split('.').reduce((current: any, key: string) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

/**
 * Set nested value in object using dot notation
 */
export function setNestedValue(obj: JsonObject, path: string, value: JsonValue): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  
  const target = keys.reduce((current: any, key: string) => {
    if (current[key] === undefined || current[key] === null) {
      current[key] = {};
    }
    return current[key];
  }, obj);

  target[lastKey] = value;
}

/**
 * Validate parameter value against parameter definition
 */
export function validateParameter(
  value: JsonValue,
  parameter: INodeParameter
): { valid: boolean; error?: string } {
  // Check required
  if (parameter.required && (value === undefined || value === null || value === '')) {
    return { valid: false, error: `Parameter '${parameter.name}' is required` };
  }

  // Skip validation if value is empty and not required
  if (!parameter.required && (value === undefined || value === null || value === '')) {
    return { valid: true };
  }

  // Type validation
  switch (parameter.type) {
    case 'string':
      if (typeof value !== 'string') {
        return { valid: false, error: `Parameter '${parameter.name}' must be a string` };
      }
      break;

    case 'number':
      if (typeof value !== 'number') {
        return { valid: false, error: `Parameter '${parameter.name}' must be a number` };
      }
      
      if (parameter.typeOptions?.minValue !== undefined && value < parameter.typeOptions.minValue) {
        return { valid: false, error: `Parameter '${parameter.name}' must be at least ${parameter.typeOptions.minValue}` };
      }
      
      if (parameter.typeOptions?.maxValue !== undefined && value > parameter.typeOptions.maxValue) {
        return { valid: false, error: `Parameter '${parameter.name}' must be at most ${parameter.typeOptions.maxValue}` };
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        return { valid: false, error: `Parameter '${parameter.name}' must be a boolean` };
      }
      break;

    case 'select':
    case 'multiselect':
      if (!parameter.options) {
        return { valid: false, error: `Parameter '${parameter.name}' has no options defined` };
      }
      
      const allowedValues = parameter.options.map(opt => opt.value);
      
      if (parameter.type === 'multiselect') {
        if (!Array.isArray(value)) {
          return { valid: false, error: `Parameter '${parameter.name}' must be an array` };
        }
        
        const invalidValues = (value as JsonValue[]).filter(v => !allowedValues.includes(v));
        if (invalidValues.length > 0) {
          return { valid: false, error: `Parameter '${parameter.name}' contains invalid values: ${invalidValues.join(', ')}` };
        }
      } else {
        if (!allowedValues.includes(value)) {
          return { valid: false, error: `Parameter '${parameter.name}' must be one of: ${allowedValues.join(', ')}` };
        }
      }
      break;

    case 'json':
      try {
        if (typeof value === 'string') {
          JSON.parse(value);
        } else if (typeof value !== 'object') {
          return { valid: false, error: `Parameter '${parameter.name}' must be valid JSON` };
        }
      } catch {
        return { valid: false, error: `Parameter '${parameter.name}' must be valid JSON` };
      }
      break;
  }

  // Custom validation
  if (parameter.validation) {
    switch (parameter.validation.type) {
      case 'regex':
        if (typeof parameter.validation.pattern === 'string' && typeof value === 'string') {
          const regex = new RegExp(parameter.validation.pattern);
          if (!regex.test(value)) {
            return { 
              valid: false, 
              error: parameter.validation.errorMessage || `Parameter '${parameter.name}' format is invalid` 
            };
          }
        }
        break;

      case 'function':
        if (typeof parameter.validation.pattern === 'function') {
          try {
            if (!parameter.validation.pattern(value)) {
              return { 
                valid: false, 
                error: parameter.validation.errorMessage || `Parameter '${parameter.name}' is invalid` 
              };
            }
          } catch (error) {
            return { 
              valid: false, 
              error: `Parameter '${parameter.name}' validation failed: ${error}` 
            };
          }
        }
        break;
    }
  }

  return { valid: true };
}

/**
 * Validate all parameters against their definitions
 */
export function validateParameters(
  parameters: NodeParameters,
  definitions: INodeParameter[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const definition of definitions) {
    const value = parameters[definition.name];
    const result = validateParameter(value, definition);
    
    if (!result.valid && result.error) {
      errors.push(result.error);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Interpolate template strings with data
 */
export function interpolateString(template: string, data: JsonObject): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
    try {
      const trimmed = expression.trim();
      
      // Handle special expressions
      if (trimmed === '$now') {
        return new Date().toISOString();
      }
      
      if (trimmed === '$timestamp') {
        return Date.now().toString();
      }
      
      if (trimmed === '$uuid') {
        return require('uuid').v4();
      }
      
      // Handle nested object access
      const value = getNestedValue(data, trimmed);
      return value !== undefined ? String(value) : match;
    } catch {
      return match;
    }
  });
}

/**
 * Sanitize string for use in file names
 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Convert bytes to human readable format
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * Create a throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    factor?: number;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    factor = 2
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        throw lastError;
      }

      const delay = Math.min(baseDelay * Math.pow(factor, attempt), maxDelay);
      await sleep(delay);
    }
  }

  throw lastError!;
}
