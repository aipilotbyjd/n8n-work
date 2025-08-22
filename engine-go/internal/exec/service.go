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

	// TODO: Implement actual step execution logic
	// This is a stub implementation
	resp := &pb.StepExecResponse{
		TenantId: req.TenantId,
		RunId:    req.RunId,
		StepId:   req.StepId,
		Success:  true,
		OutputJson: []byte(`{"result": "success", "message": "Step executed successfully"}`),
	}

	s.metrics.RecordStepExecution(req.TenantId, req.NodeType, "completed")
	return resp, nil
}

// GetExecutionStatus retrieves the status of a step execution
func (s *Service) GetExecutionStatus(ctx context.Context, req *pb.GetExecutionStatusRequest) (*pb.GetExecutionStatusResponse, error) {
	s.logger.Info("Getting execution status",
		zap.String("tenant_id", req.TenantId),
		zap.String("run_id", req.RunId),
		zap.String("step_id", req.StepId))

	// TODO: Implement status retrieval from database
	resp := &pb.GetExecutionStatusResponse{
		TenantId: req.TenantId,
		RunId:    req.RunId,
		StepId:   req.StepId,
		Status:   pb.GetExecutionStatusResponse_STATUS_COMPLETED,
	}

	return resp, nil
}

// CancelExecution cancels a running step execution
func (s *Service) CancelExecution(ctx context.Context, req *pb.CancelExecutionRequest) (*pb.CancelExecutionResponse, error) {
	s.logger.Info("Cancelling execution",
		zap.String("tenant_id", req.TenantId),
		zap.String("run_id", req.RunId),
		zap.String("step_id", req.StepId),
		zap.String("reason", req.Reason))

	// TODO: Implement cancellation logic
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
