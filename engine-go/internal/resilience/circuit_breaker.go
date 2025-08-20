package resilience

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"go.uber.org/zap"
)

// CircuitBreakerState represents the current state of a circuit breaker
type CircuitBreakerState int

const (
	StateClosed CircuitBreakerState = iota
	StateHalfOpen
	StateOpen
)

func (s CircuitBreakerState) String() string {
	switch s {
	case StateClosed:
		return "closed"
	case StateHalfOpen:
		return "half-open"
	case StateOpen:
		return "open"
	default:
		return "unknown"
	}
}

// CircuitBreakerConfig holds configuration for a circuit breaker
type CircuitBreakerConfig struct {
	Name                string
	MaxRequests         uint32        // Maximum requests allowed when half-open
	Interval            time.Duration // Statistical window
	Timeout             time.Duration // Time to wait before half-open
	ReadyToTrip         ReadyToTripFunc
	OnStateChange       OnStateChangeFunc
	IsSuccessful        IsSuccessfulFunc
	ShouldTrip          ShouldTripFunc
	MaxConcurrentCalls  int32
	SlowCallThreshold   time.Duration
	SlowCallRateThreshold float64
	MinimumThroughputThreshold uint32
}

// ReadyToTripFunc determines if the circuit breaker should trip to open state
type ReadyToTripFunc func(counts Counts) bool

// OnStateChangeFunc is called when the circuit breaker changes state
type OnStateChangeFunc func(name string, from, to CircuitBreakerState)

// IsSuccessfulFunc determines if a call is successful
type IsSuccessfulFunc func(err error) bool

// ShouldTripFunc determines if the circuit breaker should trip based on metrics
type ShouldTripFunc func(metrics CircuitBreakerMetrics) bool

// Counts holds the number of requests and their results
type Counts struct {
	Requests             uint32
	TotalSuccesses       uint32
	TotalFailures        uint32
	ConsecutiveSuccesses uint32
	ConsecutiveFailures  uint32
	SlowCalls            uint32
}

// CircuitBreakerMetrics holds detailed metrics for the circuit breaker
type CircuitBreakerMetrics struct {
	Name                 string
	State                CircuitBreakerState
	Counts               Counts
	FailureRate          float64
	SlowCallRate         float64
	AverageResponseTime  time.Duration
	TotalDuration        time.Duration
	LastFailureTime      time.Time
	LastSuccessTime      time.Time
}

// CircuitBreaker implements the circuit breaker pattern with advanced features
type CircuitBreaker struct {
	name                   string
	maxRequests            uint32
	interval               time.Duration
	timeout                time.Duration
	readyToTrip            ReadyToTripFunc
	onStateChange          OnStateChangeFunc
	isSuccessful           IsSuccessfulFunc
	shouldTrip             ShouldTripFunc
	maxConcurrentCalls     int32
	slowCallThreshold      time.Duration
	slowCallRateThreshold  float64
	minThroughputThreshold uint32

	mutex      sync.Mutex
	state      CircuitBreakerState
	generation uint64
	counts     Counts
	expiry     time.Time

	// Concurrency control
	concurrentCalls int32

	// Metrics
	totalDuration   time.Duration
	lastFailure     time.Time
	lastSuccess     time.Time
	responseTimeSum int64
	responseTimeCount int64

	logger *zap.Logger
}

