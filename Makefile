# N8N-Work Project Makefile

.PHONY: help proto-gen proto-lint proto-clean dev test lint format build docker-build docker-up docker-down clean install-buf-cli

# Default target
help:
	@echo "N8N-Work Development Commands:"
	@echo ""
	@echo "  install-buf-cli  Install the Buf CLI"
	@echo "  proto-gen      Generate code from protocol buffers"
	@echo "  proto-lint     Lint protocol buffer files"
	@echo "  proto-clean    Clean generated protocol buffer code"
	@echo ""
	@echo "  dev            Start development environment"
	@echo "  test           Run all tests"
	@echo "  lint           Run linters for all services"
	@echo "  format         Format all code"
	@echo ""
	@echo "  build          Build all services"
	@echo "  docker-build   Build Docker images"
	@echo "  docker-up      Start Docker development stack"
	@echo "  docker-down    Stop Docker development stack"
	@echo ""
	@echo "  clean          Clean all build artifacts"

install-buf-cli:
	@echo "Installing Buf CLI..."
	@if [ "$(OS)" = "Windows_NT" ]; then \
	    if command -v brew >/dev/null 2>&1; then \
	        brew install bufbuild/buf/buf; \
	    else \
	        echo "Homebrew not found. Please install Homebrew (https://brew.sh/) or install Buf CLI manually."; \
	        echo "For Windows, consider using Scoop (https://scoop.sh) or downloading the binary directly."; \
	        exit 1; \
	    fi; \
	else \
	    brew install bufbuild/buf/buf; \
	fi

# Protocol Buffer Management
proto-gen:
	@echo "Generating protocol buffer code..."
	cd proto-contracts && buf generate

proto-lint:
	@echo "Linting protocol buffer files..."
	cd proto-contracts && buf lint

proto-clean:
	@echo "Cleaning generated protocol buffer code..."
	rm -rf engine-go/proto/*
	rm -rf orchestrator-nest/proto/*
	rm -rf node-runner-js/proto/*

# Development Environment
dev: proto-gen
	@echo "Starting development environment..."
	docker-compose -f infra/docker-compose.yml up -d postgres rabbitmq redis
	@echo "Starting services..."
	@echo "Use 'make docker-up' for full Docker stack or start services individually"

# Testing
test:
	@echo "Running tests..."
	@echo "Running Go tests..."
	cd engine-go && go test ./...
	@echo "Running TypeScript tests..."
	cd orchestrator-nest && npm test
	cd node-runner-js && npm test
	cd node-sdk-js && npm test

# Code Quality
lint:
	@echo "Running linters..."
	@echo "Linting protocol buffers..."
	$(MAKE) proto-lint
	@echo "Linting Go code..."
	cd engine-go && go vet ./... && golangci-lint run
	@echo "Linting TypeScript code..."
	cd orchestrator-nest && npm run lint
	cd node-runner-js && npm run lint
	cd node-sdk-js && npm run lint

format:
	@echo "Formatting code..."
	@echo "Formatting Go code..."
	cd engine-go && go fmt ./...
	@echo "Formatting TypeScript code..."
	cd orchestrator-nest && npm run format
	cd node-runner-js && npm run format
	cd node-sdk-js && npm run format

# Building
build: proto-gen
	@echo "Building all services..."
	@echo "Building Go engine..."
	cd engine-go && go build -o bin/engine ./cmd/engine
	cd engine-go && go build -o bin/stepworker ./cmd/stepworker
	@echo "Building TypeScript services..."
	cd orchestrator-nest && npm run build
	cd node-runner-js && npm run build
	cd node-sdk-js && npm run build

# Docker Operations  
docker-build:
	@echo "Building Docker images..."
	docker build -f orchestrator-nest/Dockerfile -t n8n-work/orchestrator:latest ./orchestrator-nest
	docker build -f engine-go/Dockerfile -t n8n-work/engine:latest ./engine-go
	docker build -f node-runner-js/Dockerfile -t n8n-work/node-runner:latest ./node-runner-js

docker-up:
	@echo "Starting Docker development stack..."
	docker-compose -f infra/docker-compose.yml up -d

docker-down:
	@echo "Stopping Docker development stack..."
	docker-compose -f infra/docker-compose.yml down

# Cleanup
clean:
	@echo "Cleaning build artifacts..."
	$(MAKE) proto-clean
	rm -rf engine-go/bin
	rm -rf orchestrator-nest/dist
	rm -rf node-runner-js/dist
	rm -rf node-sdk-js/dist
	docker system prune -f

# Development shortcuts
install-deps:
	@echo "Installing dependencies..."
	cd orchestrator-nest && npm install
	cd node-runner-js && npm install
	cd node-sdk-js && npm install
	cd engine-go && go mod download

setup: install-deps proto-gen
	@echo "Project setup complete!"

# E2E Testing
e2e:
	@echo "Running E2E tests..."
	cd tests/e2e && npm test

# Load Testing
load-test:
	@echo "Running load tests..."
	cd tests/load && k6 run basic-load-test.js

# Database operations
db-migrate:
	@echo "Running database migrations..."
	cd orchestrator-nest && npm run migration:run

db-seed:
	@echo "Seeding database..."
	cd orchestrator-nest && npm run db:seed
