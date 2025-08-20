---
layout: home

hero:
  name: "N8N-Work"
  text: "Open-source workflow automation platform"
  tagline: "Build powerful automation workflows with a developer-first approach"
  image:
    src: /logo-large.svg
    alt: N8N-Work Logo
  actions:
    - theme: brand
      text: Get Started
      link: /guide/quick-start
    - theme: alt
      text: View on GitHub
      link: https://github.com/n8n-work/n8n-work

features:
  - icon: 🔧
    title: Developer-First
    details: Built with developers in mind. Full TypeScript support, comprehensive APIs, and extensible architecture.
  - icon: 🚀
    title: High Performance
    details: Scalable microservices architecture with Go execution engine and Node.js runtime for optimal performance.
  - icon: 🔌
    title: Extensible
    details: Create custom nodes with our powerful SDK. Build integrations for any service or API.
  - icon: 🛡️
    title: Enterprise Ready
    details: Production-grade security, monitoring, and deployment options. Scale from development to enterprise.
  - icon: 📊
    title: Observability
    details: Built-in metrics, tracing, and logging with OpenTelemetry. Monitor everything out of the box.
  - icon: 🌐
    title: Cloud Native
    details: Kubernetes-ready with Docker support. Deploy anywhere from local development to global scale.
---

## Why N8N-Work?

N8N-Work is a modern workflow automation platform designed for developers who need powerful, flexible, and scalable automation solutions. Unlike traditional workflow tools, N8N-Work provides:

### 🎯 **Developer Experience**
- **TypeScript-first**: Full type safety across the entire platform
- **Modern APIs**: RESTful and gRPC APIs with comprehensive documentation
- **Rich SDK**: Build custom nodes with ease using our TypeScript SDK
- **CLI Tools**: Complete development toolkit for creating, testing, and deploying workflows

### 🏗️ **Architecture**
- **Microservices**: Scalable, maintainable architecture with clear separation of concerns
- **Message Queue**: Reliable, asynchronous execution with RabbitMQ
- **Multiple Runtimes**: Go for performance-critical operations, Node.js for flexibility
- **Cloud Native**: Kubernetes-ready with comprehensive observability

### 🔄 **Workflow Capabilities**
- **Visual Editor**: Intuitive drag-and-drop workflow builder
- **Code Integration**: Mix visual workflows with custom code
- **Error Handling**: Robust error handling and retry mechanisms
- **Scheduling**: Flexible trigger system with cron-like scheduling

## Quick Example

Here's how easy it is to create a workflow that monitors GitHub issues and sends Slack notifications:

```typescript
import { Workflow } from '@n8n-work/sdk';

const workflow = new Workflow('github-to-slack', {
  trigger: {
    type: 'webhook',
    path: '/github-webhook',
    authentication: 'github-webhook-secret'
  },
  nodes: [
    {
      type: 'github.issue-filter',
      parameters: {
        action: 'opened',
        labels: ['bug', 'critical']
      }
    },
    {
      type: 'slack.send-message',
      parameters: {
        channel: '#alerts',
        message: '🚨 Critical bug reported: {{issue.title}}'
      },
      credentials: 'slack-bot-token'
    }
  ]
});
```

## Platform Components

<div class="grid-container">
<div class="grid-item">

### 🎛️ **Orchestrator API**
RESTful API built with NestJS for managing workflows, executions, and system configuration.

[Learn more →](/architecture/orchestrator)

</div>
<div class="grid-item">

### ⚡ **Execution Engine**
High-performance Go service that handles workflow execution logic and step coordination.

[Learn more →](/architecture/engine)

</div>
<div class="grid-item">

### 🏃 **Node Runner**
Sandboxed Node.js runtime for executing custom nodes with built-in security and monitoring.

[Learn more →](/architecture/node-runner)

</div>
<div class="grid-item">

### 🛠️ **Node SDK**
Comprehensive TypeScript SDK for building custom nodes with CLI tools and templates.

[Learn more →](/sdk/)

</div>
</div>

## Getting Started

<div class="next-steps">

### 1. **Install N8N-Work**
Get up and running in minutes with Docker Compose or Kubernetes.

```bash
# Quick start with Docker Compose
git clone https://github.com/n8n-work/n8n-work
cd n8n-work
docker-compose up -d
```

[Installation Guide →](/guide/installation)

### 2. **Create Your First Workflow**
Learn the basics of building workflows with our interactive tutorial.

[Quick Start Tutorial →](/guide/quick-start)

### 3. **Build Custom Nodes**
Extend the platform with custom integrations using our powerful SDK.

```bash
# Install the SDK
npm install -g @n8n-work/node-sdk

# Create a new node
n8n-work create my-api-node --type=http
```

[Node SDK Guide →](/sdk/quick-start)

### 4. **Deploy to Production**
Scale your workflows with our production deployment guides.

[Deployment Guide →](/deployment/)

</div>

## Community & Support

<div class="community-links">

- 💬 **Discord**: Join our [Discord server](https://discord.gg/n8n-work) for real-time support
- 📚 **Documentation**: Comprehensive guides and API references
- 🐛 **Issues**: Report bugs on [GitHub Issues](https://github.com/n8n-work/n8n-work/issues)
- 🤝 **Contributing**: [Contribution guidelines](/contributing/) for getting involved

</div>

<style>
.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin: 2rem 0;
}

.grid-item {
  padding: 1.5rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}

.grid-item h3 {
  margin-top: 0;
  margin-bottom: 1rem;
}

.next-steps {
  margin: 2rem 0;
}

.next-steps h3 {
  color: var(--vp-c-brand-1);
  margin-bottom: 1rem;
}

.community-links {
  margin: 2rem 0;
  padding: 1.5rem;
  background: var(--vp-c-bg-soft);
  border-radius: 8px;
  border-left: 4px solid var(--vp-c-brand-1);
}

.community-links ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.community-links li {
  margin: 0.5rem 0;
}
</style>
