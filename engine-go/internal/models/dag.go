
package models

// DAG represents a directed acyclic graph for workflow execution
type DAG struct {
	ID    string  `json:"id"`
	Name  string  `json:"name"`
	Nodes []*Node `json:"nodes"`
}

// Node represents a single workflow node
type Node struct {
	ID           string      `json:"id"`
	Type         string      `json:"type"`
	Name         string      `json:"name"`
	Parameters   string      `json:"parameters"`
	Dependencies []string    `json:"dependencies"`
	Policy       *NodePolicy `json:"policy,omitempty"`
}

// NodePolicy defines execution policies for a node
type NodePolicy struct {
	TimeoutSeconds     int  `json:"timeout_seconds"`
	RetryCount         int  `json:"retry_count"`
	RetryDelay         int  `json:"retry_delay_ms"`
	MaxMemoryMB        int  `json:"max_memory_mb"`
	MaxCpuPercent      int  `json:"max_cpu_percent"`
	AllowNetworkAccess bool `json:"allow_network_access"`
}
