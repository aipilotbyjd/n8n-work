package grpc

import (
	"sync"
	"time"

	"go.uber.org/zap"

	pb "github.com/n8n-work/engine-go/proto"
)

// SubscribeToExecution subscribes a client to execution events
func (sm *SubscriptionManager) SubscribeToExecution(executionID, clientID string, eventChan chan *pb.ExecutionEvent) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if sm.execStreams[executionID] == nil {
		sm.execStreams[executionID] = make(map[string]chan *pb.ExecutionEvent)
	}

	sm.execStreams[executionID][clientID] = eventChan

	sm.logger.Info("Client subscribed to execution events",
		zap.String("execution_id", executionID),
		zap.String("client_id", clientID),
	)
}

// UnsubscribeFromExecution unsubscribes a client from execution events
func (sm *SubscriptionManager) UnsubscribeFromExecution(executionID, clientID string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if clients, exists := sm.execStreams[executionID]; exists {
		if eventChan, exists := clients[clientID]; exists {
			close(eventChan)
			delete(clients, clientID)

			// Clean up empty execution streams
			if len(clients) == 0 {
				delete(sm.execStreams, executionID)
			}
		}
	}

	sm.logger.Info("Client unsubscribed from execution events",
		zap.String("execution_id", executionID),
		zap.String("client_id", clientID),
	)
}

// SubscribeToSteps subscribes a client to step update events
func (sm *SubscriptionManager) SubscribeToSteps(executionID, clientID string, stepChan chan *pb.StepUpdateEvent) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if sm.stepStreams[executionID] == nil {
		sm.stepStreams[executionID] = make(map[string]chan *pb.StepUpdateEvent)
	}

	sm.stepStreams[executionID][clientID] = stepChan

	sm.logger.Info("Client subscribed to step events",
		zap.String("execution_id", executionID),
		zap.String("client_id", clientID),
	)
}

// UnsubscribeFromSteps unsubscribes a client from step events
func (sm *SubscriptionManager) UnsubscribeFromSteps(executionID, clientID string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if clients, exists := sm.stepStreams[executionID]; exists {
		if stepChan, exists := clients[clientID]; exists {
			close(stepChan)
			delete(clients, clientID)

			if len(clients) == 0 {
				delete(sm.stepStreams, executionID)
			}
		}
	}

	sm.logger.Info("Client unsubscribed from step events",
		zap.String("execution_id", executionID),
		zap.String("client_id", clientID),
	)
}

// SubscribeToMetrics subscribes a client to resource metrics
func (sm *SubscriptionManager) SubscribeToMetrics(tenantID, clientID string, metricsChan chan *pb.ResourceMetricsEvent) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if sm.metricStreams[tenantID] == nil {
		sm.metricStreams[tenantID] = make(map[string]chan *pb.ResourceMetricsEvent)
	}

	sm.metricStreams[tenantID][clientID] = metricsChan

	sm.logger.Info("Client subscribed to metrics",
		zap.String("tenant_id", tenantID),
		zap.String("client_id", clientID),
	)
}

// UnsubscribeFromMetrics unsubscribes a client from resource metrics
func (sm *SubscriptionManager) UnsubscribeFromMetrics(tenantID, clientID string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if clients, exists := sm.metricStreams[tenantID]; exists {
		if metricsChan, exists := clients[clientID]; exists {
			close(metricsChan)
			delete(clients, clientID)

			if len(clients) == 0 {
				delete(sm.metricStreams, tenantID)
			}
		}
	}

	sm.logger.Info("Client unsubscribed from metrics",
		zap.String("tenant_id", tenantID),
		zap.String("client_id", clientID),
	)
}

// SubscribeToLogs subscribes a client to log events
func (sm *SubscriptionManager) SubscribeToLogs(executionID, clientID string, logChan chan *pb.LogEvent) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if sm.logStreams[executionID] == nil {
		sm.logStreams[executionID] = make(map[string]chan *pb.LogEvent)
	}

	sm.logStreams[executionID][clientID] = logChan

	sm.logger.Info("Client subscribed to logs",
		zap.String("execution_id", executionID),
		zap.String("client_id", clientID),
	)
}

