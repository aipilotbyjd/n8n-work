#!/bin/bash

# N8N Work - Multi-Environment Helm Deployment Script
# This script provides easy deployment to different environments

set -euo pipefail

# Configuration
CHART_NAME="n8n-work"
CHART_PATH="./charts/n8n-work"
NAMESPACE_PREFIX="n8n-work"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 <command> <environment> [options]

Commands:
    install         Install the application
    upgrade         Upgrade the application
    uninstall       Uninstall the application
    status          Show deployment status
    validate        Validate Helm chart
    template        Generate Kubernetes manifests

Environments:
    dev             Development environment
    staging         Staging environment
    prod            Production environment

Options:
    --dry-run       Show what would be deployed without actually deploying
    --debug         Enable debug output
    --wait          Wait for deployment to complete
    --timeout=300s  Set timeout for deployment (default: 300s)
    --create-ns     Create namespace if it doesn't exist

Examples:
    $0 install dev --create-ns
    $0 upgrade prod --wait --timeout=600s
    $0 uninstall staging
    $0 status prod
    $0 validate dev
    $0 template prod > manifests.yaml

EOF
}

# Function to validate environment
validate_environment() {
    local env=$1
    case $env in
        dev|staging|prod)
            return 0
            ;;
        *)
            print_error "Invalid environment: $env"
            print_error "Valid environments: dev, staging, prod"
            exit 1
            ;;
    esac
}

# Function to get namespace for environment
get_namespace() {
    local env=$1
    echo "${NAMESPACE_PREFIX}-${env}"
}

# Function to get values file for environment
get_values_file() {
    local env=$1
    case $env in
        dev)
            echo "${CHART_PATH}/values-dev.yaml"
            ;;
        staging)
            echo "${CHART_PATH}/values-staging.yaml"
            ;;
        prod)
            echo "${CHART_PATH}/values-prod.yaml"
            ;;
    esac
}

# Function to check prerequisites
check_prerequisites() {
    # Check if helm is installed
    if ! command -v helm &> /dev/null; then
        print_error "Helm is not installed. Please install Helm first."
        exit 1
    fi

    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed. Please install kubectl first."
        exit 1
    fi

    # Check if kubectl is connected to a cluster
    if ! kubectl cluster-info &> /dev/null; then
        print_error "kubectl is not connected to a Kubernetes cluster."
        exit 1
    fi

    # Check if chart directory exists
    if [[ ! -d "$CHART_PATH" ]]; then
        print_error "Chart directory not found: $CHART_PATH"
        exit 1
    fi

    print_success "Prerequisites check passed"
}

# Function to add Helm repositories
add_helm_repos() {
    print_status "Adding required Helm repositories..."
    
    helm repo add bitnami https://charts.bitnami.com/bitnami
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update
    
    print_success "Helm repositories added and updated"
}

# Function to create namespace
create_namespace() {
    local namespace=$1
    local create_ns_flag=$2
    
    if [[ "$create_ns_flag" == "true" ]]; then
        if ! kubectl get namespace "$namespace" &> /dev/null; then
            print_status "Creating namespace: $namespace"
            kubectl create namespace "$namespace"
            
            # Add labels to namespace
            kubectl label namespace "$namespace" \
                app.kubernetes.io/name=n8n-work \
                app.kubernetes.io/managed-by=helm \
                environment="$(echo "$namespace" | cut -d'-' -f3)"
                
            print_success "Namespace created: $namespace"
        else
            print_status "Namespace already exists: $namespace"
        fi
    fi
}

# Function to validate chart
validate_chart() {
    local env=$1
    local values_file
    values_file=$(get_values_file "$env")
    
    print_status "Validating Helm chart for environment: $env"
    
    # Lint the chart
    helm lint "$CHART_PATH" -f "$values_file"
    
    # Template the chart (dry-run)
    helm template "$CHART_NAME" "$CHART_PATH" \
        -f "$values_file" \
        --validate > /dev/null
    
    print_success "Chart validation passed for environment: $env"
}

# Function to install/upgrade application
deploy_application() {
    local command=$1
    local env=$2
    local namespace
    local values_file
    local helm_args=()
    
    namespace=$(get_namespace "$env")
    values_file=$(get_values_file "$env")
    
    # Build Helm arguments
    helm_args+=(
        "$CHART_NAME"
        "$CHART_PATH"
        "--namespace" "$namespace"
        "--values" "$values_file"
    )
    
    # Add additional arguments based on environment
    case $env in
        prod)
            helm_args+=("--atomic" "--cleanup-on-fail")
            ;;
        staging)
            helm_args+=("--wait")
            ;;
    esac
    
    # Add command-specific arguments
    if [[ "$command" == "install" ]]; then
        helm_args=("install" "${helm_args[@]}")
    else
        helm_args=("upgrade" "${helm_args[@]}")
    fi
    
    print_status "Deploying N8N Work to $env environment..."
    print_status "Command: helm ${helm_args[*]}"
    
    # Execute Helm command
    helm "${helm_args[@]}"
    
    print_success "Deployment completed for environment: $env"
    
    # Show deployment status
    show_status "$env"
}

