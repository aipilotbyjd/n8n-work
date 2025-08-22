package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"go.uber.org/zap"
	"golang.org/x/sync/semaphore"

	pb "github.com/n8n-work/engine-go/proto"
	"github.com/n8n-work/engine-go/internal/models"
	"github.com/n8n-work/engine-go/internal/queue"
	"github.com/n8n-work/engine-go/internal/storage"
)

// WorkflowEngine handles the orchestration and execution of workflows
type WorkflowEngine struct {
	logger    *zap.Logger
	db        *storage.Database
	queue     *queue.MessageQueue
	scheduler *Scheduler
	executor  *Executor
	
	// Execution management
	executions     map[string]*ExecutionContext
	executionsMu   sync.RWMutex
	
	// Rate limiting and resource management
	tenantSemaphores map[string]*semaphore.Weighted
	tenantMu         sync.RWMutex
	
	// Configuration
	config *Config
	
	// Metrics
	metrics *Metrics
}

// ExecutionContext holds the state and context for a workflow execution
type ExecutionContext struct {
	ID            string
	WorkflowID    string
	TenantID      string
	Status        models.ExecutionStatus
	StartedAt     time.Time
	CompletedAt   *time.Time
	Context       map[string]interface{}
	TriggerData   string
	
	// DAG state
	DAG           *models.DAG
	StepStates    map[string]*StepState
	CompletedSteps int
	FailedSteps   int
	
	// Execution control
	ctx        context.Context
	cancel     context.CancelFunc
	
	// Channels for coordination
	stepResults   chan *StepResult
	stepErrors    chan *StepError
	
	// Synchronization
	mu sync.RWMutex
}

// StepState represents the state of an individual step
type StepState struct {
	StepID      string
	NodeID      string
	Status      models.StepStatus
	StartedAt   time.Time
	CompletedAt *time.Time
	InputData   string
	OutputData  string
	ErrorMsg    string
	RetryCount  int
	
	// Dependencies tracking
	Dependencies    []string
	DependenciesMet bool
}

// StepResult represents the result of step execution
type StepResult struct {
	ExecutionID string
	StepID      string
	Status      models.StepStatus
	OutputData  string
	Metrics     *ExecutionMetrics
}

// StepError represents an error during step execution
type StepError struct {
	ExecutionID string
	StepID      string
	Error       error
	Retryable   bool
}

// Config holds engine configuration
type Config struct {
	MaxConcurrentExecutions int
	MaxConcurrentSteps      int
	DefaultTimeout          time.Duration
	RetryDelay              time.Duration
	MaxRetries              int
	TenantRateLimits        map[string]int
}

// NewWorkflowEngine creates a new workflow engine instance
func NewWorkflowEngine(
	logger *zap.Logger,
	db *storage.Database,
	queue *queue.MessageQueue,
	config *Config,
) *WorkflowEngine {
	engine := &WorkflowEngine{
		logger:           logger.With(zap.String("component", "workflow-engine")),
		db:               db,
		queue:            queue,
		config:           config,
		executions:       make(map[string]*ExecutionContext),
		tenantSemaphores: make(map[string]*semaphore.Weighted),
		metrics:          NewMetrics(),
	}
	
	engine.scheduler = NewScheduler(engine, logger)
	engine.executor = NewExecutor(engine, logger, queue)
	
	return engine
}

// Start starts the workflow engine
func (e *WorkflowEngine) Start(ctx context.Context) error {
	e.logger.Info("Starting workflow engine")
	
	// Start internal components
	if err := e.scheduler.Start(ctx); err != nil {
		return fmt.Errorf("failed to start scheduler: %w", err)
	}
	
	if err := e.executor.Start(ctx); err != nil {
		return fmt.Errorf("failed to start executor: %w", err)
	}
	
	// Start processing step results
	go e.processStepResults(ctx)
	
	e.logger.Info("Workflow engine started successfully")
	return nil
}

// Stop stops the workflow engine gracefully
func (e *WorkflowEngine) Stop(ctx context.Context) error {
	e.logger.Info("Stopping workflow engine")
	
	// Cancel all active executions
	e.executionsMu.Lock()
	for _, execution := range e.executions {
		execution.cancel()
	}
	e.executionsMu.Unlock()
	
	// Stop internal components
	e.scheduler.Stop()
	e.executor.Stop(ctx)
	
	e.logger.Info("Workflow engine stopped successfully")
	return nil
}

