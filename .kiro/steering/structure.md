# Project Structure & Organization

## Repository Layout

```
n8n-work/
├── orchestrator-nest/          # Control plane service (TypeScript/NestJS)
├── engine-go/                  # Execution engine service (Go)
├── node-runner-js/             # Node execution runtime (Node.js)
├── node-sdk-js/                # Public SDK for node developers
├── proto-contracts/            # gRPC contracts (single source of truth)
├── infra/                      # Infrastructure & deployment configs
├── schemas/                    # JSON Schemas (workflow DSL, node I/O)
├── docs/                       # Documentation, ADRs, runbooks
├── tests/                      # Cross-service E2E and load tests
├── scripts/                    # Utility scripts and automation
├── docker-compose.yml          # Development environment
├── Makefile                    # Build automation
└── README.md                   # Project overview
```

## Service Structure Conventions

### Orchestrator-Nest (NestJS Service)
```
orchestrator-nest/
├── src/
│   ├── modules/                # Feature modules (workflows, auth, etc.)
│   ├── common/                 # Shared utilities and decorators
│   ├── config/                 # Configuration management
│   ├── database/               # Database entities and migrations
│   ├── proto/                  # Generated gRPC code
│   └── main.ts                 # Application entry point
├── test/                       # Unit and integration tests
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── nest-cli.json               # NestJS CLI configuration
└── Dockerfile                  # Container build
```

### Engine-Go (Go Service)
```
engine-go/
├── cmd/                        # Application entry points
│   ├── engine/                 # Main engine service
│   └── stepworker/             # Step worker process
├── internal/                   # Private application code
│   ├── engine/                 # Core engine logic
│   ├── scheduler/              # DAG scheduling
│   ├── worker/                 # Step execution workers
│   └── storage/                # Data persistence layer
├── proto/                      # Generated gRPC code
├── pkg/                        # Public packages (if any)
├── go.mod                      # Go module definition
├── go.sum                      # Dependency checksums
└── Dockerfile                  # Container build
```

### Node-Runner-JS (Node.js Service)
```
node-runner-js/
├── src/
│   ├── runtime/                # Execution runtime engines
│   ├── security/               # Sandboxing and isolation
│   ├── plugins/                # Plugin management
│   ├── nodes/                  # Built-in node implementations
│   └── main.ts                 # Application entry point
├── plugins/                    # Installed plugin storage
├── proto/                      # Generated gRPC code
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
└── Dockerfile                  # Container build
```

### Node-SDK-JS (Public SDK)
```
node-sdk-js/
├── src/
│   ├── cli/                    # Command-line interface
│   ├── types/                  # TypeScript type definitions
│   ├── utils/                  # Utility functions
│   ├── templates/              # Node scaffolding templates
│   └── index.ts                # Main SDK exports
├── examples/                   # Example node implementations
├── templates/                  # Project templates
├── package.json                # SDK package definition
└── README.md                   # SDK documentation
```

## Protocol Contracts Structure

```
proto-contracts/
├── orchestrator.proto          # Workflow management service
├── engine.proto                # Execution engine service
├── node_runner.proto           # Node execution service
├── workflow.proto              # Workflow definitions
├── execution.proto             # Execution tracking
├── health.proto                # Health check service
├── buf.yaml                    # Buf configuration
├── buf.gen.yaml                # Code generation config
├── generate.sh                 # Unix generation script
└── generate.ps1                # Windows generation script
```

## Infrastructure Organization

```
infra/
├── docker-compose.yml          # Local development stack
├── k8s/                        # Kubernetes manifests
│   ├── base/                   # Base configurations
│   ├── overlays/               # Environment-specific overlays
│   └── charts/                 # Helm charts
├── terraform/                  # Infrastructure as code
├── grafana/                    # Monitoring dashboards
├── prometheus/                 # Metrics configuration
├── nginx/                      # Load balancer config
└── vault/                      # Secrets management
```

## Documentation Structure

```
docs/
├── api/                        # API documentation
├── architecture/               # System design documents
├── guide/                      # User and developer guides
├── sdk/                        # SDK documentation
├── .vitepress/                 # Documentation site config
└── index.md                    # Documentation home
```

## Testing Organization

```
tests/
├── e2e/                        # End-to-end test suites
├── load/                       # Performance and load tests
├── security/                   # Security testing
├── utils/                      # Test utilities and helpers
└── jest.config.js              # Test configuration
```

## Naming Conventions

### Files and Directories
- **kebab-case** for directories and file names
- **PascalCase** for TypeScript classes and interfaces
- **camelCase** for variables and functions
- **SCREAMING_SNAKE_CASE** for constants and environment variables

### Services and Components
- Services: `{domain}-{technology}` (e.g., `orchestrator-nest`, `engine-go`)
- Proto services: `{Domain}Service` (e.g., `OrchestratorService`)
- Database tables: `snake_case` (e.g., `workflow_executions`)
- gRPC methods: `PascalCase` (e.g., `CreateWorkflow`)

### Environment Variables
- Service-specific: `{SERVICE}_{SETTING}` (e.g., `ORCHESTRATOR_PORT`)
- Shared infrastructure: `{RESOURCE}_URL` (e.g., `DATABASE_URL`, `REDIS_URL`)
- Feature flags: `ENABLE_{FEATURE}` (e.g., `ENABLE_TRACING`)

## Code Organization Principles

### Separation of Concerns
- **Domain logic** separated from infrastructure concerns
- **Configuration** centralized and environment-aware
- **Cross-cutting concerns** (logging, metrics) handled via middleware

### Dependency Management
- **Proto contracts** as the single source of truth for APIs
- **Shared types** defined in proto files, not duplicated
- **Version pinning** for all dependencies with regular updates

### Security Boundaries
- **Service isolation** via network policies and authentication
- **Tenant isolation** at the database and runtime level
- **Plugin sandboxing** with multiple isolation levels

### Observability Integration
- **Structured logging** with correlation IDs across all services
- **Distributed tracing** instrumentation in all service calls
- **Metrics collection** for business and technical KPIs

## Development Workflow

1. **Proto-first development**: Define service contracts before implementation
2. **Feature branches**: Use descriptive branch names with issue numbers
3. **Code generation**: Always regenerate proto code after contract changes
4. **Testing pyramid**: Unit tests → Integration tests → E2E tests
5. **Documentation**: Update relevant docs with code changes