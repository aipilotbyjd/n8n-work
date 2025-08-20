package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/spf13/viper"
)

// Config holds all configuration for the application
type Config struct {
	App           AppConfig           `mapstructure:"app"`
	GRPC          GRPCConfig          `mapstructure:"grpc"`
	HTTP          HTTPConfig          `mapstructure:"http"`
	Database      DatabaseConfig      `mapstructure:"database"`
	Redis         RedisConfig         `mapstructure:"redis"`
	MessageQueue  MessageQueueConfig  `mapstructure:"message_queue"`
	Observability ObservabilityConfig `mapstructure:"observability"`
	Execution     ExecutionConfig     `mapstructure:"execution"`
	RateLimit     RateLimitConfig     `mapstructure:"rate_limit"`
}

type AppConfig struct {
	Name        string `mapstructure:"name"`
	Version     string `mapstructure:"version"`
	Environment string `mapstructure:"environment"`
}

type GRPCConfig struct {
	Address string `mapstructure:"address"`
}

type HTTPConfig struct {
	Address string `mapstructure:"address"`
}

type DatabaseConfig struct {
	URL             string        `mapstructure:"url"`
	MaxOpenConns    int           `mapstructure:"max_open_conns"`
	MaxIdleConns    int           `mapstructure:"max_idle_conns"`
	ConnMaxLifetime time.Duration `mapstructure:"conn_max_lifetime"`
}

