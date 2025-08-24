package invoker

import (
	"context"
	"fmt"
	"time"

	"github.com/n8n-work/engine-go/internal/config"
	"github.com/n8n-work/engine-go/internal/models"
	"github.com/n8n-work/engine-go/internal/observability"
	"github.com/n8n-work/engine-go/internal/repo"
	"github.com/n8n-work/engine-go/proto/executionv1"

	"github.com/golang/protobuf/proto"
	"github.com/streadway/amqp"
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

	// Connect to RabbitMQ using the config
	conn, err := amqp.Dial(s.config.RabbitMQURL)
	if err != nil {
		return fmt.Errorf("failed to connect to RabbitMQ: %v", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		return fmt.Errorf("failed to open RabbitMQ channel: %v", err)
	}

	// Set up queues and exchanges
	q, err := ch.QueueDeclare(
		"step_executions", // name
		true,              // durable
		false,             // delete when unused
		false,             // exclusive
		false,             // no-wait
		nil,               // arguments
	)
	if err != nil {
		return fmt.Errorf("failed to declare queue: %v", err)
	}

	msgs, err := ch.Consume(
		q.Name, // queue
		"",     // consumer
		true,   // auto-ack
		false,  // exclusive
		false,  // no-local
		false,  // no-wait
		nil,    // args
	)
	if err != nil {
		return fmt.Errorf("failed to register consumer: %v", err)
	}

	// Start consuming messages in a goroutine
	go func() {
		for {
			select {
			case msg := <-msgs:
				// Process messages by calling node runners
				if err := s.ProcessStepExecution(ctx, msg.Body); err != nil {
					s.logger.Error("Failed to process step execution", zap.Error(err))
					// Handle retries and dead letter queues
					// Implementation would send to DLQ after max retries
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	// Wait for context cancellation
	<-ctx.Done()
	s.logger.Info("Message queue consumer stopped")
	return nil
}

// ProcessStepExecution processes a step execution message
func (s *Service) ProcessStepExecution(ctx context.Context, message []byte) error {
	s.logger.Info("Processing step execution message")

	// Parse the message
	var req executionv1.StepExecRequest
	if err := proto.Unmarshal(message, &req); err != nil {
		return fmt.Errorf("failed to parse message: %v", err)
	}

	// Create database record
	execution := &models.Execution{
		TenantID:  req.TenantId,
		RunID:     req.RunId,
		StepID:    req.StepId,
		Status:    "started",
		StartedAt: time.Now().Format(time.RFC3339),
	}
	if err := s.repo.CreateExecution(context.Background(), execution); err != nil {
		return fmt.Errorf("failed to create execution record: %v", err)
	}

	// Call node runner via gRPC or HTTP
	result, err := s.callNodeRunner(&req)
	if err != nil {
		return fmt.Errorf("failed to call node runner: %v", err)
	}

	// Update database with results
	execution.Status = "completed"
	execution.EndedAt = time.Now().Format(time.RFC3339)
	execution.Output = string(result.OutputJson)
	if err := s.repo.UpdateExecution(context.Background(), execution); err != nil {
		return fmt.Errorf("failed to update execution record: %v", err)
	}

	// Publish result message
	if err := s.publishResult(result); err != nil {
		return fmt.Errorf("failed to publish result: %v", err)
	}

	return nil
}

// callNodeRunner calls the appropriate node runner service
func (s *Service) callNodeRunner(req *executionv1.StepExecRequest) (*executionv1.StepExecResponse, error) {
	// Implementation would determine which node runner to call based on node type
	// and make the gRPC/HTTP call
	
	// For now, return a mock response
	return &executionv1.StepExecResponse{
		TenantId:   req.TenantId,
		RunId:      req.RunId,
		StepId:     req.StepId,
		Success:    true,
		OutputJson: []byte(`{"result": "success"}`),
	}, nil
}

// publishResult publishes the execution result to the result queue
func (s *Service) publishResult(result *executionv1.StepExecResponse) error {
	// Implementation would publish the result to a result queue
	// for the orchestrator to consume
	return nil
}
