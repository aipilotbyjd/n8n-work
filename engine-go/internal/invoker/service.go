package invoker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
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
	// Implementation determines which node runner to call based on node type
	// and makes the gRPC/HTTP call
	
	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 30 * time.Second,
	}
	
	// For now, we'll make a simple HTTP call to a node runner
	// In a production implementation, this would be more sophisticated
	// with load balancing, retries, circuit breakers, etc.
	
	// Build the request
	url := fmt.Sprintf("http://localhost:3002/execute") // Default node runner URL
	
	// Marshal the request to JSON
	requestData, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %v", err)
	}
	
	// Create HTTP request
	httpReq, err := http.NewRequest("POST", url, bytes.NewBuffer(requestData))
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %v", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	
	// Make the request
	httpResp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to call node runner: %v", err)
	}
	defer httpResp.Body.Close()
	
	// Read response
	respBody, err := io.ReadAll(httpResp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %v", err)
	}
	
	// Check status code
	if httpResp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("node runner returned status %d: %s", httpResp.StatusCode, string(respBody))
	}
	
	// Parse response
	var resp executionv1.StepExecResponse
	if err := json.Unmarshal(respBody, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %v", err)
	}
	
	return &resp, nil
}

// publishResult publishes the execution result to the result queue
func (s *Service) publishResult(result *executionv1.StepExecResponse) error {
	// Implementation publishes the result to a result queue
	// for the orchestrator to consume
	
	// Marshal the result to protobuf
	data, err := proto.Marshal(result)
	if err != nil {
		return fmt.Errorf("failed to marshal result: %v", err)
	}
	
	// Connect to RabbitMQ
	conn, err := amqp.Dial(s.config.RabbitMQURL)
	if err != nil {
		return fmt.Errorf("failed to connect to RabbitMQ: %v", err)
	}
	defer conn.Close()
	
	// Open a channel
	ch, err := conn.Channel()
	if err != nil {
		return fmt.Errorf("failed to open RabbitMQ channel: %v", err)
	}
	defer ch.Close()
	
	// Declare the results queue
	q, err := ch.QueueDeclare(
		"step_results", // name
		true,          // durable
		false,         // delete when unused
		false,         // exclusive
		false,         // no-wait
		nil,           // arguments
	)
	if err != nil {
		return fmt.Errorf("failed to declare results queue: %v", err)
	}
	
	// Publish the message
	err = ch.Publish(
		"",     // exchange
		q.Name, // routing key
		false,  // mandatory
		false,  // immediate
		amqp.Publishing{
			ContentType: "application/protobuf",
			Body:        data,
		})
	if err != nil {
		return fmt.Errorf("failed to publish result: %v", err)
	}
	
	s.logger.Info("Successfully published result", zap.String("run_id", result.RunId), zap.String("step_id", result.StepId))
	return nil
}
