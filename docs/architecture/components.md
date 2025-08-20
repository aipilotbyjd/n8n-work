# Platform Components

N8N-Work consists of several specialized components that work together to provide a complete workflow automation platform. Each component has a specific responsibility and can be scaled independently.

## Overview

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[Web UI<br/>React/Next.js]
        CLI[CLI Tools<br/>Node.js]
    end
    
    subgraph "API Gateway"
        Gateway[API Gateway<br/>Kong/Nginx]
        LB[Load Balancer]
    end
    
    subgraph "Core Services"
        API[Orchestrator API<br/>NestJS/TypeScript]
        Engine[Execution Engine<br/>Go]
        Runner[Node Runner<br/>Node.js]
    end
    
    subgraph "Data Layer"
        DB[(PostgreSQL<br/>Primary Database)]
        Cache[(Redis<br/>Cache & Sessions)]
        Queue[RabbitMQ<br/>Message Queue]
    end
    
    subgraph "Observability"
        Metrics[Prometheus<br/>Metrics]
        Traces[Jaeger<br/>Tracing]
        Logs[Loki<br/>Logging]
    end
    
    UI --> Gateway
    CLI --> Gateway
    Gateway --> LB
    LB --> API
    API --> DB
    API --> Cache
    API --> Queue
    Queue --> Engine
    Engine --> Runner
    
    API --> Logs
    Engine --> Metrics
    Runner --> Traces
```

## Core Components

### Orchestrator API

**Technology**: NestJS with TypeScript  
**Responsibility**: Main API layer and business logic  
**Port**: 3000

The Orchestrator API serves as the central hub for all workflow operations. It provides RESTful endpoints for managing workflows, executions, users, and system configuration.

#### Key Features
- **Workflow Management**: CRUD operations for workflows
- **Execution Control**: Start, stop, and monitor workflow executions
- **User Management**: Authentication, authorization, and user accounts
- **System Configuration**: Platform settings and node registry
- **Real-time Updates**: WebSocket connections for live updates

#### Architecture
```mermaid
graph TB
    subgraph "Controllers"
        WC[Workflow Controller]
        EC[Execution Controller]
        UC[User Controller]
        NC[Node Controller]
    end
    
    subgraph "Services"
        WS[Workflow Service]
        ES[Execution Service]
        US[User Service]
        NS[Node Service]
    end
    
    subgraph "Repositories"
        WR[Workflow Repository]
        ER[Execution Repository]
        UR[User Repository]
        NR[Node Repository]
    end
    
    WC --> WS
    EC --> ES
    UC --> US
    NC --> NS
    
    WS --> WR
    ES --> ER
    US --> UR
    NS --> NR
    
    WR --> DB[(Database)]
    ER --> DB
    UR --> DB
    NR --> DB
```

#### Configuration
```typescript
// Configuration example
{
  port: 3000,
  database: {
    host: 'postgres',
    port: 5432,
    database: 'n8n_work',
    username: 'postgres',
    password: 'postgres'
  },
  redis: {
    host: 'redis',
    port: 6379
  },
  rabbitmq: {
    url: 'amqp://rabbitmq:5672'
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '24h'
  }
}
```

### Execution Engine

**Technology**: Go  
**Responsibility**: Workflow execution orchestration  
**Port**: 8080

The Execution Engine is a high-performance Go service that handles the actual execution of workflows. It receives execution requests from the message queue and coordinates the execution of individual workflow steps.

#### Key Features
- **High Performance**: Written in Go for optimal speed and concurrency
- **Workflow Orchestration**: Manages execution flow and dependencies
- **Error Handling**: Comprehensive error handling and retry logic
- **Metrics Collection**: Performance metrics and execution statistics
- **Resource Management**: Memory and CPU usage optimization

#### Architecture
```mermaid
graph TB
    subgraph "Engine Core"
        EM[Execution Manager]
        WE[Workflow Executor]
        SE[Step Executor]
        EH[Error Handler]
    end
    
    subgraph "Communication"
        MQ[Message Queue Consumer]
        GP[gRPC Server]
        MC[Metrics Collector]
    end
    
    subgraph "Storage"
        RC[Redis Client]
        EC[Execution Cache]
        SC[State Cache]
    end
    
    MQ --> EM
    GP --> EM
    EM --> WE
    WE --> SE
    SE --> EH
    
    EM --> RC
    WE --> EC
    SE --> SC
    
    EM --> MC
```

#### Execution Flow
```mermaid
sequenceDiagram
    participant Queue as Message Queue
    participant Engine as Execution Engine
    participant Cache as Redis Cache
    participant Runner as Node Runner
    
    Queue->>Engine: Workflow Execution Request
    Engine->>Cache: Load Workflow Definition
    Cache-->>Engine: Workflow Data
    
    loop For each step
        Engine->>Queue: Send Step Execution
        Queue->>Runner: Execute Node
        Runner-->>Queue: Step Result
        Queue-->>Engine: Execution Result
        Engine->>Cache: Update State
    end
    
    Engine->>Queue: Execution Complete
