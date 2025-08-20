# Data Flow

Understanding how data moves through the N8N-Work platform is crucial for developers, operators, and anyone working with workflows. This document details the various data flow patterns and how information is processed throughout the system.

## Overview

N8N-Work processes data through several distinct flows:

```mermaid
graph TB
    subgraph "User Interactions"
        UI[Web UI]
        API_CALLS[API Calls]
        WEBHOOKS[Webhooks]
    end
    
    subgraph "Data Processing"
        API[Orchestrator API]
        QUEUE[Message Queue]
        ENGINE[Execution Engine]
        RUNNER[Node Runner]
    end
    
    subgraph "Data Storage"
        DB[(Database)]
        CACHE[(Cache)]
        FILES[File Storage]
    end
    
    UI --> API
    API_CALLS --> API
    WEBHOOKS --> API
    
    API --> QUEUE
    API --> DB
    API --> CACHE
    
    QUEUE --> ENGINE
    ENGINE --> RUNNER
    ENGINE --> CACHE
    
    RUNNER --> FILES
    ENGINE --> DB
```

## Core Data Flow Patterns

### 1. Workflow Creation Flow

When a user creates a new workflow, the data follows this path:

```mermaid
sequenceDiagram
    participant User as User/UI
    participant API as Orchestrator API
    participant Validator as Input Validator
    participant DB as PostgreSQL
    participant Cache as Redis Cache
    
    User->>API: POST /workflows
    API->>Validator: Validate workflow definition
    Validator-->>API: Validation result
    
    alt Validation successful
        API->>DB: INSERT workflow
        DB-->>API: Workflow ID
        API->>Cache: Cache workflow definition
        API-->>User: 201 Created + Workflow ID
    else Validation failed
        API-->>User: 400 Bad Request + Errors
    end
```

#### Data Transformation
```typescript
// Input from user
interface WorkflowInput {
  name: string;
  description?: string;
  nodes: NodeDefinition[];
  connections: Connection[];
  settings: WorkflowSettings;
}

// Stored in database
interface WorkflowEntity {
  id: string;
  userId: string;
  name: string;
  description: string;
  definition: WorkflowDefinition;
  active: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2. Workflow Execution Flow

The most complex data flow is workflow execution:

```mermaid
sequenceDiagram
    participant Client as Client
    participant API as Orchestrator API
    participant Queue as RabbitMQ
    participant Engine as Execution Engine
    participant Runner as Node Runner
    participant Cache as Redis
    participant DB as PostgreSQL
    
    Client->>API: POST /workflows/{id}/execute
    API->>DB: Load workflow definition
    DB-->>API: Workflow data
    
    API->>Queue: Publish execution message
    API-->>Client: 202 Accepted + Execution ID
    
    Queue->>Engine: Consume execution message
    Engine->>Cache: Load execution state
    Engine->>Cache: Load workflow definition
    
    loop For each workflow step
        Engine->>Queue: Publish step execution
        Queue->>Runner: Consume step message
        Runner->>Runner: Execute node in sandbox
        Runner->>Queue: Publish step result
        Queue->>Engine: Consume step result
        Engine->>Cache: Update execution state
        Engine->>DB: Save step result
    end
    
    Engine->>DB: Save final execution result
    Engine->>Queue: Publish execution complete
```

#### Execution Data Structure
```typescript
interface ExecutionMessage {
  executionId: string;
  workflowId: string;
  userId: string;
  triggerData?: any;
  inputData: ExecutionInputData[];
  priority: ExecutionPriority;
  metadata: ExecutionMetadata;
}

interface StepExecutionMessage {
  executionId: string;
  stepId: string;
  nodeType: string;
  parameters: NodeParameters;
  inputData: NodeInputData[];
  context: ExecutionContext;
}

interface StepResultMessage {
  executionId: string;
  stepId: string;
  success: boolean;
  outputData?: NodeOutputData[];
  error?: ExecutionError;
  metrics: StepMetrics;
}
```

### 3. Real-time Data Flow

For real-time updates, N8N-Work uses WebSockets:

```mermaid
sequenceDiagram
    participant UI as Web UI
    participant WS as WebSocket Server
    participant API as Orchestrator API
    participant Queue as Message Queue
    participant Engine as Execution Engine
    
    UI->>WS: Connect WebSocket
    WS->>API: Authenticate user
    API-->>WS: Authentication result
    
    Engine->>Queue: Publish execution event
    Queue->>API: Consume execution event
    API->>WS: Broadcast to subscribed clients
    WS->>UI: Send real-time update