// NewCircuitBreaker creates a new circuit breaker with the given configuration
func NewCircuitBreaker(config CircuitBreakerConfig, logger *zap.Logger) *CircuitBreaker {
	cb := &CircuitBreaker{
		name:                   config.Name,
		maxRequests:            config.MaxRequests,
		interval:               config.Interval,
		timeout:                config.Timeout,
		readyToTrip:            config.ReadyToTrip,
		onStateChange:          config.OnStateChange,
		isSuccessful:           config.IsSuccessful,
		shouldTrip:             config.ShouldTrip,
		maxConcurrentCalls:     config.MaxConcurrentCalls,
		slowCallThreshold:      config.SlowCallThreshold,
		slowCallRateThreshold:  config.SlowCallRateThreshold,
		minThroughputThreshold: config.MinimumThroughputThreshold,
		state:                  StateClosed,
		logger:                 logger.With(zap.String("component", "circuit_breaker"), zap.String("name", config.Name)),
	}

	// Set default functions if not provided
	if cb.readyToTrip == nil {
		cb.readyToTrip = defaultReadyToTrip
	}
	if cb.isSuccessful == nil {
		cb.isSuccessful = defaultIsSuccessful
	}
	if cb.shouldTrip == nil {
		cb.shouldTrip = defaultShouldTrip
	}

	cb.logger.Info("Circuit breaker created",
		zap.String("state", cb.state.String()),
		zap.Uint32("max_requests", cb.maxRequests),
		zap.Duration("interval", cb.interval),
		zap.Duration("timeout", cb.timeout),
	)

	return cb
}

// Execute runs the given function if the circuit breaker allows it
func (cb *CircuitBreaker) Execute(fn func() (interface{}, error)) (interface{}, error) {
	ctx := context.Background()
	return cb.ExecuteWithContext(ctx, func(ctx context.Context) (interface{}, error) {
		return fn()
	})
}

// ExecuteWithContext runs the given function with context if the circuit breaker allows it
func (cb *CircuitBreaker) ExecuteWithContext(ctx context.Context, fn func(context.Context) (interface{}, error)) (interface{}, error) {
	// Check if we can make the call
	generation, err := cb.beforeCall()
	if err != nil {
		return nil, err
	}

	// Track concurrent calls
	current := atomic.AddInt32(&cb.concurrentCalls, 1)
	defer atomic.AddInt32(&cb.concurrentCalls, -1)

	// Check concurrent call limit
	if cb.maxConcurrentCalls > 0 && current > cb.maxConcurrentCalls {
		cb.logger.Warn("Concurrent call limit exceeded",
			zap.Int32("current", current),
			zap.Int32("limit", cb.maxConcurrentCalls),
		)
		return nil, errors.New("circuit breaker: concurrent call limit exceeded")
	}

	// Execute the function with timing
	start := time.Now()
	result, callErr := fn(ctx)
	duration := time.Since(start)

	// Record the result
	cb.afterCall(generation, callErr, duration)

	return result, callErr
}

// beforeCall checks if the circuit breaker allows the call
func (cb *CircuitBreaker) beforeCall() (uint64, error) {
	cb.mutex.Lock()
	defer cb.mutex.Unlock()

	now := time.Now()
	state, generation := cb.currentState(now)

	switch state {
	case StateClosed:
		// Circuit is closed, allow the call
		return generation, nil
	case StateOpen:
		// Circuit is open, reject the call
		return generation, fmt.Errorf("circuit breaker '%s' is open", cb.name)
	default: // StateHalfOpen
		// Circuit is half-open, allow limited calls
		if cb.counts.Requests >= cb.maxRequests {
			return generation, fmt.Errorf("circuit breaker '%s' is half-open and too many requests", cb.name)
		}
		return generation, nil
	}
}

// afterCall records the result of the call
func (cb *CircuitBreaker) afterCall(before uint64, err error, duration time.Duration) {
	cb.mutex.Lock()
	defer cb.mutex.Unlock()

	now := time.Now()
	state, generation := cb.currentState(now)
	
	// If generation has changed, ignore this result
	if generation != before {
		return
	}

	// Update response time metrics
	atomic.AddInt64(&cb.responseTimeSum, int64(duration))
	atomic.AddInt64(&cb.responseTimeCount, 1)

	// Determine if the call was successful
	success := cb.isSuccessful(err)
	
	// Check if it was a slow call
	slowCall := duration >= cb.slowCallThreshold

	// Update counts
	cb.counts.Requests++
	if success {
		cb.onSuccess(state)
		cb.lastSuccess = now
	} else {
		cb.onFailure(state)
		cb.lastFailure = now
	}

	if slowCall {
		cb.counts.SlowCalls++
	}

	cb.totalDuration += duration

	// Check if we should change state
	cb.checkStateTransition(state, now)
}

