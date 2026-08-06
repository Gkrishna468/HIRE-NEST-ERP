import opentelemetry from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';

// Initialize OpenTelemetry
const sdk = new NodeSDK({
  traceExporter: new ConsoleSpanExporter(),
  instrumentations: [getNodeAutoInstrumentations()]
});

export const startTracing = () => {
    try {
        sdk.start();
        console.log('[Telemetry] OpenTelemetry initialized with Console Exporter');
    } catch (error) {
        console.error('[Telemetry] Error initializing OpenTelemetry', error);
    }
};

export const getTracer = (name: string) => opentelemetry.trace.getTracer(name);