// UnsubscribeFromLogs unsubscribes a client from log events
func (sm *SubscriptionManager) UnsubscribeFromLogs(executionID, clientID string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if clients, exists := sm.logStreams[executionID]; exists {
		if logChan, exists := clients[clientID]; exists {
			close(logChan)
			delete(clients, clientID)

			if len(clients) == 0 {
				delete(sm.logStreams, executionID)
			}
		}
	}

	sm.logger.Info("Client unsubscribed from logs",
		zap.String("execution_id", executionID),
		zap.String("client_id", clientID),
	)
}

// RegisterCommandStream registers a bidirectional command stream
func (sm *SubscriptionManager) RegisterCommandStream(clientID string, responseChan chan *pb.ExecutionResponse) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	sm.commandStreams[clientID] = responseChan

	sm.logger.Info("Command stream registered",
		zap.String("client_id", clientID),
	)
}

// UnregisterCommandStream unregisters a bidirectional command stream
func (sm *SubscriptionManager) UnregisterCommandStream(clientID string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if responseChan, exists := sm.commandStreams[clientID]; exists {
		close(responseChan)
		delete(sm.commandStreams, clientID)
	}

	sm.logger.Info("Command stream unregistered",
		zap.String("client_id", clientID),
	)
}

// BroadcastExecutionEvent broadcasts an execution event to all subscribed clients
func (sm *SubscriptionManager) BroadcastExecutionEvent(executionID string, event *pb.ExecutionEvent) {
	sm.mu.RLock()
	clients := sm.execStreams[executionID]
	sm.mu.RUnlock()

	if clients == nil {
		return
	}

	for clientID, eventChan := range clients {
		select {
		case eventChan <- event:
			// Event sent successfully
		default:
			// Channel is full, log warning and close the subscription
			sm.logger.Warn("Client execution event channel full, closing subscription",
				zap.String("execution_id", executionID),
				zap.String("client_id", clientID),
			)
			go sm.UnsubscribeFromExecution(executionID, clientID)
		}
	}
}

// BroadcastStepEvent broadcasts a step event to all subscribed clients
func (sm *SubscriptionManager) BroadcastStepEvent(executionID string, event *pb.StepUpdateEvent) {
	sm.mu.RLock()
	clients := sm.stepStreams[executionID]
	sm.mu.RUnlock()

	if clients == nil {
		return
	}

	for clientID, stepChan := range clients {
		select {
		case stepChan <- event:
			// Event sent successfully
		default:
			sm.logger.Warn("Client step event channel full, closing subscription",
				zap.String("execution_id", executionID),
				zap.String("client_id", clientID),
			)
			go sm.UnsubscribeFromSteps(executionID, clientID)
		}
	}
}

// BroadcastResourceMetrics broadcasts resource metrics to all subscribed clients
func (sm *SubscriptionManager) BroadcastResourceMetrics(tenantID string, event *pb.ResourceMetricsEvent) {
	sm.mu.RLock()
	clients := sm.metricStreams[tenantID]
	sm.mu.RUnlock()

	if clients == nil {
		return
	}

	for clientID, metricsChan := range clients {
		select {
		case metricsChan <- event:
			// Event sent successfully
		default:
			sm.logger.Warn("Client metrics channel full, closing subscription",
				zap.String("tenant_id", tenantID),
				zap.String("client_id", clientID),
			)
			go sm.UnsubscribeFromMetrics(tenantID, clientID)
		}
	}
}

// BroadcastLogEvent broadcasts a log event to all subscribed clients
func (sm *SubscriptionManager) BroadcastLogEvent(executionID string, event *pb.LogEvent) {
	sm.mu.RLock()
	clients := sm.logStreams[executionID]
	sm.mu.RUnlock()

	if clients == nil {
		return
	}

	for clientID, logChan := range clients {
		select {
		case logChan <- event:
			// Event sent successfully
		default:
			sm.logger.Warn("Client log channel full, closing subscription",
				zap.String("execution_id", executionID),
				zap.String("client_id", clientID),
			)
			go sm.UnsubscribeFromLogs(executionID, clientID)
		}
	}
}

