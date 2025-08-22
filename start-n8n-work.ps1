# N8N-Work Application Startup Script for Windows

Write-Host "🚀 Starting N8N-Work Application with Docker" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green

# Check Docker status
Write-Host "✓ Checking Docker status..." -ForegroundColor Yellow
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Check if containers are already running
Write-Host "📦 Checking container status..." -ForegroundColor Yellow
$runningContainers = (docker ps --filter "name=n8n-work" --format "{{.Names}}").Count
Write-Host "Found $runningContainers N8N-Work containers running" -ForegroundColor Blue

# Start infrastructure services first
Write-Host "🔧 Starting infrastructure services..." -ForegroundColor Yellow
docker-compose up -d postgres redis rabbitmq clickhouse minio vault jaeger

# Wait for infrastructure to be healthy
Write-Host "⏳ Waiting for infrastructure services to be healthy..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Check infrastructure health
Write-Host "🏥 Checking infrastructure health..." -ForegroundColor Yellow
docker ps --filter "name=n8n-work-postgres" --filter "name=n8n-work-redis" --filter "name=n8n-work-rabbitmq" --format "table {{.Names}}`t{{.Status}}"

# Start application services
Write-Host "🚀 Starting application services..." -ForegroundColor Yellow
docker-compose up -d orchestrator-nest node-runner-js

Write-Host "📊 Final container status:" -ForegroundColor Cyan
docker ps --filter "name=n8n-work" --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}"

Write-Host ""
Write-Host "🌐 Available Services:" -ForegroundColor Cyan
Write-Host "   - Orchestrator API:    http://localhost:3000" -ForegroundColor White
Write-Host "   - Node Runner API:     http://localhost:3002" -ForegroundColor White  
Write-Host "   - RabbitMQ Management: http://localhost:15672 (n8n_work/n8n_work_dev)" -ForegroundColor White
Write-Host "   - MinIO Console:       http://localhost:9001 (n8n_work_access/n8n_work_secret)" -ForegroundColor White
Write-Host "   - Jaeger UI:           http://localhost:16686" -ForegroundColor White
Write-Host "   - Vault UI:            http://localhost:8200" -ForegroundColor White
Write-Host ""
Write-Host "✅ N8N-Work application startup complete!" -ForegroundColor Green
Write-Host "💡 If services are unhealthy, check logs with: docker logs <container-name>" -ForegroundColor Yellow