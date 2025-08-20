"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeOpenTelemetry = initializeOpenTelemetry;
const sdk_node_1 = require("@opentelemetry/sdk-node");
const resources_1 = require("@opentelemetry/resources");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const exporter_otlp_grpc_1 = require("@opentelemetry/exporter-otlp-grpc");
const auto_instrumentations_node_1 = require("@opentelemetry/auto-instrumentations-node");
let isInitialized = false;
function initializeOpenTelemetry() {
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
        const resource = new resources_1.Resource({
            [semantic_conventions_1.SemanticResourceAttributes.SERVICE_NAME]: serviceName,
            [semantic_conventions_1.SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
            [semantic_conventions_1.SemanticResourceAttributes.SERVICE_NAMESPACE]: 'n8n-work',
            [semantic_conventions_1.SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
        });
        const traceExporter = new exporter_otlp_grpc_1.OTLPTraceExporter({
            url: otlpEndpoint,
        });
        const sdk = new sdk_node_1.NodeSDK({
            resource,
            traceExporter,
            instrumentations: [
                (0, auto_instrumentations_node_1.getNodeAutoInstrumentations)({
                    '@opentelemetry/instrumentation-http': {
                        ignoreIncomingRequestHook: (req) => {
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
        process.on('SIGTERM', () => {
            sdk.shutdown()
                .then(() => console.log('OpenTelemetry shut down successfully'))
                .catch((error) => console.error('Error shutting down OpenTelemetry', error))
                .finally(() => process.exit(0));
        });
    }
    catch (error) {
        console.error('Failed to initialize OpenTelemetry:', error);
    }
}
//# sourceMappingURL=tracing.js.map