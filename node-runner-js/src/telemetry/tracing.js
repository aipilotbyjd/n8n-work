import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

let sdk;

export async function initializeTracing(serviceName, serviceVersion) {
  const resource = Resource.default().merge(
    new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
    }),
  );

  sdk = new NodeSDK({
    resource,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
      }),
    ],
    metricReader: new PeriodicExportingMetricReader({
      exporter: new ConsoleMetricExporter(),
    }),
  });

  try {
    await sdk.start();
    console.log('Telemetry initialized successfully');
  } catch (error) {
    console.error('Error initializing telemetry:', error);
  }

  return gracefulShutdown;
}

export async function gracefulShutdown() {
  if (sdk) {
    try {
      await sdk.shutdown();
      console.log('Telemetry terminated');
    } catch (error) {
      console.error('Error shutting down telemetry:', error);
    }
  }
}
