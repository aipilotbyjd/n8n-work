
package engine

import (
	"context"
	"fmt"
	"sync"
	"time"

	"go.uber.org/zap"
	"golang.org/x/sync/semaphore"

	pb "github.com/n8n-work/engine-go/proto"
	"github.com/n8n-work/engine-go/internal/models"
	"github.com/n8n-work/engine-go/internal/queue"
)

// ExecutorConfig holds executor configuration
type ExecutorConfig struct {
	MaxConcurrentSteps    int
	DefaultTimeout        time.Duration
	MaxRetries            int
	RetryDelay            time.Duration
	RetryBackoffFactor    float64
	MaxRetryDelay         time.Duration
	CircuitBreakerEnabled bool
	CircuitBreakerConfig  *CircuitBreakerConfig
	HealthCheckInterval   time.Duration
}

// CircuitBreakerConfig defines circuit breaker settings
type CircuitBreakerConfig struct {
	FailureThreshold   int           // Number of failures before opening
	RecoveryTimeout    time.Duration // Time to wait before trying again
	SuccessThreshold   int           // Number of successes needed to close
	TimeWindow         time.Duration // Time window for failure counting
}

// CircuitBreakerState represents circuit breaker states
type CircuitBreakerState int

const (
	CircuitBreakerClosed CircuitBreakerState = iota
	CircuitBreakerOpen
	CircuitBreakerHalfOpen
)

// CircuitBreaker implements the circuit breaker pattern
type CircuitBreaker struct {
	config       *CircuitBreakerConfig
	state        CircuitBreakerState
	failureCount int
	successCount int
	lastFailure  time.Time
	mu           sync.RWMutex
	logger       *zap.Logger
}

// StepExecutionContext represents the context for step execution
type StepExecutionContext struct {
	ExecutionID   string
	StepID        string
	NodeID        string
	TenantID      string
	Attempt       int
	MaxAttempts   int
	Timeout       time.Duration
	StartTime     time.Time
	LastError     error
	Metrics       *StepExecutionMetrics
	CircuitBreaker *CircuitBreaker
}

// StepExecutionMetrics tracks metrics for step execution
type StepExecutionMetrics struct {
	StartTime       time.Time
	EndTime         time.Time
	Duration        time.Duration
	MemoryUsage     int64
	CpuUsage        float64
	NetworkRequests int64
	RetryCount      int
	CircuitBreakerTrips int
}

// Executor handles the execution of individual workflow steps
type Executor struct {
	engine *WorkflowEngine
	logger *zap.Logger
	queue  *queue.MessageQueue
	config *ExecutorConfig
	
	// Concurrency control
	stepSemaphore    *semaphore.Weighted
	
	// Active step tracking
	activeSteps      map[string]*StepExecutionContext
	activeStepsMu    sync.RWMutex
	
	// Circuit breakers per node type
	circuitBreakers  map[string]*CircuitBreaker
	circuitBreakerMu sync.RWMutex
	
	// Health monitoring
	healthTicker     *time.Ticker
	healthStop       chan struct{}
	
	// Metrics
	metrics          *ExecutorMetrics
}

// ExecutorMetrics tracks executor-level metrics
type ExecutorMetrics struct {
	StepsExecuted     int64
	StepsSucceeded    int64
	StepsFailed       int64
	StepsRetried      int64
	StepsTimedOut     int64
	CircuitBreakerTrips int64
	AvgExecutionTime  time.Duration
	mu                sync.RWMutex
}

// NewExecutor creates a new executor instance
func NewExecutor(engine *WorkflowEngine, logger *zap.Logger, queue *queue.MessageQueue) *Executor {
	config := &ExecutorConfig{
		MaxConcurrentSteps:    50,
		DefaultTimeout:        30 * time.Second,
		MaxRetries:            3,
		RetryDelay:            1 * time.Second,
		RetryBackoffFactor:    2.0,
		MaxRetryDelay:         30 * time.Second,
		CircuitBreakerEnabled: true,
		CircuitBreakerConfig: &CircuitBreakerConfig{
			FailureThreshold: 5,
			RecoveryTimeout:  30 * time.Second,
			SuccessThreshold: 3,
			TimeWindow:       60 * time.Second,
		},
		HealthCheckInterval: 30 * time.Second,
	}
	
	// Override with engine config if available
	if engine.config != nil {
		if engine.config.MaxConcurrentSteps > 0 {
			config.MaxConcurrentSteps = engine.config.MaxConcurrentSteps
		}
		if engine.config.DefaultTimeout > 0 {
			config.DefaultTimeout = engine.config.DefaultTimeout
		}
		if engine.config.MaxRetries > 0 {
			config.MaxRetries = engine.config.MaxRetries
		}
		if engine.config.RetryDelay > 0 {
			config.RetryDelay = engine.config.RetryDelay
		}
	}
	
	return &Executor{
		engine:          engine,
		logger:          logger.With(zap.String("component", "executor")),
		queue:           queue,
		config:          config,
		stepSemaphore:   semaphore.NewWeighted(int64(config.MaxConcurrentSteps)),
		activeSteps:     make(map[string]*StepExecutionContext),
		circuitBreakers: make(map[string]*CircuitBreaker),
		healthStop:      make(chan struct{}),
		metrics:         &ExecutorMetrics{},
	}
}