```

#### WebSocket Message Types
```typescript
interface WebSocketMessage {
  type: 'execution.started' | 'execution.progress' | 'execution.completed' | 'execution.failed';
  payload: {
    executionId: string;
    workflowId: string;
    status: ExecutionStatus;
    progress?: ExecutionProgress;
    result?: ExecutionResult;
    error?: ExecutionError;
  };
  timestamp: string;
}
```

## Data Transformation Patterns

### Input Data Processing

Data enters the system through various channels and needs standardization:

```mermaid
graph TB
    subgraph "Input Sources"
        HTTP[HTTP Requests]
        WEBHOOK[Webhooks]
        SCHEDULE[Scheduled Triggers]
        MANUAL[Manual Execution]
    end
    
    subgraph "Input Processing"
        PARSER[Data Parser]
        VALIDATOR[Input Validator]
        TRANSFORMER[Data Transformer]
        SANITIZER[Data Sanitizer]
    end
    
    subgraph "Standardized Format"
        STANDARD[StandardExecutionData]
    end
    
    HTTP --> PARSER
    WEBHOOK --> PARSER
    SCHEDULE --> PARSER
    MANUAL --> PARSER
    
    PARSER --> VALIDATOR
    VALIDATOR --> TRANSFORMER
    TRANSFORMER --> SANITIZER
    SANITIZER --> STANDARD
```

#### Data Standardization
```typescript
// Raw input from various sources
interface RawInputData {
  source: 'http' | 'webhook' | 'schedule' | 'manual';
  headers?: Record<string, string>;
  query?: Record<string, any>;
  body?: any;
  metadata?: Record<string, any>;
}

// Standardized execution data
interface StandardExecutionData {
  json: Record<string, any>;
  binary?: BinaryData;
  metadata: {
    source: string;
    timestamp: string;
    contentType?: string;
    size: number;
  };
}
```

### Node Data Processing

Each node processes data in a standardized way:

```mermaid
graph LR
    subgraph "Node Execution"
        INPUT[Input Data]
        PARAMS[Parameters]
        CREDENTIALS[Credentials]
        
        VALIDATE[Validate Inputs]
        EXECUTE[Execute Logic]
        TRANSFORM[Transform Output]
        
        OUTPUT[Output Data]
        ERROR[Error Data]
    end
    
    INPUT --> VALIDATE
    PARAMS --> VALIDATE
    CREDENTIALS --> VALIDATE
    
    VALIDATE --> EXECUTE
    EXECUTE --> TRANSFORM
    
    TRANSFORM --> OUTPUT
    EXECUTE --> ERROR
```

#### Node Processing Pattern
```typescript
interface NodeExecutionContext {
  inputData: NodeInputData[];
  parameters: NodeParameters;
  credentials?: NodeCredentials;
  settings: NodeSettings;
}

interface NodeExecutionResult {
  outputData: NodeOutputData[];
  error?: NodeExecutionError;
  metadata: NodeExecutionMetadata;
}

// Standard node processing function
async function executeNode(
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  // 1. Validate inputs
  validateInputData(context.inputData);
  validateParameters(context.parameters);
  
  // 2. Execute node logic
  const result = await nodeLogic(context);
  
  // 3. Transform and validate output
  return transformOutput(result);
}
```

## State Management

### Execution State

Workflow execution state is managed across multiple storage systems:

```mermaid
graph TB
    subgraph "State Storage"
        CACHE[Redis Cache<br/>Fast Access]
        DB[PostgreSQL<br/>Persistent Storage]
        MEMORY[In-Memory<br/>Active Executions]
    end
    
    subgraph "State Types"
        ACTIVE[Active Execution State]
        HISTORY[Execution History]
        PROGRESS[Progress Tracking]
        METADATA[Execution Metadata]
    end
    
    ACTIVE --> CACHE
    ACTIVE --> MEMORY
    
    HISTORY --> DB
    METADATA --> DB
    
    PROGRESS --> CACHE
    PROGRESS --> MEMORY
```

#### State Data Structure
```typescript
interface ExecutionState {
  executionId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep?: string;
  completedSteps: string[];
  failedSteps: string[];
  stepData: Record<string, StepExecutionData>;
  startTime: Date;
  endTime?: Date;
  error?: ExecutionError;
}

