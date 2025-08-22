
package engine

import (
	"context"

	"go.uber.org/zap"

	pb "github.com/n8n-work/engine-go/proto"
	"github.com/n8n-work/engine-go/internal/queue"
)

// Executor handles the execution of individual workflow steps
type Executor struct {
	engine *WorkflowEngine
	logger *zap.Logger
	queue  *queue.MessageQueue
}

// NewExecutor creates a new executor instance
func NewExecutor(engine *WorkflowEngine, logger *zap.Logger, queue *queue.MessageQueue) *Executor {
	return &Executor{
		engine: engine,
		logger: logger.With(zap.String("component", "executor")),
		queue:  queue,
	}
}

// Start starts the executor
func (e *Executor) Start(ctx context.Context) error {
	e.logger.Info("Starting executor")
	// Initialize executor resources
	return nil
}

// Stop stops the executor
func (e *Executor) Stop(ctx context.Context) error {
	e.logger.Info("Stopping executor")
	// Cleanup executor resources
	return nil
}

// ExecuteStep executes a single workflow step
func (e *Executor) ExecuteStep(
	req *pb.StepExecRequest,
	resultChan chan *StepResult,
	errorChan chan *StepError,
) {
	go func() {
		e.logger.Debug("Executing step",
			zap.String("execution_id", req.ExecutionId),
			zap.String("step_id", req.StepId),
			zap.String("node_type", req.NodeType),
		)

		// Send step execution request to node runner via queue
		if err := e.queue.PublishStepExecution(req); err != nil {
			errorChan <- &StepError{
				ExecutionID: req.ExecutionId,
				StepID:      req.StepId,
				Error:       err,
				Retryable:   true,
			}
			return
		}

		// For now, simulate successful execution
		// In reality, this would wait for the result from the queue
		resultChan <- &StepResult{
			ExecutionID: req.ExecutionId,
			StepID:      req.StepId,
			Status:      "success",
			OutputData:  `{"result": "step completed"}`,
			Metrics: &ExecutionMetrics{
				Duration: 1000, // ms
				Memory:   50,   // MB
			},
		}
	}()
}

// ExecutionMetrics holds metrics for step execution
type ExecutionMetrics struct {
	Duration int64 `json:"duration_ms"`
	Memory   int64 `json:"memory_mb"`
	CPU      int64 `json:"cpu_percent"`
}
