package invoker

import (
	"context"

	"github.com/n8n-work/engine-go/internal/config"
	"github.com/n8n-work/engine-go/internal/observability"
	"github.com/n8n-work/engine-go/internal/repo"

	"go.uber.org/zap"
)

// Service handles message queue consumption and step invocation
type Service struct {
	logger  *zap.Logger
	config  *config.Config
	repo    *repo.Repository
	metrics *observability.Metrics
}

// NewService creates a new invoker service
func NewService(logger *zap.Logger, cfg *config.Config, repository *repo.Repository, metrics *observability.Metrics) *Service {
	return &Service{
		logger:  logger,
		config:  cfg,
		repo:    repository,
		metrics: metrics,
	}
}

// Start begins consuming messages from the message queue
func (s *Service) Start(ctx context.Context) error {
	s.logger.Info("Starting message queue consumer")

	// TODO: Implement RabbitMQ connection and consumption
	// This would typically:
	// 1. Connect to RabbitMQ using the config
	// 2. Set up queues and exchanges
	// 3. Start consuming messages
	// 4. Process messages by calling node runners
	// 5. Handle retries and dead letter queues

	// For now, we'll just log and wait for context cancellation
	<-ctx.Done()
	s.logger.Info("Message queue consumer stopped")
	return nil
}

// ProcessStepExecution processes a step execution message
func (s *Service) ProcessStepExecution(ctx context.Context, message []byte) error {
	s.logger.Info("Processing step execution message")

	// TODO: Implement message processing
	// 1. Parse the message
	// 2. Create database record
	// 3. Call node runner via gRPC or HTTP
	// 4. Update database with results
	// 5. Publish result message

	return nil
}
