export interface ObservabilityRecord {
  traceId: string;
  agentId?: string;
  workflowId?: string;
  capabilityName?: string;
  providerId?: string;
  modelId?: string;
  latencyMs: number;
  tokens?: { input: number; output: number };
  estimatedCostUsd?: number;
  businessOutcome?: string;
  errorCategory?: string;
  timestamp: string;
}

export interface ObservabilityPlatformAPI {
  record(metrics: ObservabilityRecord): Promise<void>;
}
