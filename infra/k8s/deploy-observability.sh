#!/bin/bash

# N8N Work - Observability Stack Deployment Script
# This script manages the deployment of monitoring, logging, and alerting infrastructure

set -euo pipefail

# Configuration
OBSERVABILITY_CHART="./charts/observability"
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
    deploy          Deploy observability stack
    upgrade         Upgrade observability stack
    uninstall       Uninstall observability stack
    status          Show observability stack status
    dashboards      Import Grafana dashboards
    test-alerts     Test alerting configuration

Environments:
    dev             Development environment
    staging         Staging environment
    prod            Production environment

Options:
    --dry-run       Show what would be deployed without actually deploying
    --debug         Enable debug output
    --wait          Wait for deployment to complete

Examples:
    $0 deploy dev
    $0 upgrade prod --wait
    $0 dashboards staging
    $0 test-alerts dev

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

    # Check if observability chart directory exists
    if [[ ! -d "$OBSERVABILITY_CHART" ]]; then
        print_error "Observability chart directory not found: $OBSERVABILITY_CHART"
        exit 1
    fi

    print_success "Prerequisites check passed"
}

# Function to add required Helm repositories
add_helm_repos() {
    print_status "Adding required Helm repositories..."
    
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
    helm repo update
    
    print_success "Helm repositories added and updated"
}

# Function to create namespace with proper labels
create_namespace() {
    local namespace=$1
    
    if ! kubectl get namespace "$namespace" &> /dev/null; then
        print_status "Creating namespace: $namespace"
        kubectl create namespace "$namespace"
        
        # Add labels to namespace
        kubectl label namespace "$namespace" \
            name="$namespace" \
            app.kubernetes.io/name=n8n-work-observability \
            app.kubernetes.io/managed-by=helm \
            environment="$(echo "$namespace" | cut -d'-' -f3)"
            
        print_success "Namespace created: $namespace"
    else
        print_status "Namespace already exists: $namespace"
    fi
}

# Function to deploy observability stack
deploy_observability() {
    local env=$1
    local namespace
    local values_file
    
    namespace=$(get_namespace "$env")
    
    print_status "Deploying observability stack to $env environment..."
    
    # Create namespace
    create_namespace "$namespace"
    
    # Determine values file based on environment
    case $env in
        dev)
            values_file="values-dev.yaml"
            ;;
        staging)
            values_file="values-staging.yaml"
            ;;
        prod)
            values_file="values-prod.yaml"
            ;;
        *)
            values_file="values.yaml"
            ;;
    esac
    
    # Check if values file exists
    if [[ ! -f "$OBSERVABILITY_CHART/$values_file" ]]; then
        print_warning "Environment-specific values file not found, using default values.yaml"
        values_file="values.yaml"
    fi
    
    # Deploy observability stack
    helm upgrade --install observability "$OBSERVABILITY_CHART" \
        --namespace "$namespace" \
        --values "$OBSERVABILITY_CHART/$values_file" \
        --wait \
        --timeout=600s
    
    print_success "Observability stack deployed to $env environment"
    
    # Show access information
    show_access_info "$env"
}

# Function to upgrade observability stack
upgrade_observability() {
    local env=$1
    local namespace
    local values_file
    
    namespace=$(get_namespace "$env")
    values_file="values.yaml"
    
    # Check if environment-specific values file exists
    case $env in
        dev|staging|prod)
            if [[ -f "$OBSERVABILITY_CHART/values-$env.yaml" ]]; then
                values_file="values-$env.yaml"
            fi
            ;;
    esac
    
    print_status "Upgrading observability stack in $env environment..."
    
    helm upgrade observability "$OBSERVABILITY_CHART" \
        --namespace "$namespace" \
        --values "$OBSERVABILITY_CHART/$values_file" \
        --wait \
        --timeout=600s
    
    print_success "Observability stack upgraded in $env environment"
}