// RunWorkflow starts a new workflow execution
func (e *WorkflowEngine) RunWorkflow(ctx context.Context, req *pb.RunWorkflowRequest) (*pb.RunWorkflowResponse, error) {
	e.logger.Info("Starting workflow execution",
		zap.String("execution_id", req.ExecutionId),
		zap.String("workflow_id", req.Workflow.Id),
		zap.String("tenant_id", req.TenantId),
	)
	
	// Check tenant rate limits
	if err := e.checkTenantRateLimit(req.TenantId); err != nil {
		e.metrics.IncrementExecutionsFailed(req.TenantId, "rate_limit_exceeded")
		return &pb.RunWorkflowResponse{
			Success:      false,
			ErrorMessage: err.Error(),
		}, nil
	}
	
	// Convert protobuf workflow to internal DAG
	dag, err := e.convertWorkflowToDAG(req.Workflow)
	if err != nil {
		e.metrics.IncrementExecutionsFailed(req.TenantId, "conversion_failed")
		return &pb.RunWorkflowResponse{
			Success:      false,
			ErrorMessage: fmt.Sprintf("Failed to convert workflow to DAG: %v", err),
		}, nil
	}
	
	// Validate DAG
	if err := e.validateDAG(dag); err != nil {
		e.metrics.IncrementExecutionsFailed(req.TenantId, "validation_failed")
		return &pb.RunWorkflowResponse{
			Success:      false,
			ErrorMessage: fmt.Sprintf("DAG validation failed: %v", err),
		}, nil
	}
	
	// Create execution context
	executionCtx, cancel := context.WithTimeout(ctx, time.Duration(req.Config.TimeoutSeconds)*time.Second)
	execution := &ExecutionContext{
		ID:          req.ExecutionId,
		WorkflowID:  req.Workflow.Id,
		TenantID:    req.TenantId,
		Status:      models.ExecutionStatusRunning,
		StartedAt:   time.Now(),
		Context:     convertMapStringString(req.Context),
		TriggerData: req.TriggerData,
		DAG:         dag,
		StepStates:  make(map[string]*StepState),
		ctx:         executionCtx,
		cancel:      cancel,
		stepResults: make(chan *StepResult, 100),
		stepErrors:  make(chan *StepError, 100),
	}
	
	// Initialize step states
	for _, node := range dag.Nodes {
		stepID := fmt.Sprintf("%s_%s", req.ExecutionId, node.ID)
		execution.StepStates[stepID] = &StepState{
			StepID:          stepID,
			NodeID:          node.ID,
			Status:          models.StepStatusPending,
			Dependencies:    node.Dependencies,
			DependenciesMet: len(node.Dependencies) == 0,
		}
	}
	
	// Store execution
	e.executionsMu.Lock()
	e.executions[req.ExecutionId] = execution
	e.executionsMu.Unlock()
	
	// Save execution to database
	if err := e.saveExecution(execution); err != nil {
		e.logger.Error("Failed to save execution to database", zap.Error(err))
	}
	
	// Start execution processing
	go e.processExecution(execution)
	
	// Get initial schedulable steps
	scheduledSteps := e.getSchedulableSteps(execution)
	
	e.metrics.IncrementExecutionsStarted(req.TenantId)
	
	return &pb.RunWorkflowResponse{
		ExecutionId:    req.ExecutionId,
		Success:        true,
		ScheduledSteps: scheduledSteps,
	}, nil
}

// processExecution handles the execution lifecycle of a workflow
func (e *WorkflowEngine) processExecution(execution *ExecutionContext) {
	defer func() {
		execution.cancel()
		e.executionsMu.Lock()
		delete(e.executions, execution.ID)
		e.executionsMu.Unlock()
	}()
	
	e.logger.Info("Processing execution", zap.String("execution_id", execution.ID))
	
	// Schedule initial steps
	e.scheduleReadySteps(execution)
	
	// Main execution loop
	for {
		select {
		case <-execution.ctx.Done():
			e.logger.Info("Execution context cancelled", zap.String("execution_id", execution.ID))
			execution.Status = models.ExecutionStatusCancelled
			e.finalizeExecution(execution)
			return
			
		case result := <-execution.stepResults:
			e.handleStepResult(execution, result)
			
		case stepErr := <-execution.stepErrors:
			e.handleStepError(execution, stepErr)
		}
		
		// Check if execution is complete
		if e.isExecutionComplete(execution) {
			e.finalizeExecution(execution)
			return
		}
		
		// Schedule any newly ready steps
		e.scheduleReadySteps(execution)
	}
}