# Function to uninstall application
uninstall_application() {
    local env=$1
    local namespace
    
    namespace=$(get_namespace "$env")
    
    print_warning "Uninstalling N8N Work from environment: $env"
    
    # Confirm uninstall for production
    if [[ "$env" == "prod" ]]; then
        read -p "Are you sure you want to uninstall from PRODUCTION? (yes/no): " confirm
        if [[ "$confirm" != "yes" ]]; then
            print_status "Uninstall cancelled"
            exit 0
        fi
    fi
    
    helm uninstall "$CHART_NAME" --namespace "$namespace"
    
    print_success "Application uninstalled from environment: $env"
}

# Function to show deployment status
show_status() {
    local env=$1
    local namespace
    
    namespace=$(get_namespace "$env")
    
    print_status "Deployment status for environment: $env"
    echo
    
    # Helm status
    echo "=== Helm Release Status ==="
    helm status "$CHART_NAME" --namespace "$namespace" || print_warning "Release not found"
    echo
    
    # Kubernetes resources status
    echo "=== Kubernetes Resources Status ==="
    kubectl get all -n "$namespace" -l app.kubernetes.io/instance="$CHART_NAME"
    echo
    
    # Pod status
    echo "=== Pod Status ==="
    kubectl get pods -n "$namespace" -l app.kubernetes.io/instance="$CHART_NAME" -o wide
}

# Function to generate templates
generate_templates() {
    local env=$1
    local values_file
    
    values_file=$(get_values_file "$env")
    
    print_status "Generating Kubernetes manifests for environment: $env"
    
    helm template "$CHART_NAME" "$CHART_PATH" \
        --values "$values_file" \
        --namespace "$(get_namespace "$env")"
}

# Parse command line arguments
COMMAND=""
ENVIRONMENT=""
DRY_RUN=false
DEBUG=false
WAIT=false
TIMEOUT="300s"
CREATE_NS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        install|upgrade|uninstall|status|validate|template)
            COMMAND=$1
            shift
            ;;
        dev|staging|prod)
            ENVIRONMENT=$1
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --debug)
            DEBUG=true
            shift
            ;;
        --wait)
            WAIT=true
            shift
            ;;
        --timeout=*)
            TIMEOUT="${1#*=}"
            shift
            ;;
        --create-ns)
            CREATE_NS=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate required arguments
if [[ -z "$COMMAND" ]]; then
    print_error "Command is required"
    show_usage
    exit 1
fi

if [[ -z "$ENVIRONMENT" ]] && [[ "$COMMAND" != "template" ]]; then
    print_error "Environment is required"
    show_usage
    exit 1
fi

# Enable debug mode if requested
if [[ "$DEBUG" == "true" ]]; then
    set -x
fi

# Main execution
main() {
    print_status "N8N Work Helm Deployment Script"
    print_status "Command: $COMMAND"
    print_status "Environment: $ENVIRONMENT"
    
    check_prerequisites
    
    if [[ -n "$ENVIRONMENT" ]]; then
        validate_environment "$ENVIRONMENT"
    fi
    
    case $COMMAND in
        install)
            add_helm_repos
            create_namespace "$(get_namespace "$ENVIRONMENT")" "$CREATE_NS"
            validate_chart "$ENVIRONMENT"
            deploy_application "install" "$ENVIRONMENT"
            ;;
        upgrade)
            add_helm_repos
            validate_chart "$ENVIRONMENT"
            deploy_application "upgrade" "$ENVIRONMENT"
            ;;
        uninstall)
            uninstall_application "$ENVIRONMENT"
            ;;
        status)
            show_status "$ENVIRONMENT"
            ;;
        validate)
            validate_chart "$ENVIRONMENT"
            ;;
        template)
            if [[ -n "$ENVIRONMENT" ]]; then
                generate_templates "$ENVIRONMENT"
            else
                # Generate templates for all environments
                for env in dev staging prod; do
                    echo "# Environment: $env"
                    generate_templates "$env"
                    echo "---"
                done
            fi
            ;;
    esac
}

# Run main function
main