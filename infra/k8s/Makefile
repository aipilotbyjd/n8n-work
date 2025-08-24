# N8N Work - Helm Chart Management Makefile

# Variables
CHART_NAME := n8n-work
CHART_PATH := ./charts/n8n-work
NAMESPACE_PREFIX := n8n-work

# Environment-specific variables
DEV_NAMESPACE := $(NAMESPACE_PREFIX)-dev
STAGING_NAMESPACE := $(NAMESPACE_PREFIX)-staging
PROD_NAMESPACE := $(NAMESPACE_PREFIX)-prod

# Helm flags
HELM_COMMON_FLAGS := --wait --timeout=300s
HELM_PROD_FLAGS := $(HELM_COMMON_FLAGS) --atomic --cleanup-on-fail

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m # No Color

## Help target
.PHONY: help
help: ## Show this help message
	@echo "$(BLUE)N8N Work Helm Chart Management$(NC)"
	@echo ""
	@echo "$(YELLOW)Available targets:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

## Prerequisites and setup
.PHONY: check-prerequisites
check-prerequisites: ## Check if required tools are installed
	@echo "$(BLUE)Checking prerequisites...$(NC)"
	@command -v helm >/dev/null 2>&1 || { echo "$(RED)Error: Helm is not installed$(NC)" >&2; exit 1; }
	@command -v kubectl >/dev/null 2>&1 || { echo "$(RED)Error: kubectl is not installed$(NC)" >&2; exit 1; }
	@kubectl cluster-info >/dev/null 2>&1 || { echo "$(RED)Error: kubectl is not connected to a cluster$(NC)" >&2; exit 1; }
	@echo "$(GREEN)Prerequisites check passed$(NC)"

.PHONY: add-repos
add-repos: check-prerequisites ## Add required Helm repositories
	@echo "$(BLUE)Adding Helm repositories...$(NC)"
	helm repo add bitnami https://charts.bitnami.com/bitnami
	helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
	helm repo add grafana https://grafana.github.io/helm-charts
	helm repo update
	@echo "$(GREEN)Helm repositories added and updated$(NC)"

## Chart operations
.PHONY: lint
lint: check-prerequisites ## Lint all Helm charts
	@echo "$(BLUE)Linting Helm charts...$(NC)"
	helm lint $(CHART_PATH)
	helm lint $(CHART_PATH) -f $(CHART_PATH)/values-dev.yaml
	helm lint $(CHART_PATH) -f $(CHART_PATH)/values-staging.yaml
	helm lint $(CHART_PATH) -f $(CHART_PATH)/values-prod.yaml
	@echo "$(GREEN)Chart linting completed$(NC)"

.PHONY: validate
validate: check-prerequisites ## Validate charts with dry-run
	@echo "$(BLUE)Validating Helm charts...$(NC)"
	helm template $(CHART_NAME) $(CHART_PATH) -f $(CHART_PATH)/values-dev.yaml --validate >/dev/null
	helm template $(CHART_NAME) $(CHART_PATH) -f $(CHART_PATH)/values-staging.yaml --validate >/dev/null
	helm template $(CHART_NAME) $(CHART_PATH) -f $(CHART_PATH)/values-prod.yaml --validate >/dev/null
	@echo "$(GREEN)Chart validation completed$(NC)"

.PHONY: template-dev
template-dev: check-prerequisites ## Generate Kubernetes manifests for development
	helm template $(CHART_NAME) $(CHART_PATH) \
		-f $(CHART_PATH)/values-dev.yaml \
		--namespace $(DEV_NAMESPACE)

.PHONY: template-staging
template-staging: check-prerequisites ## Generate Kubernetes manifests for staging
	helm template $(CHART_NAME) $(CHART_PATH) \
		-f $(CHART_PATH)/values-staging.yaml \
		--namespace $(STAGING_NAMESPACE)

