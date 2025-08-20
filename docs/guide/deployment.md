# Deployment Guide

Learn how to deploy N8N-Work to production environments. This guide covers Docker, Kubernetes, cloud platforms, and best practices for scalable, secure deployments.

## Overview

N8N-Work can be deployed in various environments:

- **Docker**: Single container or multi-container setups
- **Kubernetes**: Scalable container orchestration
- **Cloud Platforms**: AWS, GCP, Azure managed services
- **Traditional Servers**: VM-based deployments

## Quick Start with Docker

### Single Container Deployment

```bash
# Basic deployment
docker run -d \
  --name n8n-work \
  -p 5678:5678 \
  -e DB_TYPE=sqlite \
  -e DB_SQLITE_DATABASE=/data/database.sqlite \
  -v ~/.n8n-work:/data \
  n8nwork/n8n-work:latest

# With custom environment
docker run -d \
  --name n8n-work \
  -p 5678:5678 \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=your-password \
  -e DB_TYPE=postgres \
  -e DB_POSTGRESDB_HOST=postgres \
  -e DB_POSTGRESDB_PORT=5432 \
  -e DB_POSTGRESDB_DATABASE=n8n \
  -e DB_POSTGRESDB_USER=n8n \
  -e DB_POSTGRESDB_PASSWORD=password \
  -v ~/.n8n-work:/data \
  n8nwork/n8n-work:latest
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  n8n:
    image: n8nwork/n8n-work:latest
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
      - N8N_HOST=${N8N_HOST}
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://${N8N_HOST}/
      - GENERIC_TIMEZONE=${TIMEZONE}
      - DB_TYPE=postgres
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=n8n
      - DB_POSTGRESDB_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - n8n_data:/home/node/.n8n
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - n8n_network

  postgres:
    image: postgres:15
    restart: unless-stopped
    environment:
      - POSTGRES_USER=n8n
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=n8n
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U n8n"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - n8n_network

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
    networks:
      - n8n_network

  traefik:
    image: traefik:v3.0
    restart: unless-stopped
    command:
      - --api.dashboard=true
      - --providers.docker=true
      - --providers.docker.exposedbydefault=false
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
      - --certificatesresolvers.myresolver.acme.email=${EMAIL}
      - --certificatesresolvers.myresolver.acme.storage=/acme.json
      - --certificatesresolvers.myresolver.acme.httpchallenge.entrypoint=web
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik_data:/acme.json
    labels:
      - traefik.enable=true
      - traefik.http.routers.n8n.rule=Host(`${N8N_HOST}`)
      - traefik.http.routers.n8n.entrypoints=websecure
      - traefik.http.routers.n8n.tls.certresolver=myresolver
      - traefik.http.services.n8n.loadbalancer.server.port=5678
    networks:
      - n8n_network

volumes:
  n8n_data:
  postgres_data:
  redis_data:
  traefik_data:

networks:
  n8n_network:
    driver: bridge
```

```bash
# Environment file (.env)
N8N_HOST=your-domain.com
N8N_PASSWORD=your-secure-password
POSTGRES_PASSWORD=your-postgres-password
TIMEZONE=America/New_York
EMAIL=your-email@example.com

# Deploy with Docker Compose
docker-compose up -d
```

## Kubernetes Deployment

### Namespace and ConfigMap

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: n8n-work
---
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: n8n-config
  namespace: n8n-work
data:
  N8N_HOST: "n8n.example.com"
  N8N_PORT: "5678"
  N8N_PROTOCOL: "https"
  WEBHOOK_URL: "https://n8n.example.com/"
  GENERIC_TIMEZONE: "UTC"
  DB_TYPE: "postgres"
  DB_POSTGRESDB_HOST: "postgres-service"
  DB_POSTGRESDB_PORT: "5432"
  DB_POSTGRESDB_DATABASE: "n8n"
  DB_POSTGRESDB_USER: "n8n"
  EXECUTIONS_PROCESS: "main"
  EXECUTIONS_MODE: "regular"
  QUEUE_BULL_REDIS_HOST: "redis-service"
  QUEUE_BULL_REDIS_PORT: "6379"
```

### Secrets

```yaml
# secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: n8n-secrets
  namespace: n8n-work
type: Opaque
stringData:
  N8N_BASIC_AUTH_USER: "admin"
  N8N_BASIC_AUTH_PASSWORD: "your-secure-password"
  DB_POSTGRESDB_PASSWORD: "your-postgres-password"
  N8N_ENCRYPTION_KEY: "your-encryption-key"
