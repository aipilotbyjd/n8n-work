package grpc

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"go.uber.org/zap"

	pb "github.com/n8n-work/engine-go/proto"
	"github.com/n8n-work/engine-go/internal/models"
)

// broadcastExecutionEvent processes and broadcasts execution events
func (s *StreamingService) broadcastExecutionEvent(event *StreamEvent) {
	if execEvent, ok := event.Data.(*ExecutionEventData); ok {
		pbEvent := &pb.ExecutionEvent{
			ExecutionId: event.ExecID,
			EventType:   execEvent.EventType,
			Timestamp:   event.Timestamp.Format(time.RFC3339),
			StepId:      event.StepID,
			Status:      execEvent.Status,
			Progress:    execEvent.Progress,
			Message:     execEvent.Message,
			Data:        execEvent.Metadata,
		}

		s.subscriptions.BroadcastExecutionEvent(event.ExecID, pbEvent)
	}
}

// broadcastStepEvent processes and broadcasts step events
func (s *StreamingService) broadcastStepEvent(event *StreamEvent) {
	if stepEvent, ok := event.Data.(*StepEventData); ok {
		pbEvent := &pb.StepUpdateEvent{
			ExecutionId:  event.ExecID,
			StepId:       event.StepID,
			NodeId:       stepEvent.NodeID,
			Status:       stepEvent.Status,
			Timestamp:    event.Timestamp.Format(time.RFC3339),
			InputData:    stepEvent.InputData,
			OutputData:   stepEvent.OutputData,
			ErrorMessage: stepEvent.ErrorMessage,
			Metrics:      stepEvent.Metrics,
			RetryCount:   stepEvent.RetryCount,
			Metadata:     stepEvent.Metadata,
		}

		s.subscriptions.BroadcastStepEvent(event.ExecID, pbEvent)
	}
}

// broadcastResourceEvent processes and broadcasts resource metrics events
func (s *StreamingService) broadcastResourceEvent(event *StreamEvent) {
	if resourceEvent, ok := event.Data.(*ResourceEventData); ok {
		pbEvent := &pb.ResourceMetricsEvent{
			Timestamp:     event.Timestamp.Format(time.RFC3339),
			TenantId:      event.TenantID,
			ExecutionId:   event.ExecID,
			MetricType:    resourceEvent.MetricType,
			Value:         resourceEvent.Value,
			Unit:          resourceEvent.Unit,
			Labels:        resourceEvent.Labels,
			ResourceUsage: resourceEvent.ResourceUsage,
		}

		s.subscriptions.BroadcastResourceMetrics(event.TenantID, pbEvent)
	}
}

// broadcastLogEvent processes and broadcasts log events
func (s *StreamingService) broadcastLogEvent(event *StreamEvent) {
	if logEvent, ok := event.Data.(*LogEventData); ok {
		pbEvent := &pb.LogEvent{
			Timestamp:   event.Timestamp.Format(time.RFC3339),
			ExecutionId: event.ExecID,
			StepId:      event.StepID,
			NodeId:      logEvent.NodeID,
			Level:       logEvent.Level,
			Message:     logEvent.Message,
			Fields:      logEvent.Fields,
			Source:      logEvent.Source,
			TraceId:     logEvent.TraceID,
		}

		s.subscriptions.BroadcastLogEvent(event.ExecID, pbEvent)
	}
}