type RedisConfig struct {
	URL      string `mapstructure:"url"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
}

type MessageQueueConfig struct {
	URL       string            `mapstructure:"url"`
	Exchanges ExchangesConfig   `mapstructure:"exchanges"`
	Queues    QueuesConfig      `mapstructure:"queues"`
	Consumer  ConsumerConfig    `mapstructure:"consumer"`
}

type ExchangesConfig struct {
	Workflow  string `mapstructure:"workflow"`
	Execution string `mapstructure:"execution"`
	Events    string `mapstructure:"events"`
}

type QueuesConfig struct {
	WorkflowExecution string `mapstructure:"workflow_execution"`
	StepExecution     string `mapstructure:"step_execution"`
	EventNotification string `mapstructure:"event_notification"`
}

type ConsumerConfig struct {
	Workers    int           `mapstructure:"workers"`
	PrefetchCount int        `mapstructure:"prefetch_count"`
	RetryDelay time.Duration `mapstructure:"retry_delay"`
}

type ObservabilityConfig struct {
	OTLPEndpoint string `mapstructure:"otlp_endpoint"`
	ServiceName  string `mapstructure:"service_name"`
	Environment  string `mapstructure:"environment"`
}

type ExecutionConfig struct {
	MaxConcurrency   int           `mapstructure:"max_concurrency"`
	DefaultTimeout   time.Duration `mapstructure:"default_timeout"`
	MaxRetries       int           `mapstructure:"max_retries"`
	RetryBackoff     time.Duration `mapstructure:"retry_backoff"`
	BackpressureSize int           `mapstructure:"backpressure_size"`
}

type RateLimitConfig struct {
	Enabled      bool          `mapstructure:"enabled"`
	RequestsPerSecond int      `mapstructure:"requests_per_second"`
	BurstSize    int           `mapstructure:"burst_size"`
	WindowSize   time.Duration `mapstructure:"window_size"`
}

// Load loads configuration from environment variables and config files
func Load() (*Config, error) {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("./config")
	viper.AddConfigPath("/etc/n8n-work")

	// Set defaults
	setDefaults()

	// Bind environment variables
	bindEnvVars()

	// Read config file (optional)
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("failed to read config file: %w", err)
		}
	}

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	// Validate configuration
	if err := validate(&cfg); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	}

	return &cfg, nil
}

func setDefaults() {
	// App defaults
	viper.SetDefault("app.name", "n8n-work-engine")
	viper.SetDefault("app.version", "0.1.0")
	viper.SetDefault("app.environment", "development")

	// Server defaults
	viper.SetDefault("grpc.address", ":50051")
	viper.SetDefault("http.address", ":8080")

	// Database defaults
	viper.SetDefault("database.max_open_conns", 25)
	viper.SetDefault("database.max_idle_conns", 10)
	viper.SetDefault("database.conn_max_lifetime", "5m")

	// Redis defaults
	viper.SetDefault("redis.db", 0)

	// Message queue defaults
	viper.SetDefault("message_queue.exchanges.workflow", "workflow.execute")
	viper.SetDefault("message_queue.exchanges.execution", "execution.step")
	viper.SetDefault("message_queue.exchanges.events", "run.event")
	viper.SetDefault("message_queue.queues.workflow_execution", "workflow.execution")
	viper.SetDefault("message_queue.queues.step_execution", "step.execution")
	viper.SetDefault("message_queue.queues.event_notification", "event.notification")
	viper.SetDefault("message_queue.consumer.workers", 10)
	viper.SetDefault("message_queue.consumer.prefetch_count", 50)
	viper.SetDefault("message_queue.consumer.retry_delay", "5s")

	// Observability defaults
	viper.SetDefault("observability.otlp_endpoint", "http://localhost:4317")
	viper.SetDefault("observability.service_name", "n8n-work-engine")
	viper.SetDefault("observability.environment", "development")

	// Execution defaults
	viper.SetDefault("execution.max_concurrency", 100)
	viper.SetDefault("execution.default_timeout", "30s")
	viper.SetDefault("execution.max_retries", 3)
	viper.SetDefault("execution.retry_backoff", "1s")
	viper.SetDefault("execution.backpressure_size", 1000)

	// Rate limit defaults
	viper.SetDefault("rate_limit.enabled", true)
	viper.SetDefault("rate_limit.requests_per_second", 100)
	viper.SetDefault("rate_limit.burst_size", 200)
	viper.SetDefault("rate_limit.window_size", "1m")
}

func bindEnvVars() {
	// App
	viper.BindEnv("app.environment", "NODE_ENV")

	// Servers
	viper.BindEnv("grpc.address", "GRPC_ADDR")
	viper.BindEnv("http.address", "HTTP_ADDR")

	// Database
	viper.BindEnv("database.url", "POSTGRES_URL")
	viper.BindEnv("database.max_open_conns", "DB_MAX_OPEN_CONNS")
	viper.BindEnv("database.max_idle_conns", "DB_MAX_IDLE_CONNS")
	viper.BindEnv("database.conn_max_lifetime", "DB_CONN_MAX_LIFETIME")

	// Redis
	viper.BindEnv("redis.url", "REDIS_URL")
	viper.BindEnv("redis.password", "REDIS_PASSWORD")
	viper.BindEnv("redis.db", "REDIS_DB")

	// Message Queue
	viper.BindEnv("message_queue.url", "RABBITMQ_URL")

	// Observability
	viper.BindEnv("observability.otlp_endpoint", "OTEL_EXPORTER_OTLP_ENDPOINT")
	viper.BindEnv("observability.service_name", "OTEL_SERVICE_NAME")

	// Execution
	viper.BindEnv("execution.max_concurrency", "ENGINE_CONCURRENCY")
	viper.BindEnv("execution.default_timeout", "STEP_DEFAULT_TIMEOUT_MS")
	viper.BindEnv("execution.max_retries", "RETRY_MAX")
}

func validate(cfg *Config) error {
	if cfg.Database.URL == "" {
		return fmt.Errorf("database.url is required")
	}

	if cfg.MessageQueue.URL == "" {
		return fmt.Errorf("message_queue.url is required")
	}

	if cfg.Execution.MaxConcurrency <= 0 {
		return fmt.Errorf("execution.max_concurrency must be greater than 0")
	}

	return nil
}

// GetEnvAsInt retrieves an environment variable as an integer with a default value
func GetEnvAsInt(key string, defaultValue int) int {
	if value, exists := os.LookupEnv(key); exists {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

// GetEnvAsBool retrieves an environment variable as a boolean with a default value
func GetEnvAsBool(key string, defaultValue bool) bool {
	if value, exists := os.LookupEnv(key); exists {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}

// GetEnvAsDuration retrieves an environment variable as a duration with a default value
func GetEnvAsDuration(key string, defaultValue time.Duration) time.Duration {
	if value, exists := os.LookupEnv(key); exists {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}
