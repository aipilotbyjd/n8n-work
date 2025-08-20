package async

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"google.golang.org/protobuf/types/known/timestamppb"

	pb "github.com/n8n-work/proto-contracts/gen/go"
)

type AsyncTaskType string

const (
	TaskTypePolling  AsyncTaskType = "polling"
	TaskTypeWebhook  AsyncTaskType = "webhook"
	TaskTypeWait     AsyncTaskType = "wait"
	TaskTypeSchedule AsyncTaskType = "schedule"
)

type AsyncTaskStatus string

const (
	StatusPending   AsyncTaskStatus = "pending"
	StatusRunning   AsyncTaskStatus = "running"
	StatusCompleted AsyncTaskStatus = "completed"
	StatusFailed    AsyncTaskStatus = "failed"
	StatusCancelled AsyncTaskStatus = "cancelled"
	StatusTimeout   AsyncTaskStatus = "timeout"
)

// AsyncTask represents a long-running asynchronous task
type AsyncTask struct {
	ID           string          `json:"id"`
	ExecutionID  string          `json:"execution_id"`
	NodeID       string          `json:"node_id"`
	StepID       string          `json:"step_id"`
	Type         AsyncTaskType   `json:"type"`
	Status       AsyncTaskStatus `json:"status"`
	Config       TaskConfig      `json:"config"`
	State        TaskState       `json:"state"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
	ExpiresAt    *time.Time      `json:"expires_at,omitempty"`
	CompletedAt  *time.Time      `json:"completed_at,omitempty"`
	ErrorMessage string          `json:"error_message,omitempty"`
	Result       json.RawMessage `json:"result,omitempty"`
}

// TaskConfig holds configuration for different async task types
type TaskConfig struct {
	// Polling configuration
	PollingConfig *PollingConfig `json:"polling_config,omitempty"`
	
	// Webhook configuration
	WebhookConfig *WebhookConfig `json:"webhook_config,omitempty"`
	
	// Wait configuration
	WaitConfig *WaitConfig `json:"wait_config,omitempty"`
	
	// Schedule configuration
	ScheduleConfig *ScheduleConfig `json:"schedule_config,omitempty"`
	
	// General settings
	TimeoutSeconds int    `json:"timeout_seconds"`
	MaxRetries     int    `json:"max_retries"`
	RetryStrategy  string `json:"retry_strategy"`
}

type PollingConfig struct {
	URL             string            `json:"url"`
	Method          string            `json:"method"`
	Headers         map[string]string `json:"headers"`
	Body            json.RawMessage   `json:"body,omitempty"`
	IntervalSeconds int               `json:"interval_seconds"`
	MaxAttempts     int               `json:"max_attempts"`
	SuccessCondition string           `json:"success_condition"` // JSONPath expression
	FailureCondition string           `json:"failure_condition"`
}

type WebhookConfig struct {
	URL        string            `json:"url"`
	Secret     string            `json:"secret"`
	Headers    map[string]string `json:"headers"`
	TimeoutSec int               `json:"timeout_sec"`
}

type WaitConfig struct {
	DurationSeconds int    `json:"duration_seconds"`
	UntilTimestamp  *int64 `json:"until_timestamp,omitempty"`
	Condition       string `json:"condition,omitempty"` // Optional condition to check
}

type ScheduleConfig struct {
	CronExpression string `json:"cron_expression"`
	Timezone       string `json:"timezone"`
	MaxExecutions  int    `json:"max_executions"`
}

// TaskState holds runtime state for async tasks
type TaskState struct {
	CurrentAttempt int                    `json:"current_attempt"`
	NextRetryAt    *time.Time             `json:"next_retry_at,omitempty"`
	LastResponse   json.RawMessage        `json:"last_response,omitempty"`
	Metadata       map[string]interface{} `json:"metadata"`
}

// AsyncManager manages long-running asynchronous tasks
type AsyncManager struct {
	redis         *redis.Client
	logger        *zap.Logger
	tasks         sync.Map // In-memory cache of active tasks
	subscribers   sync.Map // Webhook subscribers
	pollingTicker *time.Ticker
	ctx           context.Context
	cancel        context.CancelFunc
	wg            sync.WaitGroup
}

// NewAsyncManager creates a new async manager
func NewAsyncManager(redisClient *redis.Client, logger *zap.Logger) *AsyncManager {
	ctx, cancel := context.WithCancel(context.Background())
	
	return &AsyncManager{
		redis:  redisClient,
		logger: logger,
		ctx:    ctx,
		cancel: cancel,
	}
}

// Start begins the async manager background processes
func (am *AsyncManager) Start() error {
	am.logger.Info("Starting async manager")
	
	// Start polling goroutine
	am.wg.Add(1)
	go am.runPollingLoop()
	
	// Start webhook cleanup goroutine
	am.wg.Add(1)
	go am.runCleanupLoop()
	
	// Start timeout checker
	am.wg.Add(1)
	go am.runTimeoutChecker()
	
	return nil
}

// Stop gracefully stops the async manager
func (am *AsyncManager) Stop() error {
	am.logger.Info("Stopping async manager")
	am.cancel()
	am.wg.Wait()
	return nil
}

// CreateAsyncTask creates and starts a new async task
func (am *AsyncManager) CreateAsyncTask(executionID, nodeID, stepID string, taskType AsyncTaskType, config TaskConfig) (*AsyncTask, error) {
	taskID := uuid.New().String()
	
	task := &AsyncTask{
		ID:          taskID,
		ExecutionID: executionID,
		NodeID:      nodeID,
		StepID:      stepID,
		Type:        taskType,
		Status:      StatusPending,
		Config:      config,
		State: TaskState{
			CurrentAttempt: 0,
			Metadata:       make(map[string]interface{}),
		},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	
	// Set expiration if timeout is configured
	if config.TimeoutSeconds > 0 {
		expiresAt := time.Now().Add(time.Duration(config.TimeoutSeconds) * time.Second)
		task.ExpiresAt = &expiresAt
	}
	
	// Store in Redis
	if err := am.saveTask(task); err != nil {
		return nil, fmt.Errorf("failed to save task: %w", err)
	}
	
	// Cache in memory
	am.tasks.Store(taskID, task)
	
	// Start the task based on type
	switch taskType {
	case TaskTypePolling:
		go am.handlePollingTask(task)
	case TaskTypeWebhook:
		go am.handleWebhookTask(task)
	case TaskTypeWait:
		go am.handleWaitTask(task)
	case TaskTypeSchedule:
		go am.handleScheduleTask(task)
	}
	
	am.logger.Info("Created async task",
		zap.String("task_id", taskID),
		zap.String("execution_id", executionID),
		zap.String("type", string(taskType)))
	
	return task, nil
}

// CancelAsyncTask cancels a running async task
func (am *AsyncManager) CancelAsyncTask(taskID string) error {
	task, err := am.getTask(taskID)
	if err != nil {
		return err
	}
	
	if task.Status == StatusCompleted || task.Status == StatusFailed || task.Status == StatusCancelled {
		return fmt.Errorf("task %s is already in final state: %s", taskID, task.Status)
	}
	
	task.Status = StatusCancelled
	task.UpdatedAt = time.Now()
	task.CompletedAt = &task.UpdatedAt
	
	if err := am.saveTask(task); err != nil {
		return fmt.Errorf("failed to save cancelled task: %w", err)
	}
	
	am.tasks.Store(taskID, task)
	
	// Notify completion
	am.notifyTaskCompletion(task)
	
	am.logger.Info("Cancelled async task", zap.String("task_id", taskID))
	return nil
}

// GetAsyncTask retrieves an async task by ID
func (am *AsyncManager) GetAsyncTask(taskID string) (*AsyncTask, error) {
	return am.getTask(taskID)
}

// ListAsyncTasks lists async tasks for an execution
func (am *AsyncManager) ListAsyncTasks(executionID string) ([]*AsyncTask, error) {
	pattern := fmt.Sprintf("async_task:execution:%s:*", executionID)
	keys, err := am.redis.Keys(am.ctx, pattern).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get task keys: %w", err)
	}
	
	tasks := make([]*AsyncTask, 0, len(keys))
	for _, key := range keys {
		data, err := am.redis.Get(am.ctx, key).Result()
		if err != nil {
			continue
		}
		
		var task AsyncTask
		if err := json.Unmarshal([]byte(data), &task); err != nil {
			continue
		}
		
		tasks = append(tasks, &task)
	}
	
	return tasks, nil
}

// handlePollingTask handles polling-based async tasks
func (am *AsyncManager) handlePollingTask(task *AsyncTask) {
	am.logger.Info("Starting polling task", zap.String("task_id", task.ID))
	
	config := task.Config.PollingConfig
	if config == nil {
		am.failTask(task, "polling config is nil")
		return
	}
	
	task.Status = StatusRunning
	task.UpdatedAt = time.Now()
	am.saveTask(task)
	
	ticker := time.NewTicker(time.Duration(config.IntervalSeconds) * time.Second)
	defer ticker.Stop()
	
	attempts := 0
	maxAttempts := config.MaxAttempts
	if maxAttempts <= 0 {
		maxAttempts = 100 // Default max attempts
	}
	
	for {
		select {
		case <-am.ctx.Done():
			return
		case <-ticker.C:
			if task.Status != StatusRunning {
				return // Task was cancelled or completed
			}
			
			if task.ExpiresAt != nil && time.Now().After(*task.ExpiresAt) {
				am.timeoutTask(task)
				return
			}
			
			attempts++
			if attempts > maxAttempts {
				am.failTask(task, "exceeded maximum polling attempts")
				return
			}
			
			// Make HTTP request
			success, result, err := am.executePollingRequest(config)
			if err != nil {
				am.logger.Warn("Polling request failed",
					zap.String("task_id", task.ID),
					zap.Error(err))
				continue
			}
			
			task.State.CurrentAttempt = attempts
			task.State.LastResponse = result
			task.UpdatedAt = time.Now()
			am.saveTask(task)
			
			if success {
				am.completeTask(task, result)
				return
			}
		}
	}
}

// handleWebhookTask handles webhook-based async tasks
func (am *AsyncManager) handleWebhookTask(task *AsyncTask) {
	am.logger.Info("Starting webhook task", zap.String("task_id", task.ID))
	
	config := task.Config.WebhookConfig
	if config == nil {
		am.failTask(task, "webhook config is nil")
		return
	}
	
	task.Status = StatusRunning
	task.UpdatedAt = time.Now()
	am.saveTask(task)
	
	// Register webhook endpoint
	webhookPath := fmt.Sprintf("/webhooks/async/%s", task.ID)
	am.subscribers.Store(task.ID, task)
	
	// Set up timeout
	timeout := time.Duration(config.TimeoutSec) * time.Second
	if timeout <= 0 {
		timeout = 1 * time.Hour // Default timeout
	}
	
	timer := time.NewTimer(timeout)
	defer timer.Stop()
	
	select {
	case <-am.ctx.Done():
		am.subscribers.Delete(task.ID)
		return
	case <-timer.C:
		am.subscribers.Delete(task.ID)
		am.timeoutTask(task)
	}
}

// handleWaitTask handles wait-based async tasks
func (am *AsyncManager) handleWaitTask(task *AsyncTask) {
	am.logger.Info("Starting wait task", zap.String("task_id", task.ID))
	
	config := task.Config.WaitConfig
	if config == nil {
		am.failTask(task, "wait config is nil")
		return
	}
	
	task.Status = StatusRunning
	task.UpdatedAt = time.Now()
	am.saveTask(task)
	
	var waitDuration time.Duration
	
	if config.UntilTimestamp != nil {
		targetTime := time.Unix(*config.UntilTimestamp, 0)
		waitDuration = time.Until(targetTime)
	} else {
		waitDuration = time.Duration(config.DurationSeconds) * time.Second
	}
	
	if waitDuration <= 0 {
		am.completeTask(task, json.RawMessage(`{"waited": 0}`))
		return
	}
	
	timer := time.NewTimer(waitDuration)
	defer timer.Stop()
	
	select {
	case <-am.ctx.Done():
		return
	case <-timer.C:
		result := map[string]interface{}{
			"waited":      waitDuration.Seconds(),
			"completed_at": time.Now().Unix(),
		}
		resultJSON, _ := json.Marshal(result)
		am.completeTask(task, resultJSON)
	}
}

// handleScheduleTask handles schedule-based async tasks
func (am *AsyncManager) handleScheduleTask(task *AsyncTask) {
	am.logger.Info("Starting schedule task", zap.String("task_id", task.ID))
	
	config := task.Config.ScheduleConfig
	if config == nil {
		am.failTask(task, "schedule config is nil")
		return
	}
	
	// Implementation would use a cron library here
	// For now, just complete immediately as placeholder
	result := map[string]interface{}{
		"scheduled": true,
		"cron":      config.CronExpression,
	}
	resultJSON, _ := json.Marshal(result)
	am.completeTask(task, resultJSON)
}

// executePollingRequest executes a polling HTTP request
func (am *AsyncManager) executePollingRequest(config *PollingConfig) (bool, json.RawMessage, error) {
	// Placeholder implementation - would use actual HTTP client
	// This should check the success/failure conditions against the response
	
	response := map[string]interface{}{
		"status": "pending", // This would come from actual HTTP response
		"data":   nil,
	}
	
	responseJSON, _ := json.Marshal(response)
	
	// Check success condition (would use JSONPath library)
	if response["status"] == "completed" {
		return true, responseJSON, nil
	}
	
	return false, responseJSON, nil
}

// completeTask marks a task as completed
func (am *AsyncManager) completeTask(task *AsyncTask, result json.RawMessage) {
	task.Status = StatusCompleted
	task.Result = result
	task.UpdatedAt = time.Now()
	task.CompletedAt = &task.UpdatedAt
	
	am.saveTask(task)
	am.tasks.Store(task.ID, task)
	am.notifyTaskCompletion(task)
	
	am.logger.Info("Completed async task", zap.String("task_id", task.ID))
}

// failTask marks a task as failed
func (am *AsyncManager) failTask(task *AsyncTask, errorMsg string) {
	task.Status = StatusFailed
	task.ErrorMessage = errorMsg
	task.UpdatedAt = time.Now()
	task.CompletedAt = &task.UpdatedAt
	
	am.saveTask(task)
	am.tasks.Store(task.ID, task)
	am.notifyTaskCompletion(task)
	
	am.logger.Error("Failed async task",
		zap.String("task_id", task.ID),
		zap.String("error", errorMsg))
}

// timeoutTask marks a task as timed out
func (am *AsyncManager) timeoutTask(task *AsyncTask) {
	task.Status = StatusTimeout
	task.UpdatedAt = time.Now()
	task.CompletedAt = &task.UpdatedAt
	
	am.saveTask(task)
	am.tasks.Store(task.ID, task)
	am.notifyTaskCompletion(task)
	
	am.logger.Warn("Timed out async task", zap.String("task_id", task.ID))
}

// notifyTaskCompletion sends completion notification
func (am *AsyncManager) notifyTaskCompletion(task *AsyncTask) {
	// This would integrate with the workflow engine to continue execution
	stepResult := &pb.StepResult{
		ExecutionId: task.ExecutionID,
		StepId:      task.StepID,
		Status:      pb.StepStatus_STEP_STATUS_COMPLETED,
		Output:      string(task.Result),
		StartTime:   timestamppb.New(task.CreatedAt),
		EndTime:     timestamppb.New(task.UpdatedAt),
	}
	
	if task.Status == StatusFailed || task.Status == StatusTimeout {
		stepResult.Status = pb.StepStatus_STEP_STATUS_FAILED
		stepResult.ErrorMessage = task.ErrorMessage
	} else if task.Status == StatusCancelled {
		stepResult.Status = pb.StepStatus_STEP_STATUS_CANCELLED
	}
	
	// Would send this back to the workflow engine via gRPC or message queue
	am.logger.Info("Notifying task completion",
		zap.String("task_id", task.ID),
		zap.String("status", string(task.Status)))
}

// getTask retrieves a task from Redis or memory cache
func (am *AsyncManager) getTask(taskID string) (*AsyncTask, error) {
	// Check memory cache first
	if cached, ok := am.tasks.Load(taskID); ok {
		return cached.(*AsyncTask), nil
	}
	
	// Load from Redis
	key := fmt.Sprintf("async_task:%s", taskID)
	data, err := am.redis.Get(am.ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, fmt.Errorf("task not found: %s", taskID)
		}
		return nil, fmt.Errorf("failed to get task from Redis: %w", err)
	}
	
	var task AsyncTask
	if err := json.Unmarshal([]byte(data), &task); err != nil {
		return nil, fmt.Errorf("failed to unmarshal task: %w", err)
	}
	
	// Cache in memory
	am.tasks.Store(taskID, &task)
	return &task, nil
}

// saveTask saves a task to Redis
func (am *AsyncManager) saveTask(task *AsyncTask) error {
	data, err := json.Marshal(task)
	if err != nil {
		return fmt.Errorf("failed to marshal task: %w", err)
	}
	
	key := fmt.Sprintf("async_task:%s", task.ID)
	executionKey := fmt.Sprintf("async_task:execution:%s:%s", task.ExecutionID, task.ID)
	
	pipe := am.redis.Pipeline()
	pipe.Set(am.ctx, key, data, 24*time.Hour) // 24 hour TTL
	pipe.Set(am.ctx, executionKey, task.ID, 24*time.Hour)
	
	_, err = pipe.Exec(am.ctx)
	return err
}

// runPollingLoop runs the main polling loop
func (am *AsyncManager) runPollingLoop() {
	defer am.wg.Done()
	
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	
	for {
		select {
		case <-am.ctx.Done():
			return
		case <-ticker.C:
			am.processPollingTasks()
		}
	}
}

// runCleanupLoop cleans up expired tasks
func (am *AsyncManager) runCleanupLoop() {
	defer am.wg.Done()
	
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	
	for {
		select {
		case <-am.ctx.Done():
			return
		case <-ticker.C:
			am.cleanupExpiredTasks()
		}
	}
}

// runTimeoutChecker checks for timed out tasks
func (am *AsyncManager) runTimeoutChecker() {
	defer am.wg.Done()
	
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	
	for {
		select {
		case <-am.ctx.Done():
			return
		case <-ticker.C:
			am.checkTaskTimeouts()
		}
	}
}

// processPollingTasks processes active polling tasks
func (am *AsyncManager) processPollingTasks() {
	// Implementation would iterate through active polling tasks
	// and check if they need to be polled
}

// cleanupExpiredTasks removes expired tasks from storage
func (am *AsyncManager) cleanupExpiredTasks() {
	// Implementation would find and remove expired tasks
}

// checkTaskTimeouts checks for tasks that have exceeded their timeout
func (am *AsyncManager) checkTaskTimeouts() {
	am.tasks.Range(func(key, value interface{}) bool {
		task := value.(*AsyncTask)
		if task.ExpiresAt != nil && time.Now().After(*task.ExpiresAt) {
			if task.Status == StatusRunning || task.Status == StatusPending {
				am.timeoutTask(task)
			}
		}
		return true
	})
}
