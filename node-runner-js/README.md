# N8N-Work Node Runner

A high-performance Node.js runtime service for executing workflow steps in sandboxed environments. Part of the N8N-Work distributed workflow execution platform.

## Features

- **Sandboxed Execution**: Multiple isolation strategies (vm2, child processes, microVMs)
- **Built-in Nodes**: HTTP requests, Slack integration, webhooks, conditional logic, data manipulation
- **Message Queue Integration**: RabbitMQ-based step execution and result publishing
- **Observability**: OpenTelemetry tracing, Prometheus metrics, structured logging
- **Security**: Non-root execution, memory/time limits, module restrictions
- **Health Monitoring**: Health checks, readiness probes, metrics endpoints

## Quick Start

### Development Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

### Docker Development

1. **Start all services:**
   ```bash
   docker-compose up -d
   ```

2. **View logs:**
   ```bash
   docker-compose logs -f node-runner
   ```

3. **Access services:**
   - Node Runner API: http://localhost:3000
   - RabbitMQ Management: http://localhost:15672
   - Jaeger UI: http://localhost:16686

## API Endpoints

### Health & Monitoring
- `GET /health` - Health check
- `GET /ready` - Readiness probe  
- `GET /metrics` - Prometheus metrics
- `GET /docs` - Swagger API documentation

### Node Execution
- `POST /execute` - Execute a node step directly

## Built-in Nodes

### HTTP Request Node
Execute HTTP requests with full configuration support:
```json
{
  "method": "GET|POST|PUT|DELETE|PATCH",
  "url": "https://api.example.com/data",
  "headers": {"Authorization": "Bearer token"},
  "body": {"key": "value"},
  "timeout": 30000
}
```

### Slack Node
Send messages to Slack channels:
```json
{
  "token": "xoxb-your-bot-token",
  "channel": "#general",
  "text": "Hello from N8N-Work!",
  "username": "WorkflowBot"
}
```

### Webhook Node
Send HTTP webhooks with retry logic:
```json
{
  "url": "https://hooks.example.com/webhook",
  "method": "POST",
  "payload": {"event": "workflow_completed"},
  "retries": 3
}
```

### Set Node
Transform and manipulate data:
```json
{
  "values": {
    "fullName": "{{firstName}} {{lastName}}",
    "timestamp": "{{$now}}",
    "userId": "{{user.id}}"
  }
}
```

### IF Node
Conditional logic and branching:
```json
{
  "condition": "{{user.age}} > 18",
  "ifTrue": {"action": "allow"},
  "ifFalse": {"action": "deny"}
}
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | HTTP server port |
| `NODE_ENV` | development | Environment mode |
| `LOG_LEVEL` | info | Logging level |
| `REDIS_URL` | redis://localhost:6379 | Redis connection |
| `RABBITMQ_URL` | amqp://localhost:5672 | RabbitMQ connection |
| `SANDBOX_STRATEGY` | vm2 | Isolation strategy |
| `MAX_EXECUTION_TIME` | 30000 | Step timeout (ms) |
| `MAX_MEMORY_USAGE` | 512 | Memory limit (MB) |

### Sandbox Strategies

1. **vm2** (Default): V8 sandbox with restricted globals
2. **childprocess**: Isolated Node.js processes
3. **microvm**: Firecracker microVMs (planned)

## Development

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build production bundle
- `npm run start` - Start production server
- `npm run test` - Run test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Lint source code
- `npm run lint:fix` - Fix linting issues

### Project Structure

```
src/
├── app.ts              # Fastify app configuration
├── main.ts             # Application entry point
├── tracing.ts          # OpenTelemetry setup
├── sandbox-manager.ts  # Execution sandboxing
├── node-registry.ts    # Built-in node definitions
├── message-queue.ts    # RabbitMQ integration
├── nodes/              # Built-in node implementations
│   ├── http-request.ts
│   ├── slack.ts
│   ├── webhook.ts
│   ├── set.ts
│   └── if.ts
└── types/              # TypeScript definitions
    └── index.ts
```

## Security

- Runs as non-root user in containers
- Sandboxed execution environments
- Module import restrictions
- Memory and CPU limits
- Network isolation options
- Input validation and sanitization

## Observability

### Tracing
OpenTelemetry traces for:
- HTTP requests
- Message queue operations
- Node executions
- Database operations

### Metrics
Prometheus metrics for:
- Request rates and latencies
- Execution success/failure rates
- Queue depth and processing times
- Resource utilization

### Logging
Structured JSON logs with:
- Request correlation IDs
- Execution context
- Performance metrics
- Error details

## Production Deployment

### Docker

```bash
# Build image
docker build -t n8n-work-node-runner .

# Run container
docker run -d \
  --name node-runner \
  -p 3000:3000 \
  -e REDIS_URL=redis://redis:6379 \
  -e RABBITMQ_URL=amqp://rabbitmq:5672 \
  n8n-work-node-runner
```

### Kubernetes

See `k8s/` directory for Kubernetes manifests including:
- Deployment
- Service
- ConfigMap
- Secret
- HorizontalPodAutoscaler

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details
