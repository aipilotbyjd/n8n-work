# API Reference

N8N-Work provides comprehensive APIs for managing workflows, executions, and platform configuration. The platform offers both RESTful HTTP APIs and high-performance gRPC services to meet different integration needs.

## API Overview

```mermaid
graph TB
    subgraph "Client Applications"
        WebUI[Web UI]
        CLI[CLI Tools]
        Mobile[Mobile Apps]
        Integration[3rd Party]
    end
    
    subgraph "API Gateway"
        Gateway[API Gateway<br/>Rate Limiting & Auth]
        LB[Load Balancer]
    end
    
    subgraph "API Services"
        REST[REST API<br/>NestJS]
        GraphQL[GraphQL API<br/>Optional]
        gRPC[gRPC Services<br/>Go/Node.js]
        WebSocket[WebSocket<br/>Real-time]
    end
    
    subgraph "Backend Services"
        Orchestrator[Orchestrator]
        Engine[Execution Engine]
        Runner[Node Runner]
    end
    
    WebUI --> Gateway
    CLI --> Gateway
    Mobile --> Gateway
    Integration --> Gateway
    
    Gateway --> LB
    LB --> REST
    LB --> GraphQL
    LB --> gRPC
    LB --> WebSocket
    
    REST --> Orchestrator
    gRPC --> Engine
    WebSocket --> Orchestrator
```

## API Types

### REST API
The primary API for most client interactions, providing standard HTTP endpoints for workflow management, user authentication, and system configuration.

**Base URL**: `https://api.n8n-work.com/v1`  
**Protocol**: HTTPS  
**Format**: JSON  
**Authentication**: JWT Bearer tokens

### gRPC API
High-performance API for internal service communication and performance-critical integrations.

**Endpoints**: Various service-specific endpoints  
**Protocol**: HTTP/2 with Protocol Buffers  
**Authentication**: mTLS + JWT

### WebSocket API
Real-time API for live updates, execution monitoring, and interactive features.

**Endpoint**: `wss://api.n8n-work.com/ws`  
**Protocol**: WebSocket over TLS  
**Authentication**: JWT tokens

## Authentication

### JWT Bearer Tokens

All API requests require authentication using JWT (JSON Web Tokens):

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Getting Access Tokens

#### 1. User Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "tokenType": "Bearer",
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user"
  }
}
```

#### 2. API Keys (for integrations)
```http
POST /auth/api-keys
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "name": "My Integration",
  "scopes": ["workflows:read", "executions:write"],
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "id": "key_123",
  "name": "My Integration",
  "key": "n8w_live_1234567890abcdef",
  "scopes": ["workflows:read", "executions:write"],
  "createdAt": "2023-12-01T10:00:00Z",
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

### Token Refresh

```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Rate Limiting

APIs are rate-limited to ensure fair usage and system stability:

| Tier | Requests/Minute | Burst Limit |
|------|-----------------|-------------|
| Free | 100 | 120 |
| Pro | 1,000 | 1,200 |
| Enterprise | 10,000 | 12,000 |

Rate limit headers are included in all responses:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1701234567
```

## Error Handling

### HTTP Status Codes

| Code | Description | Usage |
|------|-------------|-------|
| 200 | OK | Successful request |
| 201 | Created | Resource created successfully |
| 202 | Accepted | Async operation started |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict |
| 422 | Unprocessable Entity | Validation errors |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | System maintenance |

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request data is invalid",
    "details": [
      {
        "field": "name",
        "message": "Name is required",
        "code": "REQUIRED"
      },
      {
        "field": "email",
        "message": "Email format is invalid",
        "code": "INVALID_FORMAT"
      }
    ],
    "timestamp": "2023-12-01T10:00:00Z",
    "requestId": "req_123456789",
    "documentation": "https://docs.n8n-work.com/api/errors#validation"
  }
}
```

### Common Error Codes

| Code | Description | Action |
|------|-------------|--------|
| `INVALID_TOKEN` | JWT token is invalid or expired | Refresh token or re-authenticate |
| `INSUFFICIENT_PERMISSIONS` | User lacks required permissions | Check user role and permissions |
| `RESOURCE_NOT_FOUND` | Requested resource doesn't exist | Verify resource ID |
| `VALIDATION_ERROR` | Request data validation failed | Fix validation errors |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Wait and retry with backoff |
| `WORKFLOW_EXECUTION_FAILED` | Workflow execution error | Check workflow configuration |

## Pagination

List endpoints support cursor-based pagination:

### Request Parameters
```http
GET /workflows?limit=20&cursor=eyJpZCI6IjEyMyJ9
```

### Response Format
```json
{
  "data": [
    {
      "id": "workflow_123",
      "name": "My Workflow"
    }
  ],
  "pagination": {
    "limit": 20,
    "hasMore": true,
    "nextCursor": "eyJpZCI6IjEyNCJ9",
    "total": 150
  }
}
```

## Filtering and Sorting

### Filtering
```http
GET /workflows?filter[active]=true&filter[userId]=user_123
```

### Sorting
```http
GET /workflows?sort=-createdAt,name
```

## API Versioning

N8N-Work uses URL-based versioning:

- **Current Version**: `v1`
- **Base URL**: `https://api.n8n-work.com/v1`
- **Deprecation**: 12 months notice for breaking changes
- **Support**: Previous version supported for 6 months

