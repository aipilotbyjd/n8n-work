
package engine

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"go.uber.org/zap"
	"golang.org/x/sync/semaphore"

	"github.com/n8n-work/engine-go/internal/models"
)

// Scheduler handles workflow scheduling and lifecycle management
type Scheduler struct {
	engine *WorkflowEngine
	logger *zap.Logger
	
	// Scheduling queues
	pendingQueue     chan *ScheduledExecution
	runningQueue     chan *ScheduledExecution
	completedQueue   chan *ScheduledExecution
	
	// Worker pool management
	workerSemaphore  *semaphore.Weighted
	maxWorkers       int
	
	// State management
	scheduledJobs    map[string]*ScheduledExecution
	scheduledJobsMu  sync.RWMutex
	
	// Control channels
	stopChan         chan struct{}
	done             chan struct{}
}

// ScheduledExecution represents a scheduled workflow execution
type ScheduledExecution struct {
	ExecutionID      string
	WorkflowID       string
	TenantID         string
	ScheduledAt      time.Time
	StartAt          time.Time
	Priority         int
	RetryCount       int
	MaxRetries       int
	RetryDelay       time.Duration
	Timeout          time.Duration
	Tags             []string
	Metadata         map[string]interface{}
	Status           ScheduleStatus
	
	// Execution context
	Execution        *ExecutionContext
	
	// Synchronization
	mu               sync.RWMutex
}

// ScheduleStatus represents the status of a scheduled execution
type ScheduleStatus string

const (
	ScheduleStatusPending   ScheduleStatus = "pending"
	ScheduleStatusScheduled ScheduleStatus = "scheduled"
	ScheduleStatusRunning   ScheduleStatus = "running"
	ScheduleStatusCompleted ScheduleStatus = "completed"
	ScheduleStatusFailed    ScheduleStatus = "failed"
	ScheduleStatusCancelled ScheduleStatus = "cancelled"
)

// SchedulerConfig holds scheduler configuration
type SchedulerConfig struct {
	MaxWorkers           int
	SchedulingInterval   time.Duration
	CleanupInterval      time.Duration
	MaxRetries           int
	DefaultRetryDelay    time.Duration
	DefaultTimeout       time.Duration
	PriorityLevels       int
}

// NewScheduler creates a new scheduler instance
func NewScheduler(engine *WorkflowEngine, logger *zap.Logger) *Scheduler {
	maxWorkers := 100 // Default worker pool size
	if engine.config != nil && engine.config.MaxConcurrentExecutions > 0 {
		maxWorkers = engine.config.MaxConcurrentExecutions
	}
	
	return &Scheduler{
		engine:          engine,
		logger:          logger.With(zap.String("component", "scheduler")),
		pendingQueue:    make(chan *ScheduledExecution, 1000),
		runningQueue:    make(chan *ScheduledExecution, 1000),
		completedQueue:  make(chan *ScheduledExecution, 1000),
		workerSemaphore: semaphore.NewWeighted(int64(maxWorkers)),
		maxWorkers:      maxWorkers,
		scheduledJobs:   make(map[string]*ScheduledExecution),
		stopChan:        make(chan struct{}),
		done:            make(chan struct{}),
	}
}

// Start starts the scheduler
func (s *Scheduler) Start(ctx context.Context) error {
	s.logger.Info("Starting DAG scheduler", zap.Int("max_workers", s.maxWorkers))
	
	// Start scheduling goroutines
	go s.schedulingLoop(ctx)
	go s.executionLoop(ctx)
	go s.cleanupLoop(ctx)
	go s.priorityScheduler(ctx)
	
	s.logger.Info("DAG scheduler started successfully")
	return nil
}

// Stop stops the scheduler
func (s *Scheduler) Stop() {
	s.logger.Info("Stopping DAG scheduler")
	
	close(s.stopChan)
	
	// Wait for graceful shutdown
	select {
	case <-s.done:
		s.logger.Info("DAG scheduler stopped gracefully")
	case <-time.After(30 * time.Second):
		s.logger.Warn("DAG scheduler stop timeout")
	}
}

