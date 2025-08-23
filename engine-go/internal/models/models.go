package models

import (
	"time"
)

// ExecutionStatus represents the status of a workflow execution
type ExecutionStatus string

const (
	ExecutionStatusPending   ExecutionStatus = "pending"
	ExecutionStatusRunning   ExecutionStatus = "running"
	ExecutionStatusSuccess   ExecutionStatus = "success"
	ExecutionStatusFailed    ExecutionStatus = "failed"
	ExecutionStatusCancelled ExecutionStatus = "cancelled"
	ExecutionStatusTimeout   ExecutionStatus = "timeout"
)

// StepStatus represents the status of a workflow step
type StepStatus string

const (
	StepStatusPending   StepStatus = "pending"
	StepStatusRunning   StepStatus = "running"
	StepStatusSuccess   StepStatus = "success"
	StepStatusFailed    StepStatus = "failed"
	StepStatusCancelled StepStatus = "cancelled"
	StepStatusTimeout   StepStatus = "timeout"
	StepStatusSkipped   StepStatus = "skipped"
)

// Execution represents a workflow execution
type Execution struct {
	ID          string                 `json:"id" db:"id"`
	WorkflowID  string                 `json:"workflow_id" db:"workflow_id"`
	TenantID    string                 `json:"tenant_id" db:"tenant_id"`
	Status      ExecutionStatus        `json:"status" db:"status"`
	StartedAt   time.Time              `json:"started_at" db:"started_at"`
	CompletedAt *time.Time             `json:"completed_at,omitempty" db:"completed_at"`
	Input       map[string]interface{} `json:"input,omitempty"`
	Output      map[string]interface{} `json:"output,omitempty"`
	Error       *string                `json:"error,omitempty" db:"error"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt   time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at" db:"updated_at"`
	
	// Execution metrics
	Duration    *time.Duration         `json:"duration,omitempty"`
	StepsTotal  int                    `json:"steps_total"`
	StepsPassed int                    `json:"steps_passed"`
	StepsFailed int                    `json:"steps_failed"`
}

// WorkflowNode represents a workflow node (enhanced version)
type WorkflowNode struct {
	ID           string                 `json:"id"`
	Type         string                 `json:"type"`
	Name         string                 `json:"name"`
	Description  string                 `json:"description,omitempty"`
	Parameters   map[string]interface{} `json:"parameters"`
	Position     Position               `json:"position"`
	Dependencies []string               `json:"dependencies,omitempty"`
	Policy       *NodePolicy            `json:"policy,omitempty"`
	
	// Runtime configuration
	RetryOnFailure bool                  `json:"retry_on_failure"`
	MaxRetries     int                   `json:"max_retries"`
	RetryDelay     time.Duration         `json:"retry_delay"`
	Timeout        time.Duration         `json:"timeout"`
	Enabled        bool                  `json:"enabled"`
	Tags           []string              `json:"tags,omitempty"`
}

// StepExecution represents the execution state of a single step
type StepExecution struct {
	ID            string                 `json:"id" db:"id"`
	ExecutionID   string                 `json:"execution_id" db:"execution_id"`
	NodeID        string                 `json:"node_id" db:"node_id"`
	Status        StepStatus             `json:"status" db:"status"`
	StartedAt     time.Time              `json:"started_at" db:"started_at"`
	CompletedAt   *time.Time             `json:"completed_at,omitempty" db:"completed_at"`
	Input         map[string]interface{} `json:"input,omitempty"`
	Output        map[string]interface{} `json:"output,omitempty"`
	Error         *string                `json:"error,omitempty" db:"error"`
	RetryCount    int                    `json:"retry_count" db:"retry_count"`
	Duration      *time.Duration         `json:"duration,omitempty"`
	MemoryUsed    *int64                 `json:"memory_used,omitempty"`
	CpuUsed       *float64               `json:"cpu_used,omitempty"`
	CreatedAt     time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at" db:"updated_at"`
}