// handleStepResult processes a completed step result
func (e *WorkflowEngine) handleStepResult(execution *ExecutionContext, result *StepResult) {
	execution.mu.Lock()
	defer execution.mu.Unlock()
	
	step, exists := execution.StepStates[result.StepID]
	if !exists {
		e.logger.Error("Received result for unknown step",
			zap.String("execution_id", execution.ID),
			zap.String("step_id", result.StepID),
		)
		return
	}
	
	// Update step state
	now := time.Now()
	step.Status = result.Status
	step.CompletedAt = &now
	step.OutputData = result.OutputData
	
	// Update execution counters
	if result.Status == models.StepStatusSuccess {
		execution.CompletedSteps++
		e.metrics.IncrementStepsCompleted(execution.TenantID, "success")
	} else {
		execution.FailedSteps++
		e.metrics.IncrementStepsCompleted(execution.TenantID, "failed")
	}
	
	// Update dependent steps
	e.updateDependentSteps(execution, step.NodeID)
	
	// Save step state to database
	if err := e.saveStepState(step); err != nil {
		e.logger.Error("Failed to save step state", zap.Error(err))
	}
	
	e.logger.Debug("Step completed",
		zap.String("execution_id", execution.ID),
		zap.String("step_id", result.StepID),
		zap.String("status", string(result.Status)),
	)
}

// handleStepError processes a step execution error
func (e *WorkflowEngine) handleStepError(execution *ExecutionContext, stepErr *StepError) {
	execution.mu.Lock()
	defer execution.mu.Unlock()
	
	step, exists := execution.StepStates[stepErr.StepID]
	if !exists {
		e.logger.Error("Received error for unknown step",
			zap.String("execution_id", execution.ID),
			zap.String("step_id", stepErr.StepID),
		)
		return
	}
	
	step.ErrorMsg = stepErr.Error.Error()
	step.RetryCount++
	
	// Check if we should retry
	if stepErr.Retryable && step.RetryCount < e.config.MaxRetries {
		e.logger.Info("Retrying failed step",
			zap.String("execution_id", execution.ID),
			zap.String("step_id", stepErr.StepID),
			zap.Int("retry_count", step.RetryCount),
		)
		
		// Schedule retry after delay
		go func() {
			time.Sleep(e.config.RetryDelay)
			e.scheduleStep(execution, step)
		}()
		
		return
	}
	
	// Mark step as failed
	now := time.Now()
	step.Status = models.StepStatusFailed
	step.CompletedAt = &now
	execution.FailedSteps++
	
	e.metrics.IncrementStepsCompleted(execution.TenantID, "failed")
	
	e.logger.Error("Step failed permanently",
		zap.String("execution_id", execution.ID),
		zap.String("step_id", stepErr.StepID),
		zap.Error(stepErr.Error),
		zap.Int("retry_count", step.RetryCount),
	)
}

// scheduleReadySteps finds and schedules all steps that are ready to execute
func (e *WorkflowEngine) scheduleReadySteps(execution *ExecutionContext) {
	execution.mu.RLock()
	defer execution.mu.RUnlock()
	
	for _, step := range execution.StepStates {
		if step.Status == models.StepStatusPending && step.DependenciesMet {
			go e.scheduleStep(execution, step)
		}
	}
}

// scheduleStep schedules a single step for execution
func (e *WorkflowEngine) scheduleStep(execution *ExecutionContext, step *StepState) {
	// Find the node definition
	var node *models.Node
	for _, n := range execution.DAG.Nodes {
		if n.ID == step.NodeID {
			node = n
			break
		}
	}
	
	if node == nil {
		e.logger.Error("Node definition not found",
			zap.String("execution_id", execution.ID),
			zap.String("node_id", step.NodeID),
		)
		return
	}
	
	// Update step status
	step.Status = models.StepStatusRunning
	step.StartedAt = time.Now()
	
	// Prepare step execution request
	stepReq := &pb.StepExecRequest{
		ExecutionId: execution.ID,
		StepId:      step.StepID,
		NodeId:      node.ID,
		NodeType:    node.Type,
		Parameters:  node.Parameters,
		InputData:   e.prepareStepInput(execution, step),
		Policy:      convertNodePolicy(node.Policy),
		TenantId:    execution.TenantID,
	}
	
	// Send to executor
	e.executor.ExecuteStep(stepReq, execution.stepResults, execution.stepErrors)
	
	e.logger.Debug("Step scheduled",
		zap.String("execution_id", execution.ID),
		zap.String("step_id", step.StepID),
		zap.String("node_type", node.Type),
	)
}