# Function to uninstall observability stack
uninstall_observability() {
    local env=$1
    local namespace
    
    namespace=$(get_namespace "$env")
    
    print_warning "Uninstalling observability stack from $env environment"
    
    # Confirm uninstall for production
    if [[ "$env" == "prod" ]]; then
        read -p "Are you sure you want to uninstall observability from PRODUCTION? (yes/no): " confirm
        if [[ "$confirm" != "yes" ]]; then
            print_status "Uninstall cancelled"
            exit 0
        fi
    fi
    
    helm uninstall observability --namespace "$namespace"
    
    print_success "Observability stack uninstalled from $env environment"
}

# Function to show deployment status
show_status() {
    local env=$1
    local namespace
    
    namespace=$(get_namespace "$env")
    
    print_status "Observability stack status for $env environment"
    echo
    
    # Helm status
    echo "=== Helm Release Status ==="
    helm status observability --namespace "$namespace" || print_warning "Release not found"
    echo
    
    # Kubernetes resources status
    echo "=== Kubernetes Resources Status ==="
    kubectl get all -n "$namespace" -l app.kubernetes.io/name=observability
    echo
    
    # Pod status
    echo "=== Pod Status ==="
    kubectl get pods -n "$namespace" -o wide
    
    # PVC status
    echo
    echo "=== Persistent Volume Claims ==="
    kubectl get pvc -n "$namespace"
}

# Function to show access information
show_access_info() {
    local env=$1
    local namespace
    
    namespace=$(get_namespace "$env")
    
    echo
    print_success "Access Information for $env environment:"
    echo
    
    # Grafana access
    print_status "Grafana Dashboard:"
    if kubectl get ingress grafana -n "$namespace" &> /dev/null; then
        grafana_host=$(kubectl get ingress grafana -n "$namespace" -o jsonpath='{.spec.rules[0].host}')
        echo "  URL: https://$grafana_host"
    else
        echo "  Port-forward: kubectl port-forward svc/grafana 3000:80 -n $namespace"
        echo "  URL: http://localhost:3000"
    fi
    echo "  Username: admin"
    echo "  Password: admin123 (change in production!)"
    echo
    
    # Prometheus access
    print_status "Prometheus:"
    echo "  Port-forward: kubectl port-forward svc/prometheus-server 9090:80 -n $namespace"
    echo "  URL: http://localhost:9090"
    echo
    
    # Alertmanager access
    print_status "Alertmanager:"
    echo "  Port-forward: kubectl port-forward svc/alertmanager 9093:9093 -n $namespace"
    echo "  URL: http://localhost:9093"
    echo
    
    # Jaeger access
    print_status "Jaeger Tracing:"
    if kubectl get ingress jaeger -n "$namespace" &> /dev/null; then
        jaeger_host=$(kubectl get ingress jaeger -n "$namespace" -o jsonpath='{.spec.rules[0].host}')
        echo "  URL: https://$jaeger_host"
    else
        echo "  Port-forward: kubectl port-forward svc/jaeger-query 16686:16686 -n $namespace"
        echo "  URL: http://localhost:16686"
    fi
}

