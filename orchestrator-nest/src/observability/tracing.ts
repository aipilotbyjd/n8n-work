import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-grpc';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

let isInitialized = false;

export function initializeOpenTelemetry(): void {
  if (isInitialized) {
    return;
  }

  const serviceName = process.env.OTEL_SERVICE_NAME || 'n8n-work-orchestrator';
  const serviceVersion = process.env.OTEL_SERVICE_VERSION || '0.1.0';
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';
  const enableTracing = process.env.OTEL_ENABLE_TRACING !== 'false';

  if (!enableTracing) {
    console.log('OpenTelemetry tracing is disabled');
    return;
  }

  try {
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'n8n-work',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
    });

    const traceExporter = new OTLPTraceExporter({
      url: otlpEndpoint,
    });

    const sdk = new NodeSDK({
      resource,
      traceExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-http': {
            ignoreIncomingRequestHook: (req) => {
              // Ignore health check and metrics endpoints to reduce noise
              const url = req.url || '';
              return url.includes('/health') || url.includes('/metrics');
            },
          },
          '@opentelemetry/instrumentation-express': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-nestjs-core': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-pg': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-redis': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-grpc': {
            enabled: true,
          },
        }),
      ],
    });

    sdk.start();
    isInitialized = true;

    console.log(`OpenTelemetry initialized successfully for ${serviceName}`);
    console.log(`Exporting traces to: ${otlpEndpoint}`);

    // Graceful shutdown
    process.on('SIGTERM', () => {
      sdk.shutdown()
        .then(() => console.log('OpenTelemetry shut down successfully'))
        .catch((error) => console.error('Error shutting down OpenTelemetry', error))
        .finally(() => process.exit(0));
    });

  } catch (error) {
    console.error('Failed to initialize OpenTelemetry:', error);
  }
}
