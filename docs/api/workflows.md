# Workflows API

The Workflows API allows you to manage workflow definitions, including creating, updating, executing, and monitoring workflows. This is the core API for building automation solutions with N8N-Work.

## Overview

Workflows are the heart of N8N-Work. A workflow defines a series of connected nodes that process data and perform actions. The Workflows API provides comprehensive CRUD operations and execution control.

## Workflow Object

```typescript
interface Workflow {
  id: string;
  name: string;
  description?: string;
  userId: string;
  organizationId?: string;
  active: boolean;
  definition: WorkflowDefinition;
  version: number;
  tags: string[];
  settings: WorkflowSettings;
  statistics: WorkflowStatistics;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowDefinition {
  nodes: Node[];
  connections: Connection[];
  settings: WorkflowSettings;
}

interface WorkflowSettings {
  timezone?: string;
  saveDataErrorExecution?: 'all' | 'none';
  saveDataSuccessExecution?: 'all' | 'none';
  executionTimeout?: number;
  maxExecutionTime?: number;
}
```

## Endpoints

### List Workflows

```http
GET /workflows
```

Retrieve a paginated list of workflows for the authenticated user.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Number of workflows to return (max 100, default 20) |
| `cursor` | string | Pagination cursor for next page |
| `filter[active]` | boolean | Filter by active status |
| `filter[tag]` | string | Filter by tag |
| `sort` | string | Sort order: `name`, `createdAt`, `-createdAt` |

#### Example Request

```bash
curl -X GET "https://api.n8n-work.com/v1/workflows?limit=10&filter[active]=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Example Response

```json
{
  "data": [
    {
      "id": "wf_1234567890",
      "name": "GitHub to Slack Notification",
      "description": "Send Slack notifications for new GitHub issues",
      "userId": "user_123",
      "active": true,
      "version": 2,
      "tags": ["github", "slack", "notifications"],
      "settings": {
        "timezone": "UTC",
        "executionTimeout": 300
      },
      "statistics": {
        "totalExecutions": 142,
        "successfulExecutions": 138,
        "failedExecutions": 4,
        "averageExecutionTime": 2.5
      },
      "createdAt": "2023-12-01T10:00:00Z",
      "updatedAt": "2023-12-05T14:30:00Z"
    }
  ],
  "pagination": {
    "limit": 10,
    "hasMore": true,
    "nextCursor": "eyJpZCI6IndmXzEyMzQ1Njc4OTEifQ==",
    "total": 25
  }
}
```

### Get Workflow

```http
GET /workflows/{id}
```

Retrieve a specific workflow by ID.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Workflow ID |
| `include` | string | Additional data to include: `definition`, `executions`, `statistics` |

#### Example Request

```bash
curl -X GET "https://api.n8n-work.com/v1/workflows/wf_1234567890?include=definition" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Example Response

```json
{
  "id": "wf_1234567890",
  "name": "GitHub to Slack Notification",
  "description": "Send Slack notifications for new GitHub issues",
  "active": true,
  "definition": {
    "nodes": [
      {
        "id": "webhook_1",
        "type": "webhook",
        "name": "GitHub Webhook",
        "parameters": {
          "path": "/github-webhook",
          "httpMethod": "POST"
        },
        "position": [100, 100]
      },
      {
        "id": "filter_1",
        "type": "if",
        "name": "Filter Issues",
        "parameters": {
          "condition": "={{$json.action}} === 'opened'"
        },
        "position": [300, 100]
      },
      {
        "id": "slack_1",
        "type": "slack",
        "name": "Send to Slack",
        "parameters": {
          "channel": "#dev-alerts",
          "message": "New issue: {{$json.issue.title}}"
        },
        "position": [500, 100]
      }
    ],
    "connections": [
      {
        "from": "webhook_1",
        "to": "filter_1",
        "fromOutput": "main",
        "toInput": "main"
      },
      {
        "from": "filter_1",
        "to": "slack_1",
        "fromOutput": "true",
        "toInput": "main"
      }
    ]
  },
  "createdAt": "2023-12-01T10:00:00Z",
  "updatedAt": "2023-12-05T14:30:00Z"
}
```

### Create Workflow

```http
POST /workflows
```

Create a new workflow.

