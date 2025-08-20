/**
 * Core types and interfaces for the N8N-Work Node SDK
 */

// ============================================================================
// Basic Types
// ============================================================================

export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];

export type NodeParameterValue = JsonValue;
export type NodeParameters = Record<string, NodeParameterValue>;

// ============================================================================
// Node Execution Context
// ============================================================================

export interface IExecutionContext {
  /** Unique execution ID */
  executionId: string;
  /** Workflow ID */
  workflowId: string;
  /** Current step/node ID */
  stepId: string;
  /** User ID executing the workflow */
  userId?: string;
  /** Execution mode (test, production, etc.) */
  mode: 'test' | 'production' | 'manual' | 'webhook';
  /** Execution timestamp */
  timestamp: Date;
  /** Additional context data */
  context?: JsonObject;
}

export interface IWorkflowData {
  /** Input data from previous nodes */
  inputData: INodeExecutionData[];
  /** Node parameters */
  parameters: NodeParameters;
  /** Credentials for the node */
  credentials?: ICredentials;
  /** Additional workflow metadata */
  metadata?: JsonObject;
}

export interface INodeExecutionData {
  /** Main data object */
  json: JsonObject;
  /** Binary data attachments */
  binary?: IBinaryData;
  /** Error information if any */
  error?: INodeExecutionError;
  /** Pagination information */
  pagedResponse?: {
    hasMore: boolean;
    nextPageToken?: string;
  };
}

export interface IBinaryData {
  [key: string]: IBinaryDataEntry;
}

export interface IBinaryDataEntry {
  /** Data buffer */
  data: Buffer;
  /** MIME type */
  mimeType: string;
  /** Original filename */
  fileName?: string;
  /** File extension */
  fileExtension?: string;
  /** File size in bytes */
  fileSize?: number;
  /** Additional metadata */
  metadata?: JsonObject;
}

export interface INodeExecutionError {
  /** Error message */
  message: string;
  /** Error code */
  code?: string;
  /** HTTP status code if applicable */
  httpCode?: number;
  /** Stack trace */
  stack?: string;
  /** Additional error context */
  context?: JsonObject;
}

// ============================================================================
// Node Definition
// ============================================================================

export interface INodeType {
  /** Node type name (unique identifier) */
  name: string;
  /** Display name for the node */
  displayName: string;
  /** Node description */
  description: string;
  /** Node version */
  version: number;
  /** Node group/category */
  group: NodeGroup;
  /** Node icon (base64 or URL) */
  icon?: string;
  /** Node color (hex code) */
  color?: string;
  /** Node defaults */
  defaults: INodeDefaults;
  /** Node inputs configuration */
  inputs: INodeInput[];
  /** Node outputs configuration */
  outputs: INodeOutput[];
  /** Node parameters/properties */
  properties: INodeParameter[];
  /** Node credentials */
  credentials?: INodeCredentials[];
  /** Webhook configuration if applicable */
  webhooks?: IWebhookDescription[];
  /** Polling configuration if applicable */
  polling?: IPollingConfiguration;
  /** Node documentation */
  documentation?: INodeDocumentation;
  /** Node tags for searchability */
  tags?: string[];
}

export type NodeGroup = 
  | 'input' 
  | 'output' 
  | 'transform' 
  | 'trigger' 
  | 'action' 
  | 'utility' 
  | 'conditional' 
  | 'loop';

export interface INodeDefaults {
  /** Default display name */
  name: string;
  /** Default node color */
  color?: string;
  /** Default parameter values */
  parameters?: NodeParameters;
}

export interface INodeInput {
  /** Input type */
  type: 'main' | 'ai' | 'webhook';
  /** Display name */
  displayName: string;
  /** Whether input is required */
  required?: boolean;
  /** Maximum number of connections */
  maxConnections?: number;
}

export interface INodeOutput {
  /** Output type */
  type: 'main' | 'ai' | 'webhook';
  /** Display name */
  displayName: string;
  /** Maximum number of connections */
  maxConnections?: number;
}

// ============================================================================
// Node Parameters
// ============================================================================

export interface INodeParameter {
  /** Parameter name (used as key) */
  name: string;
  /** Display name for UI */
  displayName: string;
  /** Parameter type */
  type: NodeParameterType;
  /** Default value */
  default?: NodeParameterValue;
  /** Parameter description */
  description?: string;
  /** Whether parameter is required */
  required?: boolean;
  /** Parameter options for select/multiselect */
  options?: INodeParameterOption[];
  /** Type-specific options */
  typeOptions?: INodeParameterTypeOptions;
  /** Display conditions */
  displayOptions?: INodeParameterDisplayOptions;
  /** Parameter placeholder text */
  placeholder?: string;
  /** Parameter validation */
  validation?: INodeParameterValidation;
}

export type NodeParameterType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'select' 
  | 'multiselect' 
  | 'json' 
  | 'dateTime' 
  | 'color' 
  | 'file' 
  | 'collection' 
  | 'fixedCollection' 
  | 'resourceLocator' 
  | 'notice' 
  | 'hidden';

export interface INodeParameterOption {
  /** Option value */
  value: string | number | boolean;
  /** Option display name */
  name: string;
  /** Option description */
  description?: string;
  /** Whether option is disabled */
  disabled?: boolean;
}

export interface INodeParameterTypeOptions {
  /** String type options */
  password?: boolean;
  multipleLines?: boolean;
  /** Number type options */
  minValue?: number;
  maxValue?: number;
  numberPrecision?: number;
  /** File type options */
  acceptedTypes?: string[];
  /** Collection type options */
  multipleValues?: boolean;
  sortable?: boolean;
}

