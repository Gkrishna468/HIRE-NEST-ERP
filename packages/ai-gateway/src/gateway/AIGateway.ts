import { CapabilityRegistryAPI, PolicyEngineAPI, TelemetryServiceAPI, AuditServiceAPI } from '@hirenest/platform-sdk';
import { AIProvider } from '../provider/AIProvider';

export interface CapabilityRequest {
  capabilityName: string;
  operation: 'chat' | 'embed' | 'vision' | 'speech' | 'image' | 'rerank';
  payload: any;
  context: {
    userId: string;
    workspaceId: string;
    correlationId: string;
  };
}

export interface CapabilityResponse {
  success: boolean;
  providerId?: string;
  data?: any;
  error?: string;
  latencyMs: number;
}

export class AIGateway {
  private providers: Map<string, AIProvider> = new Map();

  constructor(
    private registry: CapabilityRegistryAPI,
    private policyEngine: PolicyEngineAPI,
    private telemetry: TelemetryServiceAPI,
    private audit: AuditServiceAPI
  ) {}

  registerProvider(provider: AIProvider) {
    this.providers.set(provider.id, provider);
  }

  async executeCapability(request: CapabilityRequest): Promise<CapabilityResponse> {
    const startTime = Date.now();
    let response: CapabilityResponse = {
      success: false,
      latencyMs: 0
    };

    try {
      // 1. Resolve Capability
      const capability = this.registry.resolve(request.capabilityName);
      if (!capability) throw new Error(`Capability not found: ${request.capabilityName}`);

      // 2. Policy Authorization
      const decision = await this.policyEngine.evaluate({
        userId: request.context.userId,
        workspaceId: request.context.workspaceId,
        action: `capability:${request.capabilityName}:${request.operation}`
      });

      if (decision.type === 'Deny') {
        throw new Error(`Policy denied: ${decision.reason}`);
      }

      // 3. Provider Selection
      let selectedProviderId = capability.primaryProvider;
      let provider = this.providers.get(selectedProviderId);
      
      // Basic Health/Fallback Routing
      if (!provider || capability.healthState !== 'healthy') {
        selectedProviderId = capability.fallbackProviders[0];
        provider = selectedProviderId ? this.providers.get(selectedProviderId) : undefined;
      }

      if (!provider) {
        throw new Error(`No available providers for capability: ${request.capabilityName}`);
      }

      response.providerId = provider.id;

      // 4. Execution
      const result = await (provider as any)[request.operation](request.payload);
      response.data = result;
      response.success = true;

    } catch (error: any) {
      response.error = error.message;
      response.success = false;
    } finally {
      response.latencyMs = Date.now() - startTime;

      // 5. Telemetry & Audit
      await this.telemetry.emit({
        requestId: request.context.correlationId,
        tool: `capability:${request.capabilityName}`,
        version: '1.0.0',
        workspaceId: request.context.workspaceId,
        latencyMs: response.latencyMs,
        success: response.success,
        error: response.error,
        timestamp: new Date().toISOString()
      }).catch(() => {});

      await this.audit.log({
        actor: request.context.userId,
        tool: 'ai-gateway',
        action: `capability:${request.capabilityName}`,
        entity: 'capability',
        timestamp: new Date().toISOString(),
        correlationId: request.context.correlationId,
        workspaceId: request.context.workspaceId,
        after: { success: response.success, provider: response.providerId, error: response.error }
      }).catch(() => {});
    }

    return response;
  }
}