// updateDependentSteps checks and updates the dependency status of dependent steps
func (e *WorkflowEngine) updateDependentSteps(execution *ExecutionContext, completedNodeID string) {
	for _, step := range execution.StepStates {
		if step.Status == models.StepStatusPending && !step.DependenciesMet {
			// Check if all dependencies are met
			allMet := true
			for _, depNodeID := range step.Dependencies {
				depMet := false
				for _, otherStep := range execution.StepStates {
					if otherStep.NodeID == depNodeID && otherStep.Status == models.StepStatusSuccess {
						depMet = true
						break
					}
				}
				if !depMet {
					allMet = false
					break
				}
			}
			step.DependenciesMet = allMet
		}
	}
}

// isExecutionComplete checks if the workflow execution is complete
func (e *WorkflowEngine) isExecutionComplete(execution *ExecutionContext) bool {
	execution.mu.RLock()
	defer execution.mu.RUnlock()
	
	totalSteps := len(execution.StepStates)
	completedSteps := execution.CompletedSteps + execution.FailedSteps
	
	return completedSteps >= totalSteps
}

// finalizeExecution finalizes the execution and updates status
func (e *WorkflowEngine) finalizeExecution(execution *ExecutionContext) {
	execution.mu.Lock()
	defer execution.mu.Unlock()
	
	now := time.Now()
	execution.CompletedAt = &now
	
	// Determine final status
	if execution.FailedSteps > 0 {
		execution.Status = models.ExecutionStatusFailed
		e.metrics.IncrementExecutionsCompleted(execution.TenantID, "failed")
	} else if execution.Status == models.ExecutionStatusCancelled {
		e.metrics.IncrementExecutionsCompleted(execution.TenantID, "cancelled")
	} else {
		execution.Status = models.ExecutionStatusSuccess
		e.metrics.IncrementExecutionsCompleted(execution.TenantID, "success")
	}
	
	// Save final execution state
	if err := e.saveExecution(execution); err != nil {
		e.logger.Error("Failed to save final execution state", zap.Error(err))
	}
	
	// Record execution time
	duration := now.Sub(execution.StartedAt)
	e.metrics.RecordExecutionDuration(execution.TenantID, duration)
	
	e.logger.Info("Execution finalized",
		zap.String("execution_id", execution.ID),
		zap.String("status", string(execution.Status)),
		zap.Duration("duration", duration),
		zap.Int("completed_steps", execution.CompletedSteps),
		zap.Int("failed_steps", execution.FailedSteps),
	)
}

// Helper methods for the workflow engine
func (e *WorkflowEngine) checkTenantRateLimit(tenantID string) error {
	e.tenantMu.Lock()
	defer e.tenantMu.Unlock()
	
	limit, exists := e.config.TenantRateLimits[tenantID]
	if !exists {
		limit = 100 // default limit
	}
	
	sem, exists := e.tenantSemaphores[tenantID]
	if !exists {
		sem = semaphore.NewWeighted(int64(limit))
		e.tenantSemaphores[tenantID] = sem
	}
	
	if !sem.TryAcquire(1) {
		return fmt.Errorf("tenant rate limit exceeded for tenant %s", tenantID)
	}
	
	// Release the semaphore after a short time
	go func() {
		time.Sleep(time.Minute)
		sem.Release(1)
	}()
	
	return nil
}

func (e *WorkflowEngine) getSchedulableSteps(execution *ExecutionContext) []string {
	var steps []string
	for stepID, step := range execution.StepStates {
		if step.Status == models.StepStatusPending && step.DependenciesMet {
			steps = append(steps, stepID)
		}
	}
	return steps
}

func (e *WorkflowEngine) prepareStepInput(execution *ExecutionContext, step *StepState) string {
	// Collect output data from dependency steps
	inputData := make(map[string]interface{})
	
	for _, depNodeID := range step.Dependencies {
		for _, depStep := range execution.StepStates {
			if depStep.NodeID == depNodeID && depStep.Status == models.StepStatusSuccess {
				// Parse and merge output data
				if depStep.OutputData != "" {
					inputData[depNodeID] = depStep.OutputData
				}
			}
		}
	}
	
	// Add execution context
	inputData["execution_context"] = execution.Context
	inputData["trigger_data"] = execution.TriggerData
	
	// Convert to JSON string
	jsonData, _ := json.Marshal(inputData)
	return string(jsonData)
}

func (e *WorkflowEngine) saveExecution(execution *ExecutionContext) error {
	// Save execution to database
	return e.db.SaveExecution(execution)
}

func (e *WorkflowEngine) saveStepState(step *StepState) error {
	// Save step state to database
	return e.db.SaveStepState(step)
}
