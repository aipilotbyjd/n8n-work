# Executions API

The Executions API provides comprehensive monitoring and control over workflow executions. Track execution status, retrieve results, manage running workflows, and analyze execution data.

## Overview

Every time a workflow runs, it creates an execution record that contains detailed information about the run, including status, timing, data flow, and any errors that occurred. The Executions API allows you to programmatically access and manage these execution records.

## Execution Object

```typescript
interface Execution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: ExecutionStatus;
  mode: ExecutionMode;
  trigger: ExecutionTrigger;
  startedAt: string;
  stoppedAt?: string;
  duration?: number;
  inputData?: any;
  outputData?: any;
  executionData: ExecutionNodeData[];
  error?: ExecutionError;
  metadata: ExecutionMetadata;
  createdAt: string;
  updatedAt: string;
}

type ExecutionStatus = 
  | 'queued'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'timeout';

type ExecutionMode = 
  | 'manual'
  | 'trigger'
  | 'webhook'
  | 'scheduled'
  | 'retry';

interface ExecutionNodeData {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: ExecutionStatus;
  startedAt: string;
  stoppedAt?: string;
  duration?: number;
  inputData?: any[];
  outputData?: any[];
  error?: ExecutionError;
}

interface ExecutionError {
  type: string;
  message: string;
  stack?: string;
  nodeId?: string;
  timestamp: string;
}
```

## Endpoints

### List Executions

```http
GET /executions
```

Retrieve a paginated list of executions.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Number of executions to return (max 100, default 20) |
| `cursor` | string | Pagination cursor for next page |
| `filter[workflowId]` | string | Filter by workflow ID |
| `filter[status]` | string | Filter by execution status |
| `filter[mode]` | string | Filter by execution mode |
| `filter[dateRange]` | string | Date range: `1d`, `7d`, `30d`, `custom` |
| `filter[startDate]` | string | Start date for custom range (ISO 8601) |
| `filter[endDate]` | string | End date for custom range (ISO 8601) |
| `sort` | string | Sort order: `startedAt`, `-startedAt`, `duration` |
| `include` | string | Additional data: `data`, `error`, `metadata` |

#### Example Request

```bash
curl -X GET "https://api.n8n-work.com/v1/executions?filter[status]=failed&limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Example Response

```json
{
  "data": [
    {
      "id": "exec_1234567890",
      "workflowId": "wf_abcdef123456",
      "workflowName": "GitHub to Slack Notification",
      "status": "failed",
      "mode": "webhook",
      "trigger": {
        "type": "webhook",
        "source": "github",
        "timestamp": "2023-12-06T10:30:00Z"
      },
      "startedAt": "2023-12-06T10:30:00Z",
      "stoppedAt": "2023-12-06T10:30:15Z",
      "duration": 15.2,
      "error": {
        "type": "ConnectionError",
        "message": "Failed to connect to Slack API",
        "nodeId": "slack_1",
        "timestamp": "2023-12-06T10:30:15Z"
      },
      "metadata": {
        "retryCount": 0,
        "queueTime": 0.1,
        "memoryUsage": 45.2
      },
      "createdAt": "2023-12-06T10:30:00Z",
      "updatedAt": "2023-12-06T10:30:15Z"
    }
  ],
  "pagination": {
    "limit": 5,
    "hasMore": true,
    "nextCursor": "eyJpZCI6ImV4ZWNfMTIzNDU2Nzg5MSJ9",
    "total": 127
  }
}
```

### Get Execution

```http
GET /executions/{id}
```

Retrieve a specific execution by ID with detailed information.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Execution ID |
| `include` | string | Additional data: `data`, `error`, `logs`, `metadata` |

#### Example Request

```bash
curl -X GET "https://api.n8n-work.com/v1/executions/exec_1234567890?include=data,error" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Example Response