// handleExecutionCommand processes bidirectional execution commands
func (s *StreamingService) handleExecutionCommand(command *pb.ExecutionCommand) *pb.ExecutionResponse {
	response := &pb.ExecutionResponse{
		CommandId:   command.CommandId,
		ExecutionId: command.ExecutionId,
		Timestamp:   time.Now().Format(time.RFC3339),
		Success:     false,
		Data:        make(map[string]string),
	}

	s.logger.Info("Processing execution command",
		zap.String("command_id", command.CommandId),
		zap.String("execution_id", command.ExecutionId),
		zap.String("command_type", command.CommandType.String()),
	)

	switch command.CommandType {
	case pb.ExecutionCommandType_PAUSE_EXECUTION:
		err := s.engine.PauseExecution(command.ExecutionId)
		if err != nil {
			response.ErrorMessage = err.Error()
			response.ResponseType = pb.ExecutionResponseType_COMMAND_FAILED
		} else {
			response.Success = true
			response.ResponseType = pb.ExecutionResponseType_COMMAND_COMPLETED
			response.Data["action"] = "paused"
		}

	case pb.ExecutionCommandType_RESUME_EXECUTION:
		err := s.engine.ResumeExecution(command.ExecutionId)
		if err != nil {
			response.ErrorMessage = err.Error()
			response.ResponseType = pb.ExecutionResponseType_COMMAND_FAILED
		} else {
			response.Success = true
			response.ResponseType = pb.ExecutionResponseType_COMMAND_COMPLETED
			response.Data["action"] = "resumed"
		}

	case pb.ExecutionCommandType_CANCEL_EXECUTION:
		reason := command.Parameters["reason"]
		if reason == "" {
			reason = "Cancelled by user command"
		}
		err := s.engine.CancelExecution(command.ExecutionId, reason)
		if err != nil {
			response.ErrorMessage = err.Error()
			response.ResponseType = pb.ExecutionResponseType_COMMAND_FAILED
		} else {
			response.Success = true
			response.ResponseType = pb.ExecutionResponseType_COMMAND_COMPLETED
			response.Data["action"] = "cancelled"
			response.Data["reason"] = reason
		}

	case pb.ExecutionCommandType_SKIP_STEP:
		stepID := command.Parameters["step_id"]
		if stepID == "" {
			response.ErrorMessage = "step_id parameter is required"
			response.ResponseType = pb.ExecutionResponseType_COMMAND_FAILED
		} else {
			err := s.engine.SkipStep(command.ExecutionId, stepID)
			if err != nil {
				response.ErrorMessage = err.Error()
				response.ResponseType = pb.ExecutionResponseType_COMMAND_FAILED
			} else {
				response.Success = true
				response.ResponseType = pb.ExecutionResponseType_COMMAND_COMPLETED
				response.Data["action"] = "step_skipped"
				response.Data["step_id"] = stepID
			}
		}

	case pb.ExecutionCommandType_RETRY_STEP:
		stepID := command.Parameters["step_id"]
		if stepID == "" {
			response.ErrorMessage = "step_id parameter is required"
			response.ResponseType = pb.ExecutionResponseType_COMMAND_FAILED
		} else {
			err := s.engine.RetryStep(command.ExecutionId, stepID)
			if err != nil {
				response.ErrorMessage = err.Error()
				response.ResponseType = pb.ExecutionResponseType_COMMAND_FAILED
			} else {
				response.Success = true
				response.ResponseType = pb.ExecutionResponseType_COMMAND_COMPLETED
				response.Data["action"] = "step_retried"
				response.Data["step_id"] = stepID
			}
		}

	case pb.ExecutionCommandType_UPDATE_VARIABLES:
		variablesJSON := command.Parameters["variables"]
		if variablesJSON == "" {
			response.ErrorMessage = "variables parameter is required"
			response.ResponseType = pb.ExecutionResponseType_COMMAND_FAILED
		} else {
			var variables map[string]interface{}
			if err := json.Unmarshal([]byte(variablesJSON), &variables); err != nil {
				response.ErrorMessage = fmt.Sprintf("Invalid variables JSON: %v", err)
				response.ResponseType = pb.ExecutionResponseType_COMMAND_FAILED
			} else {
				err := s.engine.UpdateExecutionVariables(command.ExecutionId, variables)
				if err != nil {
					response.ErrorMessage = err.Error()
					response.ResponseType = pb.ExecutionResponseType_COMMAND_FAILED
				} else {
					response.Success = true
					response.ResponseType = pb.ExecutionResponseType_COMMAND_COMPLETED
					response.Data["action"] = "variables_updated"
				}
			}
		}

	case pb.ExecutionCommandType_GET_SNAPSHOT:
		snapshot, err := s.engine.GetExecutionSnapshot(command.ExecutionId)
		if err != nil {
			response.ErrorMessage = err.Error()
			response.ResponseType = pb.ExecutionResponseType_COMMAND_FAILED
		} else {
			response.Success = true
			response.ResponseType = pb.ExecutionResponseType_EXECUTION_SNAPSHOT
			
			// Convert snapshot to JSON
			snapshotJSON, _ := json.Marshal(snapshot)
			response.Data["snapshot"] = string(snapshotJSON)
		}

	default:
		response.ErrorMessage = fmt.Sprintf("Unknown command type: %v", command.CommandType)
		response.ResponseType = pb.ExecutionResponseType_COMMAND_FAILED
	}

	return response
}

