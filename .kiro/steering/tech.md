# Technology Stack & Build System

## Architecture Overview

N8N-Work follows a microservices architecture with four core services communicating via gRPC and message queues:

- **Orchestrator-Nest**: Control plane (TypeScript/NestJS)
- **Engine-Go**: Execution engine (Go)
- **Node-Runner-JS**: Sandboxed node execution (Node.js)
- **Node-SDK-JS**: Public SDK for node development (TypeScript)

## Core Technologies

### Backend Services
- **Orchestrator**: NestJS, TypeScript, Prisma/TypeORM, PostgreSQL
- **Engine**: Go 1.21+, gRPC, Protocol Buffers, PostgreSQL
- **Node Runner**: Node.js 18+, Fastify, VM2/isolated-vm, sandboxing
- **SDK**: TypeScript, Commander.js, Inquirer, Mustache templates

### Communication & Messaging
- **gRPC**: Inter-service communication with Protocol Buffers
- **RabbitMQ**: Message queuing and event streaming
- **Redis**: Caching, sessions, and real-time data

### Data Storage
- **PostgreSQL 15+**: Primary database for metadata and state
- **ClickHouse**: Analytics and time-series data
- **MinIO/S3**: Object storage with SSE-KMS encryption

### Observability Stack
- **OpenTelemetry**: Distributed tracing and metrics collection
- **Prometheus**: Metrics storage and alerting
- **Grafana**: Dashboards and visualization
- **Tempo**: Distributed tracing backend
- **Loki**: Log aggregation and search

### Security & Infrastructure
- **Docker**: Containerization with multi-stage builds
- **Kubernetes**: Orchestration with Helm charts
- **Vault/KMS**: Secrets management with key rotation
- **Linkerd/Istio**: Service mesh for mTLS

## Build System & Commands

### Prerequisites
- Node.js 18+ and npm 9+
- Go 1.21+
- Docker & Docker Compose
- Buf CLI for Protocol Buffer management

### Common Development Commands

```bash
# Project setup
make setup                    # Install deps and generate proto code
make install-deps            # Install all service dependencies
make proto-gen               # Generate code from proto contracts

# Development environment
make dev                     # Start development environment
make docker-up               # Start full Docker stack
make docker-down             # Stop Docker stack

# Code quality
make lint                    # Run all linters
make format                  # Format all code
make test                    # Run all tests
make test-coverage           # Generate coverage reports

# Building
make build                   # Build all services
make docker-build            # Build Docker images

# Database operations
make db-migrate              # Run database migrations
make db-seed                 # Seed development data

# Testing
make e2e                     # Run end-to-end tests
make load-test               # Run load tests
```

### Service-Specific Commands

#### Orchestrator (NestJS)
```bash
cd orchestrator-nest
npm run start:dev            # Development server with hot reload
npm run build                # Production build
npm run test                 # Unit tests
npm run migration:generate   # Generate new migration
```

#### Engine (Go)
```bash
cd engine-go
go run ./cmd/engine          # Start engine service
go run ./cmd/stepworker      # Start step worker
go test ./...                # Run tests
make dev                     # Development mode
```

#### Node Runner (Node.js)
```bash
cd node-runner-js
npm run start:dev            # Development server
npm run build                # Build TypeScript
npm test                     # Run tests
```

#### Node SDK (TypeScript)
```bash
cd node-sdk-js
npm run dev                  # CLI development mode
npm run build                # Build for distribution
npm test                     # Run SDK tests
```

## Code Generation

Protocol Buffers are the single source of truth for service contracts:

```bash
# Generate all proto code
make proto-gen

# Or per-service
cd proto-contracts && ./generate.ps1  # Windows
cd proto-contracts && ./generate.sh   # Unix
```

## Environment Configuration

Each service uses environment-specific configuration:

- `.env` files for local development
- Kubernetes ConfigMaps/Secrets for production
- Vault integration for sensitive data
- Feature flags via configuration

## Testing Strategy

- **Unit Tests**: Jest (TypeScript), Go testing package
- **Integration Tests**: Service-to-service communication
- **E2E Tests**: Full workflow execution scenarios
- **Load Tests**: K6 for performance validation
- **Security Tests**: SAST/DAST in CI pipeline

## Deployment

- **Local**: Docker Compose for development
- **Staging/Production**: Kubernetes with Helm charts
- **CI/CD**: GitHub Actions with automated testing and deployment
- **Monitoring**: Comprehensive observability stack