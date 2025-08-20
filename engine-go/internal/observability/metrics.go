package observability

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Metrics holds all Prometheus metrics for the engine
type Metrics struct {
	// gRPC metrics
	GRPCRequestsTotal    *prometheus.CounterVec
	GRPCRequestDuration  *prometheus.HistogramVec

	// Step execution metrics
	StepExecutionsTotal  *prometheus.CounterVec
	StepExecutionDuration *prometheus.HistogramVec
	ActiveStepExecutions *prometheus.GaugeVec

	// Workflow execution metrics
	WorkflowExecutionsTotal *prometheus.CounterVec
	ActiveWorkflowExecutions *prometheus.GaugeVec

	// Queue metrics
	QueueDepth           *prometheus.GaugeVec
	MessageProcessingRate *prometheus.CounterVec

	// Error metrics
	ErrorsTotal          *prometheus.CounterVec

	// Resource metrics
	DatabaseConnections  *prometheus.GaugeVec
}

// NewMetrics creates a new Metrics instance with all Prometheus metrics
func NewMetrics() *Metrics {
	return &Metrics{
		// gRPC metrics
		GRPCRequestsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "grpc_requests_total",
				Help: "Total number of gRPC requests",
			},
			[]string{"method", "status_code"},
		),

		GRPCRequestDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "grpc_request_duration_seconds",
				Help:    "Duration of gRPC requests in seconds",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"method"},
		),

		// Step execution metrics
		StepExecutionsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "step_executions_total",
				Help: "Total number of step executions",
			},
			[]string{"tenant_id", "node_type", "status"},
		),

		StepExecutionDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "step_execution_duration_seconds",
				Help:    "Duration of step executions in seconds",
				Buckets: []float64{0.1, 0.5, 1, 2, 5, 10, 30, 60},
			},
			[]string{"tenant_id", "node_type"},
		),

		ActiveStepExecutions: promauto.NewGaugeVec(
			prometheus.GaugeVec{
				Name: "active_step_executions",
				Help: "Number of currently active step executions",
			},
			[]string{"tenant_id", "node_type"},
		),

		// Workflow execution metrics
		WorkflowExecutionsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "workflow_executions_total",
				Help: "Total number of workflow executions",
			},
			[]string{"tenant_id", "status"},
		),

		ActiveWorkflowExecutions: promauto.NewGaugeVec(
			prometheus.GaugeVec{
				Name: "active_workflow_executions",
				Help: "Number of currently active workflow executions",
			},
			[]string{"tenant_id"},
		),

		// Queue metrics
		QueueDepth: promauto.NewGaugeVec(
			prometheus.GaugeVec{
				Name: "queue_depth",
				Help: "Number of messages in queue",
			},
			[]string{"queue_name"},
		),

		MessageProcessingRate: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "message_processing_total",
				Help: "Total number of messages processed",
			},
			[]string{"queue_name", "status"},
		),

		// Error metrics
		ErrorsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "errors_total",
				Help: "Total number of errors",
			},
			[]string{"component", "error_type"},
		),

		// Resource metrics
		DatabaseConnections: promauto.NewGaugeVec(
			prometheus.GaugeVec{
				Name: "database_connections",
				Help: "Number of database connections",
			},
			[]string{"state"}, // "active", "idle", "open"
		),
	}
}

// RecordGRPCRequest records a gRPC request metric
func (m *Metrics) RecordGRPCRequest(method, statusCode string) {
	m.GRPCRequestsTotal.WithLabelValues(method, statusCode).Inc()
}

// ObserveGRPCDuration observes gRPC request duration
func (m *Metrics) ObserveGRPCDuration(method string, duration float64) {
	m.GRPCRequestDuration.WithLabelValues(method).Observe(duration)
}

// RecordStepExecution records a step execution metric
func (m *Metrics) RecordStepExecution(tenantID, nodeType, status string) {
	m.StepExecutionsTotal.WithLabelValues(tenantID, nodeType, status).Inc()
}

// ObserveStepDuration observes step execution duration
func (m *Metrics) ObserveStepDuration(tenantID, nodeType string, duration float64) {
	m.StepExecutionDuration.WithLabelValues(tenantID, nodeType).Observe(duration)
}

// SetActiveSteps sets the number of active step executions
func (m *Metrics) SetActiveSteps(tenantID, nodeType string, count float64) {
	m.ActiveStepExecutions.WithLabelValues(tenantID, nodeType).Set(count)
}

// RecordWorkflowExecution records a workflow execution metric
func (m *Metrics) RecordWorkflowExecution(tenantID, status string) {
	m.WorkflowExecutionsTotal.WithLabelValues(tenantID, status).Inc()
}

// SetActiveWorkflows sets the number of active workflow executions
func (m *Metrics) SetActiveWorkflows(tenantID string, count float64) {
	m.ActiveWorkflowExecutions.WithLabelValues(tenantID).Set(count)
}

// SetQueueDepth sets the queue depth metric
func (m *Metrics) SetQueueDepth(queueName string, depth float64) {
	m.QueueDepth.WithLabelValues(queueName).Set(depth)
}

// RecordMessageProcessed records a processed message metric
func (m *Metrics) RecordMessageProcessed(queueName, status string) {
	m.MessageProcessingRate.WithLabelValues(queueName, status).Inc()
}

// RecordError records an error metric
func (m *Metrics) RecordError(component, errorType string) {
	m.ErrorsTotal.WithLabelValues(component, errorType).Inc()
}

// SetDatabaseConnections sets database connection metrics
func (m *Metrics) SetDatabaseConnections(state string, count float64) {
	m.DatabaseConnections.WithLabelValues(state).Set(count)
}
