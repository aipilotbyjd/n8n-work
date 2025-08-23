package engine

import (
	"sync"
	"time"

	"go.uber.org/zap"
)

// Metrics tracks workflow engine performance and statistics
type Metrics struct {
	// Execution counters
	executionsStarted   map[string]int64 // by tenant
	executionsCompleted map[string]map[string]int64 // by tenant and status
	executionsFailed    map[string]map[string]int64 // by tenant and reason
	
	// Step counters
	stepsCompleted map[string]map[string]int64 // by tenant and status
	
	// Timing metrics
	executionDurations map[string][]time.Duration // by tenant
	
	// Resource usage
	activeExecutions    map[string]int64 // by tenant
	peakExecutions      map[string]int64 // by tenant
	
	// Synchronization
	mu sync.RWMutex
	
	// Logger
	logger *zap.Logger
}

// NewMetrics creates a new metrics instance
func NewMetrics() *Metrics {
	return &Metrics{
		executionsStarted:   make(map[string]int64),
		executionsCompleted: make(map[string]map[string]int64),
		executionsFailed:    make(map[string]map[string]int64),
		stepsCompleted:      make(map[string]map[string]int64),
		executionDurations:  make(map[string][]time.Duration),
		activeExecutions:    make(map[string]int64),
		peakExecutions:      make(map[string]int64),
	}
}

// IncrementExecutionsStarted increments the count of started executions for a tenant
func (m *Metrics) IncrementExecutionsStarted(tenantID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	m.executionsStarted[tenantID]++
	m.activeExecutions[tenantID]++
	
	// Update peak if necessary
	if m.activeExecutions[tenantID] > m.peakExecutions[tenantID] {
		m.peakExecutions[tenantID] = m.activeExecutions[tenantID]
	}
}

// IncrementExecutionsCompleted increments the count of completed executions
func (m *Metrics) IncrementExecutionsCompleted(tenantID, status string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	if m.executionsCompleted[tenantID] == nil {
		m.executionsCompleted[tenantID] = make(map[string]int64)
	}
	
	m.executionsCompleted[tenantID][status]++
	
	// Decrement active executions
	if m.activeExecutions[tenantID] > 0 {
		m.activeExecutions[tenantID]--
	}
}

// IncrementExecutionsFailed increments the count of failed executions
func (m *Metrics) IncrementExecutionsFailed(tenantID, reason string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	if m.executionsFailed[tenantID] == nil {
		m.executionsFailed[tenantID] = make(map[string]int64)
	}
	
	m.executionsFailed[tenantID][reason]++
}

// IncrementStepsCompleted increments the count of completed steps
func (m *Metrics) IncrementStepsCompleted(tenantID, status string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	if m.stepsCompleted[tenantID] == nil {
		m.stepsCompleted[tenantID] = make(map[string]int64)
	}
	
	m.stepsCompleted[tenantID][status]++
}

// RecordExecutionDuration records the duration of an execution
func (m *Metrics) RecordExecutionDuration(tenantID string, duration time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	// Keep last 1000 durations per tenant for calculating averages
	durations := m.executionDurations[tenantID]
	if len(durations) >= 1000 {
		// Remove oldest duration
		durations = durations[1:]
	}
	durations = append(durations, duration)
	m.executionDurations[tenantID] = durations
}

// GetExecutionStats returns execution statistics for a tenant
func (m *Metrics) GetExecutionStats(tenantID string) map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	stats := make(map[string]interface{})
	
	// Basic counters
	stats["executions_started"] = m.executionsStarted[tenantID]
	stats["executions_completed"] = m.executionsCompleted[tenantID]
	stats["executions_failed"] = m.executionsFailed[tenantID]
	stats["steps_completed"] = m.stepsCompleted[tenantID]
	
	// Resource usage
	stats["active_executions"] = m.activeExecutions[tenantID]
	stats["peak_executions"] = m.peakExecutions[tenantID]
	
	// Duration statistics
	if durations, exists := m.executionDurations[tenantID]; exists && len(durations) > 0 {
		stats["avg_duration_ms"] = m.calculateAverageDuration(durations).Milliseconds()
		stats["min_duration_ms"] = m.calculateMinDuration(durations).Milliseconds()
		stats["max_duration_ms"] = m.calculateMaxDuration(durations).Milliseconds()
	}
	
	return stats
}

// GetGlobalStats returns global statistics across all tenants
func (m *Metrics) GetGlobalStats() map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	stats := make(map[string]interface{})
	
	// Aggregate counters
	var totalStarted, totalActive, totalPeak int64
	totalCompleted := make(map[string]int64)
	totalFailed := make(map[string]int64)
	totalSteps := make(map[string]int64)
	
	for tenantID := range m.executionsStarted {
		totalStarted += m.executionsStarted[tenantID]
		totalActive += m.activeExecutions[tenantID]
		totalPeak += m.peakExecutions[tenantID]
		
		// Aggregate completed executions
		if completed, exists := m.executionsCompleted[tenantID]; exists {
			for status, count := range completed {
				totalCompleted[status] += count
			}
		}
		
		// Aggregate failed executions
		if failed, exists := m.executionsFailed[tenantID]; exists {
			for reason, count := range failed {
				totalFailed[reason] += count
			}
		}
		
		// Aggregate steps
		if steps, exists := m.stepsCompleted[tenantID]; exists {
			for status, count := range steps {
				totalSteps[status] += count
			}
		}
	}
	
	stats["total_executions_started"] = totalStarted
	stats["total_active_executions"] = totalActive
	stats["total_peak_executions"] = totalPeak
	stats["total_executions_completed"] = totalCompleted
	stats["total_executions_failed"] = totalFailed
	stats["total_steps_completed"] = totalSteps
	stats["tenant_count"] = len(m.executionsStarted)
	
	return stats
}

// Reset resets all metrics (useful for testing)
func (m *Metrics) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	m.executionsStarted = make(map[string]int64)
	m.executionsCompleted = make(map[string]map[string]int64)
	m.executionsFailed = make(map[string]map[string]int64)
	m.stepsCompleted = make(map[string]map[string]int64)
	m.executionDurations = make(map[string][]time.Duration)
	m.activeExecutions = make(map[string]int64)
	m.peakExecutions = make(map[string]int64)
}

// calculateAverageDuration calculates average duration from a slice of durations
func (m *Metrics) calculateAverageDuration(durations []time.Duration) time.Duration {
	if len(durations) == 0 {
		return 0
	}
	
	var total time.Duration
	for _, d := range durations {
		total += d
	}
	
	return total / time.Duration(len(durations))
}

// calculateMinDuration finds minimum duration from a slice of durations
func (m *Metrics) calculateMinDuration(durations []time.Duration) time.Duration {
	if len(durations) == 0 {
		return 0
	}
	
	min := durations[0]
	for _, d := range durations[1:] {
		if d < min {
			min = d
		}
	}
	
	return min
}

// calculateMaxDuration finds maximum duration from a slice of durations
func (m *Metrics) calculateMaxDuration(durations []time.Duration) time.Duration {
	if len(durations) == 0 {
		return 0
	}
	
	max := durations[0]
	for _, d := range durations[1:] {
		if d > max {
			max = d
		}
	}
	
	return max
}

// LogMetrics logs current metrics to the logger
func (m *Metrics) LogMetrics() {
	if m.logger == nil {
		return
	}
	
	globalStats := m.GetGlobalStats()
	
	m.logger.Info("Workflow Engine Metrics",
		zap.Any("global_stats", globalStats),
	)
}