/**
 * N8N-Work Node SDK
 * 
 * Main entry point for the SDK. Exports all types, base classes, and utilities
 * needed to create custom nodes for the N8N-Work platform.
 */

// Export all types
export * from './types';

// Export base classes
export { NodeBase } from './base/NodeBase';
export { HttpRequestNode } from './base/HttpRequestNode';
export { TriggerNode } from './base/TriggerNode';

// Export utilities
export * from './utils';

// Export version
export const SDK_VERSION = '1.0.0';