// onSuccess handles a successful call
func (cb *CircuitBreaker) onSuccess(state CircuitBreakerState) {
	cb.counts.TotalSuccesses++
	cb.counts.ConsecutiveSuccesses++
	cb.counts.ConsecutiveFailures = 0
}

// onFailure handles a failed call
func (cb *CircuitBreaker) onFailure(state CircuitBreakerState) {
	cb.counts.TotalFailures++
	cb.counts.ConsecutiveFailures++
	cb.counts.ConsecutiveSuccesses = 0
}

// currentState returns the current state and generation
func (cb *CircuitBreaker) currentState(now time.Time) (CircuitBreakerState, uint64) {
	switch cb.state {
	case StateClosed:
		if !cb.expiry.IsZero() && cb.expiry.Before(now) {
			cb.toNewGeneration(now)
		}
	case StateOpen:
		if cb.expiry.Before(now) {
			cb.setState(StateHalfOpen, now)
		}
	}
	return cb.state, cb.generation
}

// checkStateTransition checks if the state should be changed
func (cb *CircuitBreaker) checkStateTransition(state CircuitBreakerState, now time.Time) {
	switch state {
	case StateClosed:
		if cb.shouldTripToOpen() {
			cb.setState(StateOpen, now)
		}
	case StateHalfOpen:
		if cb.counts.ConsecutiveFailures > 0 {
			// Any failure in half-open state trips to open
			cb.setState(StateOpen, now)
		} else if cb.counts.ConsecutiveSuccesses >= cb.maxRequests {
			// Enough successes to close the circuit
			cb.setState(StateClosed, now)
		}
	}
}

// shouldTripToOpen determines if the circuit should trip to open state
func (cb *CircuitBreaker) shouldTripToOpen() bool {
	// Check minimum throughput threshold
	if cb.counts.Requests < cb.minThroughputThreshold {
		return false
	}

	// Use custom trip function if provided
	if cb.shouldTrip != nil {
		metrics := cb.GetMetrics()
		return cb.shouldTrip(metrics)
	}

	// Use ready to trip function
	return cb.readyToTrip(cb.counts)
}

// setState changes the state of the circuit breaker
func (cb *CircuitBreaker) setState(state CircuitBreakerState, now time.Time) {
	if cb.state == state {
		return
	}

	prev := cb.state
	cb.state = state

	cb.toNewGeneration(now)

	// Set timeout for open state
	if state == StateOpen {
		cb.expiry = now.Add(cb.timeout)
	} else {
		cb.expiry = time.Time{}
	}

	// Call state change callback
	if cb.onStateChange != nil {
		cb.onStateChange(cb.name, prev, state)
	}

	cb.logger.Info("Circuit breaker state changed",
		zap.String("from", prev.String()),
		zap.String("to", state.String()),
		zap.Uint32("requests", cb.counts.Requests),
		zap.Uint32("failures", cb.counts.TotalFailures),
		zap.Float64("failure_rate", cb.getFailureRate()),
	)
}

// toNewGeneration moves to a new generation
func (cb *CircuitBreaker) toNewGeneration(now time.Time) {
	cb.generation++
	cb.counts = Counts{}
	
	// Reset statistical window
	if cb.interval > 0 {
		cb.expiry = now.Add(cb.interval)
	}

	// Reset response time metrics
	atomic.StoreInt64(&cb.responseTimeSum, 0)
	atomic.StoreInt64(&cb.responseTimeCount, 0)
	cb.totalDuration = 0
}

// GetMetrics returns current metrics
func (cb *CircuitBreaker) GetMetrics() CircuitBreakerMetrics {
	cb.mutex.Lock()
	defer cb.mutex.Unlock()

	now := time.Now()
	state, _ := cb.currentState(now)

	return CircuitBreakerMetrics{
		Name:                cb.name,
		State:               state,
		Counts:              cb.counts,
		FailureRate:         cb.getFailureRate(),
		SlowCallRate:        cb.getSlowCallRate(),
		AverageResponseTime: cb.getAverageResponseTime(),
		TotalDuration:       cb.totalDuration,
		LastFailureTime:     cb.lastFailure,
		LastSuccessTime:     cb.lastSuccess,
	}
}

