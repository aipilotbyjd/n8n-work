package exec

import (
	"context"

	"github.com/n8n-work/engine-go/internal/config"
	"github.com/n8n-work/engine-go/internal/observability"
	"github.com/n8n-work/engine-go/internal/repo"
	pb "github.com/n8n-work/engine-go/proto/executionv1"

	"go.uber.org/zap"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// Service implements the ExecutionService gRPC interface
type Service struct {
	pb.UnimplementedExecutionServiceServer
	logger  *zap.Logger
	config  *config.Config
	repo    *repo.Repository
	metrics *observability.Metrics
}

// NewService creates a new execution service
func NewService(logger *zap.Logger, cfg *config.Config, repository *repo.Repository, metrics *observability.Metrics) *Service {
	return &Service{
		logger:  logger,
		config:  cfg,
		repo:    repository,
		metrics: metrics,
	}
}

// ExecuteStep executes a single workflow step
func (s *Service) ExecuteStep(ctx context.Context, req *pb.StepExecRequest) (*pb.StepExecResponse, error) {
	s.logger.Info("Executing step",
		zap.String("tenant_id", req.TenantId),
		zap.String("run_id", req.RunId),
		zap.String("step_id", req.StepId),
		zap.String("node_type", req.NodeType))

	// Record metrics
	s.metrics.RecordStepExecution(req.TenantId, req.NodeType, "started")

	// Validate request
	if req.RunId == "" || req.StepId == "" {
		return nil, status.Errorf(codes.InvalidArgument, "missing required fields")
	}

	// Execute the step based on node type
	var outputData []byte
	var success bool
	var errorMessage string

	switch req.NodeType {
	case "http-request":
		outputData, success, errorMessage = s.executeHTTPRequest(ctx, req)
	case "data-transform":
		outputData, success, errorMessage = s.executeDataTransform(ctx, req)
	case "condition":
		outputData, success, errorMessage = s.executeCondition(ctx, req)
	default:
		outputData, success, errorMessage = s.executeGenericNode(ctx, req)
	}

	resp := &pb.StepExecResponse{
		TenantId:   req.TenantId,
		RunId:      req.RunId,
		StepId:     req.StepId,
		Success:    success,
		OutputJson: outputData,
	}

	if !success {
		resp.ErrorMessage = errorMessage
		s.metrics.RecordStepExecution(req.TenantId, req.NodeType, "failed")
	} else {
		s.metrics.RecordStepExecution(req.TenantId, req.NodeType, "completed")
	}

	return resp, nil
}

// GetExecutionStatus retrieves the status of a step execution
func (s *Service) GetExecutionStatus(ctx context.Context, req *pb.GetStatusRequest) (*pb.GetStatusResponse, error) {
	s.logger.Info("Getting execution status",
		zap.String("tenant_id", req.TenantId),
		zap.String("run_id", req.RunId))

	// Implementation would query database for execution status
	return &pb.GetStatusResponse{
		TenantId: req.TenantId,
		RunId:    req.RunId,
		Status:   "running", // This would come from actual status
		Success:  true,
	}, nil
}

// Helper methods for different node types
func (s *Service) executeHTTPRequest(ctx context.Context, req *pb.StepExecRequest) ([]byte, bool, string) {
	// HTTP request execution logic
	result := map[string]interface{}{
		"type": "http-request",
		"status": "success",
		"data": "HTTP request executed",
	}
	data, _ := json.Marshal(result)
	return data, true, ""
}

func (s *Service) executeDataTransform(ctx context.Context, req *pb.StepExecRequest) ([]byte, bool, string) {
	// Data transformation logic
	result := map[string]interface{}{
		"type": "data-transform",
		"status": "success",
		"data": "Data transformed",
	}
	data, _ := json.Marshal(result)
	return data, true, ""
}

func (s *Service) executeCondition(ctx context.Context, req *pb.StepExecRequest) ([]byte, bool, string) {
	// Condition evaluation logic
	result := map[string]interface{}{
		"type": "condition",
		"status": "success",
		"result": true,
	}
	data, _ := json.Marshal(result)
	return data, true, ""
}

func (s *Service) executeGenericNode(ctx context.Context, req *pb.StepExecRequest) ([]byte, bool, string) {
	// Generic node execution logic
	result := map[string]interface{}{
		"type": req.NodeType,
		"status": "success",
		"message": "Node executed successfully",
	}
	data, _ := json.Marshal(result)
	return data, true, ""
}
// GetExecutionStatus retrieves the detailed status of a workflow execution
func (s *Service) GetExecutionStatus(ctx context.Context, req *pb.GetExecutionStatusRequest) (*pb.GetExecutionStatusResponse, error) {
	s.logger.Info("Getting execution status",
		zap.String("tenant_id", req.TenantId),
		zap.String("execution_id", req.ExecutionId))

	// Retrieve execution from repository
	execution, err := s.repo.GetExecution(ctx, req.TenantId, req.ExecutionId)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "execution not found: %v", err)
	}

	// Convert steps to protobuf format
	var steps []*pb.StepExecution
	for _, step := range execution.Steps {
		steps = append(steps, &pb.StepExecution{
			StepId:     step.StepID,
			Status:     pb.ExecutionStatus(pb.ExecutionStatus_value[string(step.Status)]),
			StartedAt:  step.StartedAt,
			EndedAt:    step.EndedAt,
			OutputJson: []byte(step.Output),
		})
	}

	// Create progress information
	progress := &pb.ExecutionProgress{
		TotalSteps:          int32(execution.TotalSteps),
		CompletedSteps:      int32(execution.CompletedSteps),
		FailedSteps:         int32(execution.FailedSteps),
		RunningSteps:        int32(execution.RunningSteps),
		PendingSteps:        int32(execution.PendingSteps),
		CompletionPercentage: execution.CompletionPercentage,
	}

	resp := &pb.GetExecutionStatusResponse{
		Status:   pb.ExecutionStatus(pb.ExecutionStatus_value[string(execution.Status)]),
		Steps:    steps,
		Progress: progress,
		Success:  true,
	}

	return resp, nil
}

