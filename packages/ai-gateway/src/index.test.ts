import { describe, it, expect, vi } from 'vitest';
import { AIGateway, CapabilityRequest } from './gateway/AIGateway';
import { CapabilityRegistry } from './registry/CapabilityRegistry';
import { AIProvider } from './provider/AIProvider';
import { PolicyEngineAPI, TelemetryServiceAPI, AuditServiceAPI, CapabilityDefinition } from '@hirenest/platform-sdk';

describe('AI Gateway & Capability Registry (Sprint 3 Validation)', () => {
  it('routes capability requests to the correct provider', async () => {
    const registry = new CapabilityRegistry();
    
    // 1. Setup Mock Provider
    const mockGemini: AIProvider = {
      id: 'gemini',
      name: 'Google Gemini',
      chat: vi.fn().mockResolvedValue({ text: 'Hello from Gemini' }),
      embed: vi.fn(),
      vision: vi.fn(),
      speech: vi.fn(),
      image: vi.fn(),
      rerank: vi.fn(),
      health: vi.fn().mockResolvedValue('healthy')
    };

    const mockOllama: AIProvider = {
      id: 'ollama',
      name: 'Ollama Local',
      chat: vi.fn().mockResolvedValue({ text: 'Hello from Ollama' }),
      embed: vi.fn(),
      vision: vi.fn(),
      speech: vi.fn(),
      image: vi.fn(),
      rerank: vi.fn(),
      health: vi.fn().mockResolvedValue('healthy')
    };

    // 2. Setup Mock Services
    const mockPolicyEngine: PolicyEngineAPI = { evaluate: vi.fn().mockResolvedValue({ type: 'Allow' }) };
    const mockTelemetry: TelemetryServiceAPI = { emit: vi.fn().mockResolvedValue(undefined) };
    const mockAudit: AuditServiceAPI = { log: vi.fn().mockResolvedValue(undefined), query: vi.fn() };

    const gateway = new AIGateway(registry, mockPolicyEngine, mockTelemetry, mockAudit);
    gateway.registerProvider(mockGemini);
    gateway.registerProvider(mockOllama);

    // 3. Register Capability
    const chatCap: CapabilityDefinition = {
      name: 'chat',
      version: '1.0.0',
      category: 'General',
      supportedProviders: ['gemini', 'ollama'],
      primaryProvider: 'gemini',
      fallbackProviders: ['ollama'],
      sla: '99.9%',
      timeoutMs: 10000,
      costClass: 'medium',
      healthState: 'healthy'
    };
    registry.register(chatCap);

    const request: CapabilityRequest = {
      capabilityName: 'chat',
      operation: 'chat',
      payload: { prompt: 'Hi' },
      context: { userId: 'u1', workspaceId: 'ws1', correlationId: 'req1' }
    };

    // 4. Test Primary Routing
    const response = await gateway.executeCapability(request);
    expect(response.success).toBe(true);
    expect(response.providerId).toBe('gemini');
    expect(mockGemini.chat).toHaveBeenCalledWith({ prompt: 'Hi' });

    // 5. Test Fallback Routing
    registry.updateHealth('chat', 'degraded');
    const fallbackResponse = await gateway.executeCapability(request);
    expect(fallbackResponse.success).toBe(true);
    expect(fallbackResponse.providerId).toBe('ollama');
    expect(mockOllama.chat).toHaveBeenCalledWith({ prompt: 'Hi' });

    // 6. Test Policy Denial
    vi.mocked(mockPolicyEngine.evaluate).mockResolvedValueOnce({ type: 'Deny', reason: 'quota exceeded' });
    const deniedResponse = await gateway.executeCapability(request);
    expect(deniedResponse.success).toBe(false);
    expect(deniedResponse.error).toContain('Policy denied');
  });
});