// GetState returns the current state
func (cb *CircuitBreaker) GetState() CircuitBreakerState {
	cb.mutex.Lock()
	defer cb.mutex.Unlock()

	now := time.Now()
	state, _ := cb.currentState(now)
	return state
}

// GetName returns the circuit breaker name
func (cb *CircuitBreaker) GetName() string {
	return cb.name
}

// Reset resets the circuit breaker to closed state
func (cb *CircuitBreaker) Reset() {
	cb.mutex.Lock()
	defer cb.mutex.Unlock()

	cb.toNewGeneration(time.Now())
	cb.setState(StateClosed, time.Now())
	
	cb.logger.Info("Circuit breaker reset")
}

// helper methods

func (cb *CircuitBreaker) getFailureRate() float64 {
	if cb.counts.Requests == 0 {
		return 0.0
	}
	return float64(cb.counts.TotalFailures) / float64(cb.counts.Requests)
}

func (cb *CircuitBreaker) getSlowCallRate() float64 {
	if cb.counts.Requests == 0 {
		return 0.0
	}
	return float64(cb.counts.SlowCalls) / float64(cb.counts.Requests)
}

func (cb *CircuitBreaker) getAverageResponseTime() time.Duration {
	count := atomic.LoadInt64(&cb.responseTimeCount)
	if count == 0 {
		return 0
	}
	sum := atomic.LoadInt64(&cb.responseTimeSum)
	return time.Duration(sum / count)
}

// Default implementations

func defaultReadyToTrip(counts Counts) bool {
	return counts.ConsecutiveFailures > 5
}

func defaultIsSuccessful(err error) bool {
	return err == nil
}

func defaultShouldTrip(metrics CircuitBreakerMetrics) bool {
	// Trip if failure rate > 50% and minimum throughput is met
	return metrics.FailureRate > 0.5 && metrics.Counts.Requests >= 10
}

// CircuitBreakerManager manages multiple circuit breakers
type CircuitBreakerManager struct {
	breakers map[string]*CircuitBreaker
	mutex    sync.RWMutex
	logger   *zap.Logger
}

// NewCircuitBreakerManager creates a new circuit breaker manager
func NewCircuitBreakerManager(logger *zap.Logger) *CircuitBreakerManager {
	return &CircuitBreakerManager{
		breakers: make(map[string]*CircuitBreaker),
		logger:   logger.With(zap.String("component", "circuit_breaker_manager")),
	}
}

// GetOrCreate gets an existing circuit breaker or creates a new one
func (cbm *CircuitBreakerManager) GetOrCreate(name string, config CircuitBreakerConfig) *CircuitBreaker {
	cbm.mutex.Lock()
	defer cbm.mutex.Unlock()

	if cb, exists := cbm.breakers[name]; exists {
		return cb
	}

	config.Name = name
	cb := NewCircuitBreaker(config, cbm.logger)
	cbm.breakers[name] = cb

	return cb
}

// GetCircuitBreaker gets a circuit breaker by name
func (cbm *CircuitBreakerManager) GetCircuitBreaker(name string) (*CircuitBreaker, bool) {
	cbm.mutex.RLock()
	defer cbm.mutex.RUnlock()

	cb, exists := cbm.breakers[name]
	return cb, exists
}

// GetAllMetrics returns metrics for all circuit breakers
func (cbm *CircuitBreakerManager) GetAllMetrics() map[string]CircuitBreakerMetrics {
	cbm.mutex.RLock()
	defer cbm.mutex.RUnlock()

	metrics := make(map[string]CircuitBreakerMetrics)
	for name, cb := range cbm.breakers {
		metrics[name] = cb.GetMetrics()
	}

	return metrics
}

// RemoveCircuitBreaker removes a circuit breaker
func (cbm *CircuitBreakerManager) RemoveCircuitBreaker(name string) {
	cbm.mutex.Lock()
	defer cbm.mutex.Unlock()

	delete(cbm.breakers, name)
	cbm.logger.Info("Circuit breaker removed", zap.String("name", name))
}