```

### Node Runner

**Technology**: Node.js with TypeScript  
**Responsibility**: Sandboxed node execution  
**Port**: 3000

The Node Runner provides a secure, sandboxed environment for executing custom nodes. It supports multiple isolation strategies and includes built-in nodes for common operations.

#### Key Features
- **Sandboxed Execution**: Secure isolation using vm2, child processes, or containers
- **Built-in Nodes**: HTTP requests, Slack, webhooks, data transformation
- **Custom Node Support**: Execute user-created nodes via the SDK
- **Resource Limits**: CPU, memory, and network usage controls
- **Monitoring**: Detailed execution metrics and tracing

#### Architecture
```mermaid
graph TB
    subgraph "Node Runner"
        SM[Sandbox Manager]
        NR[Node Registry]
        EM[Execution Manager]
        MM[Message Manager]
    end
    
    subgraph "Sandbox Strategies"
        VM2[VM2 Sandbox]
        CP[Child Process]
        Docker[Docker Container]
    end
    
    subgraph "Built-in Nodes"
        HTTP[HTTP Request]
        Slack[Slack Node]
        Webhook[Webhook Node]
        Transform[Data Transform]
    end
    
    MM --> EM
    EM --> SM
    SM --> NR
    
    SM --> VM2
    SM --> CP
    SM --> Docker
    
    NR --> HTTP
    NR --> Slack
    NR --> Webhook
    NR --> Transform
