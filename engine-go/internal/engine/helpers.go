
package engine

import (
	"encoding/json"
	"fmt"

	pb "github.com/n8n-work/engine-go/proto"
	"github.com/n8n-work/engine-go/internal/models"
)

// convertWorkflowToDAG converts a protobuf workflow to internal DAG representation
func (e *WorkflowEngine) convertWorkflowToDAG(workflow *pb.Workflow) (*models.DAG, error) {
	if workflow == nil {
		return nil, fmt.Errorf("workflow cannot be nil")
	}

	dag := &models.DAG{
		ID:    workflow.Id,
		Name:  workflow.Name,
		Nodes: make([]*models.Node, 0, len(workflow.Nodes)),
	}

	// Convert nodes
	for _, pbNode := range workflow.Nodes {
		node := &models.Node{
			ID:           pbNode.Id,
			Type:         pbNode.Type,
			Name:         pbNode.Name,
			Parameters:   pbNode.Parameters,
			Dependencies: pbNode.Dependencies,
		}

		// Convert policy if present
		if pbNode.Policy != nil {
			node.Policy = &models.NodePolicy{
				TimeoutSeconds:    int(pbNode.Policy.TimeoutSeconds),
				RetryCount:        int(pbNode.Policy.RetryCount),
				RetryDelay:        int(pbNode.Policy.RetryDelayMs),
				MaxMemoryMB:       int(pbNode.Policy.MaxMemoryMb),
				MaxCpuPercent:     int(pbNode.Policy.MaxCpuPercent),
				AllowNetworkAccess: pbNode.Policy.AllowNetworkAccess,
			}
		}

		dag.Nodes = append(dag.Nodes, node)
	}

	return dag, nil
}

// validateDAG validates that a DAG is valid for execution
func (e *WorkflowEngine) validateDAG(dag *models.DAG) error {
	if dag == nil {
		return fmt.Errorf("DAG cannot be nil")
	}

	if len(dag.Nodes) == 0 {
		return fmt.Errorf("DAG must have at least one node")
	}

	// Check for duplicate node IDs
	nodeIds := make(map[string]bool)
	for _, node := range dag.Nodes {
		if nodeIds[node.ID] {
			return fmt.Errorf("duplicate node ID: %s", node.ID)
		}
		nodeIds[node.ID] = true
	}

	// Validate dependencies exist
	for _, node := range dag.Nodes {
		for _, depId := range node.Dependencies {
			if !nodeIds[depId] {
				return fmt.Errorf("node %s depends on non-existent node %s", node.ID, depId)
			}
		}
	}

	// Check for circular dependencies
	if err := e.checkCircularDependencies(dag); err != nil {
		return err
	}

	return nil
}

// checkCircularDependencies checks for circular dependencies in the DAG
func (e *WorkflowEngine) checkCircularDependencies(dag *models.DAG) error {
	visited := make(map[string]bool)
	recursionStack := make(map[string]bool)

	var dfs func(nodeId string) bool
	dfs = func(nodeId string) bool {
		visited[nodeId] = true
		recursionStack[nodeId] = true

		// Find the node
		var node *models.Node
		for _, n := range dag.Nodes {
			if n.ID == nodeId {
				node = n
				break
			}
		}

		if node == nil {
			return false
		}

		// Check dependencies
		for _, depId := range node.Dependencies {
			if !visited[depId] {
				if dfs(depId) {
					return true
				}
			} else if recursionStack[depId] {
				return true
			}
		}

		recursionStack[nodeId] = false
		return false
	}

	for _, node := range dag.Nodes {
		if !visited[node.ID] {
			if dfs(node.ID) {
				return fmt.Errorf("circular dependency detected")
			}
		}
	}

	return nil
}

// convertMapStringString converts map[string]string to map[string]interface{}
func convertMapStringString(m map[string]string) map[string]interface{} {
	result := make(map[string]interface{})
	for k, v := range m {
		result[k] = v
	}
	return result
}

// convertNodePolicy converts protobuf policy to internal policy
func convertNodePolicy(policy *pb.NodePolicy) *models.NodePolicy {
	if policy == nil {
		return nil
	}

	return &models.NodePolicy{
		TimeoutSeconds:     int(policy.TimeoutSeconds),
		RetryCount:         int(policy.RetryCount),
		RetryDelay:         int(policy.RetryDelayMs),
		MaxMemoryMB:        int(policy.MaxMemoryMb),
		MaxCpuPercent:      int(policy.MaxCpuPercent),
		AllowNetworkAccess: policy.AllowNetworkAccess,
	}
}

// processStepResults processes step results from the channel
func (e *WorkflowEngine) processStepResults(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			// This is handled in the main execution loop
			// This function exists to satisfy the interface
		}
	}
}
