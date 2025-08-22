#!/bin/bash

# N8N-Work Application Startup Script

echo "🚀 Starting N8N-Work Application with Docker"
echo "=============================================="

# Check Docker status
echo "✓ Checking Docker status..."
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi
echo "✅ Docker is running"

# Check if containers are already running
echo "📦 Checking container status..."
RUNNING_CONTAINERS=$(docker ps --filter "name=n8n-work" --format "{{.Names}}" | wc -l)
echo "Found $RUNNING_CONTAINERS N8N-Work containers running"

# Start infrastructure services first
echo "🔧 Starting infrastructure services..."
docker-compose up -d postgres redis rabbitmq clickhouse minio vault jaeger

# Wait for infrastructure to be healthy
echo "⏳ Waiting for infrastructure services to be healthy..."
sleep 30

# Check infrastructure health
echo "🏥 Checking infrastructure health..."
docker ps --filter "name=n8n-work-postgres" --filter "name=n8n-work-redis" --filter "name=n8n-work-rabbitmq" --format "table {{.Names}}\t{{.Status}}"

# Start application services
echo "🚀 Starting application services..."
docker-compose up -d orchestrator-nest node-runner-js

echo "📊 Final container status:"
docker ps --filter "name=n8n-work" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "🌐 Available Services:"
echo "   - Orchestrator API:    http://localhost:3000"
echo "   - Node Runner API:     http://localhost:3002"
echo "   - RabbitMQ Management: http://localhost:15672 (n8n_work/n8n_work_dev)"
echo "   - MinIO Console:       http://localhost:9001 (n8n_work_access/n8n_work_secret)"
echo "   - Jaeger UI:           http://localhost:16686"
echo "   - Vault UI:            http://localhost:8200"
echo ""
echo "✅ N8N-Work application startup complete!"
echo "💡 If services are unhealthy, check logs with: docker logs <container-name>"