interface StepExecutionData {
  stepId: string;
  nodeType: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  inputData: any[];
  outputData?: any[];
  error?: StepExecutionError;
  startTime: Date;
  endTime?: Date;
  metrics: StepMetrics;
}
```

### Caching Strategy

N8N-Work uses a multi-level caching strategy:

```mermaid
graph TB
    subgraph "Cache Levels"
        L1[L1: In-Memory<br/>Node.js/Go Process]
        L2[L2: Redis<br/>Shared Cache]
        L3[L3: Database<br/>Persistent Storage]
    end
    
    subgraph "Cache Types"
        HOT[Hot Data<br/>Active Executions]
        WARM[Warm Data<br/>Recent Workflows]
        COLD[Cold Data<br/>Historical Data]
    end
    
    HOT --> L1
    HOT --> L2
    
    WARM --> L2
    WARM --> L3
    
    COLD --> L3
```

#### Cache Configuration
```typescript
interface CacheConfig {
  levels: {
    l1: {
      maxSize: string; // '100MB'
      ttl: string; // '5m'
      strategy: 'LRU' | 'LFU';
    };
    l2: {
      maxSize: string; // '1GB'
      ttl: string; // '1h'
      keyPrefix: string;
    };
    l3: {
      connectionPool: number;
      queryTimeout: string;
    };
  };
}
```

## Message Queue Data Flow

### Queue Organization

RabbitMQ organizes data flow through exchanges and queues:

```mermaid
graph TB
    subgraph "Exchanges"
        WF_EX[Workflow Exchange<br/>workflow.direct]
        EXEC_EX[Execution Exchange<br/>execution.topic]
        RESULT_EX[Results Exchange<br/>results.fanout]
        DLX[Dead Letter Exchange<br/>dlx.direct]
    end
    
    subgraph "Queues"
        WF_Q[workflow.create]
        EXEC_Q[execution.start]
        STEP_Q[step.execute]
        RESULT_Q[results.collect]
        DLQ[dead.letter.queue]
    end
    
    subgraph "Consumers"
        API_CONSUMER[API Consumer]
        ENGINE_CONSUMER[Engine Consumer]
        RUNNER_CONSUMER[Runner Consumer]
    end
    
    WF_EX --> WF_Q
    EXEC_EX --> EXEC_Q
    EXEC_EX --> STEP_Q
    RESULT_EX --> RESULT_Q
    DLX --> DLQ
    
    WF_Q --> API_CONSUMER
    EXEC_Q --> ENGINE_CONSUMER
    STEP_Q --> RUNNER_CONSUMER
    RESULT_Q --> API_CONSUMER
```

### Message Structure

All messages follow a standardized format:

```typescript
interface BaseMessage {
  id: string;
  type: string;
  timestamp: string;
  correlationId: string;
  userId?: string;
  priority: number;
  retryCount: number;
  maxRetries: number;
}

interface WorkflowExecutionMessage extends BaseMessage {
  type: 'workflow.execute';
  payload: {
    workflowId: string;
    inputData: any;
    triggerData?: any;
    settings?: ExecutionSettings;
  };
}

interface StepExecutionMessage extends BaseMessage {
  type: 'step.execute';
  payload: {
    executionId: string;
    stepId: string;
    nodeType: string;
    parameters: any;
    inputData: any[];
    context: ExecutionContext;
  };
}
```

## Error Data Flow

Error handling involves multiple layers:

```mermaid
sequenceDiagram
    participant Node as Node Execution
    participant Runner as Node Runner
    participant Engine as Execution Engine
    participant Queue as Message Queue
    participant API as Orchestrator API
    participant UI as User Interface
    
    Node->>Runner: Execution Error
    Runner->>Runner: Log error details
    Runner->>Queue: Publish error result
    
    Queue->>Engine: Consume error result
    Engine->>Engine: Update execution state
    Engine->>Queue: Publish execution failed
    
    Queue->>API: Consume execution failed
    API->>API: Update database
    API->>UI: Send WebSocket notification
    
    Note over Node,UI: Error propagation and notification
```

### Error Data Structure

```typescript
interface ExecutionError {
  code: string;
  message: string;
  details?: any;
  stack?: string;
  context: {
    executionId: string;
    stepId?: string;
    nodeType?: string;
    timestamp: string;
    userId?: string;
  };
  classification: 'user' | 'system' | 'network' | 'timeout' | 'resource';
  retryable: boolean;
  metadata?: Record<string, any>;
}

