package repo

import (
	"database/sql"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"go.uber.org/zap"
)

// Repository provides data access operations
type Repository struct {
	db     *sqlx.DB
	logger *zap.Logger
}

// New creates a new repository instance
func New(databaseURL string, logger *zap.Logger) (*Repository, error) {
	db, err := sqlx.Connect("postgres", databaseURL)
	if err != nil {
		return nil, err
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)

	repo := &Repository{
		db:     db,
		logger: logger,
	}

	return repo, nil
}

// Close closes the database connection
func (r *Repository) Close() error {
	return r.db.Close()
}

// Ping checks database connectivity
func (r *Repository) Ping() error {
	return r.db.Ping()
}

// GetStats returns database connection statistics
func (r *Repository) GetStats() sql.DBStats {
	return r.db.Stats()
}

// WorkflowExecution represents a workflow execution record
type WorkflowExecution struct {
	ID          string                 `db:"id" json:"id"`
	WorkflowID  string                 `db:"workflow_id" json:"workflow_id"`
	TenantID    string                 `db:"tenant_id" json:"tenant_id"`
	Status      string                 `db:"status" json:"status"`
	TriggerType string                 `db:"trigger_type" json:"trigger_type"`
	InputData   map[string]interface{} `db:"input_data" json:"input_data"`
	OutputData  map[string]interface{} `db:"output_data" json:"output_data"`
	StartedAt   time.Time              `db:"started_at" json:"started_at"`
	CompletedAt *time.Time             `db:"completed_at" json:"completed_at"`
	DurationMs  *int64                 `db:"duration_ms" json:"duration_ms"`
}

// StepExecution represents a step execution record
type StepExecution struct {
	ID          string                 `db:"id" json:"id"`
	ExecutionID string                 `db:"execution_id" json:"execution_id"`
	StepID      string                 `db:"step_id" json:"step_id"`
	NodeID      string                 `db:"node_id" json:"node_id"`
	NodeType    string                 `db:"node_type" json:"node_type"`
	Status      string                 `db:"status" json:"status"`
	Attempt     int                    `db:"attempt" json:"attempt"`
	InputData   map[string]interface{} `db:"input_data" json:"input_data"`
	OutputData  map[string]interface{} `db:"output_data" json:"output_data"`
	StartedAt   time.Time              `db:"started_at" json:"started_at"`
	CompletedAt *time.Time             `db:"completed_at" json:"completed_at"`
	DurationMs  *int64                 `db:"duration_ms" json:"duration_ms"`
}

// CreateWorkflowExecution creates a new workflow execution record
func (r *Repository) CreateWorkflowExecution(exec *WorkflowExecution) error {
	query := `
		INSERT INTO workflow_executions (id, workflow_id, tenant_id, status, trigger_type, input_data, started_at)
		VALUES (:id, :workflow_id, :tenant_id, :status, :trigger_type, :input_data, :started_at)
	`
	_, err := r.db.NamedExec(query, exec)
	return err
}

// UpdateWorkflowExecution updates an existing workflow execution
func (r *Repository) UpdateWorkflowExecution(exec *WorkflowExecution) error {
	query := `
		UPDATE workflow_executions 
		SET status = :status, output_data = :output_data, completed_at = :completed_at, duration_ms = :duration_ms
		WHERE id = :id
	`
	_, err := r.db.NamedExec(query, exec)
	return err
}

// GetWorkflowExecution retrieves a workflow execution by ID
func (r *Repository) GetWorkflowExecution(id string) (*WorkflowExecution, error) {
	var exec WorkflowExecution
	query := `SELECT * FROM workflow_executions WHERE id = $1`
	err := r.db.Get(&exec, query, id)
	if err != nil {
		return nil, err
	}
	return &exec, nil
}

// CreateStepExecution creates a new step execution record
func (r *Repository) CreateStepExecution(step *StepExecution) error {
	query := `
		INSERT INTO step_executions (id, execution_id, step_id, node_id, node_type, status, attempt, input_data, started_at)
		VALUES (:id, :execution_id, :step_id, :node_id, :node_type, :status, :attempt, :input_data, :started_at)
	`
	_, err := r.db.NamedExec(query, step)
	return err
}

// UpdateStepExecution updates an existing step execution
func (r *Repository) UpdateStepExecution(step *StepExecution) error {
	query := `
		UPDATE step_executions 
		SET status = :status, output_data = :output_data, completed_at = :completed_at, duration_ms = :duration_ms
		WHERE id = :id
	`
	_, err := r.db.NamedExec(query, step)
	return err
}

// GetStepExecution retrieves a step execution by ID
func (r *Repository) GetStepExecution(id string) (*StepExecution, error) {
	var step StepExecution
	query := `SELECT * FROM step_executions WHERE id = $1`
	err := r.db.Get(&step, query, id)
	if err != nil {
		return nil, err
	}
	return &step, nil
}

// GetStepExecutionsByWorkflow retrieves all step executions for a workflow execution
func (r *Repository) GetStepExecutionsByWorkflow(executionID string) ([]*StepExecution, error) {
	var steps []*StepExecution
	query := `SELECT * FROM step_executions WHERE execution_id = $1 ORDER BY started_at`
	err := r.db.Select(&steps, query, executionID)
	return steps, err
}