```json
{
  "id": "exec_1234567890",
  "workflowId": "wf_abcdef123456",
  "workflowName": "GitHub to Slack Notification",
  "status": "success",
  "mode": "webhook",
  "trigger": {
    "type": "webhook",
    "source": "github",
    "payload": {
      "action": "opened",
      "issue": {
        "number": 123,
        "title": "Bug report"
      }
    },
    "timestamp": "2023-12-06T10:30:00Z"
  },
  "startedAt": "2023-12-06T10:30:00Z",
  "stoppedAt": "2023-12-06T10:30:05Z",
  "duration": 5.3,
  "executionData": [
    {
      "nodeId": "webhook_1",
      "nodeName": "GitHub Webhook",
      "nodeType": "webhook",
      "status": "success",
      "startedAt": "2023-12-06T10:30:00Z",
      "stoppedAt": "2023-12-06T10:30:01Z",
      "duration": 1.0,
      "outputData": [
        {
          "json": {
            "action": "opened",
            "issue": {
              "number": 123,
              "title": "Bug report"
            }
          }
        }
      ]
    },
    {
      "nodeId": "slack_1",
      "nodeName": "Send to Slack",
      "nodeType": "slack",
      "status": "success",
      "startedAt": "2023-12-06T10:30:01Z",
      "stoppedAt": "2023-12-06T10:30:05Z",
      "duration": 4.3,
      "inputData": [
        {
          "json": {
            "action": "opened",
            "issue": {
              "number": 123,
              "title": "Bug report"
            }
          }
        }
      ],
      "outputData": [
        {
          "json": {
            "ok": true,
            "ts": "1701860205.123456"
          }
        }
      ]
    }
  ],
  "metadata": {
    "retryCount": 0,
    "queueTime": 0.1,
    "memoryUsage": 32.1,
    "nodeCount": 2,
    "dataTransferred": 1024
  }
}
```

### Cancel Execution

```http
POST /executions/{id}/cancel
```

Cancel a running execution.

#### Example Request

```bash
curl -X POST "https://api.n8n-work.com/v1/executions/exec_1234567890/cancel" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Example Response

```json
{
  "message": "Execution cancelled successfully",
  "executionId": "exec_1234567890",
  "status": "cancelled",
  "cancelledAt": "2023-12-06T10:35:00Z"
}
```

### Retry Execution

```http
POST /executions/{id}/retry
```

Retry a failed execution.

#### Request Body

```json
{
  "fromNode": "slack_1",
  "loadWorkflow": true,
  "startNodes": ["slack_1"]
}
```

#### Example Request

```bash
curl -X POST "https://api.n8n-work.com/v1/executions/exec_1234567890/retry" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fromNode": "slack_1",
    "loadWorkflow": true
  }'
```

#### Example Response

```json
{
  "executionId": "exec_0987654321",
  "status": "running",
  "retryOf": "exec_1234567890",
  "startedAt": "2023-12-06T10:40:00Z"
}
```

### Delete Execution

```http
DELETE /executions/{id}
```

Delete an execution record. This cannot be undone.

#### Example Request

```bash
curl -X DELETE "https://api.n8n-work.com/v1/executions/exec_1234567890" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Execution Data

### Get Execution Data

```http
GET /executions/{id}/data
```

Retrieve detailed input/output data for all nodes in an execution.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `nodeId` | string | Filter data for specific node |
| `format` | string | Data format: `json`, `csv`, `raw` |

#### Example Response

```json
{
  "executionId": "exec_1234567890",
  "nodes": {
    "webhook_1": {
      "input": [],
      "output": [
        {
          "json": {
            "action": "opened",
            "issue": {
              "number": 123,
              "title": "Bug report"
            }
          }
        }
      ]
    },
    "slack_1": {
      "input": [
        {
          "json": {
            "action": "opened",
            "issue": {
              "number": 123,
              "title": "Bug report"
            }
          }
        }
      ],
      "output": [
        {
          "json": {
            "ok": true,
            "ts": "1701860205.123456"
          }
        }
      ]
    }
  }
}
```

### Get Node Execution Data

```http
GET /executions/{id}/nodes/{nodeId}/data
```

Retrieve input/output data for a specific node in an execution.

#### Example Response

```json
{
  "nodeId": "slack_1",
  "nodeName": "Send to Slack",
  "input": [
    {
      "json": {
        "message": "New issue: Bug report",
        "channel": "#dev-alerts"
      }
    }
  ],
  "output": [
    {
      "json": {
        "ok": true,
        "ts": "1701860205.123456",
        "channel": "C1234567890",
        "message": {
          "text": "New issue: Bug report"
        }
      }
    }
  ]
}
```