interface ErrorResponse {
  error: ExecutionError;
  execution: {
    id: string;
    status: 'failed';
    failedAt: string;
    partialResults?: any[];
  };
  recovery: {
    canRetry: boolean;
    retryAfter?: string;
    suggestions: string[];
  };
}
```

## Data Security and Privacy

### Data Encryption

Sensitive data is encrypted at multiple points:

```mermaid
graph TB
    subgraph "Encryption Points"
        API_ENC[API Input/Output<br/>TLS 1.3]
        QUEUE_ENC[Message Queue<br/>Message Encryption]
        DB_ENC[Database<br/>Column Encryption]
        CACHE_ENC[Cache<br/>Key Encryption]
    end
    
    subgraph "Key Management"
        HSM[Hardware Security Module]
        VAULT[HashiCorp Vault]
        K8S_SEC[Kubernetes Secrets]
    end
    
    API_ENC --> VAULT
    QUEUE_ENC --> HSM
    DB_ENC --> VAULT
    CACHE_ENC --> K8S_SEC
```

### Data Classification

```typescript
enum DataClassification {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted'
}

interface ClassifiedData {
  classification: DataClassification;
  data: any;
  encryption: {
    algorithm: string;
    keyId: string;
    iv?: string;
  };
  access: {
    roles: string[];
    permissions: string[];
  };
  audit: {
    created: string;
    accessed: string[];
    modified: string[];
  };
}
```

## Performance Optimization

### Data Flow Optimization

Several techniques optimize data flow performance:

```mermaid
graph TB
    subgraph "Optimization Techniques"
        BATCH[Batch Processing]
        STREAM[Stream Processing]
        COMPRESS[Data Compression]
        DEDUPE[Deduplication]
    end
    
    subgraph "Performance Metrics"
        THROUGHPUT[Throughput<br/>msgs/sec]
        LATENCY[Latency<br/>P95/P99]
        MEMORY[Memory Usage<br/>MB/GB]
        CPU[CPU Usage<br/>%]
    end
    
    BATCH --> THROUGHPUT
    STREAM --> LATENCY
    COMPRESS --> MEMORY
    DEDUPE --> CPU
```

### Batching Strategy

```typescript
interface BatchConfig {
  maxSize: number; // Maximum messages per batch
  maxWait: number; // Maximum wait time in ms
  strategy: 'size' | 'time' | 'adaptive';
}

interface BatchProcessor {
  config: BatchConfig;
  buffer: Message[];
  timer?: NodeJS.Timeout;
  
  add(message: Message): void;
  flush(): Promise<void>;
  process(batch: Message[]): Promise<void>;
}
```

## Monitoring and Observability

### Data Flow Metrics

Key metrics for monitoring data flow:

```typescript
interface DataFlowMetrics {
  throughput: {
    apiRequests: number; // requests/second
    queueMessages: number; // messages/second
    executions: number; // executions/minute
  };
  latency: {
    apiResponse: number; // milliseconds P95
    queueProcessing: number; // milliseconds P95
    executionTime: number; // seconds P95
  };
  errors: {
    apiErrors: number; // errors/minute
    executionFailures: number; // failures/minute
    queueDeadLetters: number; // messages/minute
  };
  resources: {
    cpuUsage: number; // percentage
    memoryUsage: number; // percentage
    diskUsage: number; // percentage
    networkIO: number; // bytes/second
  };
}
```

### Tracing Data Flow

Distributed tracing tracks data through the entire system:

```mermaid
graph LR
    subgraph "Trace Span Hierarchy"
        ROOT[Root Span<br/>HTTP Request]
        API_SPAN[API Processing]
        QUEUE_SPAN[Queue Publishing]
        ENGINE_SPAN[Engine Processing]
        RUNNER_SPAN[Node Execution]
    end
    
    ROOT --> API_SPAN
    API_SPAN --> QUEUE_SPAN
    QUEUE_SPAN --> ENGINE_SPAN
    ENGINE_SPAN --> RUNNER_SPAN
```

## Next Steps

Learn more about related topics:

- **[Security Architecture](/architecture/security)** - How data is secured throughout the system
- **[Scalability Patterns](/architecture/scalability)** - How data flow scales with load
- **[API Documentation](/api/)** - Detailed API specifications and data formats
