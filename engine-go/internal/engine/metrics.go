
package engine

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Metrics holds all prometheus metrics for the workflow engine
type Metrics struct {
	executionsStarted   *prometheus.CounterVec
	executionsCompleted *prometheus.CounterVec
	executionsFailed    *prometheus.CounterVec
	stepsCompleted      *prometheus.CounterVec
	executionDuration   *prometheus.HistogramVec
}

// NewMetrics creates a new metrics instance
func NewMetrics() *Metrics {
	return &Metrics{
		executionsStarted: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "workflow_executions_started_total",
				Help: "Total number of workflow executions started",
			},
			[]string{"tenant_id"},
		),
		executionsCompleted: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "workflow_executions_completed_total",
				Help: "Total number of workflow executions completed",
			},
			[]string{"tenant_id", "status"},
		),
		executionsFailed: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "workflow_executions_failed_total",
				Help: "Total number of workflow executions failed",
			},
			[]string{"tenant_id", "reason"},
		),
		stepsCompleted: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "workflow_steps_completed_total",
				Help: "Total number of workflow steps completed",
			},
			[]string{"tenant_id", "status"},
		),
		executionDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "workflow_execution_duration_seconds",
				Help:    "Duration of workflow executions",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"tenant_id"},
		),
	}
}

// IncrementExecutionsStarted increments the executions started counter
func (m *Metrics) IncrementExecutionsStarted(tenantID string) {
	m.executionsStarted.WithLabelValues(tenantID).Inc()
}

// IncrementExecutionsCompleted increments the executions completed counter
func (m *Metrics) IncrementExecutionsCompleted(tenantID, status string) {
	m.executionsCompleted.WithLabelValues(tenantID, status).Inc()
}

// IncrementExecutionsFailed increments the executions failed counter
func (m *Metrics) IncrementExecutionsFailed(tenantID, reason string) {
	m.executionsFailed.WithLabelValues(tenantID, reason).Inc()
}

// IncrementStepsCompleted increments the steps completed counter
func (m *Metrics) IncrementStepsCompleted(tenantID, status string) {
	m.stepsCompleted.WithLabelValues(tenantID, status).Inc()
}

// RecordExecutionDuration records the duration of a workflow execution
func (m *Metrics) RecordExecutionDuration(tenantID string, duration time.Duration) {
	m.executionDuration.WithLabelValues(tenantID).Observe(duration.Seconds())
}