## Execution Logs

### Get Execution Logs

```http
GET /executions/{id}/logs
```

Retrieve logs for an execution.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `level` | string | Log level: `debug`, `info`, `warn`, `error` |
| `nodeId` | string | Filter logs for specific node |
| `limit` | number | Number of log entries (max 1000, default 100) |

#### Example Response

```json
{
  "executionId": "exec_1234567890",
  "logs": [
    {
      "timestamp": "2023-12-06T10:30:00Z",
      "level": "info",
      "nodeId": "webhook_1",
      "message": "Webhook received payload",
      "data": {
        "contentType": "application/json",
        "size": 512
      }
    },
    {
      "timestamp": "2023-12-06T10:30:01Z",
      "level": "debug",
      "nodeId": "slack_1",
      "message": "Sending message to Slack",
      "data": {
        "channel": "#dev-alerts",
        "messageLength": 25
      }
    },
    {
      "timestamp": "2023-12-06T10:30:05Z",
      "level": "info",
      "nodeId": "slack_1",
      "message": "Message sent successfully",
      "data": {
        "messageId": "1701860205.123456"
      }
    }
  ]
}
```

## Execution Statistics

### Get Execution Statistics

```http
GET /executions/statistics
```

Get aggregated execution statistics.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `period` | string | Time period: `1h`, `24h`, `7d`, `30d` |
| `workflowId` | string | Filter by specific workflow |
| `granularity` | string | Data granularity: `hour`, `day`, `week` |

#### Example Response

```json
{
  "period": "24h",
  "granularity": "hour",
  "totalExecutions": 1247,
  "successfulExecutions": 1189,
  "failedExecutions": 58,
  "averageExecutionTime": 3.2,
  "data": [
    {
      "timestamp": "2023-12-06T10:00:00Z",
      "executions": 52,
      "successes": 48,
      "failures": 4,
      "avgTime": 2.8,
      "minTime": 0.5,
      "maxTime": 15.2
    }
  ],
  "byWorkflow": [
    {
      "workflowId": "wf_abcdef123456",
      "workflowName": "GitHub to Slack",
      "executions": 342,
      "successRate": 0.94,
      "avgTime": 2.1
    }
  ],
  "byStatus": {
    "success": 1189,
    "failed": 45,
    "timeout": 8,
    "cancelled": 5
  }
}
```

## Real-time Execution Monitoring

### WebSocket Connection

Connect to execution events via WebSocket:

```javascript
const ws = new WebSocket('wss://api.n8n-work.com/v1/executions/stream');

ws.onopen = () => {
  // Subscribe to execution events
  ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['executions', 'workflow:wf_123']
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Execution event:', data);
};
```

### Execution Events

```typescript
interface ExecutionEvent {
  type: 'execution.started' | 'execution.completed' | 'execution.failed' | 'node.completed';
  executionId: string;
  workflowId: string;
  timestamp: string;
  data: any;
}
```

Example events:

```json
{
  "type": "execution.started",
  "executionId": "exec_1234567890",
  "workflowId": "wf_abcdef123456",
  "timestamp": "2023-12-06T10:30:00Z",
  "data": {
    "mode": "webhook",
    "trigger": "github"
  }
}

{
  "type": "node.completed",
  "executionId": "exec_1234567890",
  "workflowId": "wf_abcdef123456",
  "timestamp": "2023-12-06T10:30:01Z",
  "data": {
    "nodeId": "webhook_1",
    "status": "success",
    "duration": 1.0
  }
}

{
  "type": "execution.completed",
  "executionId": "exec_1234567890",
  "workflowId": "wf_abcdef123456",
  "timestamp": "2023-12-06T10:30:05Z",
  "data": {
    "status": "success",
    "duration": 5.3,
    "nodeCount": 2
  }
}
```

## Error Handling

### Common Error Responses

#### Execution Not Found

```json
{
  "error": {
    "code": "EXECUTION_NOT_FOUND",
    "message": "Execution with ID 'exec_invalid' not found",
    "timestamp": "2023-12-06T16:00:00Z"
  }
}
```