```

#### Sandbox Configuration
```typescript
// Sandbox configuration options
{
  strategy: 'vm2', // vm2, childprocess, docker
  timeout: 30000,
  memory: 512, // MB
  allowedModules: ['crypto', 'url', 'querystring'],
  networkAccess: true,
  fileSystemAccess: false
}
```

## Data Layer Components

### PostgreSQL Database

**Technology**: PostgreSQL 14+  
**Responsibility**: Primary data storage  
**Port**: 5432

The primary database stores all persistent data including workflows, executions, users, and system configuration.

#### Schema Overview
```mermaid
erDiagram
    Users ||--o{ Workflows : creates
    Users ||--o{ Executions : owns
    Workflows ||--o{ Executions : generates
    Workflows ||--o{ WorkflowSteps : contains
    Executions ||--o{ ExecutionSteps : contains
    Users ||--o{ Credentials : owns
    
    Users {
        uuid id PK
        string email
        string password_hash
        jsonb profile
        timestamp created_at
        timestamp updated_at
    }
    
    Workflows {
        uuid id PK
        uuid user_id FK
        string name
        text description
        jsonb definition
        boolean active
        timestamp created_at
        timestamp updated_at
    }
    
    Executions {
        uuid id PK
        uuid workflow_id FK
        uuid user_id FK
        string status
        jsonb input_data
        jsonb output_data
        text error_message
        timestamp started_at
        timestamp finished_at
    }
```

#### Key Tables
- **users**: User accounts and authentication
- **workflows**: Workflow definitions and metadata
- **executions**: Execution history and results
- **workflow_steps**: Individual workflow step definitions
- **execution_steps**: Step-level execution data
- **credentials**: Encrypted credential storage
- **node_types**: Registry of available node types

### Redis Cache

**Technology**: Redis 7+  
**Responsibility**: Caching and session storage  
**Port**: 6379

Redis provides high-performance caching and session management.

#### Usage Patterns
```typescript
// Cache usage examples
{
  // Session storage
  sessions: 'session:user_id:session_token',
  
  // Workflow definitions cache
  workflows: 'workflow:workflow_id',
  
  // Execution state cache
  execution_state: 'execution:execution_id:state',
  
  // Rate limiting
  rate_limits: 'rate_limit:user_id:endpoint',
  
  // Node registry cache
  node_registry: 'nodes:type:version'
}
```

### RabbitMQ Message Queue

**Technology**: RabbitMQ 3.8+  
**Responsibility**: Asynchronous messaging  
**Port**: 5672

RabbitMQ handles all asynchronous communication between components.

#### Queue Structure
```mermaid
graph LR
    subgraph "Exchanges"
        WE[Workflow Exchange]
        RE[Results Exchange]
        NE[Notifications Exchange]
    end
    
    subgraph "Queues"
        EQ[Execution Queue]
        SQ[Step Queue]
        RQ[Results Queue]
        NQ[Notification Queue]
    end
    
    subgraph "Dead Letter"
        DLQ[Dead Letter Queue]
        RLQ[Retry Queue]
    end
    
    WE --> EQ
    WE --> SQ
    RE --> RQ
    NE --> NQ
    
    EQ --> DLQ
    SQ --> RLQ
```

#### Message Types
```typescript
// Message type definitions
interface WorkflowExecutionMessage {
  executionId: string;
  workflowId: string;
  userId: string;
  inputData: any;
  priority: number;
}

interface StepExecutionMessage {
  executionId: string;
  stepId: string;
  nodeType: string;
  parameters: any;
  inputData: any;
}

interface ExecutionResultMessage {
  executionId: string;
  stepId: string;
  success: boolean;
  outputData?: any;
  errorMessage?: string;
}
```

## Observability Components

### Prometheus Metrics

**Technology**: Prometheus  
**Responsibility**: Metrics collection and alerting  
**Port**: 9090

Prometheus collects metrics from all components and provides alerting capabilities.

#### Key Metrics
```yaml
# API metrics
api_requests_total: Counter of API requests
api_request_duration: Histogram of request durations
api_active_connections: Gauge of active connections

# Execution metrics
executions_total: Counter of workflow executions
execution_duration: Histogram of execution times
execution_queue_depth: Gauge of pending executions

# Node runner metrics
nodes_executed_total: Counter of node executions
node_execution_duration: Histogram of node execution times
sandbox_memory_usage: Gauge of sandbox memory usage

# System metrics
system_cpu_usage: Gauge of CPU usage
system_memory_usage: Gauge of memory usage
database_connections: Gauge of database connections
```

### Jaeger Tracing

**Technology**: Jaeger  
**Responsibility**: Distributed tracing  
**Port**: 16686

Jaeger provides distributed tracing for tracking requests across components.

#### Trace Structure
```mermaid
graph TB
    subgraph "HTTP Request Trace"
        Start[API Request Start]
        Auth[Authentication]
        Validation[Input Validation]
        Queue[Queue Message]
        Execute[Execute Workflow]
        Response[API Response]
    end
    
    subgraph "Workflow Execution Trace"
        WStart[Workflow Start]
        Step1[Execute Step 1]
        Step2[Execute Step 2]
        StepN[Execute Step N]
        WEnd[Workflow Complete]
    end
    
    Start --> Auth
    Auth --> Validation
    Validation --> Queue
    Queue --> Execute
    Execute --> Response
    
    Execute --> WStart
    WStart --> Step1
    Step1 --> Step2
    Step2 --> StepN
    StepN --> WEnd
```

### Loki Logging

**Technology**: Grafana Loki  
**Responsibility**: Log aggregation and analysis  
**Port**: 3100

Loki aggregates logs from all components for centralized analysis.

#### Log Structure
```json
{
  "timestamp": "2023-12-01T10:00:00Z",
  "level": "info",
  "service": "orchestrator-api",
  "trace_id": "abc123",
  "span_id": "def456",
  "user_id": "user123",
  "workflow_id": "workflow456",
  "execution_id": "exec789",
  "message": "Workflow execution started",
  "metadata": {
    "duration_ms": 1500,
    "status": "success"
  }
}
```

## Component Communication

### Internal Communication

Components communicate using various protocols:

```mermaid
graph TB
    subgraph "Synchronous"
        HTTP[HTTP REST]
        GRPC[gRPC]
        GraphQL[GraphQL]
    end
    
    subgraph "Asynchronous"
        MQ[Message Queue]
        Events[Event Bus]
        Streams[Event Streams]
    end
    
    subgraph "Data Access"
        SQL[SQL Queries]
        Cache[Cache Lookups]
        Files[File System]
    end
    
    API --> HTTP
    Engine --> GRPC
    Runner --> Events
    
    API --> MQ
    Engine --> Streams
    
    API --> SQL
    Engine --> Cache
    Runner --> Files
```

### Service Discovery

Components discover each other through:

- **DNS-based discovery** in Kubernetes
- **Service registry** with Consul
- **Environment variables** for configuration
- **Health checks** for availability

## Deployment Patterns

### Development Environment

```mermaid
graph TB
    subgraph "Local Development"
        Dev[Developer Machine]
        Docker[Docker Compose]
        Services[All Services]
    end
    
    Dev --> Docker
    Docker --> Services
```

### Production Environment

```mermaid
graph TB
    subgraph "Production Cluster"
        LB[Load Balancer]
        K8s[Kubernetes Cluster]
        Services[Microservices]
        Data[Data Layer]
        Monitor[Monitoring]
    end
    
    LB --> K8s
    K8s --> Services
    K8s --> Data
    K8s --> Monitor
```

## Resource Requirements

### Minimum Requirements

| Component | CPU | Memory | Storage |
|-----------|-----|--------|---------|
| Orchestrator API | 0.5 cores | 1GB | 10GB |
| Execution Engine | 1 core | 2GB | 5GB |
| Node Runner | 0.5 cores | 1GB | 5GB |
| PostgreSQL | 1 core | 2GB | 50GB |
| Redis | 0.25 cores | 512MB | 5GB |
| RabbitMQ | 0.5 cores | 1GB | 10GB |

### Production Requirements

| Component | CPU | Memory | Storage |
|-----------|-----|--------|---------|
| Orchestrator API | 2-4 cores | 4-8GB | 20GB |
| Execution Engine | 4-8 cores | 8-16GB | 10GB |
| Node Runner | 2-4 cores | 4-8GB | 10GB |
| PostgreSQL | 4-8 cores | 16-32GB | 500GB+ |
| Redis | 1-2 cores | 4-8GB | 20GB |
| RabbitMQ | 2-4 cores | 4-8GB | 50GB |

## Next Steps

Learn more about specific aspects:

- **[Data Flow](/architecture/data-flow)** - How data moves through the system
- **[Security](/architecture/security)** - Security implementation details
- **[Scalability](/architecture/scalability)** - Scaling strategies and patterns
