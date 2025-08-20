# Platform Architecture

N8N-Work is built as a modern, cloud-native platform using microservices architecture. This design ensures scalability, maintainability, and flexibility while providing robust workflow automation capabilities.

## Overview

The platform consists of several key components that work together to provide a complete workflow automation solution:

```mermaid
graph TB
    subgraph "Frontend"
        UI[Web UI]
        CLI[CLI Tools]
    end
    
    subgraph "API Layer"
        API[Orchestrator API<br/>NestJS]
        Auth[Authentication<br/>& Authorization]
    end
    
    subgraph "Execution Layer"
        Engine[Execution Engine<br/>Go]
        Runner[Node Runner<br/>Node.js]
        SDK[Node SDK<br/>TypeScript]
    end
    
    subgraph "Infrastructure"
        Queue[Message Queue<br/>RabbitMQ]
        DB[(Database<br/>PostgreSQL)]
        Cache[(Cache<br/>Redis)]
    end
    
    subgraph "Observability"
        Metrics[Metrics<br/>Prometheus]
        Traces[Tracing<br/>Jaeger]
        Logs[Logging<br/>Loki]
    end
    
    UI --> API
    CLI --> API
    API --> Auth
    API --> DB
    API --> Queue
    Queue --> Engine
    Engine --> Runner
    Runner --> SDK
    Engine --> Cache
    
    API --> Logs
    Engine --> Metrics
    Runner --> Traces
    
    style API fill:#e1f5fe
    style Engine fill:#f3e5f5
    style Runner fill:#e8f5e8
    style Queue fill:#fff3e0
```

## Core Principles

### 🏗️ **Microservices Architecture**
Each component has a single responsibility and can be scaled independently. This allows for:
- **Independent deployment** of components
- **Technology diversity** (Go for performance, Node.js for flexibility)
- **Fault isolation** to prevent cascading failures
- **Team autonomy** for component development

### ⚡ **Asynchronous Processing**
Workflows execute asynchronously using message queues, providing:
- **Non-blocking** API responses
- **Reliable delivery** with message persistence
- **Load balancing** across multiple execution engines
- **Retry mechanisms** for failed operations

### 🔄 **Event-Driven Design**
Components communicate through events and messages:
- **Loose coupling** between services
- **Scalable communication** patterns
- **Easy integration** of new components
- **Audit trail** of all operations

### 🛡️ **Security First**
Security is built into every layer:
- **Authentication** and authorization at the API layer
- **Sandboxed execution** for user code
- **Encrypted communication** between services
- **Audit logging** for compliance

## Component Architecture

### API Layer

The API layer serves as the main interface for all external interactions:

```mermaid
graph LR
    Client[Client Applications] --> LB[Load Balancer]
    LB --> API1[API Instance 1]
    LB --> API2[API Instance 2]
    LB --> API3[API Instance N]
    
    API1 --> Auth[Auth Service]
    API1 --> DB[(PostgreSQL)]
    API1 --> Queue[RabbitMQ]
    
    style API1 fill:#e1f5fe
    style Auth fill:#ffebee
```

**Key Features:**
- RESTful API with OpenAPI specification
- JWT-based authentication
- Role-based access control (RBAC)
- Rate limiting and throttling
- Input validation and sanitization

### Execution Layer

The execution layer handles workflow processing:

```mermaid
graph TD
    Queue[Message Queue] --> Engine[Execution Engine]
    Engine --> NodeRunner1[Node Runner 1]
    Engine --> NodeRunner2[Node Runner 2] 
    Engine --> NodeRunnerN[Node Runner N]
    
    NodeRunner1 --> Sandbox1[Sandboxed Environment]
    NodeRunner2 --> Sandbox2[Sandboxed Environment]
    NodeRunnerN --> SandboxN[Sandboxed Environment]
    
    style Engine fill:#f3e5f5
    style NodeRunner1 fill:#e8f5e8
    style Sandbox1 fill:#fff9c4
```

**Key Features:**
- High-performance Go execution engine
- Sandboxed Node.js runtime environments
- Horizontal scaling of node runners
- Resource isolation and limits
- Execution monitoring and metrics

### Data Layer

The data layer provides persistent and temporary storage:

```mermaid
graph TB
    subgraph "Persistent Storage"
        PG[(PostgreSQL<br/>Primary Database)]
        Backup[(Backup<br/>Storage)]
    end
    
    subgraph "Caching Layer"
        Redis[(Redis<br/>Cache & Sessions)]
        Memory[In-Memory<br/>Cache]
    end
    
    subgraph "Message Storage"
        Queue[RabbitMQ<br/>Durable Queues]
        DLQ[Dead Letter<br/>Queues]
    end
    
    PG --> Backup
    API --> PG
    API --> Redis
    Engine --> Redis
    Engine --> Queue
    Queue --> DLQ
```

**Key Features:**
- ACID compliance with PostgreSQL
- High-performance caching with Redis
- Durable message queues
- Automated backup and recovery
- Data encryption at rest

## Communication Patterns

### Synchronous Communication

Used for real-time operations and user-facing APIs:

```mermaid
sequenceDiagram
    participant UI as Web UI
    participant API as Orchestrator API
    participant DB as Database
    
    UI->>API: Create Workflow
    API->>DB: Save Workflow
    DB-->>API: Workflow ID
    API-->>UI: Success Response
```

