import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-grpc';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

let sdk: NodeSDK | null = null;
let isInitialized = false;

export async function initializeTracing(
  serviceName: string,
  serviceVersion: string
): Promise<() => Promise<void>> {
  if (isInitialized) {
    console.warn('OpenTelemetry already initialized');
    return gracefulShutdown;
  }

  try {
    const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';
    const enableTracing = process.env.OTEL_ENABLE_TRACING !== 'false';

    if (!enableTracing) {
      console.log('OpenTelemetry tracing is disabled');
      return async () => {};
    }

    // Create resource with service information
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'n8n-work',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
    });

    // Create trace exporter
    const traceExporter = new OTLPTraceExporter({
      url: otlpEndpoint,
    });

    // Initialize SDK
    sdk = new NodeSDK({
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
            enabled: false, // We're using Fastify, not Express
          },
          '@opentelemetry/instrumentation-fastify': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-amqplib': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-redis': {
            enabled: true,
          },
        }),
      ],
    });

    // Start the SDK
    sdk.start();
    isInitialized = true;

    console.log(`OpenTelemetry initialized successfully for ${serviceName}`);
    console.log(`Exporting traces to: ${otlpEndpoint}`);

    return gracefulShutdown;

  } catch (error) {
    console.error('Failed to initialize OpenTelemetry:', error);
    throw error;
  }
}

export async function gracefulShutdown(): Promise<void> {
  if (sdk) {
    try {
      await sdk.shutdown();
      console.log('OpenTelemetry shut down successfully');
    } catch (error) {
      console.error('Error shutting down OpenTelemetry:', error);
    } finally {
      sdk = null;
      isInitialized = false;
    }
  }
}