// Start starts the executor
func (e *Executor) Start(ctx context.Context) error {
	e.logger.Info("Starting executor",
		zap.Int("max_concurrent_steps", e.config.MaxConcurrentSteps),
		zap.Duration("default_timeout", e.config.DefaultTimeout),
		zap.Int("max_retries", e.config.MaxRetries),
	)
	
	// Start health monitoring
	if e.config.HealthCheckInterval > 0 {
		e.healthTicker = time.NewTicker(e.config.HealthCheckInterval)
		go e.healthMonitor(ctx)
	}
	
	e.logger.Info("Executor started successfully")
	return nil
}

// Stop stops the executor
func (e *Executor) Stop(ctx context.Context) error {
	e.logger.Info("Stopping executor")
	
	// Stop health monitoring
	if e.healthTicker != nil {
		e.healthTicker.Stop()
		close(e.healthStop)
	}
	
	// Cancel all active steps
	e.activeStepsMu.Lock()
	for stepID, stepCtx := range e.activeSteps {
		e.logger.Debug("Cancelling active step", zap.String("step_id", stepID))
		_ = stepCtx // Avoid unused variable warning
	}
	e.activeStepsMu.Unlock()
	
	// Wait for all steps to complete with timeout
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	
	// Wait for semaphore to be fully released (all steps completed)
	if err := e.stepSemaphore.Acquire(ctx, int64(e.config.MaxConcurrentSteps)); err != nil {
		e.logger.Warn("Timeout waiting for steps to complete", zap.Error(err))
	} else {
		e.stepSemaphore.Release(int64(e.config.MaxConcurrentSteps))
	}
	
	e.logger.Info("Executor stopped successfully")
	return nil
}

// ExecuteStep executes a single workflow step with comprehensive error handling
func (e *Executor) ExecuteStep(
	req *pb.StepExecRequest,
	resultChan chan *StepResult,
	errorChan chan *StepError,
) {
	// Try to acquire semaphore for concurrency control
	ctx := context.Background()
	if err := e.stepSemaphore.Acquire(ctx, 1); err != nil {
		errorChan <- &StepError{
			ExecutionID: req.ExecutionId,
			StepID:      req.StepId,
			Error:       fmt.Errorf("failed to acquire executor semaphore: %w", err),
			Retryable:   true,
		}
		return
	}
	
	go func() {
		defer e.stepSemaphore.Release(1)
		e.executeStepWithRetry(req, resultChan, errorChan)
	}()
}