.PHONY: template-prod
template-prod: check-prerequisites ## Generate Kubernetes manifests for production
	helm template $(CHART_NAME) $(CHART_PATH) \
		-f $(CHART_PATH)/values-prod.yaml \
		--namespace $(PROD_NAMESPACE)

## Development environment
.PHONY: create-secrets-dev
create-secrets-dev: check-prerequisites ## Create secrets for development environment
	@echo "$(BLUE)Creating secrets for development environment...$(NC)"
	kubectl create namespace $(DEV_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	kubectl create secret generic postgresql-secret \
		--from-literal=postgres-password="dev-postgres-pass" \
		--from-literal=password="dev-user-pass" \
		--from-literal=database-url="postgresql://n8n_work:dev-user-pass@postgresql:5432/n8n_work" \
		-n $(DEV_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	kubectl create secret generic rabbitmq-secret \
		--from-literal=rabbitmq-password="dev-rabbit-pass" \
		--from-literal=amqp-url="amqp://n8n_work:dev-rabbit-pass@rabbitmq:5672/" \
		-n $(DEV_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	kubectl create secret generic redis-secret \
		--from-literal=redis-password="dev-redis-pass" \
		--from-literal=redis-url="redis://:dev-redis-pass@redis:6379" \
		-n $(DEV_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	@echo "$(GREEN)Development secrets created$(NC)"

.PHONY: install-dev
install-dev: add-repos create-secrets-dev lint ## Install N8N Work in development environment
	@echo "$(BLUE)Installing N8N Work in development environment...$(NC)"
	helm install $(CHART_NAME) $(CHART_PATH) \
		-f $(CHART_PATH)/values-dev.yaml \
		-n $(DEV_NAMESPACE) \
		--create-namespace \
		$(HELM_COMMON_FLAGS)
	@echo "$(GREEN)Development deployment completed$(NC)"

.PHONY: upgrade-dev
upgrade-dev: add-repos lint ## Upgrade N8N Work in development environment
	@echo "$(BLUE)Upgrading N8N Work in development environment...$(NC)"
	helm upgrade $(CHART_NAME) $(CHART_PATH) \
		-f $(CHART_PATH)/values-dev.yaml \
		-n $(DEV_NAMESPACE) \
		$(HELM_COMMON_FLAGS)
	@echo "$(GREEN)Development upgrade completed$(NC)"

.PHONY: uninstall-dev
uninstall-dev: check-prerequisites ## Uninstall N8N Work from development environment
	@echo "$(YELLOW)Uninstalling N8N Work from development environment...$(NC)"
	helm uninstall $(CHART_NAME) -n $(DEV_NAMESPACE) || true
	@echo "$(GREEN)Development uninstall completed$(NC)"

## Staging environment
.PHONY: create-secrets-staging
create-secrets-staging: check-prerequisites ## Create secrets for staging environment
	@echo "$(BLUE)Creating secrets for staging environment...$(NC)"
	kubectl create namespace $(STAGING_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	@echo "$(YELLOW)Please create actual secrets with secure passwords for staging$(NC)"
	@echo "Example commands:"
	@echo "kubectl create secret generic postgresql-secret --from-literal=postgres-password='SECURE_PASSWORD' -n $(STAGING_NAMESPACE)"
	@echo "kubectl create secret generic rabbitmq-secret --from-literal=rabbitmq-password='SECURE_PASSWORD' -n $(STAGING_NAMESPACE)"
	@echo "kubectl create secret generic redis-secret --from-literal=redis-password='SECURE_PASSWORD' -n $(STAGING_NAMESPACE)"

.PHONY: install-staging
install-staging: add-repos lint ## Install N8N Work in staging environment
	@echo "$(BLUE)Installing N8N Work in staging environment...$(NC)"
	helm install $(CHART_NAME) $(CHART_PATH) \
		-f $(CHART_PATH)/values-staging.yaml \
		-n $(STAGING_NAMESPACE) \
		--create-namespace \
		$(HELM_COMMON_FLAGS)
	@echo "$(GREEN)Staging deployment completed$(NC)"

.PHONY: upgrade-staging
upgrade-staging: add-repos lint ## Upgrade N8N Work in staging environment
	@echo "$(BLUE)Upgrading N8N Work in staging environment...$(NC)"
	helm upgrade $(CHART_NAME) $(CHART_PATH) \
		-f $(CHART_PATH)/values-staging.yaml \
		-n $(STAGING_NAMESPACE) \
		$(HELM_COMMON_FLAGS)
	@echo "$(GREEN)Staging upgrade completed$(NC)"

.PHONY: uninstall-staging
uninstall-staging: check-prerequisites ## Uninstall N8N Work from staging environment
	@echo "$(YELLOW)Uninstalling N8N Work from staging environment...$(NC)"
	helm uninstall $(CHART_NAME) -n $(STAGING_NAMESPACE) || true
	@echo "$(GREEN)Staging uninstall completed$(NC)"

## Production environment
.PHONY: create-secrets-prod
create-secrets-prod: check-prerequisites ## Create secrets for production environment
	@echo "$(BLUE)Creating namespace for production environment...$(NC)"
	kubectl create namespace $(PROD_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	@echo "$(RED)IMPORTANT: Please create actual secrets with secure passwords for production$(NC)"
	@echo "Example commands:"
	@echo "kubectl create secret generic postgresql-secret --from-literal=postgres-password='VERY_SECURE_PASSWORD' -n $(PROD_NAMESPACE)"
	@echo "kubectl create secret generic rabbitmq-secret --from-literal=rabbitmq-password='VERY_SECURE_PASSWORD' -n $(PROD_NAMESPACE)"
	@echo "kubectl create secret generic redis-secret --from-literal=redis-password='VERY_SECURE_PASSWORD' -n $(PROD_NAMESPACE)"

.PHONY: install-prod
install-prod: add-repos lint ## Install N8N Work in production environment
	@echo "$(RED)Installing N8N Work in PRODUCTION environment...$(NC)"
	@echo "$(YELLOW)Please confirm you want to deploy to production [y/N]:$(NC)"
	@read -r confirm && [ "$$confirm" = "y" ] || { echo "Deployment cancelled"; exit 1; }
	helm install $(CHART_NAME) $(CHART_PATH) \
		-f $(CHART_PATH)/values-prod.yaml \
		-n $(PROD_NAMESPACE) \
		--create-namespace \
		$(HELM_PROD_FLAGS)
	@echo "$(GREEN)Production deployment completed$(NC)"

.PHONY: upgrade-prod
upgrade-prod: add-repos lint ## Upgrade N8N Work in production environment
	@echo "$(RED)Upgrading N8N Work in PRODUCTION environment...$(NC)"
	@echo "$(YELLOW)Please confirm you want to upgrade production [y/N]:$(NC)"
	@read -r confirm && [ "$$confirm" = "y" ] || { echo "Upgrade cancelled"; exit 1; }
	helm upgrade $(CHART_NAME) $(CHART_PATH) \
		-f $(CHART_PATH)/values-prod.yaml \
		-n $(PROD_NAMESPACE) \
		$(HELM_PROD_FLAGS)
	@echo "$(GREEN)Production upgrade completed$(NC)"

.PHONY: uninstall-prod
uninstall-prod: check-prerequisites ## Uninstall N8N Work from production environment
	@echo "$(RED)Uninstalling N8N Work from PRODUCTION environment...$(NC)"
	@echo "$(YELLOW)Please type 'yes' to confirm production uninstall:$(NC)"
	@read -r confirm && [ "$$confirm" = "yes" ] || { echo "Uninstall cancelled"; exit 1; }
	helm uninstall $(CHART_NAME) -n $(PROD_NAMESPACE) || true
	@echo "$(GREEN)Production uninstall completed$(NC)"

## Status and monitoring
.PHONY: status-dev
status-dev: check-prerequisites ## Show status of development deployment
	@echo "$(BLUE)Development environment status:$(NC)"
	helm status $(CHART_NAME) -n $(DEV_NAMESPACE) || echo "$(YELLOW)No deployment found$(NC)"
	kubectl get all -n $(DEV_NAMESPACE) -l app.kubernetes.io/instance=$(CHART_NAME)

.PHONY: status-staging
status-staging: check-prerequisites ## Show status of staging deployment
	@echo "$(BLUE)Staging environment status:$(NC)"
	helm status $(CHART_NAME) -n $(STAGING_NAMESPACE) || echo "$(YELLOW)No deployment found$(NC)"
	kubectl get all -n $(STAGING_NAMESPACE) -l app.kubernetes.io/instance=$(CHART_NAME)

.PHONY: status-prod
status-prod: check-prerequisites ## Show status of production deployment
	@echo "$(BLUE)Production environment status:$(NC)"
	helm status $(CHART_NAME) -n $(PROD_NAMESPACE) || echo "$(YELLOW)No deployment found$(NC)"
	kubectl get all -n $(PROD_NAMESPACE) -l app.kubernetes.io/instance=$(CHART_NAME)

.PHONY: logs-dev
logs-dev: check-prerequisites ## Show logs from development environment
	kubectl logs -f deployment/orchestrator -n $(DEV_NAMESPACE)

.PHONY: logs-staging
logs-staging: check-prerequisites ## Show logs from staging environment
	kubectl logs -f deployment/orchestrator -n $(STAGING_NAMESPACE)

.PHONY: logs-prod
logs-prod: check-prerequisites ## Show logs from production environment
	kubectl logs -f deployment/orchestrator -n $(PROD_NAMESPACE)

## Port forwarding for local access
.PHONY: port-forward-dev
port-forward-dev: check-prerequisites ## Port forward development services to local machine
	@echo "$(BLUE)Port forwarding development services...$(NC)"
	@echo "Orchestrator API: http://localhost:3000"
	@echo "Grafana: http://localhost:3001"
	kubectl port-forward svc/orchestrator 3000:3000 -n $(DEV_NAMESPACE) &
	kubectl port-forward svc/grafana 3001:80 -n $(DEV_NAMESPACE) &
	@echo "$(GREEN)Port forwarding started. Press Ctrl+C to stop.$(NC)"
	@wait

## Cleanup
.PHONY: clean-all
clean-all: check-prerequisites ## Clean up all environments (DANGEROUS)
	@echo "$(RED)This will remove ALL N8N Work deployments from ALL environments!$(NC)"
	@echo "$(YELLOW)Please type 'DELETE_ALL' to confirm:$(NC)"
	@read -r confirm && [ "$$confirm" = "DELETE_ALL" ] || { echo "Cleanup cancelled"; exit 1; }
	-helm uninstall $(CHART_NAME) -n $(DEV_NAMESPACE)
	-helm uninstall $(CHART_NAME) -n $(STAGING_NAMESPACE)
	-helm uninstall $(CHART_NAME) -n $(PROD_NAMESPACE)
	-kubectl delete namespace $(DEV_NAMESPACE)
	-kubectl delete namespace $(STAGING_NAMESPACE)
	-kubectl delete namespace $(PROD_NAMESPACE)
	@echo "$(GREEN)All environments cleaned up$(NC)"

## Testing
.PHONY: test-chart
test-chart: lint validate ## Run all chart tests
	@echo "$(GREEN)All chart tests passed$(NC)"

.PHONY: deploy-test
deploy-test: install-dev ## Deploy to development and run basic tests
	@echo "$(BLUE)Running deployment tests...$(NC)"
	kubectl wait --for=condition=available --timeout=300s deployment/orchestrator -n $(DEV_NAMESPACE)
	kubectl wait --for=condition=available --timeout=300s deployment/engine-go -n $(DEV_NAMESPACE)
	kubectl wait --for=condition=available --timeout=300s deployment/node-runner-js -n $(DEV_NAMESPACE)
	@echo "$(GREEN)Deployment tests passed$(NC)"