#### Cannot Cancel Execution

```json
{
  "error": {
    "code": "CANNOT_CANCEL_EXECUTION",
    "message": "Cannot cancel execution that is already completed",
    "executionId": "exec_1234567890",
    "status": "success"
  }
}
```

#### Permission Denied

```json
{
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "You don't have permission to access this execution",
    "requiredPermission": "executions:read"
  }
}
```

## SDK Examples

### JavaScript/TypeScript

```typescript
import { N8NWorkClient } from '@n8n-work/api-client';

const client = new N8NWorkClient({
  accessToken: 'your-token'
});

// Get execution details
const execution = await client.executions.get('exec_1234567890', {
  include: ['data', 'logs']
});

// Cancel running execution
await client.executions.cancel('exec_1234567890');

// Retry failed execution
const retryExecution = await client.executions.retry('exec_1234567890', {
  fromNode: 'slack_1'
});

// Monitor executions with WebSocket
client.executions.stream((event) => {
  if (event.type === 'execution.failed') {
    console.log(`Execution ${event.executionId} failed:`, event.data);
  }
});

// Get execution statistics
const stats = await client.executions.getStatistics({
  period: '7d',
  workflowId: 'wf_abcdef123456'
});
```

### Python

```python
from n8n_work import Client

client = Client(access_token='your-token')

# List recent failed executions
executions = client.executions.list(
    filter={'status': 'failed'},
    limit=10,
    include=['error']
)

# Get execution details
execution = client.executions.get(
    'exec_1234567890',
    include=['data', 'logs']
)

# Retry execution
retry = client.executions.retry(
    'exec_1234567890',
    from_node='slack_1'
)

# Get statistics
stats = client.executions.get_statistics(
    period='24h',
    workflow_id='wf_abcdef123456'
)
```

### Go

```go
package main

import (
    "context"
    "fmt"
    "github.com/n8n-work/go-client"
)

func main() {
    client := n8nwork.NewClient("your-token")
    
    // Get execution
    execution, err := client.Executions.Get(context.Background(), "exec_1234567890")
    if err != nil {
        panic(err)
    }
    
    fmt.Printf("Execution status: %s\n", execution.Status)
    
    // List executions
    executions, err := client.Executions.List(context.Background(), &n8nwork.ExecutionListOptions{
        Limit: 50,
        Filter: map[string]interface{}{
            "status": "failed",
        },
    })
    if err != nil {
        panic(err)
    }
    
    fmt.Printf("Found %d failed executions\n", len(executions.Data))
}
```

## Best Practices

### 1. Execution Monitoring
- Set up alerts for execution failures
- Monitor execution duration trends
- Track memory usage and performance
- Use real-time events for critical workflows

### 2. Error Handling
- Implement retry logic for transient failures
- Log execution errors for debugging
- Set up proper timeout values
- Monitor execution queue length

### 3. Data Management
- Regularly clean up old execution data
- Export execution logs for analysis
- Use execution statistics for optimization
- Archive long-term execution history

### 4. Performance Optimization
- Monitor execution duration patterns
- Identify bottleneck nodes
- Optimize data flow between nodes
- Use pagination for large execution lists

## Webhooks and Triggers

### Execution Webhooks

Set up webhooks to receive execution events:

```bash
curl -X POST "https://api.n8n-work.com/v1/webhooks" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/n8n-webhooks",
    "events": ["execution.failed", "execution.completed"],
    "filters": {
      "workflowId": "wf_abcdef123456"
    }
  }'
```

### Webhook Payload

```json
{
  "event": "execution.failed",
  "executionId": "exec_1234567890",
  "workflowId": "wf_abcdef123456",
  "workflowName": "GitHub to Slack",
  "timestamp": "2023-12-06T10:30:15Z",
  "data": {
    "error": {
      "type": "ConnectionError",
      "message": "Failed to connect to Slack API",
      "nodeId": "slack_1"
    },
    "duration": 15.2,
    "retryCount": 0
  }
}
```

## Next Steps

- **[Workflows API](/api/workflows)** - Create and manage workflows
- **[Nodes API](/api/nodes)** - Work with individual workflow nodes
- **[Credentials API](/api/credentials)** - Manage authentication credentials