// ScheduleExecution schedules a new workflow execution
func (s *Scheduler) ScheduleExecution(executionID, workflowID, tenantID string, startAt time.Time, options ...ScheduleOption) error {
	scheduled := &ScheduledExecution{
		ExecutionID: executionID,
		WorkflowID:  workflowID,
		TenantID:    tenantID,
		ScheduledAt: time.Now(),
		StartAt:     startAt,
		Priority:    5, // Default priority
		MaxRetries:  3, // Default max retries
		RetryDelay:  30 * time.Second,
		Timeout:     1 * time.Hour,
		Status:      ScheduleStatusPending,
		Metadata:    make(map[string]interface{}),
	}
	
	// Apply options
	for _, opt := range options {
		opt(scheduled)
	}
	
	// Store scheduled execution
	s.scheduledJobsMu.Lock()
	s.scheduledJobs[executionID] = scheduled
	s.scheduledJobsMu.Unlock()
	
	// Add to pending queue
	select {
	case s.pendingQueue <- scheduled:
		s.logger.Debug("Execution scheduled",
			zap.String("execution_id", executionID),
			zap.String("workflow_id", workflowID),
			zap.Time("start_at", startAt),
			zap.Int("priority", scheduled.Priority),
		)
		return nil
	default:
		return fmt.Errorf("scheduler queue full, cannot schedule execution %s", executionID)
	}
}

// schedulingLoop handles the main scheduling logic
func (s *Scheduler) schedulingLoop(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Second) // Check every second
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-s.stopChan:
			return
		case <-ticker.C:
			s.processScheduledExecutions()
		}
	}
}

// processScheduledExecutions processes pending executions that are ready to run
func (s *Scheduler) processScheduledExecutions() {
	now := time.Now()
	var readyExecutions []*ScheduledExecution
	
	// Collect ready executions from pending queue
	for {
		select {
		case scheduled := <-s.pendingQueue:
			if scheduled.StartAt.Before(now) || scheduled.StartAt.Equal(now) {
				readyExecutions = append(readyExecutions, scheduled)
			} else {
				// Put back in queue if not ready
				select {
				case s.pendingQueue <- scheduled:
				default:
					s.logger.Warn("Failed to requeue pending execution", 
						zap.String("execution_id", scheduled.ExecutionID))
				}
			}
		default:
			// No more pending executions
			goto process
		}
	}
	
process:
	if len(readyExecutions) > 0 {
		// Sort by priority (higher number = higher priority)
		sort.Slice(readyExecutions, func(i, j int) bool {
			return readyExecutions[i].Priority > readyExecutions[j].Priority
		})
		
		// Schedule ready executions
		for _, scheduled := range readyExecutions {
			select {
			case s.runningQueue <- scheduled:
				scheduled.Status = ScheduleStatusScheduled
				s.logger.Debug("Execution queued for running",
					zap.String("execution_id", scheduled.ExecutionID),
					zap.Int("priority", scheduled.Priority),
				)
			default:
				// Running queue full, put back in pending
				select {
				case s.pendingQueue <- scheduled:
					scheduled.Status = ScheduleStatusPending
				default:
					s.logger.Error("Failed to requeue execution - queues full",
						zap.String("execution_id", scheduled.ExecutionID))
				}
			}
		}
	}
}

// executionLoop handles the actual execution of scheduled workflows
func (s *Scheduler) executionLoop(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-s.stopChan:
			return
		case scheduled := <-s.runningQueue:
			// Try to acquire worker semaphore
			if s.workerSemaphore.TryAcquire(1) {
				go s.executeWorkflow(ctx, scheduled)
			} else {
				// No workers available, put back in queue
				select {
				case s.runningQueue <- scheduled:
					// Successfully requeued
				default:
					s.logger.Warn("Worker pool full and running queue full",
						zap.String("execution_id", scheduled.ExecutionID))
					// Put back in pending queue as fallback
					select {
					case s.pendingQueue <- scheduled:
						scheduled.Status = ScheduleStatusPending
					default:
						s.logger.Error("All queues full - dropping execution",
							zap.String("execution_id", scheduled.ExecutionID))
					}
				}
			}
		}
	}
}