```

### PostgreSQL Deployment

```yaml
# postgres.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: n8n-work
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_USER
          value: "n8n"
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: n8n-secrets
              key: DB_POSTGRESDB_PASSWORD
        - name: POSTGRES_DB
          value: "n8n"
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  namespace: n8n-work
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: n8n-work
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

### Redis Deployment

```yaml
# redis.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: n8n-work
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
---
apiVersion: v1
kind: Service
metadata:
  name: redis-service
  namespace: n8n-work
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
```

### N8N Deployment

```yaml
# n8n.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: n8n
  namespace: n8n-work
  labels:
    app: n8n
spec:
  replicas: 2
  selector:
    matchLabels:
      app: n8n
  template:
    metadata:
      labels:
        app: n8n
    spec:
      containers:
      - name: n8n
        image: n8nwork/n8n-work:latest
        ports:
        - containerPort: 5678
        envFrom:
        - configMapRef:
            name: n8n-config
        env:
        - name: N8N_BASIC_AUTH_USER
          valueFrom:
            secretKeyRef:
              name: n8n-secrets
              key: N8N_BASIC_AUTH_USER
        - name: N8N_BASIC_AUTH_PASSWORD
          valueFrom:
            secretKeyRef:
              name: n8n-secrets
              key: N8N_BASIC_AUTH_PASSWORD
        - name: DB_POSTGRESDB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: n8n-secrets
              key: DB_POSTGRESDB_PASSWORD
        - name: N8N_ENCRYPTION_KEY
          valueFrom:
            secretKeyRef:
              name: n8n-secrets
              key: N8N_ENCRYPTION_KEY
        volumeMounts:
        - name: n8n-storage
          mountPath: /home/node/.n8n
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /healthz
            port: 5678
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /healthz
            port: 5678
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: n8n-storage
        persistentVolumeClaim:
          claimName: n8n-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: n8n-service
  namespace: n8n-work
spec:
  selector:
    app: n8n
  ports:
  - port: 80
    targetPort: 5678
  type: ClusterIP
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: n8n-pvc
  namespace: n8n-work
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
```

### Ingress Configuration

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: n8n-ingress
  namespace: n8n-work
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
spec:
  tls:
  - hosts:
    - n8n.example.com
    secretName: n8n-tls
  rules:
  - host: n8n.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: n8n-service
            port:
              number: 80
```

### Deploy to Kubernetes

```bash
# Apply all configurations
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secrets.yaml
kubectl apply -f postgres.yaml
kubectl apply -f redis.yaml
kubectl apply -f n8n.yaml
kubectl apply -f ingress.yaml