export interface INodeParameterDisplayOptions {
  /** Show parameter when conditions are met */
  show?: Record<string, NodeParameterValue[]>;
  /** Hide parameter when conditions are met */
  hide?: Record<string, NodeParameterValue[]>;
}

export interface INodeParameterValidation {
  /** Validation type */
  type: 'regex' | 'function' | 'schema';
  /** Validation pattern/function */
  pattern?: string | ((value: NodeParameterValue) => boolean);
  /** Error message for invalid values */
  errorMessage?: string;
}

// ============================================================================
// Node Credentials
// ============================================================================

export interface INodeCredentials {
  /** Credential type name */
  name: string;
  /** Whether credentials are required */
  required?: boolean;
  /** Display conditions for credentials */
  displayOptions?: INodeParameterDisplayOptions;
}

export interface ICredentials {
  /** Credential type */
  type: string;
  /** Credential data */
  data: Record<string, string>;
  /** Credential ID */
  id?: string;
  /** Credential name */
  name?: string;
}

export interface ICredentialType {
  /** Credential type name */
  name: string;
  /** Display name */
  displayName: string;
  /** Description */
  description?: string;
  /** Icon */
  icon?: string;
  /** Properties/fields */
  properties: ICredentialProperty[];
  /** Authentication method */
  authenticate?: IAuthenticateGeneric | IAuthenticateGeneric[];
  /** Test function */
  test?: ICredentialTestRequest;
  /** Documentation URL */
  documentationUrl?: string;
}

export interface ICredentialProperty {
  /** Property name */
  name: string;
  /** Display name */
  displayName: string;
  /** Property type */
  type: 'string' | 'password' | 'hidden' | 'boolean' | 'number';
  /** Default value */
  default?: string | number | boolean;
  /** Description */
  description?: string;
  /** Required flag */
  required?: boolean;
  /** Type options */
  typeOptions?: {
    password?: boolean;
    multipleLines?: boolean;
  };
}

export interface IAuthenticateGeneric {
  /** Authentication type */
  type: 'generic';
  /** Properties to include in authentication */
  properties: {
    auth?: {
      username: string;
      password: string;
    };
    headers?: Record<string, string>;
    qs?: Record<string, string>;
    body?: Record<string, string>;
  };
}

export interface ICredentialTestRequest {
  /** Test request configuration */
  request: {
    baseURL?: string;
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
    body?: JsonObject;
  };
  /** Rules for determining success */
  rules?: Array<{
    type: 'responseCode' | 'responseSuccessBody' | 'responseErrorBody';
    properties: {
      value?: number | string;
      message?: string;
    };
  }>;
}

// ============================================================================
// Webhooks
// ============================================================================

export interface IWebhookDescription {
  /** Webhook name */
  name: string;
  /** HTTP methods supported */
  httpMethod: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | '*';
  /** Whether webhook is multistep */
  isFullPath?: boolean;
  /** Response mode */
  responseMode?: 'onReceived' | 'lastNode' | 'responseNode';
  /** Response data */
  responseBinaryPropertyName?: string;
  /** Path for webhook */
  path?: string;
  /** Whether to restart webhook on workflow update */
  restartWebhook?: boolean;
}

// ============================================================================
// Polling
// ============================================================================

export interface IPollingConfiguration {
  /** Default polling interval in minutes */
  default: number;
  /** Minimum polling interval in minutes */
  min?: number;
  /** Maximum polling interval in minutes */
  max?: number;
  /** Whether to hide interval option from UI */
  hideInterval?: boolean;
}

// ============================================================================
// Documentation
// ============================================================================

export interface INodeDocumentation {
  /** Short description */
  description: string;
  /** Detailed documentation */
  longDescription?: string;
  /** Documentation URL */
  url?: string;
  /** Example workflows */
  examples?: INodeExample[];
  /** Setup instructions */
  setup?: string[];
  /** Common issues and solutions */
  troubleshooting?: Array<{
    issue: string;
    solution: string;
  }>;
}

export interface INodeExample {
  /** Example name */
  name: string;
  /** Example description */
  description: string;
  /** Example workflow JSON */
  workflow: JsonObject;
  /** Example parameters */
  parameters?: NodeParameters;
}

// ============================================================================
// Node Execution
// ============================================================================

export interface INodeExecutionFunctions {
  /** Execute the node */
  execute(context: IExecutionContext, data: IWorkflowData): Promise<INodeExecutionData[]>;
  /** Optional polling function */
  poll?(context: IExecutionContext, data: IWorkflowData): Promise<INodeExecutionData[]>;
  /** Optional webhook function */
  webhook?(context: IExecutionContext, data: IWorkflowData): Promise<INodeExecutionData[]>;
  /** Optional test function */
  test?(context: IExecutionContext, data: IWorkflowData): Promise<boolean>;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface IVersionedNodeType extends INodeType {
  /** Node version */
  version: number;
  /** Backward compatibility */
  compatibility?: number[];
}

export interface INodeTypeDescription extends INodeType {
  /** Source information */
  sourcePath?: string;
  /** Package information */
  packageName?: string;
  /** Load time */
  loadedAt?: Date;
}

export interface INodeRegistry {
  /** Register a node type */
  register(nodeType: INodeType, functions: INodeExecutionFunctions): void;
  /** Get registered node type */
  get(name: string, version?: number): INodeTypeDescription | undefined;
  /** Get all registered node types */
  getAll(): INodeTypeDescription[];
  /** Check if node type exists */
  has(name: string, version?: number): boolean;
}