// Node represents a workflow node (legacy, keeping for compatibility)
type Node struct {
	ID         string                 `json:"id"`
	Type       string                 `json:"type"`
	Name       string                 `json:"name"`
	Parameters map[string]interface{} `json:"parameters"`
	Position   Position               `json:"position"`
}

// Position represents node position in workflow
type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// Workflow represents a workflow definition
type Workflow struct {
	ID          string                 `json:"id" db:"id"`
	Name        string                 `json:"name" db:"name"`
	Description string                 `json:"description" db:"description"`
	Version     int                    `json:"version" db:"version"`
	Active      bool                   `json:"active" db:"active"`
	Nodes       []Node                 `json:"nodes"`
	Connections []Connection           `json:"connections"`
	Settings    map[string]interface{} `json:"settings"`
	CreatedAt   time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at" db:"updated_at"`
	
	// Enhanced workflow properties
	TenantID    string                 `json:"tenant_id" db:"tenant_id"`
	Tags        []string               `json:"tags,omitempty"`
	Schedule    *WorkflowSchedule      `json:"schedule,omitempty"`
	Policy      *WorkflowPolicy        `json:"policy,omitempty"`
}

// Connection represents a connection between nodes
type Connection struct {
	Source     string `json:"source"`
	Target     string `json:"target"`
	SourcePort string `json:"source_port,omitempty"`
	TargetPort string `json:"target_port,omitempty"`
	Condition  string `json:"condition,omitempty"` // Optional condition for conditional connections
}

// WorkflowSchedule represents workflow scheduling configuration
type WorkflowSchedule struct {
	Enabled     bool      `json:"enabled"`
	CronExpr    string    `json:"cron_expr,omitempty"`
	Interval    string    `json:"interval,omitempty"`
	StartDate   time.Time `json:"start_date,omitempty"`
	EndDate     time.Time `json:"end_date,omitempty"`
	Timezone    string    `json:"timezone,omitempty"`
	MaxRuns     int       `json:"max_runs,omitempty"`
}

// WorkflowPolicy represents workflow-level execution policies
type WorkflowPolicy struct {
	TimeoutSeconds     int                    `json:"timeout_seconds"`
	MaxConcurrency     int                    `json:"max_concurrency"`
	RetryPolicy        *RetryPolicy           `json:"retry_policy,omitempty"`
	ResourceLimits     *ResourceLimits        `json:"resource_limits,omitempty"`
	Notifications      []NotificationConfig   `json:"notifications,omitempty"`
	ErrorHandling      *ErrorHandlingPolicy   `json:"error_handling,omitempty"`
}

// RetryPolicy defines retry behavior
type RetryPolicy struct {
	MaxRetries    int           `json:"max_retries"`
	InitialDelay  time.Duration `json:"initial_delay"`
	MaxDelay      time.Duration `json:"max_delay"`
	BackoffFactor float64       `json:"backoff_factor"`
	RetryableErrors []string    `json:"retryable_errors,omitempty"`
}

// ResourceLimits defines resource constraints
type ResourceLimits struct {
	MaxMemoryMB    int     `json:"max_memory_mb"`
	MaxCpuPercent  int     `json:"max_cpu_percent"`
	MaxDiskMB      int     `json:"max_disk_mb"`
	MaxNetworkMbps float64 `json:"max_network_mbps"`
	MaxExecutionTime time.Duration `json:"max_execution_time"`
}

// NotificationConfig defines notification settings
type NotificationConfig struct {
	Type       string                 `json:"type"` // email, webhook, slack, etc.
	Target     string                 `json:"target"`
	Events     []string               `json:"events"` // success, failure, timeout, etc.
	Settings   map[string]interface{} `json:"settings,omitempty"`
}

// ErrorHandlingPolicy defines how errors should be handled
type ErrorHandlingPolicy struct {
	OnFailure       string   `json:"on_failure"` // stop, continue, retry
	IgnoreErrors    []string `json:"ignore_errors,omitempty"`
	EscalateErrors  []string `json:"escalate_errors,omitempty"`
	FailurePath     string   `json:"failure_path,omitempty"` // Alternative execution path on failure
}