// executeWorkflow executes a single workflow
func (s *Scheduler) executeWorkflow(ctx context.Context, scheduled *ScheduledExecution) {
	defer s.workerSemaphore.Release(1)
	
	scheduled.mu.Lock()
	scheduled.Status = ScheduleStatusRunning
	scheduled.mu.Unlock()
	
	s.logger.Info("Starting scheduled workflow execution",
		zap.String("execution_id", scheduled.ExecutionID),
		zap.String("workflow_id", scheduled.WorkflowID),
		zap.String("tenant_id", scheduled.TenantID),
	)
	
	// Create execution context with timeout
	executionCtx, cancel := context.WithTimeout(ctx, scheduled.Timeout)
	defer cancel()
	
	// Integrate with workflow engine to actually execute the workflow
	result, err := s.engine.ExecuteWorkflow(executionCtx, &pb.ExecuteWorkflowRequest{
		WorkflowId: scheduled.WorkflowID,
		TenantId:   scheduled.TenantID,
		RunId:      scheduled.ExecutionID,
		Inputs:     scheduled.Inputs,
	})
	
	if err != nil {
		s.logger.Error("Workflow execution failed",
			zap.String("execution_id", scheduled.ExecutionID),
			zap.Error(err),
		)
		
		scheduled.mu.Lock()
		scheduled.Status = ScheduleStatusFailed
		scheduled.mu.Unlock()
		return
	}
	
	// Process execution result
	if !result.Success {
		s.logger.Warn("Workflow execution unsuccessful",
			zap.String("execution_id", scheduled.ExecutionID),
			zap.String("error", result.ErrorMessage),
		)
		
		scheduled.mu.Lock()
		scheduled.Status = ScheduleStatusFailed
		scheduled.mu.Unlock()
	} else {
		s.logger.Info("Workflow execution successful",
			zap.String("execution_id", scheduled.ExecutionID),
		)
	}
	
	// Mark as completed
	scheduled.mu.Lock()
	scheduled.Status = ScheduleStatusCompleted
	scheduled.mu.Unlock()
	
	// Send to completed queue for cleanup
	select {
	case s.completedQueue <- scheduled:
	default:
		s.logger.Warn("Completed queue full", 
			zap.String("execution_id", scheduled.ExecutionID))
	}
	
	s.logger.Info("Scheduled workflow execution completed",
		zap.String("execution_id", scheduled.ExecutionID),
		zap.String("status", string(scheduled.Status)),
	)
}

// priorityScheduler handles priority-based scheduling
func (s *Scheduler) priorityScheduler(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second) // Priority rebalancing every 5 seconds
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-s.stopChan:
			return
		case <-ticker.C:
			s.rebalancePriorities()
		}
	}
}

// rebalancePriorities adjusts execution priorities based on age and tenant
func (s *Scheduler) rebalancePriorities() {
	now := time.Now()
	
	s.scheduledJobsMu.RLock()
	for _, scheduled := range s.scheduledJobs {
		scheduled.mu.Lock()
		
		// Increase priority for older executions
		age := now.Sub(scheduled.ScheduledAt)
		if age > 5*time.Minute && scheduled.Priority < 10 {
			scheduled.Priority++
			s.logger.Debug("Increased execution priority due to age",
				zap.String("execution_id", scheduled.ExecutionID),
				zap.Int("new_priority", scheduled.Priority),
				zap.Duration("age", age),
			)
		}
		
		scheduled.mu.Unlock()
	}
	s.scheduledJobsMu.RUnlock()
}