// collectCurrentMetrics collects current system metrics
func (s *StreamingService) collectCurrentMetrics(tenantID, executionID string) *pb.ResourceMetricsEvent {
	// Get current resource usage from the engine
	resourceUsage := s.engine.GetCurrentResourceUsage(tenantID, executionID)
	
	// Get streaming service metrics
	streamingMetrics := s.GetMetrics()

	return &pb.ResourceMetricsEvent{
		Timestamp:   time.Now().Format(time.RFC3339),
		TenantId:    tenantID,
		ExecutionId: executionID,
		MetricType:  pb.MetricType_CPU_USAGE,
		Value:       float64(resourceUsage.CpuUsedMillicores),
		Unit:        "millicores",
		Labels: map[string]string{
			"component":           "engine-go",
			"streaming_connections": fmt.Sprintf("%d", streamingMetrics.ActiveConnections),
			"events_streamed":      fmt.Sprintf("%d", streamingMetrics.EventsStreamed),
		},
		ResourceUsage: &pb.ResourceUsage{
			MemoryUsedBytes:         resourceUsage.MemoryUsedBytes,
			CpuUsedMillicores:      resourceUsage.CpuUsedMillicores,
			ActiveExecutions:       resourceUsage.ActiveExecutions,
			QueuedExecutions:       resourceUsage.QueuedExecutions,
			NetworkBytesPerMinute:  resourceUsage.NetworkBytesPerMinute,
			RequestsPerMinute:      resourceUsage.RequestsPerMinute,
		},
	}
}

// getHistoricalLogs retrieves historical logs for an execution
func (s *StreamingService) getHistoricalLogs(executionID, stepID string, tailLines int32) []*pb.LogEvent {
	// This would typically query a log storage system
	// For now, we'll return a placeholder implementation
	logs := make([]*pb.LogEvent, 0)

	// Mock some historical logs
	if tailLines > 0 {
		for i := int32(0); i < tailLines && i < 10; i++ {
			log := &pb.LogEvent{
				Timestamp:   time.Now().Add(-time.Duration(i)*time.Minute).Format(time.RFC3339),
				ExecutionId: executionID,
				StepId:      stepID,
				Level:       pb.LogLevel_INFO,
				Message:     fmt.Sprintf("Historical log entry %d", i+1),
				Fields: map[string]string{
					"type": "historical",
					"line": fmt.Sprintf("%d", i+1),
				},
				Source:  "engine-go",
				TraceId: fmt.Sprintf("trace-%s-%d", executionID, i),
			}
			logs = append(logs, log)
		}
	}

	return logs
}

// Event data structures for internal streaming events

type ExecutionEventData struct {
	EventType pb.ExecutionEventType
	Status    pb.ExecutionStatus
	Progress  *pb.ExecutionProgress
	Message   string
	Metadata  map[string]string
}

type StepEventData struct {
	NodeID       string
	Status       pb.StepStatus
	InputData    string
	OutputData   string
	ErrorMessage string
	Metrics      *pb.ExecutionMetrics
	RetryCount   int32
	Metadata     map[string]string
}

