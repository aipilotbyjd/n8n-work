module github.com/n8n-work/engine-go

go 1.21

require (

	// Validation
	github.com/go-playground/validator/v10 v10.16.0

	// Redis
	github.com/go-redis/redis/v8 v8.11.5

	// HTTP client
	github.com/go-resty/resty/v2 v2.10.0

	// Utilities
	github.com/google/uuid v1.4.0
	github.com/jmoiron/sqlx v1.3.5

	// Database
	github.com/lib/pq v1.10.9
	github.com/mitchellh/mapstructure v1.5.0

	// Metrics
	github.com/prometheus/client_golang v1.17.0
	github.com/spf13/cobra v1.8.0

	// Configuration
	github.com/spf13/viper v1.17.0

	// Message Queue
	github.com/streadway/amqp v1.1.0

	// JSON handling
	github.com/tidwall/gjson v1.17.0
	github.com/tidwall/sjson v1.2.5
	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.46.1
	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.46.1

	// OpenTelemetry
	go.opentelemetry.io/otel v1.21.0
	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.21.0
	go.opentelemetry.io/otel/resource v1.21.0
	go.opentelemetry.io/otel/sdk v1.21.0
	go.opentelemetry.io/otel/sdk/trace v1.21.0
	go.opentelemetry.io/otel/trace v1.21.0

	// Logging
	go.uber.org/zap v1.26.0
	golang.org/x/sync v0.5.0
	golang.org/x/time v0.5.0
	// gRPC and Protocol Buffers
	google.golang.org/grpc v1.59.0
	google.golang.org/protobuf v1.31.0

)

require (
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/cespare/xxhash/v2 v2.2.0 // indirect
	github.com/fsnotify/fsnotify v1.7.0 // indirect
	github.com/go-logr/logr v1.3.0 // indirect
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/golang/protobuf v1.5.3 // indirect
	github.com/hashicorp/hcl v1.0.0 // indirect
	github.com/inconshreveable/mousetrap v1.1.0 // indirect
	github.com/magiconair/properties v1.8.7 // indirect
	github.com/matttproud/golang_protobuf_extensions v1.0.4 // indirect
	github.com/pelletier/go-toml/v2 v2.1.0 // indirect
	github.com/prometheus/client_model v0.5.0 // indirect
	github.com/prometheus/common v0.45.0 // indirect
	github.com/prometheus/procfs v0.12.0 // indirect
	github.com/spf13/afero v1.10.0 // indirect
	github.com/spf13/cast v1.5.1 // indirect
	github.com/spf13/jwalterweatherman v1.1.0 // indirect
	github.com/spf13/pflag v1.0.5 // indirect
	github.com/subosito/gotenv v1.6.0 // indirect
	go.opentelemetry.io/otel/metric v1.21.0 // indirect
	go.uber.org/multierr v1.11.0 // indirect
	golang.org/x/net v0.18.0 // indirect
	golang.org/x/sys v0.14.0 // indirect
	golang.org/x/text v0.14.0 // indirect
	google.golang.org/genproto/googleapis/api v0.0.0-20231106174013-bbf56f31fb17 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20231120223509-83a465c0220f // indirect
	gopkg.in/ini.v1 v1.67.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)