// executeStepWithRetry handles step execution with retry logic
func (e *Executor) executeStepWithRetry(
	req *pb.StepExecRequest,
	resultChan chan *StepResult,
	errorChan chan *StepError,
) {
	stepCtx := &StepExecutionContext{
		ExecutionID: req.ExecutionId,
		StepID:      req.StepId,
		NodeID:      req.NodeId,
		TenantID:    req.TenantId,
		Attempt:     1,
		MaxAttempts: e.config.MaxRetries + 1,
		Timeout:     e.config.DefaultTimeout,
		StartTime:   time.Now(),
		Metrics:     &StepExecutionMetrics{StartTime: time.Now()},
	}
	
	// Override timeout from request policy if available
	if req.Policy != nil && req.Policy.TimeoutSeconds > 0 {
		stepCtx.Timeout = time.Duration(req.Policy.TimeoutSeconds) * time.Second
	}
	
	// Get or create circuit breaker for this node type
	stepCtx.CircuitBreaker = e.getCircuitBreaker(req.NodeType)
	
	// Track active step
	e.activeStepsMu.Lock()
	e.activeSteps[req.StepId] = stepCtx
	e.activeStepsMu.Unlock()
	
	defer func() {
		e.activeStepsMu.Lock()
		delete(e.activeSteps, req.StepId)
		e.activeStepsMu.Unlock()
		
		// Update metrics
		stepCtx.Metrics.EndTime = time.Now()
		stepCtx.Metrics.Duration = stepCtx.Metrics.EndTime.Sub(stepCtx.Metrics.StartTime)
		e.updateExecutorMetrics(stepCtx)
	}()
	
	// Retry loop
	for stepCtx.Attempt <= stepCtx.MaxAttempts {
		// Check circuit breaker
		if !stepCtx.CircuitBreaker.CanExecute() {
			stepCtx.Metrics.CircuitBreakerTrips++
			errorChan <- &StepError{
				ExecutionID: req.ExecutionId,
				StepID:      req.StepId,
				Error:       fmt.Errorf("circuit breaker is open for node type %s", req.NodeType),
				Retryable:   true,
			}
			return
		}
		
		// Execute step attempt
		result, err := e.executeStepAttempt(req, stepCtx)
		
		if err == nil {
			// Success
			stepCtx.CircuitBreaker.RecordSuccess()
			resultChan <- result
			return
		}
		
		// Record failure
		stepCtx.LastError = err
		stepCtx.CircuitBreaker.RecordFailure()
		
		// Check if error is retryable
		retryable := e.isRetryableError(err)
		
		// If this is the last attempt or error is not retryable, fail
		if stepCtx.Attempt >= stepCtx.MaxAttempts || !retryable {
			errorChan <- &StepError{
				ExecutionID: req.ExecutionId,
				StepID:      req.StepId,
				Error:       err,
				Retryable:   retryable && stepCtx.Attempt < stepCtx.MaxAttempts,
			}
			return
		}
		
		// Calculate retry delay with exponential backoff
		retryDelay := e.calculateRetryDelay(stepCtx.Attempt)
		stepCtx.Metrics.RetryCount++
		
		// Wait before retry
		time.Sleep(retryDelay)
		stepCtx.Attempt++
	}
}

// CircuitBreaker methods
func (cb *CircuitBreaker) CanExecute() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	
	switch cb.state {
	case CircuitBreakerClosed:
		return true
	case CircuitBreakerOpen:
		if time.Since(cb.lastFailure) >= cb.config.RecoveryTimeout {
			cb.state = CircuitBreakerHalfOpen
			cb.successCount = 0
			return true
		}
		return false
	case CircuitBreakerHalfOpen:
		return true
	default:
		return false
	}
}

func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	
	if cb.state == CircuitBreakerHalfOpen {
		cb.successCount++
		if cb.successCount >= cb.config.SuccessThreshold {
			cb.state = CircuitBreakerClosed
			cb.failureCount = 0
			cb.logger.Info("Circuit breaker closed - service recovered")
		}
	} else if cb.state == CircuitBreakerClosed {
		cb.failureCount = 0 // Reset failure count on success
	}
}

func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	
	cb.failureCount++
	cb.lastFailure = time.Now()
	
	if cb.state == CircuitBreakerClosed && cb.failureCount >= cb.config.FailureThreshold {
		cb.state = CircuitBreakerOpen
		cb.logger.Warn("Circuit breaker opened - too many failures",
			zap.Int("failure_count", cb.failureCount),
			zap.Int("threshold", cb.config.FailureThreshold),
		)
	} else if cb.state == CircuitBreakerHalfOpen {
		cb.state = CircuitBreakerOpen
		cb.successCount = 0
		cb.logger.Warn("Circuit breaker opened - failure in half-open state")
	}
}

func (cb *CircuitBreaker) getStateString() string {
	switch cb.state {
	case CircuitBreakerClosed:
		return "closed"
	case CircuitBreakerOpen:
		return "open"
	case CircuitBreakerHalfOpen:
		return "half-open"
	default:
		return "unknown"
	}
}

// executeStepAttempt executes a single attempt of step execution
func (e *Executor) executeStepAttempt(req *pb.StepExecRequest, stepCtx *StepExecutionContext) (*StepResult, error) {
	// Create execution context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), stepCtx.Timeout)
	defer cancel()
	
	// Send step execution request to node runner via queue
	if err := e.queue.PublishStepExecution(req); err != nil {
		return nil, fmt.Errorf("failed to publish step execution: %w", err)
	}
	
	// For now, simulate execution based on node type
	// In production, this would wait for actual response from queue
	result, err := e.simulateStepExecution(ctx, req)
	return result, err
}

