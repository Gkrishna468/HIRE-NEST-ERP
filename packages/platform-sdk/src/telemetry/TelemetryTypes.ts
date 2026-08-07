/** The standard envelope for all telemetry metrics across the platform */
export interface TelemetryEnvelope {
  requestId: string;
  workflowId?: string;
  tool: string;
  version: string;
  workspaceId: string;
  agentId?: string;
  latencyMs: number;
  success: boolean;
  error?: string;
  timestamp: string;
}

/** 
 * TelemetryServiceAPI handles emitting standard telemetry records.
 */
export interface TelemetryServiceAPI {
  /** Emits a telemetry envelope for observability */
  emit(envelope: TelemetryEnvelope): Promise<void>;
}