// SendCommandResponse sends a response to a specific command stream
func (sm *SubscriptionManager) SendCommandResponse(clientID string, response *pb.ExecutionResponse) {
	sm.mu.RLock()
	responseChan := sm.commandStreams[clientID]
	sm.mu.RUnlock()

	if responseChan == nil {
		return
	}

	select {
	case responseChan <- response:
		// Response sent successfully
	default:
		sm.logger.Warn("Command response channel full",
			zap.String("client_id", clientID),
		)
	}
}

// GetSubscriptionStats returns statistics about current subscriptions
func (sm *SubscriptionManager) GetSubscriptionStats() map[string]interface{} {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	stats := make(map[string]interface{})
	
	// Count execution subscribers
	execCount := 0
	for _, clients := range sm.execStreams {
		execCount += len(clients)
	}
	stats["execution_subscribers"] = execCount
	stats["execution_streams"] = len(sm.execStreams)

	// Count step subscribers
	stepCount := 0
	for _, clients := range sm.stepStreams {
		stepCount += len(clients)
	}
	stats["step_subscribers"] = stepCount
	stats["step_streams"] = len(sm.stepStreams)

	// Count metrics subscribers
	metricsCount := 0
	for _, clients := range sm.metricStreams {
		metricsCount += len(clients)
	}
	stats["metrics_subscribers"] = metricsCount
	stats["metrics_streams"] = len(sm.metricStreams)

	// Count log subscribers
	logCount := 0
	for _, clients := range sm.logStreams {
		logCount += len(clients)
	}
	stats["log_subscribers"] = logCount
	stats["log_streams"] = len(sm.logStreams)

	// Command streams
	stats["command_streams"] = len(sm.commandStreams)

	// Total
	stats["total_subscribers"] = execCount + stepCount + metricsCount + logCount
	stats["total_streams"] = len(sm.execStreams) + len(sm.stepStreams) + len(sm.metricStreams) + len(sm.logStreams) + len(sm.commandStreams)

	return stats
}

// CleanupInactiveSubscriptions removes subscriptions that haven't been active for a while
func (sm *SubscriptionManager) CleanupInactiveSubscriptions() {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	// This would typically track last activity timestamps and clean up inactive subscriptions
	// For now, we'll just log the cleanup operation
	sm.logger.Info("Subscription cleanup completed",
		zap.Int("execution_streams", len(sm.execStreams)),
		zap.Int("step_streams", len(sm.stepStreams)),
		zap.Int("metrics_streams", len(sm.metricStreams)),
		zap.Int("log_streams", len(sm.logStreams)),
		zap.Int("command_streams", len(sm.commandStreams)),
	)
}

// StartCleanupRoutine starts a background routine to periodically clean up inactive subscriptions
func (sm *SubscriptionManager) StartCleanupRoutine() {
	ticker := time.NewTicker(5 * time.Minute)
	go func() {
		for range ticker.C {
			sm.CleanupInactiveSubscriptions()
		}
	}()
}

// StreamingMetrics helper methods
func (m *StreamingMetrics) IncrementActiveConnections() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.ActiveConnections++
}

func (m *StreamingMetrics) DecrementActiveConnections() {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.ActiveConnections > 0 {
		m.ActiveConnections--
	}
}

func (m *StreamingMetrics) IncrementEventsStreamed() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.EventsStreamed++
}

func (m *StreamingMetrics) IncrementSubscriptions() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.SubscriptionsCreated++
}

func (m *StreamingMetrics) IncrementSubscriptionsClosed() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.SubscriptionsClosed++
}

func (m *StreamingMetrics) IncrementErrors() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.ErrorsCount++
}