package exec

import (
	"context"

	"github.com/n8n-work/engine-go/internal/repo"
	pb "github.com/n8n-work/engine-go/proto/health/v1"

	"go.uber.org/zap"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/status"
)

// HealthService implements the health check service
type HealthService struct {
	pb.UnimplementedHealthServiceServer
	grpc_health_v1.UnimplementedHealthServer
	logger *zap.Logger
	repo   *repo.Repository
}

// NewHealthService creates a new health service
func NewHealthService(logger *zap.Logger, repo *repo.Repository) *HealthService {
	return &HealthService{
		logger: logger,
		repo:   repo,
	}
}

// Check performs a health check
func (h *HealthService) Check(ctx context.Context, req *pb.HealthCheckRequest) (*pb.HealthCheckResponse, error) {
	// Check database connectivity
	if err := h.repo.Ping(); err != nil {
		return &pb.HealthCheckResponse{
			Status:  pb.HealthCheckResponse_NOT_SERVING,
			Message: "Database connection failed",
		}, nil
	}

	return &pb.HealthCheckResponse{
		Status:  pb.HealthCheckResponse_SERVING,
		Message: "Service is healthy",
		ServiceInfo: &pb.ServiceInfo{
			Name:    "n8n-work-engine",
			Version: "0.1.0",
			Build:   "dev",
		},
	}, nil
}

// Watch performs a streaming health check
func (h *HealthService) Watch(req *pb.HealthCheckRequest, stream pb.HealthService_WatchServer) error {
	// For now, just send initial status
	resp, err := h.Check(stream.Context(), req)
	if err != nil {
		return err
	}

	return stream.Send(resp)
}

// Ready checks if the service is ready to serve traffic
func (h *HealthService) Ready(ctx context.Context, req *pb.ReadinessCheckRequest) (*pb.ReadinessCheckResponse, error) {
	dependencies := []*pb.DependencyStatus{}

	// Check database
	dbHealthy := true
	if err := h.repo.Ping(); err != nil {
		dbHealthy = false
	}

	dependencies = append(dependencies, &pb.DependencyStatus{
		Name:    "database",
		Type:    "database",
		Healthy: dbHealthy,
		Message: func() string {
			if dbHealthy {
				return "Database connection is healthy"
			}
			return "Database connection failed"
		}(),
	})

	// Service is ready if all dependencies are healthy
	ready := true
	for _, dep := range dependencies {
		if !dep.Healthy {
			ready = false
			break
		}
	}

	return &pb.ReadinessCheckResponse{
		Ready:        ready,
		Message:      "Service readiness check",
		Dependencies: dependencies,
	}, nil
}

// Live checks if the service is alive
func (h *HealthService) Live(ctx context.Context, req *pb.LivenessCheckRequest) (*pb.LivenessCheckResponse, error) {
	return &pb.LivenessCheckResponse{
		Alive:   true,
		Message: "Service is alive",
	}, nil
}

// gRPC health check interface implementation
func (h *HealthService) Check(ctx context.Context, req *grpc_health_v1.HealthCheckRequest) (*grpc_health_v1.HealthCheckResponse, error) {
	// Check database connectivity
	if err := h.repo.Ping(); err != nil {
		return &grpc_health_v1.HealthCheckResponse{
			Status: grpc_health_v1.HealthCheckResponse_NOT_SERVING,
		}, status.Error(codes.Unavailable, "Database connection failed")
	}

	return &grpc_health_v1.HealthCheckResponse{
		Status: grpc_health_v1.HealthCheckResponse_SERVING,
	}, nil
}

func (h *HealthService) Watch(req *grpc_health_v1.HealthCheckRequest, stream grpc_health_v1.Health_WatchServer) error {
	// Simple implementation that sends status once
	resp, err := h.Check(stream.Context(), req)
	if err != nil {
		return err
	}
	return stream.Send(resp)
}
