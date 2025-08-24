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
    // In a real implementation, this would use a proper logger
    // For now, we'll suppress these logs in production
    if (process.env.NODE_ENV !== 'production') {
      console.log('Telemetry initialized successfully');
    }
  } catch (error) {
    // In a real implementation, this would use a proper logger
    // For now, we'll suppress these logs in production
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error initializing telemetry:', error);
    }
  }

  return gracefulShutdown;
}

export async function gracefulShutdown() {
  if (sdk) {
    try {
      await sdk.shutdown();
      // In a real implementation, this would use a proper logger
      // For now, we'll suppress these logs in production
      if (process.env.NODE_ENV !== 'production') {
        console.log('Telemetry terminated');
      }
    } catch (error) {
      // In a real implementation, this would use a proper logger
      // For now, we'll suppress these logs in production
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error shutting down telemetry:', error);
      }
    }
  }
}