#### Request Body

```json
{
  "name": "My New Workflow",
  "description": "Description of the workflow",
  "definition": {
    "nodes": [...],
    "connections": [...]
  },
  "active": false,
  "tags": ["automation", "api"],
  "settings": {
    "timezone": "UTC",
    "executionTimeout": 300
  }
}
```

#### Example Request

```bash
curl -X POST "https://api.n8n-work.com/v1/workflows" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Data Sync",
    "description": "Sync data between APIs",
    "definition": {
      "nodes": [
        {
          "id": "http_1",
          "type": "httpRequest",
          "name": "Fetch Data",
          "parameters": {
            "method": "GET",
            "url": "https://api.example.com/data"
          },
          "position": [100, 100]
        }
      ],
      "connections": []
    },
    "active": false,
    "tags": ["api", "sync"]
  }'
```

#### Example Response

```json
{
  "id": "wf_0987654321",
  "name": "API Data Sync",
  "description": "Sync data between APIs",
  "userId": "user_123",
  "active": false,
  "version": 1,
  "tags": ["api", "sync"],
  "createdAt": "2023-12-06T10:00:00Z",
  "updatedAt": "2023-12-06T10:00:00Z"
}
```

### Update Workflow

```http
PUT /workflows/{id}
```

Update an existing workflow.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Workflow ID |

#### Request Body

```json
{
  "name": "Updated Workflow Name",
  "description": "Updated description",
  "definition": {
    "nodes": [...],
    "connections": [...]
  },
  "active": true,
  "tags": ["updated", "automation"]
}
```

#### Example Request

```bash
curl -X PUT "https://api.n8n-work.com/v1/workflows/wf_1234567890" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated GitHub Notifications",
    "active": true
  }'
```

### Delete Workflow

```http
DELETE /workflows/{id}
```

Delete a workflow. This will also cancel any running executions.

#### Example Request

```bash
curl -X DELETE "https://api.n8n-work.com/v1/workflows/wf_1234567890" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Example Response

```json
{
  "message": "Workflow deleted successfully",
  "deletedAt": "2023-12-06T15:30:00Z"
}
```

## Workflow Execution

### Execute Workflow

```http
POST /workflows/{id}/execute
```

Execute a workflow manually with optional input data.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Workflow ID |

#### Request Body

```json
{
  "inputData": {
    "key": "value",
    "data": ["item1", "item2"]
  },
  "settings": {
    "saveExecution": true,
    "timeout": 300
  }
}
```

#### Example Request

```bash
curl -X POST "https://api.n8n-work.com/v1/workflows/wf_1234567890/execute" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "inputData": {
      "userId": "user_456",
      "action": "process_data"
    }
  }'
```

#### Example Response

```json
{
  "executionId": "exec_abcdef123456",
  "status": "running",
  "startedAt": "2023-12-06T16:00:00Z",
  "inputData": {
    "userId": "user_456",
    "action": "process_data"
  }
}
```

### Test Workflow

```http
POST /workflows/{id}/test
```

Test a workflow without saving the execution.

#### Example Request

```bash
curl -X POST "https://api.n8n-work.com/v1/workflows/wf_1234567890/test" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "inputData": {"test": true}
  }'
```

#### Example Response

```json
{
  "success": true,
  "executionTime": 2.5,
  "steps": [
    {
      "nodeId": "webhook_1",
      "status": "success",
      "outputData": [{"json": {"test": true}}],
      "executionTime": 0.1
    },
    {
      "nodeId": "slack_1", 
      "status": "success",
      "outputData": [{"json": {"sent": true}}],
      "executionTime": 2.4
    }
  ]
}
```

## Workflow Activation

### Activate Workflow

```http
POST /workflows/{id}/activate
```

Activate a workflow to enable automatic execution via triggers.

#### Example Request

```bash
curl -X POST "https://api.n8n-work.com/v1/workflows/wf_1234567890/activate" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Deactivate Workflow

```http
POST /workflows/{id}/deactivate
```

Deactivate a workflow to disable automatic execution.

#### Example Request