# Check deployment status
kubectl get pods -n n8n-work
kubectl get services -n n8n-work
kubectl get ingress -n n8n-work
```

## Cloud Platform Deployments

### AWS ECS with Fargate

```yaml
# aws-ecs-task-definition.json
{
  "family": "n8n-work",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "n8n",
      "image": "n8nwork/n8n-work:latest",
      "portMappings": [
        {
          "containerPort": 5678,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "N8N_HOST",
          "value": "n8n.example.com"
        },
        {
          "name": "N8N_PROTOCOL",
          "value": "https"
        },
        {
          "name": "WEBHOOK_URL",
          "value": "https://n8n.example.com/"
        },
        {
          "name": "DB_TYPE",
          "value": "postgres"
        },
        {
          "name": "DB_POSTGRESDB_HOST",
          "value": "your-rds-endpoint.region.rds.amazonaws.com"
        }
      ],
      "secrets": [
        {
          "name": "N8N_BASIC_AUTH_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:n8n-secrets:password::"
        },
        {
          "name": "DB_POSTGRESDB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:n8n-secrets:db_password::"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/n8n-work",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### Google Cloud Run

```yaml
# cloudrun.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: n8n-work
  namespace: default
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/maxScale: "10"
        run.googleapis.com/cpu-throttling: "false"
        run.googleapis.com/memory: "2Gi"
        run.googleapis.com/cpu: "2"
    spec:
      containerConcurrency: 80
      containers:
      - image: n8nwork/n8n-work:latest
        ports:
        - containerPort: 5678
        env:
        - name: N8N_HOST
          value: "n8n.example.com"
        - name: N8N_PROTOCOL
          value: "https"
        - name: WEBHOOK_URL
          value: "https://n8n.example.com/"
        - name: DB_TYPE
          value: "postgres"
        - name: DB_POSTGRESDB_HOST
          valueFrom:
            secretKeyRef:
              name: n8n-secrets
              key: db_host
        - name: N8N_BASIC_AUTH_PASSWORD
          valueFrom:
            secretKeyRef:
              name: n8n-secrets
              key: auth_password
        resources:
          limits:
            cpu: "2"
            memory: "2Gi"
```

### Azure Container Instances

```yaml
# azure-container-group.yaml
apiVersion: 2021-09-01
location: eastus
name: n8n-work
properties:
  containers:
  - name: n8n
    properties:
      image: n8nwork/n8n-work:latest
      ports:
      - port: 5678
      environmentVariables:
      - name: N8N_HOST
        value: n8n.example.com
      - name: N8N_PROTOCOL
        value: https
      - name: WEBHOOK_URL
        value: https://n8n.example.com/
      - name: DB_TYPE
        value: postgres
      - name: DB_POSTGRESDB_HOST
        secureValue: your-postgres-host
      - name: N8N_BASIC_AUTH_PASSWORD
        secureValue: your-password
      resources:
        requests:
          cpu: 1
          memoryInGB: 2
  osType: Linux
  ipAddress:
    type: Public
    ports:
    - protocol: tcp
      port: 5678
  restartPolicy: Always
type: Microsoft.ContainerInstance/containerGroups
```

## Environment Configuration

### Core Settings

```bash
# Basic configuration
N8N_HOST=your-domain.com
N8N_PORT=5678
N8N_PROTOCOL=https
WEBHOOK_URL=https://your-domain.com/
GENERIC_TIMEZONE=UTC

# Authentication
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=your-secure-password

# Database
DB_TYPE=postgres
DB_POSTGRESDB_HOST=localhost
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=n8n
DB_POSTGRESDB_USER=n8n
DB_POSTGRESDB_PASSWORD=password

# Encryption
N8N_ENCRYPTION_KEY=your-encryption-key

# Execution settings
EXECUTIONS_PROCESS=main
EXECUTIONS_MODE=regular
EXECUTIONS_TIMEOUT=3600
EXECUTIONS_MAX_TIMEOUT=7200

# Queue settings (for scaling)
QUEUE_BULL_REDIS_HOST=redis
QUEUE_BULL_REDIS_PORT=6379
QUEUE_BULL_REDIS_PASSWORD=redis-password

# Logging
N8N_LOG_LEVEL=info
N8N_LOG_OUTPUT=console

# Security
N8N_SECURE_COOKIE=true
N8N_COOKIE_SECURE=true
```

### Advanced Configuration

```bash
# Performance tuning
NODE_OPTIONS=--max-old-space-size=2048
N8N_PAYLOAD_SIZE_MAX=16
N8N_METRICS=true

# File storage
N8N_DEFAULT_BINARY_DATA_MODE=filesystem
N8N_BINARY_DATA_TTL=120

# External services
N8N_EXTERNAL_HOOK_FILES=/data/hooks/external-hooks.js

# Custom nodes
N8N_CUSTOM_EXTENSIONS=/data/custom

# SMTP settings
N8N_EMAIL_MODE=smtp
N8N_SMTP_HOST=smtp.gmail.com
N8N_SMTP_PORT=587
N8N_SMTP_USER=your-email@gmail.com
N8N_SMTP_PASS=your-app-password
N8N_SMTP_SENDER=your-email@gmail.com

# User management
N8N_USER_FOLDER=/data/users
N8N_PERSONALIZATION_ENABLED=true

# Webhook settings
N8N_DISABLE_UI=false
N8N_SKIP_WEBHOOK_DEREGISTRATION_SHUTDOWN=false
```

## Database Setup

### PostgreSQL

```sql
-- Create database and user
CREATE DATABASE n8n;
CREATE USER n8n WITH ENCRYPTED PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE n8n TO n8n;

-- Performance optimization
ALTER DATABASE n8n SET shared_preload_libraries = 'pg_stat_statements';
ALTER DATABASE n8n SET log_statement = 'all';
ALTER DATABASE n8n SET log_min_duration_statement = 1000;

-- Backup configuration
-- Setup automated backups
CREATE OR REPLACE FUNCTION backup_n8n_db()
RETURNS void AS $$
BEGIN
    PERFORM pg_dump('n8n', '/backup/n8n_' || to_char(now(), 'YYYY-MM-DD_HH24-MI-SS') || '.sql');
END;
$$ LANGUAGE plpgsql;

-- Schedule backups (using pg_cron extension)
SELECT cron.schedule('backup-n8n', '0 2 * * *', 'SELECT backup_n8n_db();');
```

### MySQL

```sql
-- Create database and user
CREATE DATABASE n8n CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'n8n'@'%' IDENTIFIED BY 'your-password';
GRANT ALL PRIVILEGES ON n8n.* TO 'n8n'@'%';
FLUSH PRIVILEGES;

-- Configuration optimization
SET GLOBAL innodb_buffer_pool_size = 1073741824; -- 1GB
SET GLOBAL max_connections = 200;
SET GLOBAL innodb_log_file_size = 268435456; -- 256MB
```

## Security Configuration

### SSL/TLS Setup

```bash
# Generate self-signed certificate (development only)
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Use Let's Encrypt with Certbot
certbot certonly --standalone -d your-domain.com

# Nginx SSL configuration
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    location / {
        proxy_pass http://localhost:5678;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Authentication Configuration

```bash
# JWT authentication
N8N_JWT_AUTH_ACTIVE=true
N8N_JWT_AUTH_HEADER=authorization
N8N_JWT_AUTH_HEADER_VALUE_PREFIX=Bearer

# LDAP authentication
N8N_LDAP_ENABLED=true
N8N_LDAP_SERVER=ldap://ldap.company.com
N8N_LDAP_BIND_DN=cn=admin,dc=company,dc=com
N8N_LDAP_BIND_PASSWORD=ldap-password
N8N_LDAP_BASE_DN=ou=users,dc=company,dc=com

# OAuth2 authentication
N8N_OAUTH2_ENABLED=true
N8N_OAUTH2_CLIENT_ID=your-client-id
N8N_OAUTH2_CLIENT_SECRET=your-client-secret
N8N_OAUTH2_AUTH_URL=https://oauth.provider.com/auth
N8N_OAUTH2_TOKEN_URL=https://oauth.provider.com/token
```

### Network Security

```bash
# Firewall rules (UFW)
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw deny 5678/tcp  # Only allow through reverse proxy
ufw enable

# Docker network isolation
docker network create --driver bridge n8n_secure_network

# Kubernetes network policies
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: n8n-network-policy
  namespace: n8n-work
spec:
  podSelector:
    matchLabels:
      app: n8n
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 5678
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
```

## Monitoring and Observability

### Prometheus Metrics

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'n8n'
    static_configs:
      - targets: ['localhost:5678']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "N8N-Work Monitoring",
    "panels": [
      {
        "title": "Workflow Executions",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(n8n_workflow_executions_total[5m])",
            "legendFormat": "{{status}}"
          }
        ]
      },
      {
        "title": "Active Workflows",
        "type": "singlestat",
        "targets": [
          {
            "expr": "n8n_workflows_active_total"
          }
        ]
      },
      {
        "title": "Execution Duration",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(n8n_workflow_execution_duration_seconds_bucket[5m]))"
          }
        ]
      }
    ]
  }
}
```

### Health Checks

```bash
# Health check script
#!/bin/bash
set -e

# Check if N8N is responding
if ! curl -f http://localhost:5678/healthz; then
    echo "N8N health check failed"
    exit 1
fi

# Check database connectivity
if ! pg_isready -h postgres -p 5432 -U n8n; then
    echo "Database health check failed"
    exit 1
fi

# Check Redis connectivity
if ! redis-cli -h redis ping; then
    echo "Redis health check failed"
    exit 1
fi

echo "All health checks passed"
```

### Logging Configuration

```yaml
# filebeat.yml
filebeat.inputs:
- type: container
  paths:
    - '/var/lib/docker/containers/*/*.log'
  processors:
  - add_docker_metadata:
      host: "unix:///var/run/docker.sock"

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
  index: "n8n-logs-%{+yyyy.MM.dd}"

logging.level: info
logging.to_files: true
logging.files:
  path: /var/log/filebeat
  name: filebeat
  keepfiles: 7
  permissions: 0644
```

## Backup and Recovery

### Database Backup

```bash
#!/bin/bash
# backup-script.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/n8n"
DB_NAME="n8n"
DB_USER="n8n"
DB_HOST="localhost"

# Create backup directory
mkdir -p $BACKUP_DIR

# PostgreSQL backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | gzip > $BACKUP_DIR/n8n_backup_$DATE.sql.gz

# Backup N8N data directory
tar -czf $BACKUP_DIR/n8n_data_$DATE.tar.gz /home/node/.n8n

# Cleanup old backups (keep last 7 days)
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

### Automated Backup with Cron

```bash
# Add to crontab
0 2 * * * /scripts/backup-script.sh >> /var/log/n8n-backup.log 2>&1
0 3 * * 0 /scripts/cleanup-old-backups.sh >> /var/log/n8n-cleanup.log 2>&1
```

### Disaster Recovery

```bash
#!/bin/bash
# restore-script.sh

BACKUP_FILE=$1
DATA_BACKUP=$2

if [ -z "$BACKUP_FILE" ] || [ -z "$DATA_BACKUP" ]; then
    echo "Usage: $0 <database_backup> <data_backup>"
    exit 1
fi

# Stop N8N
docker-compose down

# Restore database
gunzip -c $BACKUP_FILE | psql -h localhost -U n8n -d n8n

# Restore data directory
rm -rf /home/node/.n8n/*
tar -xzf $DATA_BACKUP -C /

# Start N8N
docker-compose up -d

echo "Restore completed"
```

## Performance Optimization

### Resource Allocation

```yaml
# Docker resource limits
services:
  n8n:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G

# Kubernetes resource requests/limits
resources:
  requests:
    memory: "1Gi"
    cpu: "500m"
  limits:
    memory: "2Gi" 
    cpu: "2000m"
```

### Database Optimization

```sql
-- PostgreSQL performance tuning
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Index optimization
CREATE INDEX CONCURRENTLY idx_executions_workflow_id ON executions(workflow_id);
CREATE INDEX CONCURRENTLY idx_executions_started_at ON executions(started_at);
CREATE INDEX CONCURRENTLY idx_workflow_active ON workflows(active) WHERE active = true;

-- Analyze tables
ANALYZE executions;
ANALYZE workflows;
ANALYZE credentials;
```

### Application Tuning

```bash
# Node.js optimization
NODE_OPTIONS="--max-old-space-size=2048 --optimize-for-size"

# N8N specific optimizations
N8N_PAYLOAD_SIZE_MAX=64
EXECUTIONS_DATA_SAVE_ON_ERROR=none
EXECUTIONS_DATA_SAVE_ON_SUCCESS=none
EXECUTIONS_DATA_SAVE_MANUAL_EXECUTIONS=false
```

## Scaling Strategies

### Horizontal Scaling

```yaml
# Kubernetes HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: n8n-hpa
  namespace: n8n-work
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: n8n
  minReplicas: 2
  maxReplicas: 10
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

### Load Balancing

```nginx
# Nginx upstream configuration
upstream n8n_backend {
    least_conn;
    server n8n-1:5678 max_fails=3 fail_timeout=30s;
    server n8n-2:5678 max_fails=3 fail_timeout=30s;
    server n8n-3:5678 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name n8n.example.com;
    
    location / {
        proxy_pass http://n8n_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Session affinity for websockets
        ip_hash;
    }
}
```

## Troubleshooting

### Common Issues

```bash
# Check logs
docker logs n8n-work -f
kubectl logs -f deployment/n8n -n n8n-work

# Database connection issues
docker exec -it postgres psql -U n8n -d n8n -c "SELECT 1;"

# Redis connection issues
docker exec -it redis redis-cli ping

# Disk space issues
df -h
docker system prune -a

# Memory issues
free -h
docker stats
```

### Debug Mode

```bash
# Enable debug logging
N8N_LOG_LEVEL=debug

# Enable debug for specific modules
DEBUG=n8n:*

# Database query debugging
DB_LOGGING_ENABLED=true
DB_LOGGING_OPTIONS=all
```

### Performance Issues

```bash
# Check system resources
top
htop
iotop

# Database performance
pg_stat_activity
pg_stat_statements

# Application metrics
curl http://localhost:5678/metrics
```

## Migration Guide

### Version Upgrades

```bash
# Backup before upgrade
./backup-script.sh

# Stop current version
docker-compose down

# Pull new image
docker-compose pull

# Start with new version
docker-compose up -d

# Check migration status
docker logs n8n-work | grep migration
```

### Database Migration

```bash
# Manual migration
docker exec -it n8n-work npm run db:migrate

# Rollback migration
docker exec -it n8n-work npm run db:revert
```

## Next Steps

- **[Monitoring Guide](/guide/monitoring)** - Set up comprehensive monitoring
- **[Security Guide](/guide/security)** - Advanced security configurations
- **[API Reference](/api/index)** - Integration with external systems
- **[Troubleshooting](/guide/troubleshooting)** - Common issues and solutions
