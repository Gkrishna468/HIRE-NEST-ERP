import opentelemetry from '@opentelemetry/api';

let sdk: any = null;

export const startTracing = () => {
  try {
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    
    sdk = new NodeSDK({
      instrumentations: [getNodeAutoInstrumentations()]
    });
    sdk.start();
    console.log('[Telemetry] OpenTelemetry initialized');
  } catch (error: any) {
    console.warn('[Telemetry] OpenTelemetry skipped or not initialized:', error?.message);
  }
};

export const getTracer = (name: string) => {
  try {
    return opentelemetry.trace.getTracer(name);
  } catch {
    return {
      startSpan: () => ({ end: () => {} }),
      startActiveSpan: (_name: string, fn: (span: any) => any) => fn({ end: () => {} })
    } as any;
  }
};