```bash
curl -X POST "https://api.n8n-work.com/v1/workflows/wf_1234567890/deactivate" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Workflow Versions

### List Workflow Versions

```http
GET /workflows/{id}/versions
```

Get version history for a workflow.

#### Example Response

```json
{
  "data": [
    {
      "version": 2,
      "description": "Added error handling",
      "createdBy": "user_123",
      "createdAt": "2023-12-05T14:30:00Z"
    },
    {
      "version": 1,
      "description": "Initial version",
      "createdBy": "user_123", 
      "createdAt": "2023-12-01T10:00:00Z"
    }
  ]
}
```

### Get Workflow Version

```http
GET /workflows/{id}/versions/{version}
```

Retrieve a specific version of a workflow.

### Restore Workflow Version

```http
POST /workflows/{id}/versions/{version}/restore
```

Restore a workflow to a previous version.

## Workflow Statistics

### Get Workflow Statistics

```http
GET /workflows/{id}/statistics
```

Get execution statistics for a workflow.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `period` | string | Time period: `1d`, `7d`, `30d`, `90d` |
| `granularity` | string | Data granularity: `hour`, `day`, `week` |

#### Example Response

```json
{
  "period": "30d",
  "granularity": "day",
  "totalExecutions": 450,
  "successfulExecutions": 442,
  "failedExecutions": 8,
  "averageExecutionTime": 2.8,
  "data": [
    {
      "date": "2023-12-01",
      "executions": 15,
      "successes": 15,
      "failures": 0,
      "avgTime": 2.1
    }
  ]
}
```

## Error Responses

### Validation Errors

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Workflow validation failed",
    "details": [
      {
        "field": "definition.nodes",
        "message": "At least one node is required",
        "code": "REQUIRED"
      }
    ]
  }
}
```

### Workflow Not Found

```json
{
  "error": {
    "code": "WORKFLOW_NOT_FOUND",
    "message": "Workflow with ID 'wf_invalid' not found",
    "timestamp": "2023-12-06T16:00:00Z"
  }
}
```

### Permission Denied

```json
{
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "You don't have permission to access this workflow",
    "requiredPermission": "workflows:read"
  }
}
```

## Workflow Webhooks

Workflows with webhook triggers automatically create webhook endpoints:

### Webhook URL Format

```
https://api.n8n-work.com/v1/webhook/{workflowId}/{webhookPath}
```

### Testing Webhooks

```bash
# Send test data to webhook
curl -X POST "https://api.n8n-work.com/v1/webhook/wf_1234567890/github" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "opened",
    "issue": {
      "title": "Test Issue",
      "number": 123
    }
  }'
```

## Best Practices

### 1. Workflow Design
- Keep workflows focused on a single purpose
- Use descriptive names and descriptions
- Add tags for organization
- Document complex logic with comments

### 2. Error Handling
- Always include error handling nodes
- Set appropriate timeout values
- Use conditional logic for different scenarios
- Monitor execution statistics regularly

### 3. Performance
- Minimize the number of nodes when possible
- Use efficient data transformations
- Set reasonable execution timeouts
- Consider workflow complexity for maintenance

### 4. Security
- Validate webhook inputs
- Use credentials for sensitive data
- Review workflow permissions regularly
- Monitor for unusual execution patterns

## SDK Examples

### JavaScript/TypeScript

```typescript
import { N8NWorkClient } from '@n8n-work/api-client';

const client = new N8NWorkClient({
  accessToken: 'your-token'
});

// Create workflow
const workflow = await client.workflows.create({
  name: 'My Workflow',
  definition: {
    nodes: [...],
    connections: [...]
  }
});

// Execute workflow
const execution = await client.workflows.execute(workflow.id, {
  inputData: { key: 'value' }
});

// Monitor execution
const status = await client.executions.get(execution.executionId);
```

### Python

```python
from n8n_work import Client

client = Client(access_token='your-token')

# Create workflow
workflow = client.workflows.create({
    'name': 'My Workflow',
    'definition': {
        'nodes': [...],
        'connections': [...]
    }
})

# Execute workflow
execution = client.workflows.execute(
    workflow['id'], 
    input_data={'key': 'value'}
)
```

## Next Steps

- **[Executions API](/api/executions)** - Monitor and control workflow executions
- **[Nodes API](/api/nodes)** - Discover and manage available node types
- **[Credentials API](/api/credentials)** - Secure credential management
