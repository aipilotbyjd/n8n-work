# N8N-Work: Production-Grade Workflow Automation Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://github.com/n8n-work/platform/workflows/CI/badge.svg)](https://github.com/n8n-work/platform/actions)
[![Docker](https://img.shields.io/badge/docker-supported-blue)](https://hub.docker.com/r/n8n-work/platform)
[![Kubernetes](https://img.shields.io/badge/kubernetes-ready-green)](https://kubernetes.io/)

N8N-Work is a next-generation workflow automation platform designed for enterprise-scale deployment with advanced features including ultra-scale multi-region support, comprehensive security isolation, enterprise governance, and developer velocity optimization.

## 🚀 Features

### Core Capabilities
- **Ultra Scale**: Active/active multi-region, zero-downtime deploys, adaptive backpressure, elastic autoscaling
- **Safety & Isolation**: Tiered sandboxing (VM → process → microVM), strict egress allowlists, plugin code signing, policy engine
- **Enterprise Governance**: RBAC/ABAC, PII controls, data lineage, audit immutability, usage metering & billing
- **Developer Velocity**: Single source of truth contracts, codegen, local E2E, golden paths for nodes, fast CI with hermetic tests
- **Observability-First**: Tracing across control/engine/node/vendor, click-to-correlation, SLOs + auto rollback

### System Architecture
- **Orchestrator-Nest**: TypeScript/NestJS control plane for workflow management and coordination
- **Engine-Go**: Go-based execution engine with DAG scheduling and state management
- **Node-Runner-JS**: Node.js runtime for sandboxed node execution with multiple isolation levels
- **Node-SDK-JS**: Comprehensive SDK for node development with CLI tools and testing utilities

## 📋 Prerequisites

- **Docker & Docker Compose**: For local development
- **Node.js 18+**: For TypeScript services
- **Go 1.21+**: For the execution engine
- **PostgreSQL 15+**: Primary database
- **Redis 7+**: Caching and sessions
- **RabbitMQ 3+**: Message queuing

## 🏃‍♂️ Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/n8n-work/platform.git
cd platform
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

### 3. Start with Docker Compose

```bash
# Start all services
make dev

# Or manually with docker-compose
docker-compose up -d
```

### 4. Verify Installation

```bash
# Check service health
make health

# View logs
make logs

# Access the API
curl http://localhost:3000/api/v1/health
```

## 🌐 Service Endpoints

| Service | HTTP | gRPC | Purpose |
|---------|------|------|---------|
| Orchestrator | 3000 | 50051 | API & Control Plane |
| Engine | 8080 | 50052 | Execution Engine |
| Node Runner | 3002 | 50053 | Node Execution |
| Grafana | 3001 | - | Monitoring Dashboard |
| Prometheus | 9090 | - | Metrics Collection |
| Jaeger | 16686 | - | Distributed Tracing |
| RabbitMQ | 15672 | - | Message Queue UI |

## 🛠️ Development

### Local Development Setup

```bash
# Install dependencies
make install

# Generate protobuf code
make proto-gen

# Run database migrations
make db-migrate

# Start development servers
make dev-services

# Run tests
make test

# Build all services
make build
```

### Service Development

#### Orchestrator (NestJS)
```bash
cd orchestrator-nest
npm install
npm run start:dev
```

#### Engine (Go)
```bash
cd engine-go
go mod tidy
make dev
```

#### Node Runner (Node.js)
```bash
cd node-runner-js
npm install
npm run dev
```

### Creating Custom Nodes

```bash
# Install the SDK
npm install -g @n8n-work/node-sdk

# Create a new node
n8n-work-sdk create my-custom-node

# Test your node
cd my-custom-node
npm test

# Package for distribution
n8n-work-sdk package
```

## 🚀 Deployment

### Docker Compose (Development)

```bash
# Start all services
docker-compose up -d

# Scale specific services
docker-compose up -d --scale orchestrator-nest=3

# View logs
docker-compose logs -f orchestrator-nest
```

### Kubernetes (Production)

```bash
# Create namespace
kubectl create namespace n8n-work

# Apply configurations
kubectl apply -f infra/k8s/

# Check deployment status
kubectl get pods -n n8n-work

# Access logs
kubectl logs -f deployment/orchestrator-nest -n n8n-work
```

### Helm Chart

```bash
# Add repository
helm repo add n8n-work https://charts.n8n-work.com

# Install
helm install n8n-work n8n-work/platform \
  --namespace n8n-work \
  --create-namespace \
  --values values.yaml
```

## 📊 Monitoring & Observability

### Metrics (Prometheus + Grafana)

- **Platform Overhead**: p95 < 150ms (excluding vendor API time)
- **Workflow Start Time**: p95 < 500ms from webhook to first step
- **Step Execution**: p95 < 2s for built-in nodes
- **UI Responsiveness**: p95 < 200ms for API calls

Access Grafana: http://localhost:3001 (admin/admin)

### Tracing (Jaeger)

Distributed tracing across all services with correlation IDs.

Access Jaeger: http://localhost:16686

### Logging

Structured JSON logging with configurable levels:

```bash
# View aggregated logs
make logs

# Filter by service
make logs SERVICE=orchestrator-nest

# Follow logs
make logs-follow
```

## 🔒 Security

### Authentication & Authorization

- **SSO/OIDC Integration**: Enterprise identity providers
- **API Key Management**: Service-to-service authentication
- **RBAC/ABAC**: Role and attribute-based access control
- **JWT Tokens**: Secure session management

### Data Protection

- **Encryption at Rest**: AES-256-GCM with KMS key management
- **Encryption in Transit**: TLS 1.3 for external, mTLS for internal
- **Secret Management**: Vault/KMS integration with key rotation
- **PII Handling**: Automatic detection, classification, and redaction

### Isolation Levels

1. **VM2 Sandbox**: Fast path for trusted nodes
2. **Process Isolation**: Child processes with resource limits
3. **MicroVM**: Firecracker/Kata containers for untrusted code
4. **WASM Runtime**: Memory-safe execution

## 🧪 Testing

### Unit Tests

```bash
# Run all unit tests
make test

# Run specific service tests
make test-orchestrator
make test-engine
make test-node-runner

# Generate coverage report
make test-coverage
```

### Integration Tests

```bash
# Run integration tests
make test-integration

# Run end-to-end tests
make test-e2e
```

### Load Testing

```bash
# Run load tests
make test-load

# Stress test specific endpoints
make stress-test ENDPOINT=/api/v1/workflows
```

## 📈 Performance & Scaling

### SLO Targets

- **Availability**: 99.95% single-region, 99.99% multi-region
- **Concurrent Workflows**: 10,000+ per region
- **Steps per Second**: 100,000+ per region
- **Webhook Ingress**: 50,000 RPS per region

### Auto-scaling Configuration

Kubernetes HPA configured with:
- CPU utilization: 70%
- Memory utilization: 80%
- Custom metrics: HTTP requests per second

### Multi-Region Deployment

```bash
# Deploy to multiple regions
kubectl apply -f infra/k8s/multi-region/

# Configure cross-region failover
kubectl apply -f infra/k8s/failover/
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for your changes
5. Ensure all tests pass (`make test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Code Style

- **TypeScript**: Prettier + ESLint
- **Go**: gofmt + golangci-lint
- **Commit Messages**: Conventional Commits format

## 📚 Documentation

- **API Reference**: [https://docs.n8n-work.com/api](https://docs.n8n-work.com/api)
- **Node SDK Guide**: [https://docs.n8n-work.com/sdk](https://docs.n8n-work.com/sdk)
- **Deployment Guide**: [https://docs.n8n-work.com/deploy](https://docs.n8n-work.com/deploy)
- **Architecture Deep Dive**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **ADRs**: [docs/adr/](docs/adr/)

## 🔗 Links

- **Website**: [https://n8n-work.com](https://n8n-work.com)
- **Documentation**: [https://docs.n8n-work.com](https://docs.n8n-work.com)
- **Community**: [https://community.n8n-work.com](https://community.n8n-work.com)
- **Node Registry**: [https://registry.n8n-work.com](https://registry.n8n-work.com)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **N8N Team**: For the original inspiration and open-source foundation
- **Community Contributors**: For feedback, testing, and contributions
- **Enterprise Users**: For real-world use cases and requirements

---

**Built with ❤️ for the automation community**

For questions, issues, or enterprise support, please contact us at [support@n8n-work.com](mailto:support@n8n-work.com).
