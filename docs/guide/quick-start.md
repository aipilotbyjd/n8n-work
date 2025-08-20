# Quick Start

Get N8N-Work up and running on your local machine in just a few minutes. This guide will walk you through installing N8N-Work, creating your first workflow, and exploring the platform's capabilities.

## Prerequisites

Before you begin, make sure you have the following installed:

- **Docker** (version 20.10 or later)
- **Docker Compose** (version 2.0 or later)
- **Git** (for cloning the repository)
- **Node.js** (version 18 or later) - optional, for SDK development

::: tip
If you don't have Docker installed, visit [docker.com](https://www.docker.com/get-started) for installation instructions for your operating system.
:::

## Step 1: Clone and Start N8N-Work

1. **Clone the repository:**
   ```bash
   git clone https://github.com/n8n-work/n8n-work.git
   cd n8n-work
   ```

2. **Start the platform:**
   ```bash
   docker-compose up -d
   ```

3. **Wait for services to initialize:**
   ```bash
   # Check that all services are healthy
   docker-compose ps
   ```

The platform will start several services:
- **Orchestrator API** on port 3000
- **Web UI** on port 8080
- **PostgreSQL** database on port 5432
- **RabbitMQ** on port 5672 (management UI on 15672)
- **Prometheus** on port 9090
- **Jaeger** on port 16686

## Step 2: Access the Web Interface

Open your web browser and navigate to [http://localhost:8080](http://localhost:8080).

You should see the N8N-Work welcome screen. The platform comes with a default admin account:

- **Username**: `admin@n8n-work.com`
- **Password**: `admin123`

::: warning Security Notice
Remember to change the default password in production environments!
:::

## Step 3: Create Your First Workflow

Let's create a simple workflow that demonstrates the platform's capabilities.

### 3.1 Create a New Workflow

1. Click **"Create Workflow"** on the dashboard
2. Enter the following details:
   - **Name**: `My First Workflow`
   - **Description**: `A simple HTTP to Slack notification workflow`
3. Click **"Create"**

### 3.2 Add a Webhook Trigger

1. Click **"Add Trigger"** 
2. Select **"Webhook"** from the trigger types
3. Configure the webhook:
   ```json
   {
     "path": "/my-first-webhook",
     "method": "POST",
     "authentication": "none"
   }
   ```
4. Click **"Save"**

### 3.3 Add Data Processing Node

1. Click **"Add Node"** 
2. Select **"Data Transform"**
3. Configure the transformation:
   ```json
   {
     "operations": [
       {
         "type": "set",
         "field": "message",
         "value": "Hello from {{$json.name}} at {{$now}}"
       },
       {
         "type": "set", 
         "field": "priority",
         "value": "{{$json.urgent ? 'high' : 'normal'}}"
       }
     ]
   }
   ```
4. Click **"Save"**

### 3.4 Add HTTP Request Node

1. Click **"Add Node"**
2. Select **"HTTP Request"**
3. Configure the request:
   ```json
   {
     "method": "POST",
     "url": "https://httpbin.org/post",
     "headers": {
       "Content-Type": "application/json"
     },
     "body": {
       "message": "{{$json.message}}",
       "priority": "{{$json.priority}}",
       "timestamp": "{{$json.timestamp}}"
     }
   }
   ```
4. Click **"Save"**

### 3.5 Save and Activate the Workflow

1. Click **"Save Workflow"**
2. Toggle the **"Active"** switch to enable the workflow

## Step 4: Test Your Workflow

Now let's test the workflow by sending a webhook request:

```bash
curl -X POST http://localhost:3000/webhook/my-first-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "urgent": true
  }'
```

### Expected Response

You should receive a response indicating the workflow executed successfully:

```json
{
  "success": true,
  "executionId": "exec_123456789",
  "message": "Workflow executed successfully"
}
```

## Step 5: Monitor Execution

1. Go to the **"Executions"** tab in the web interface
2. Find your execution in the list
3. Click on it to see detailed execution data:
   - Input data received by the webhook
   - Transformed data from the processing step
   - HTTP response from the external service

## Step 6: Explore Monitoring

N8N-Work comes with comprehensive monitoring capabilities:

### Prometheus Metrics
Visit [http://localhost:9090](http://localhost:9090) to explore metrics:
- Workflow execution rates
- Node performance statistics
- System resource usage

### Jaeger Tracing
Visit [http://localhost:16686](http://localhost:16686) to see distributed traces:
- End-to-end request tracing
- Performance bottleneck identification
- Service dependency mapping

### RabbitMQ Management
Visit [http://localhost:15672](http://localhost:15672) (guest/guest) to monitor:
- Message queue depth
- Processing rates
- Consumer health

## Next Steps

Congratulations! You've successfully:
- ✅ Installed N8N-Work locally
- ✅ Created your first workflow
- ✅ Tested webhook execution  
- ✅ Explored monitoring capabilities

### Continue Learning

Now that you have the basics working, explore these topics:

1. **[Core Concepts](/guide/concepts/workflows)** - Deep dive into workflows, nodes, and executions
2. **[Building Complex Workflows](/guide/workflows/creating)** - Learn advanced workflow patterns
3. **[Creating Custom Nodes](/sdk/quick-start)** - Build your own integrations
4. **[Production Deployment](/deployment/)** - Deploy to production environments

### Common Next Actions

<div class="action-grid">

#### 🔧 **Build Custom Nodes**
Create integrations for your specific services and APIs.

```bash
npm install -g @n8n-work/node-sdk
n8n-work create my-api-node --type=http
```

[Node SDK Guide →](/sdk/)

#### 🚀 **Deploy to Production** 
Scale your workflows with Kubernetes or cloud deployment.

[Deployment Guide →](/deployment/)

#### 📊 **Advanced Workflows**
Learn about error handling, loops, and conditional logic.

[Advanced Workflows →](/guide/workflows/advanced)

#### 🔐 **Security & Authentication**
Configure authentication, credentials, and access control.

[Security Guide →](/guide/security)

</div>

## Troubleshooting

### Services Won't Start

If services fail to start, check the logs:
```bash
docker-compose logs -f [service-name]
```

Common issues:
- **Port conflicts**: Make sure ports 3000, 8080, 5432 are available
- **Insufficient memory**: Docker needs at least 4GB RAM allocated
- **Permission issues**: Ensure Docker has proper permissions

### Webhook Not Responding

- Verify the workflow is **Active**
- Check the webhook URL matches your configuration
- Review execution logs in the web interface

### Performance Issues

- Check system resources with `docker stats`
- Review Prometheus metrics for bottlenecks
- Ensure adequate disk space for PostgreSQL

## Getting Help

- 💬 **Discord**: [Join our community](https://discord.gg/n8n-work)
- 📖 **Documentation**: Browse the full documentation
- 🐛 **Issues**: [Report bugs on GitHub](https://github.com/n8n-work/n8n-work/issues)
- 📧 **Support**: [support@n8n-work.com](mailto:support@n8n-work.com)

<style>
.action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin: 2rem 0;
}

.action-grid > div {
  padding: 1.5rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}

.action-grid h4 {
  margin-top: 0;
  color: var(--vp-c-brand-1);
}
</style>