type ResourceEventData struct {
	MetricType    pb.MetricType
	Value         float64
	Unit          string
	Labels        map[string]string
	ResourceUsage *pb.ResourceUsage
}

type LogEventData struct {
	NodeID   string
	Level    pb.LogLevel
	Message  string
	Fields   map[string]string
	Source   string
	TraceID  string
}

// Helper functions for creating events

func (s *StreamingService) CreateExecutionEvent(execID, tenantID, stepID string, eventType pb.ExecutionEventType, status pb.ExecutionStatus, message string) {
	eventData := &ExecutionEventData{
		EventType: eventType,
		Status:    status,
		Message:   message,
		Metadata:  make(map[string]string),
	}

	// Get execution progress if available
	if execution, err := s.engine.GetExecution(execID); err == nil {
		eventData.Progress = convertExecutionProgress(execution)
	}

	s.BroadcastEvent(EventTypeExecution, eventData, tenantID, execID, stepID)
}

func (s *StreamingService) CreateStepEvent(execID, stepID, nodeID, tenantID string, status pb.StepStatus, inputData, outputData, errorMsg string) {
	eventData := &StepEventData{
		NodeID:       nodeID,
		Status:       status,
		InputData:    inputData,
		OutputData:   outputData,
		ErrorMessage: errorMsg,
		Metadata:     make(map[string]string),
	}

	s.BroadcastEvent(EventTypeStep, eventData, tenantID, execID, stepID)
}

func (s *StreamingService) CreateLogEvent(execID, stepID, nodeID, tenantID, message, source, traceID string, level pb.LogLevel) {
	eventData := &LogEventData{
		NodeID:  nodeID,
		Level:   level,
		Message: message,
		Fields:  make(map[string]string),
		Source:  source,
		TraceID: traceID,
	}

	s.BroadcastEvent(EventTypeLog, eventData, tenantID, execID, stepID)
}

// Integration helper methods for the workflow engine

func (s *StreamingService) OnExecutionStarted(execution *models.Execution) {
	s.CreateExecutionEvent(
		execution.ID,
		execution.Metadata["tenant_id"],
		"",
		pb.ExecutionEventType_EXECUTION_STARTED,
		convertExecutionStatus(execution.Status),
		"Execution started",
	)
}

func (s *StreamingService) OnExecutionCompleted(execution *models.Execution) {
	eventType := pb.ExecutionEventType_EXECUTION_COMPLETED
	if execution.Status == models.ExecutionStatusFailed {
		eventType = pb.ExecutionEventType_EXECUTION_FAILED
	} else if execution.Status == models.ExecutionStatusCancelled {
		eventType = pb.ExecutionEventType_EXECUTION_CANCELLED
	}

	s.CreateExecutionEvent(
		execution.ID,
		execution.Metadata["tenant_id"],
		"",
		eventType,
		convertExecutionStatus(execution.Status),
		"Execution completed",
	)
}

func (s *StreamingService) OnStepStarted(execution *models.Execution, stepID, nodeID string) {
	s.CreateStepEvent(
		execution.ID,
		stepID,
		nodeID,
		execution.Metadata["tenant_id"],
		pb.StepStatus_STEP_STATUS_RUNNING,
		"", "", "",
	)
}

func (s *StreamingService) OnStepCompleted(execution *models.Execution, stepID, nodeID, outputData string, err error) {
	status := pb.StepStatus_STEP_STATUS_SUCCESS
	errorMsg := ""
	
	if err != nil {
		status = pb.StepStatus_STEP_STATUS_FAILED
		errorMsg = err.Error()
	}

	s.CreateStepEvent(
		execution.ID,
		stepID,
		nodeID,
		execution.Metadata["tenant_id"],
		status,
		"", outputData, errorMsg,
	)
}

// Close gracefully shuts down the streaming service
func (s *StreamingService) Close() {
	close(s.eventBroadcast)
	s.logger.Info("Streaming service closed")
}