// simulateStepExecution simulates step execution (replace with actual queue handling)
func (e *Executor) simulateStepExecution(ctx context.Context, req *pb.StepExecRequest) (*StepResult, error) {
	// Simulate different execution times and failure rates based on node type
	switch req.NodeType {
	case "http":
		time.Sleep(100 * time.Millisecond)
		if time.Now().UnixNano()%10 < 2 { // 20% failure rate
			return nil, fmt.Errorf("HTTP request failed: connection timeout")
		}
	case "database":
		time.Sleep(50 * time.Millisecond)
		if time.Now().UnixNano()%20 < 1 { // 5% failure rate
			return nil, fmt.Errorf("database query failed: connection lost")
		}
	case "transform":
		time.Sleep(25 * time.Millisecond)
	default:
		time.Sleep(50 * time.Millisecond)
	}
	
	// Check for context cancellation
	select {
	case <-ctx.Done():
		return nil, fmt.Errorf("step execution timeout: %w", ctx.Err())
	default:
	}
	
	// Return successful result
	return &StepResult{
		ExecutionID: req.ExecutionId,
		StepID:      req.StepId,
		Status:      models.StepStatusSuccess,
		OutputData:  fmt.Sprintf(`{"result": "step %s completed", "node_type": "%s"}`, req.StepId, req.NodeType),
		Metrics: &ExecutionMetrics{
			Duration: 100, // ms
			Memory:   25,  // MB
			CPU:      15,  // percent
		},
	}, nil
}

// getCircuitBreaker gets or creates a circuit breaker for a node type
func (e *Executor) getCircuitBreaker(nodeType string) *CircuitBreaker {
	e.circuitBreakerMu.Lock()
	defer e.circuitBreakerMu.Unlock()
	
	if cb, exists := e.circuitBreakers[nodeType]; exists {
		return cb
	}
	
	cb := &CircuitBreaker{
		config: e.config.CircuitBreakerConfig,
		state:  CircuitBreakerClosed,
		logger: e.logger.With(zap.String("node_type", nodeType)),
	}
	
	e.circuitBreakers[nodeType] = cb
	return cb
}

// isRetryableError determines if an error is retryable
func (e *Executor) isRetryableError(err error) bool {
	if err == nil {
		return false
	}
	
	errorStr := err.Error()
	retryablePatterns := []string{
		"connection timeout", "connection refused", "connection lost",
		"network unreachable", "temporary failure", "service unavailable",
		"timeout", "rate limit",
	}
	
	for _, pattern := range retryablePatterns {
		if contains(errorStr, pattern) {
			return true
		}
	}
	return false
}

// calculateRetryDelay calculates delay for retry with exponential backoff
func (e *Executor) calculateRetryDelay(attempt int) time.Duration {
	baseDelay := e.config.RetryDelay
	multiplier := 1.0
	
	for i := 1; i < attempt; i++ {
		multiplier *= e.config.RetryBackoffFactor
	}
	
	delay := time.Duration(float64(baseDelay) * multiplier)
	if delay > e.config.MaxRetryDelay {
		delay = e.config.MaxRetryDelay
	}
	return delay
}

// healthMonitor monitors executor health
func (e *Executor) healthMonitor(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-e.healthStop:
			return
		case <-e.healthTicker.C:
			e.performHealthCheck()
		}
	}
}

// performHealthCheck performs health check and logs metrics
func (e *Executor) performHealthCheck() {
	e.activeStepsMu.RLock()
	activeStepCount := len(e.activeSteps)
	e.activeStepsMu.RUnlock()
	
	e.metrics.mu.RLock()
	metrics := *e.metrics
	e.metrics.mu.RUnlock()
	
	e.logger.Info("Executor health check",
		zap.Int("active_steps", activeStepCount),
		zap.Int("max_concurrent_steps", e.config.MaxConcurrentSteps),
		zap.Int64("total_executed", metrics.StepsExecuted),
		zap.Int64("total_succeeded", metrics.StepsSucceeded),
		zap.Int64("total_failed", metrics.StepsFailed),
	)
}

// updateExecutorMetrics updates executor-level metrics
func (e *Executor) updateExecutorMetrics(stepCtx *StepExecutionContext) {
	e.metrics.mu.Lock()
	defer e.metrics.mu.Unlock()
	
	e.metrics.StepsExecuted++
	if stepCtx.LastError == nil {
		e.metrics.StepsSucceeded++
	} else {
		e.metrics.StepsFailed++
	}
	
	if stepCtx.Metrics.RetryCount > 0 {
		e.metrics.StepsRetried++
	}
	
	// Update average execution time
	if e.metrics.StepsExecuted == 1 {
		e.metrics.AvgExecutionTime = stepCtx.Metrics.Duration
	} else {
		totalTime := time.Duration(e.metrics.StepsExecuted-1) * e.metrics.AvgExecutionTime
		totalTime += stepCtx.Metrics.Duration
		e.metrics.AvgExecutionTime = totalTime / time.Duration(e.metrics.StepsExecuted)
	}
}

// contains checks if a string contains a substring
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || 
		(len(s) > len(substr) && 
			(s[:len(substr)] == substr || s[len(s)-len(substr):] == substr || 
				containsSubstring(s, substr))))
}

func containsSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