# Function to import Grafana dashboards
import_dashboards() {
    local env=$1
    local namespace
    
    namespace=$(get_namespace "$env")
    
    print_status "Importing Grafana dashboards for $env environment..."
    
    # Get Grafana pod
    grafana_pod=$(kubectl get pods -n "$namespace" -l app.kubernetes.io/name=grafana -o jsonpath='{.items[0].metadata.name}')
    
    if [[ -z "$grafana_pod" ]]; then
        print_error "Grafana pod not found in namespace $namespace"
        exit 1
    fi
    
    # Copy dashboard files to Grafana pod
    dashboard_dir="$OBSERVABILITY_CHART/dashboards"
    if [[ -d "$dashboard_dir" ]]; then
        for dashboard in "$dashboard_dir"/*.json; do
            if [[ -f "$dashboard" ]]; then
                dashboard_name=$(basename "$dashboard")
                print_status "Importing dashboard: $dashboard_name"
                kubectl cp "$dashboard" "$namespace/$grafana_pod:/var/lib/grafana/dashboards/n8n-work/$dashboard_name"
            fi
        done
        
        # Restart Grafana to load new dashboards
        kubectl rollout restart deployment/grafana -n "$namespace"
        
        print_success "Dashboards imported successfully"
    else
        print_warning "Dashboard directory not found: $dashboard_dir"
    fi
}

# Function to test alerting configuration
test_alerts() {
    local env=$1
    local namespace
    
    namespace=$(get_namespace "$env")
    
    print_status "Testing alerting configuration for $env environment..."
    
    # Get Alertmanager service
    alertmanager_svc=$(kubectl get svc -n "$namespace" -l app.kubernetes.io/name=alertmanager -o jsonpath='{.items[0].metadata.name}')
    
    if [[ -z "$alertmanager_svc" ]]; then
        print_error "Alertmanager service not found in namespace $namespace"
        exit 1
    fi
    
    # Create a test alert
    test_alert='{
        "receiver": "default",
        "status": "firing",
        "alerts": [
            {
                "status": "firing",
                "labels": {
                    "alertname": "TestAlert",
                    "severity": "warning",
                    "instance": "test-instance",
                    "job": "test-job"
                },
                "annotations": {
                    "summary": "This is a test alert",
                    "description": "Testing alerting configuration for N8N Work"
                },
                "startsAt": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'",
                "endsAt": "'$(date -u -d '+1 hour' +%Y-%m-%dT%H:%M:%S.%3NZ)'"
            }
        ],
        "groupLabels": {
            "alertname": "TestAlert"
        },
        "commonLabels": {
            "alertname": "TestAlert",
            "severity": "warning"
        },
        "commonAnnotations": {
            "summary": "This is a test alert"
        },
        "externalURL": "http://alertmanager:9093",
        "version": "4",
        "groupKey": "{}:{alertname=\"TestAlert\"}"
    }'
    
    # Send test alert via port-forward
    print_status "Sending test alert..."
    kubectl port-forward svc/"$alertmanager_svc" 9093:9093 -n "$namespace" &
    port_forward_pid=$!
    
    # Wait for port-forward to establish
    sleep 3
    
    # Send the test alert
    curl -X POST http://localhost:9093/api/v1/alerts \
        -H "Content-Type: application/json" \
        -d "$test_alert" \
        || print_error "Failed to send test alert"
    
    # Kill port-forward
    kill $port_forward_pid &> /dev/null || true
    
    print_success "Test alert sent. Check your configured notification channels."
}

# Parse command line arguments
COMMAND=""
ENVIRONMENT=""
DRY_RUN=false
DEBUG=false
WAIT=false

while [[ $# -gt 0 ]]; do
    case $1 in
        deploy|upgrade|uninstall|status|dashboards|test-alerts)
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

if [[ -z "$ENVIRONMENT" ]]; then
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
    print_status "N8N Work Observability Deployment Script"
    print_status "Command: $COMMAND"
    print_status "Environment: $ENVIRONMENT"
    
    check_prerequisites
    validate_environment "$ENVIRONMENT"
    
    case $COMMAND in
        deploy)
            add_helm_repos
            deploy_observability "$ENVIRONMENT"
            ;;
        upgrade)
            add_helm_repos
            upgrade_observability "$ENVIRONMENT"
            ;;
        uninstall)
            uninstall_observability "$ENVIRONMENT"
            ;;
        status)
            show_status "$ENVIRONMENT"
            ;;
        dashboards)
            import_dashboards "$ENVIRONMENT"
            ;;
        test-alerts)
            test_alerts "$ENVIRONMENT"
            ;;
    esac
}

# Run main function
main