### Asynchronous Communication

Used for workflow execution and background processing:

```mermaid
sequenceDiagram
    participant API as Orchestrator API
    participant Queue as Message Queue
    participant Engine as Execution Engine
    participant Runner as Node Runner
    
    API->>Queue: Execute Workflow
    Queue->>Engine: Workflow Message
    Engine->>Queue: Execute Step
    Queue->>Runner: Step Message
    Runner-->>Queue: Step Result
    Queue-->>Engine: Result
    Engine-->>Queue: Next Step / Complete
```

## Scalability Design

### Horizontal Scaling

All components are designed for horizontal scaling:

```mermaid
graph TB
    subgraph "Load Balancers"
        LB1[API Load Balancer]
        LB2[Engine Load Balancer]
    end
    
    subgraph "API Tier"
        API1[API 1]
        API2[API 2]
        API3[API N]
    end
    
    subgraph "Execution Tier"
        ENG1[Engine 1]
        ENG2[Engine 2]
        ENG3[Engine N]
    end
    
    subgraph "Node Runners"
        NR1[Runner 1]
        NR2[Runner 2]
        NR3[Runner N]
    end
    
    LB1 --> API1
    LB1 --> API2
    LB1 --> API3
    
    LB2 --> ENG1
    LB2 --> ENG2
    LB2 --> ENG3
    
    ENG1 --> NR1
    ENG2 --> NR2
    ENG3 --> NR3
```

### Auto-Scaling

Components can automatically scale based on metrics:

- **API Servers**: Scale based on CPU and request rate
- **Execution Engines**: Scale based on queue depth
- **Node Runners**: Scale based on execution load
- **Database**: Read replicas for scaling reads

## Security Architecture

### Defense in Depth

Multiple layers of security protect the platform:

```mermaid
graph TB
    subgraph "Network Security"
        WAF[Web Application Firewall]
        VPC[Virtual Private Cloud]
        Firewall[Network Firewall]
    end
    
    subgraph "Application Security"
        Auth[Authentication]
        AuthZ[Authorization]
        Encryption[Encryption]
    end
    
    subgraph "Runtime Security"
        Sandbox[Code Sandboxing]
        Limits[Resource Limits]
        Monitoring[Security Monitoring]
    end
    
    WAF --> VPC
    VPC --> Firewall
    Firewall --> Auth
    Auth --> AuthZ
    AuthZ --> Encryption
    Encryption --> Sandbox
    Sandbox --> Limits
    Limits --> Monitoring
```

### Key Security Features

1. **Authentication & Authorization**
   - JWT tokens with refresh mechanism
   - Role-based access control (RBAC)
   - API key management for integrations

2. **Code Isolation**
   - Sandboxed execution environments
   - Resource limits (CPU, memory, network)
   - Restricted module access

3. **Data Protection**
   - Encryption at rest and in transit
   - Secrets management
   - Audit logging

4. **Network Security**
   - VPC isolation
   - TLS termination
   - Rate limiting and DDoS protection

## Deployment Architecture

### Container Orchestration

The platform is designed for Kubernetes deployment:

```mermaid
graph TB
    subgraph "Ingress"
        Ingress[Nginx Ingress]
        Cert[Cert Manager]
    end
    
    subgraph "Application Pods"
        API[API Pods]
        Engine[Engine Pods]
        Runner[Runner Pods]
    end
    
    subgraph "Data Services"
        PG[PostgreSQL]
        Redis[Redis]
        RabbitMQ[RabbitMQ]
    end
    
    subgraph "Monitoring"
        Prometheus[Prometheus]
        Grafana[Grafana]
        Jaeger[Jaeger]
    end
    
    Ingress --> API
    Cert --> Ingress
    API --> PG
    API --> Redis
    API --> RabbitMQ
    Engine --> RabbitMQ
    Runner --> Engine
    
    Prometheus --> API
    Prometheus --> Engine
    Grafana --> Prometheus
    Jaeger --> API
```

### Infrastructure as Code

All infrastructure is managed as code:

- **Kubernetes manifests** for container orchestration
- **Helm charts** for application packaging
- **Terraform** for cloud infrastructure
- **GitOps** for deployment automation

## Performance Characteristics

### Throughput

Expected performance characteristics:

| Component | Metric | Target |
|-----------|--------|--------|
| API | Requests/sec | 10,000+ |
| Execution Engine | Workflows/sec | 1,000+ |
| Node Runner | Nodes/sec | 5,000+ |
| Database | Queries/sec | 50,000+ |

### Latency

Response time targets:

| Operation | Target Latency | Max Latency |
|-----------|---------------|-------------|
| API Response | < 100ms | < 500ms |
| Workflow Start | < 200ms | < 1s |
| Node Execution | < 500ms | < 5s |
| Database Query | < 10ms | < 100ms |

### Scalability Limits

Theoretical scaling limits:

- **Concurrent Workflows**: 100,000+
- **Daily Executions**: 10 million+
- **Stored Workflows**: 1 million+
- **Active Users**: 100,000+

## Next Steps

Learn more about specific components:

- **[Components Overview](/architecture/components)** - Detailed component descriptions
- **[Data Flow](/architecture/data-flow)** - How data moves through the system
- **[Security](/architecture/security)** - Security implementation details
- **[Scalability](/architecture/scalability)** - Scaling strategies and limits