// cleanupLoop handles cleanup of completed executions
func (s *Scheduler) cleanupLoop(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second) // Cleanup every 30 seconds
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-s.stopChan:
			close(s.done)
			return
		case scheduled := <-s.completedQueue:
			s.cleanupExecution(scheduled)
		case <-ticker.C:
			s.cleanupOldExecutions()
		}
	}
}

// cleanupExecution cleans up a completed execution
func (s *Scheduler) cleanupExecution(scheduled *ScheduledExecution) {
	s.scheduledJobsMu.Lock()
	delete(s.scheduledJobs, scheduled.ExecutionID)
	s.scheduledJobsMu.Unlock()
	
	s.logger.Debug("Cleaned up completed execution",
		zap.String("execution_id", scheduled.ExecutionID),
		zap.String("status", string(scheduled.Status)),
	)
}

// cleanupOldExecutions removes old completed/failed executions
func (s *Scheduler) cleanupOldExecutions() {
	now := time.Now()
	cutoff := now.Add(-1 * time.Hour) // Remove executions older than 1 hour
	
	s.scheduledJobsMu.Lock()
	for id, scheduled := range s.scheduledJobs {
		if scheduled.ScheduledAt.Before(cutoff) && 
			(scheduled.Status == ScheduleStatusCompleted || 
			 scheduled.Status == ScheduleStatusFailed || 
			 scheduled.Status == ScheduleStatusCancelled) {
			delete(s.scheduledJobs, id)
			s.logger.Debug("Cleaned up old execution",
				zap.String("execution_id", id),
				zap.String("status", string(scheduled.Status)),
			)
		}
	}
	s.scheduledJobsMu.Unlock()
}

// GetScheduledExecution returns information about a scheduled execution
func (s *Scheduler) GetScheduledExecution(executionID string) (*ScheduledExecution, bool) {
	s.scheduledJobsMu.RLock()
	defer s.scheduledJobsMu.RUnlock()
	
	scheduled, exists := s.scheduledJobs[executionID]
	return scheduled, exists
}

// GetSchedulerStats returns scheduler statistics
func (s *Scheduler) GetSchedulerStats() map[string]interface{} {
	s.scheduledJobsMu.RLock()
	defer s.scheduledJobsMu.RUnlock()
	
	stats := make(map[string]interface{})
	stats["total_jobs"] = len(s.scheduledJobs)
	stats["pending_queue_size"] = len(s.pendingQueue)
	stats["running_queue_size"] = len(s.runningQueue)
	stats["completed_queue_size"] = len(s.completedQueue)
	stats["max_workers"] = s.maxWorkers
	
	// Count by status
	statusCounts := make(map[ScheduleStatus]int)
	for _, scheduled := range s.scheduledJobs {
		statusCounts[scheduled.Status]++
	}
	stats["status_counts"] = statusCounts
	
	return stats
}

// ScheduleOption allows customization of scheduled executions
type ScheduleOption func(*ScheduledExecution)

// WithPriority sets the execution priority
func WithPriority(priority int) ScheduleOption {
	return func(s *ScheduledExecution) {
		s.Priority = priority
	}
}

// WithRetry sets retry configuration
func WithRetry(maxRetries int, retryDelay time.Duration) ScheduleOption {
	return func(s *ScheduledExecution) {
		s.MaxRetries = maxRetries
		s.RetryDelay = retryDelay
	}
}

// WithTimeout sets execution timeout
func WithTimeout(timeout time.Duration) ScheduleOption {
	return func(s *ScheduledExecution) {
		s.Timeout = timeout
	}
}

// WithTags adds tags to the execution
func WithTags(tags ...string) ScheduleOption {
	return func(s *ScheduledExecution) {
		s.Tags = append(s.Tags, tags...)
	}
}

// WithMetadata adds metadata to the execution
func WithMetadata(key string, value interface{}) ScheduleOption {
	return func(s *ScheduledExecution) {
		s.Metadata[key] = value
	}
}
