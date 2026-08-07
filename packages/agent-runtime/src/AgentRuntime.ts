import { 
  AgentManifest, 
  AgentRuntimeAPI, 
  AgentContext, 
  AgentResponse,
  WorkflowEngineAPI,
  MemoryPlatformAPI,
  EventPlatformAPI,
  ObservabilityPlatformAPI,
  AgentRegistryAPI
} from '@hirenest/platform-sdk';

export interface AIGatewayAPI {
  executeCapability(request: any): Promise<any>;
}

export class AgentRuntime implements AgentRuntimeAPI {
  constructor(
    private aiGateway: AIGatewayAPI,
    private workflowEngine: WorkflowEngineAPI,
    private memory: MemoryPlatformAPI,
    private eventBus: EventPlatformAPI,
    private observability: ObservabilityPlatformAPI,
    private registry: AgentRegistryAPI
  ) {}

  async spawn(manifest: AgentManifest): Promise<void> {
    await this.registry.register(manifest);
    
    await this.eventBus.publish({
      id: `agent-spawn-${Date.now()}`,
      type: 'agent.spawned',
      source: 'agent-runtime',
      timestamp: new Date().toISOString(),
      data: { agentId: manifest.id, role: manifest.role, status: manifest.status }
    });
  }

  async chat(agentId: string, input: string, context: AgentContext): Promise<AgentResponse> {
    const manifest = await this.registry.resolve(agentId);
    if (!manifest) throw new Error(`Agent not found: ${agentId}`);

    if (manifest.status === 'ARCHIVED' || manifest.status === 'DEPRECATED') {
      throw new Error(`Agent ${agentId} is ${manifest.status} and cannot be used.`);
    }

    const startTime = Date.now();

    try {
      // 1. Memory Retrieval (Context Injection)
      const operationalMemory = await this.memory.get(context.sessionId, 'operational');
      
      // 2. AI Reasoning via Gateway
      const reasoningCapability = manifest.modelConfig.reasoning.capability;
      const aiRequest = {
        capabilityName: reasoningCapability,
        operation: 'chat',
        payload: {
          messages: [
            { role: 'system', content: `You are ${manifest.name}, a ${manifest.role}. ${manifest.description}` },
            { role: 'user', content: input }
          ],
          context: operationalMemory
        },
        context: {
          userId: context.userId,
          workspaceId: context.workspaceId,
          correlationId: context.correlationId
        }
      };

      const aiResponse = await this.aiGateway.executeCapability(aiRequest);

      if (!aiResponse.success) {
        throw new Error(`AI Reasoning failed: ${aiResponse.error}`);
      }

      // 3. Post-Process (Simplified: Check for tool calls or just return text)
      // In a real runtime, we would handle recursive tool execution loops here.
      const result: AgentResponse = {
        text: aiResponse.data.text || aiResponse.data.content || "I couldn't generate a response.",
        usage: aiResponse.data.usage
      };

      // 4. Memory Persistence
      await this.memory.set(context.sessionId, 'operational', {
        ...operationalMemory,
        lastInteraction: {
          input,
          output: result.text,
          timestamp: new Date().toISOString()
        }
      });

      // 5. Telemetry
      await this.observability.track({
        type: 'trace',
        id: context.correlationId,
        name: 'agent.chat',
        timestamp: new Date().toISOString(),
        metadata: {
          agentId,
          latencyMs: Date.now() - startTime,
          success: true
        }
      });

      return result;

    } catch (error: any) {
      await this.observability.track({
        type: 'trace',
        id: context.correlationId,
        name: 'agent.chat',
        timestamp: new Date().toISOString(),
        metadata: {
          agentId,
          error: error.message,
          success: false
        }
      });
      throw error;
    }
  }
}
