# Protocol Buffer Code Generation Script for Windows

Write-Host "N8N-Work Protocol Buffer Code Generation" -ForegroundColor Green

# Check if buf is installed
try {
    buf --version | Out-Null
    Write-Host "✓ Buf CLI found" -ForegroundColor Green
} catch {
    Write-Host "✗ Buf CLI not found. Please install from https://docs.buf.build/installation" -ForegroundColor Red
    Write-Host "Install command: go install github.com/bufbuild/buf/cmd/buf@latest" -ForegroundColor Yellow
    exit 1
}

# Create output directories if they don't exist
$outputDirs = @(
    "../engine-go/proto",
    "../orchestrator-nest/proto", 
    "../node-runner-js/proto"
)

foreach ($dir in $outputDirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "Created directory: $dir" -ForegroundColor Blue
    }
}

# Clean existing generated code
Write-Host "Cleaning existing generated code..." -ForegroundColor Yellow
foreach ($dir in $outputDirs) {
    Get-ChildItem -Path $dir -Recurse | Remove-Item -Force -Recurse
}

# Lint protocol buffers
Write-Host "Linting protocol buffers..." -ForegroundColor Yellow
try {
    buf lint
    Write-Host "✓ Protocol buffer linting passed" -ForegroundColor Green
} catch {
    Write-Host "✗ Protocol buffer linting failed" -ForegroundColor Red
    exit 1
}

# Generate code
Write-Host "Generating protocol buffer code..." -ForegroundColor Yellow
try {
    buf generate
    Write-Host "✓ Protocol buffer code generation completed" -ForegroundColor Green
} catch {
    Write-Host "✗ Protocol buffer code generation failed" -ForegroundColor Red
    exit 1
}

# Verify generated files exist
$generatedFiles = @(
    "../engine-go/proto/execution.pb.go",
    "../engine-go/proto/workflow.pb.go",
    "../engine-go/proto/health.pb.go",
    "../orchestrator-nest/proto/execution_pb.ts",
    "../orchestrator-nest/proto/workflow_pb.ts", 
    "../orchestrator-nest/proto/health_pb.ts",
    "../node-runner-js/proto/execution_pb.ts",
    "../node-runner-js/proto/workflow_pb.ts",
    "../node-runner-js/proto/health_pb.ts"
)

$missingFiles = @()
foreach ($file in $generatedFiles) {
    if (-not (Test-Path $file)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "⚠ Some generated files are missing:" -ForegroundColor Yellow
    foreach ($file in $missingFiles) {
        Write-Host "  - $file" -ForegroundColor Red
    }
} else {
    Write-Host "✓ All expected files generated successfully" -ForegroundColor Green
}

Write-Host "Protocol buffer code generation completed!" -ForegroundColor Green