// CancelExecution cancels a running workflow execution
func (s *Service) CancelExecution(ctx context.Context, req *pb.CancelExecutionRequest) (*pb.CancelExecutionResponse, error) {
	s.logger.Info("Cancelling execution",
		zap.String("tenant_id", req.TenantId),
		zap.String("execution_id", req.ExecutionId),
		zap.String("reason", req.Reason))

	// Update execution status to cancelled
	if err := s.repo.UpdateExecutionStatus(ctx, req.TenantId, req.ExecutionId, "cancelled"); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to cancel execution: %v", err)
	}

	// Send cancellation signal to execution engine
	if err := s.engine.CancelExecution(req.ExecutionId); err != nil {
		// Log error but don't fail the request
		s.logger.Warn("Failed to send cancellation signal to engine",
			zap.String("execution_id", req.ExecutionId),
			zap.Error(err))
	}

	resp := &pb.CancelExecutionResponse{
		Cancelled: true,
		Message:   "Execution cancelled successfully",
	}

	return resp, nil
}

// Health performs a health check
func (s *Service) Health(ctx context.Context, req *pb.HealthRequest) (*pb.HealthResponse, error) {
	// Check database connectivity
	if err := s.repo.Ping(); err != nil {
		return &pb.HealthResponse{
			Status:  pb.HealthResponse_STATUS_NOT_SERVING,
			Message: "Database connection failed",
		}, status.Error(codes.Unavailable, "Database connection failed")
	}

	return &pb.HealthResponse{
		Status:  pb.HealthResponse_STATUS_SERVING,
		Message: "Service is healthy",
		Capabilities: &pb.Capabilities{
			SupportsAsyncNodes: true,
			SupportsWasm:       false,
			Supportsicrovm:     false,
		},
	}, nil
}
