-- Initialize analytics database and tables
CREATE DATABASE IF NOT EXISTS analytics;

-- Workflow execution logs
CREATE TABLE IF NOT EXISTS analytics.workflow_executions (
    id UUID DEFAULT generateUUIDv4(),
    workflow_id String,
    execution_id String,
    status Enum8('running' = 1, 'completed' = 2, 'failed' = 3, 'cancelled' = 4),
    started_at DateTime64(3),
    finished_at Nullable(DateTime64(3)),
    duration_ms UInt64,
    nodes_executed UInt32,
    success_nodes UInt32,
    failed_nodes UInt32,
    input_data String,
    output_data String,
    error_message Nullable(String),
    created_at DateTime64(3) DEFAULT now64()
) ENGINE = MergeTree()
ORDER BY (workflow_id, started_at)
PARTITION BY toYYYYMM(started_at);

-- Node execution metrics
CREATE TABLE IF NOT EXISTS analytics.node_executions (
    id UUID DEFAULT generateUUIDv4(),
    execution_id String,
    node_id String,
    node_type String,
    status Enum8('running' = 1, 'completed' = 2, 'failed' = 3, 'skipped' = 4),
    started_at DateTime64(3),
    finished_at Nullable(DateTime64(3)),
    duration_ms UInt64,
    memory_usage_mb Float64,
    cpu_usage_percent Float64,
    input_size_bytes UInt64,
    output_size_bytes UInt64,
    error_message Nullable(String),
    created_at DateTime64(3) DEFAULT now64()
) ENGINE = MergeTree()
ORDER BY (execution_id, node_id, started_at)
PARTITION BY toYYYYMM(started_at);

-- System performance metrics
CREATE TABLE IF NOT EXISTS analytics.system_metrics (
    timestamp DateTime64(3),
    service_name String,
    metric_name String,
    metric_value Float64,
    labels Map(String, String),
    created_at DateTime64(3) DEFAULT now64()
) ENGINE = MergeTree()
ORDER BY (service_name, metric_name, timestamp)
PARTITION BY toYYYYMM(timestamp);

-- User activity logs
CREATE TABLE IF NOT EXISTS analytics.user_activity (
    id UUID DEFAULT generateUUIDv4(),
    user_id String,
    action String,
    resource_type String,
    resource_id String,
    ip_address String,
    user_agent String,
    timestamp DateTime64(3),
    success Bool,
    error_message Nullable(String),
    created_at DateTime64(3) DEFAULT now64()
) ENGINE = MergeTree()
ORDER BY (user_id, timestamp)
PARTITION BY toYYYYMM(timestamp);

-- Create materialized views for common queries
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.workflow_execution_stats_hourly
ENGINE = AggregatingMergeTree()
ORDER BY (workflow_id, hour)
PARTITION BY toYYYYMM(hour)
AS SELECT
    workflow_id,
    toStartOfHour(started_at) as hour,
    countState() as execution_count,
    avgState(duration_ms) as avg_duration_ms,
    countIfState(status = 'completed') as success_count,
    countIfState(status = 'failed') as failure_count
FROM analytics.workflow_executions
GROUP BY workflow_id, hour;
