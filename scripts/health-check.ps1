# N8N-Work Platform Health Check Script
# Checks the status of all platform components

Write-Host "N8N-Work Platform Health Check" -ForegroundColor Green
Write-Host "==============================" -ForegroundColor Green

$errors = 0

# Check Docker
Write-Host "`n1. Docker Status..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>$null
    if ($dockerVersion) {
        Write-Host "✓ Docker: $dockerVersion" -ForegroundColor Green
    } else {
        Write-Host "✗ Docker is not running or not installed" -ForegroundColor Red
        $errors++
    }
} catch {
    Write-Host "✗ Docker is not running or not installed" -ForegroundColor Red
    $errors++
}

# Check Docker Compose
Write-Host "`n2. Docker Compose Status..." -ForegroundColor Yellow
try {
    $composeVersion = docker-compose --version 2>$null
    if ($composeVersion) {
        Write-Host "✓ Docker Compose: $composeVersion" -ForegroundColor Green
    } else {
        Write-Host "✗ Docker Compose is not available" -ForegroundColor Red
        $errors++
    }
} catch {
    Write-Host "✗ Docker Compose is not available" -ForegroundColor Red
    $errors++
}

# Check required files
Write-Host "`n3. Required Files..." -ForegroundColor Yellow
$requiredFiles = @(
    "docker-compose.yml",
    "orchestrator-nest/package.json", 
    "engine-go/go.mod",
    "node-runner-js/package.json",
    "proto-contracts/orchestrator.proto"
)

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✓ $file exists" -ForegroundColor Green
    } else {
        Write-Host "✗ $file missing" -ForegroundColor Red
        $errors++
    }
}

# Check environment configuration
Write-Host "`n4. Environment Configuration..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "✓ .env file exists" -ForegroundColor Green
    $envContent = Get-Content .env -ErrorAction SilentlyContinue
    if ($envContent) {
        $requiredVars = @("POSTGRES_PASSWORD", "RABBITMQ_USER", "JWT_SECRET")
        foreach ($var in $requiredVars) {
            if ($envContent -like "*$var=*") {
                Write-Host "✓ $var configured" -ForegroundColor Green
            } else {
                Write-Host "✗ $var not configured" -ForegroundColor Red
                $errors++
            }
        }
    } else {
        Write-Host "✗ .env file is empty or unreadable" -ForegroundColor Red
        $errors++
    }
} else {
    Write-Host "✗ .env file missing" -ForegroundColor Red
    $errors++
}

# Check Node.js (for development)
Write-Host "`n5. Development Tools..." -ForegroundColor Yellow
$nodeVersion = $null
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Host "✓ Node.js: $nodeVersion" -ForegroundColor Green
    } else {
        Write-Host "⚠ Node.js not found (optional for Docker deployment)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ Node.js not found (optional for Docker deployment)" -ForegroundColor Yellow
}

$goVersion = $null
try {
    $goVersion = go version 2>$null
    if ($goVersion) {
        Write-Host "✓ Go: $goVersion" -ForegroundColor Green
    } else {
        Write-Host "⚠ Go not found (optional for Docker deployment)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ Go not found (optional for Docker deployment)" -ForegroundColor Yellow
}

# Check container status
Write-Host "`n6. Container Status..." -ForegroundColor Yellow
try {
    $containerStatus = docker ps -a --format "table {{.Names}}`t{{.Status}}" 2>$null
    if ($containerStatus) {
        $n8nContainers = $containerStatus | Where-Object { $_ -match "n8n-work" }
        if ($n8nContainers) {
            Write-Host "N8N-Work containers found:" -ForegroundColor Green
            $n8nContainers | ForEach-Object { Write-Host "  $_" -ForegroundColor Cyan }
        } else {
            Write-Host "⚠ No N8N-Work containers found" -ForegroundColor Yellow
        }
        
        # Show all containers for context
        Write-Host "`nAll containers:" -ForegroundColor White
        $containerStatus | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    } else {
        Write-Host "⚠ Could not retrieve container status" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ Error checking containers: $_" -ForegroundColor Yellow
}

# Check port availability
Write-Host "`n7. Port Availability..." -ForegroundColor Yellow
$ports = @(3000, 8080, 3002, 5432, 6379, 5672, 15672, 9090, 3001, 16686)
foreach ($port in $ports) {
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $connect = $tcpClient.BeginConnect("127.0.0.1", $port, $null, $null)
        $wait = $connect.AsyncWaitHandle.WaitOne(1000, $false)
        if ($wait) {
            try {
                $tcpClient.EndConnect($connect)
                Write-Host "✓ Port $port is in use" -ForegroundColor Green
                $tcpClient.Close()
            } catch {
                Write-Host "⚠ Port $port is not responding" -ForegroundColor Yellow
            }
        } else {
            Write-Host "⚠ Port $port is not responding" -ForegroundColor Yellow
        }
        $tcpClient.Close()
    } catch {
        Write-Host "⚠ Could not test port $port" -ForegroundColor Yellow
    }
}

# Summary
Write-Host "`n$('='*50)" -ForegroundColor Green
if ($errors -eq 0) {
    Write-Host "✓ PLATFORM READY - All checks passed!" -ForegroundColor Green
    Write-Host "You can now start the platform with: docker-compose up -d" -ForegroundColor Green
} elseif ($errors -le 2) {
    Write-Host "⚠ PLATFORM MOSTLY READY - Minor issues found" -ForegroundColor Yellow
    Write-Host "Fix the issues above and try again" -ForegroundColor Yellow
} else {
    Write-Host "✗ PLATFORM NOT READY - $errors critical issues found" -ForegroundColor Red
    Write-Host "Please fix the issues above before starting the platform" -ForegroundColor Red
}

# Quick start guide
Write-Host "`nQuick Start Commands:" -ForegroundColor Cyan
Write-Host "  Start infrastructure: docker-compose up -d postgres redis rabbitmq" -ForegroundColor White
Write-Host "  Start all services:   docker-compose up -d" -ForegroundColor White
Write-Host "  View logs:           docker-compose logs -f" -ForegroundColor White
Write-Host "  Stop services:       docker-compose down" -ForegroundColor White
Write-Host "  Health endpoints:" -ForegroundColor White
Write-Host "    Orchestrator: http://localhost:3000/api/v1/health" -ForegroundColor White
Write-Host "    Engine:       http://localhost:8080/health" -ForegroundColor White
Write-Host "    Node Runner:  http://localhost:3002/health" -ForegroundColor White
Write-Host "    Grafana:      http://localhost:3001 (admin/admin)" -ForegroundColor White
Write-Host "    RabbitMQ:     http://localhost:15672 (n8n_work/n8n_work_dev)" -ForegroundColor White

exit $errors
