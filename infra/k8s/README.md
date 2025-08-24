# N8N Work - Helm Charts Deployment Guide

This directory contains Helm charts for deploying the N8N Work platform across multiple environments.

## Overview

The N8N Work platform consists of several microservices:
- **Orchestrator** (NestJS) - API Gateway and workflow management
- **Engine-Go** - Workflow execution engine
- **Node-Runner-JS** - Secure sandbox runtime for node execution
- **Supporting Infrastructure** - PostgreSQL, RabbitMQ, Redis, Observability stack

## Chart Structure

```
charts/
├── n8n-work/                 # Umbrella chart
│   ├── Chart.yaml
│   ├── values.yaml           # Default values
│   ├── values-dev.yaml       # Development environment
│   ├── values-staging.yaml   # Staging environment
│   ├── values-prod.yaml      # Production environment
│   └── templates/
├── orchestrator/             # Orchestrator service chart
├── engine-go/               # Engine service chart
├── node-runner-js/          # Node runner service chart
└── observability/           # Monitoring stack chart
```

## Quick Start

### Prerequisites

1. **Kubernetes Cluster** - v1.21+
2. **Helm** - v3.8+
3. **kubectl** - Configured for your cluster
4. **Storage Classes** - For persistent volumes

### Basic Deployment

```bash
# Development environment
./deploy.sh install dev --create-ns

# Staging environment
./deploy.sh install staging --create-ns

# Production environment
./deploy.sh install prod --create-ns --wait --timeout=600s
```

## Environment Configurations

### Development Environment

- **Resource Requirements**: Minimal (suitable for local development)
- **High Availability**: Disabled
- **Persistence**: Reduced storage sizes
- **Security**: Relaxed network policies
- **Observability**: Basic monitoring

```bash
# Deploy to development
./deploy.sh install dev --create-ns

# Access services
kubectl port-forward svc/orchestrator 3000:3000 -n n8n-work-dev
```

### Staging Environment

- **Resource Requirements**: Moderate (production-like but smaller)
- **High Availability**: Limited replicas
- **Persistence**: Medium storage sizes
- **Security**: Production-like policies
- **Observability**: Full monitoring stack

```bash
# Deploy to staging
./deploy.sh install staging --create-ns --wait

# Access Grafana dashboard
kubectl port-forward svc/grafana 3001:80 -n n8n-work-staging
```

### Production Environment

- **Resource Requirements**: Full production resources
- **High Availability**: Multiple replicas with anti-affinity
- **Persistence**: Large storage with fast SSDs
- **Security**: Strict network policies and security contexts
- **Observability**: Complete monitoring, alerting, and logging

```bash
# Deploy to production
./deploy.sh install prod --create-ns --wait --timeout=600s

# Check deployment status
./deploy.sh status prod
```

## Deployment Commands

### Installation

```bash
# Install with default values
helm install n8n-work ./charts/n8n-work -n n8n-work-prod --create-namespace

# Install with environment-specific values
helm install n8n-work ./charts/n8n-work \
  -f ./charts/n8n-work/values-prod.yaml \
  -n n8n-work-prod \
  --create-namespace \
  --wait \
  --timeout=600s
```

### Upgrade

```bash
# Upgrade deployment
helm upgrade n8n-work ./charts/n8n-work \
  -f ./charts/n8n-work/values-prod.yaml \
  -n n8n-work-prod \
  --wait
```

### Uninstallation

```bash
# Uninstall release
helm uninstall n8n-work -n n8n-work-prod

# Delete namespace (optional)
kubectl delete namespace n8n-work-prod
```

## Configuration

### Environment Variables

Key environment variables can be configured through values files:

```yaml
orchestrator:
  env:
    - name: NODE_ENV
      value: "production"
    - name: DATABASE_URL
      valueFrom:
        secretKeyRef:
          name: postgresql-secret
          key: database-url
```

### Secrets Management

Create secrets before deployment:

```bash
# PostgreSQL secret
kubectl create secret generic postgresql-secret \
  --from-literal=postgres-password="secure-password" \
  --from-literal=password="user-password" \
  --from-literal=database-url="postgresql://user:pass@host:5432/db" \
  -n n8n-work-prod

# RabbitMQ secret
kubectl create secret generic rabbitmq-secret \
  --from-literal=rabbitmq-password="secure-password" \
  --from-literal=amqp-url="amqp://user:pass@host:5672/" \
  -n n8n-work-prod

# Redis secret
kubectl create secret generic redis-secret \
  --from-literal=redis-password="secure-password" \
  --from-literal=redis-url="redis://:pass@host:6379" \
  -n n8n-work-prod
```

### Resource Requirements

#### Minimum Requirements (Development)
- **CPU**: 2 cores
- **Memory**: 4 GB
- **Storage**: 20 GB

#### Recommended Requirements (Staging)
- **CPU**: 8 cores
- **Memory**: 16 GB
- **Storage**: 100 GB

#### Production Requirements
- **CPU**: 20+ cores
- **Memory**: 32+ GB
- **Storage**: 500+ GB (fast SSD)

### Node Types and Taints

For optimal performance, use dedicated node pools:

```yaml
# Production node configuration
nodeSelector:
  node-type: compute-optimized    # For engine-go
  node-type: sandbox-workload     # For node-runner-js
  node-type: database            # For databases

tolerations:
  - key: "compute-optimized"
    operator: "Equal"
    value: "true"
    effect: "NoSchedule"
```

## Monitoring and Observability

### Prometheus Metrics

Access Prometheus at `http://prometheus.your-domain.com`:

Key metrics to monitor:
- `n8n_workflow_executions_total`
- `n8n_execution_duration_seconds`
- `n8n_node_executions_total`
- `n8n_sandbox_resource_usage`

### Grafana Dashboards

Pre-configured dashboards for:
- Workflow execution metrics
- System resource usage
- Security and sandbox metrics
- Database performance

### Logging with Loki

Structured logging with correlation IDs:
- Application logs
- Audit logs
- Security events
- Performance traces

## Security Considerations

### Network Policies

```yaml
networkPolicy:
  enabled: true
  policyTypes:
    - Ingress
    - Egress
  # Restrict traffic between components
```

### Pod Security Standards

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1001
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
```

### RBAC

Minimal RBAC permissions for each component:

```yaml
serviceAccount:
  create: true
  annotations: {}
  name: ""
```

## Backup and Disaster Recovery

### Database Backups

```bash
# PostgreSQL backup
kubectl exec -it postgresql-primary-0 -n n8n-work-prod -- \
  pg_dump -U n8n_work n8n_work | gzip > backup-$(date +%Y%m%d).sql.gz
```

### Volume Snapshots

```yaml
# Enable volume snapshots
persistence:
  enabled: true
  annotations:
    snapshot.storage.kubernetes.io/is-default-class: "true"
```

## Troubleshooting

### Common Issues

1. **Pod Stuck in Pending**
   ```bash
   kubectl describe pod <pod-name> -n <namespace>
   # Check resource constraints and node availability
   ```

2. **Failed Database Connection**
   ```bash
   kubectl logs deployment/orchestrator -n <namespace>
   # Verify database secrets and connectivity
   ```

3. **High Memory Usage**
   ```bash
   kubectl top pods -n <namespace>
   # Monitor resource usage and adjust limits
   ```

### Validation

```bash
# Validate chart before deployment
helm lint ./charts/n8n-work

# Dry-run deployment
helm install n8n-work ./charts/n8n-work --dry-run

# Template generation
helm template n8n-work ./charts/n8n-work > manifests.yaml
```

## Advanced Configuration

### Multi-Region Deployment

```yaml
# Configure region-specific values
global:
  region: us-east-1
  
affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
        - matchExpressions:
            - key: topology.kubernetes.io/region
              operator: In
              values:
                - us-east-1
```

### Auto-scaling Configuration

```yaml
autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### Custom Ingress Configuration

```yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rate-limit: "1000"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
  hosts:
    - host: api.n8n-work.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: n8n-work-tls
      hosts:
        - api.n8n-work.com
```

## Support

For issues and questions:
- Check the troubleshooting section above
- Review Kubernetes and Helm documentation
- Contact the N8N Work development team

## Contributing

To contribute to the Helm charts:
1. Fork the repository
2. Create a feature branch
3. Test your changes thoroughly
4. Submit a pull request

## License

This project is licensed under the Apache 2.0 License.