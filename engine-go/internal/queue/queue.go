package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/streadway/amqp"
	"go.uber.org/zap"
)

// Queue interface for message queue operations
type Queue interface {
	Publish(ctx context.Context, exchange, routingKey string, message interface{}) error
	Subscribe(ctx context.Context, queue string, handler MessageHandler) error
	Close() error
}

// MessageHandler is a function that handles incoming messages
type MessageHandler func(message []byte) error

// RabbitMQQueue implements Queue interface using RabbitMQ
type RabbitMQQueue struct {
	conn    *amqp.Connection
	channel *amqp.Channel
	logger  *zap.Logger
}

// NewRabbitMQQueue creates a new RabbitMQ queue instance
func NewRabbitMQQueue(url string, logger *zap.Logger) (*RabbitMQQueue, error) {
	conn, err := amqp.Dial(url)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}

	channel, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to open channel: %w", err)
	}

	return &RabbitMQQueue{
		conn:    conn,
		channel: channel,
		logger:  logger,
	}, nil
}

// Publish sends a message to the queue
func (q *RabbitMQQueue) Publish(ctx context.Context, exchange, routingKey string, message interface{}) error {
	body, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	err = q.channel.Publish(
		exchange,
		routingKey,
		false,
		false,
		amqp.Publishing{
			ContentType: "application/json",
			Body:        body,
			Timestamp:   time.Now(),
		},
	)
	if err != nil {
		return fmt.Errorf("failed to publish message: %w", err)
	}

	q.logger.Debug("Message published",
		zap.String("exchange", exchange),
		zap.String("routing_key", routingKey),
	)

	return nil
}

// Subscribe listens for messages on a queue
func (q *RabbitMQQueue) Subscribe(ctx context.Context, queue string, handler MessageHandler) error {
	msgs, err := q.channel.Consume(
		queue,
		"",
		false,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return fmt.Errorf("failed to register consumer: %w", err)
	}

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case msg := <-msgs:
				if err := handler(msg.Body); err != nil {
					q.logger.Error("Failed to handle message",
						zap.Error(err),
						zap.String("queue", queue),
					)
					msg.Nack(false, true)
				} else {
					msg.Ack(false)
				}
			}
		}
	}()

	q.logger.Info("Started consuming messages", zap.String("queue", queue))
	return nil
}

// Close closes the RabbitMQ connection
func (q *RabbitMQQueue) Close() error {
	if err := q.channel.Close(); err != nil {
		return fmt.Errorf("failed to close channel: %w", err)
	}
	if err := q.conn.Close(); err != nil {
		return fmt.Errorf("failed to close connection: %w", err)
	}
	return nil
}