### Version Headers
```http
Accept: application/vnd.n8n-work.v1+json
N8N-Work-Version: 2023-12-01
```

## SDKs and Libraries

### Official SDKs

#### JavaScript/TypeScript
```bash
npm install @n8n-work/api-client
```

```typescript
import { N8NWorkClient } from '@n8n-work/api-client';

const client = new N8NWorkClient({
  baseURL: 'https://api.n8n-work.com/v1',
  accessToken: 'your-access-token'
});

const workflows = await client.workflows.list();
```

#### Python
```bash
pip install n8n-work
```

```python
from n8n_work import Client

client = Client(
    base_url="https://api.n8n-work.com/v1",
    access_token="your-access-token"
)

workflows = client.workflows.list()
```

#### Go
```bash
go get github.com/n8n-work/go-client
```

```go
import "github.com/n8n-work/go-client"

client := n8nwork.NewClient("https://api.n8n-work.com/v1", "your-access-token")
workflows, err := client.Workflows.List(ctx)
```

## WebSocket API

### Connection
```javascript
const ws = new WebSocket('wss://api.n8n-work.com/ws?token=your-jwt-token');

ws.onopen = () => {
  console.log('Connected to N8N-Work WebSocket');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

### Message Types

#### Subscribe to Execution Updates
```json
{
  "type": "subscribe",
  "channel": "executions",
  "filter": {
    "userId": "user_123",
    "workflowId": "workflow_456"
  }
}
```

#### Execution Status Update
```json
{
  "type": "execution.status",
  "data": {
    "executionId": "exec_789",
    "workflowId": "workflow_456",
    "status": "running",
    "progress": {
      "completed": 2,
      "total": 5,
      "currentStep": "step_3"
    }
  },
  "timestamp": "2023-12-01T10:00:00Z"
}
```

## API Endpoints

### Core Resources

| Resource | Description | Documentation |
|----------|-------------|---------------|
| [Workflows](/api/workflows) | Manage workflow definitions | CRUD operations, versioning |
| [Executions](/api/executions) | Control workflow executions | Start, stop, monitor |
| [Nodes](/api/nodes) | Node type registry | Available nodes, schemas |
| [Credentials](/api/credentials) | Secure credential storage | Encrypted storage, sharing |
| [Users](/api/users) | User management | Profiles, permissions |
| [Organizations](/api/organizations) | Multi-tenant support | Teams, billing |

### System Resources

| Resource | Description | Documentation |
|----------|-------------|---------------|
| [Health](/api/health) | System health checks | Service status |
| [Metrics](/api/metrics) | Performance metrics | Usage statistics |
| [Events](/api/events) | System events | Audit logs, webhooks |

## Best Practices

### 1. Authentication
- Store tokens securely (never in client-side code)
- Implement token refresh logic
- Use API keys for server-to-server communication
- Rotate API keys regularly

### 2. Error Handling
- Always check HTTP status codes
- Implement exponential backoff for retries
- Log error details for debugging
- Handle rate limiting gracefully

### 3. Performance
- Use pagination for large datasets
- Implement caching where appropriate
- Use WebSockets for real-time updates
- Batch operations when possible

### 4. Security
- Always use HTTPS
- Validate and sanitize inputs
- Follow OWASP guidelines
- Monitor for suspicious activity

## Testing

### API Testing Tools

#### Postman Collection
Download our [Postman collection](https://docs.n8n-work.com/api/postman.json) for easy API testing.

#### OpenAPI Specification
View our [OpenAPI spec](https://api.n8n-work.com/docs) for interactive documentation.

### Example Requests

#### Create and Execute a Workflow
```bash
# 1. Create workflow
curl -X POST https://api.n8n-work.com/v1/workflows \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Workflow",
    "nodes": [...],
    "connections": [...]
  }'

# 2. Execute workflow
curl -X POST https://api.n8n-work.com/v1/workflows/workflow_123/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "inputData": {"key": "value"}
  }'
```

## Support

- 📖 **Documentation**: Browse detailed endpoint documentation
- 💬 **Discord**: [Join our developer community](https://discord.gg/n8n-work)
- 🐛 **Issues**: [Report API issues on GitHub](https://github.com/n8n-work/n8n-work/issues)
- 📧 **API Support**: [api-support@n8n-work.com](mailto:api-support@n8n-work.com)

## Next Steps

- **[Workflows API](/api/workflows)** - Manage workflow definitions
- **[Executions API](/api/executions)** - Control workflow executions  
- **[gRPC Services](/api/grpc/)** - High-performance service APIs
- **[Authentication Guide](/api/authentication)** - Detailed auth documentation
