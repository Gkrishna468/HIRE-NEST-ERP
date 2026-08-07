import { describe, it, expect, vi } from 'vitest';
import { MCPExecutor } from './MCPExecutor';
import { RegistryAPI } from '../registry/Registry';
import { PolicyEngineAPI } from '../policy/PolicyTypes';
import { TelemetryServiceAPI } from '../telemetry/TelemetryTypes';
import { AuditServiceAPI } from '../audit/AuditTypes';
import { MCPTool, MCPToolManifest } from '../mcp';
import { ToolContext } from '../mcp/MCPTypes';

describe('MCPExecutor (Golden Path Validation)', () => {
  it('exercises the full tool lifecycle end-to-end', async () => {
    // 1. Setup Mock Services
    const mockRegistry: RegistryAPI = {
      resolve: vi.fn(),
      register: vi.fn(),
      discover: vi.fn(),
      health: vi.fn(),
      versions: vi.fn(),
      deprecate: vi.fn(),
      remove: vi.fn(),
    };
    
    const mockPolicyEngine: PolicyEngineAPI = {
      evaluate: vi.fn().mockResolvedValue({ type: 'Allow' }),
    };

    const mockTelemetry: TelemetryServiceAPI = {
      emit: vi.fn().mockResolvedValue(undefined),
    };

    const mockAudit: AuditServiceAPI = {
      log: vi.fn().mockResolvedValue(undefined),
      query: vi.fn(),
    };

    // 2. Setup Dummy Tool
    const mockTool: MCPTool<{ query: string }, { result: string }> = {
      manifest: {
        id: 'dummy.tool',
        name: 'Dummy Tool',
        version: '1.0.0',
        domain: 'Test',
        owner: 'Platform',
        description: 'Testing tool lifecycle',
        permissions: [],
        capabilities: [],
        auditLevel: 'NONE',
        timeout: '1s',
        retryPolicy: 'none',
        visibility: 'internal',
        status: 'Production',
        tags: []
      },
      validate: vi.fn().mockResolvedValue({ valid: true }),
      authorize: vi.fn().mockResolvedValue({ authorized: true }),
      execute: vi.fn().mockResolvedValue({ result: 'success' }),
      audit: vi.fn().mockResolvedValue(undefined),
      telemetry: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(mockRegistry.resolve).mockReturnValue(mockTool);

    const executor = new MCPExecutor(mockRegistry, mockPolicyEngine, mockTelemetry, mockAudit);
    
    const context: ToolContext = {
      workspaceId: 'ws-123',
      userId: 'u-456',
      correlationId: 'req-789',
      timestamp: new Date().toISOString()
    };

    // 3. Execute!
    const execution = await executor.execute('dummy.tool', { query: 'test' }, context);

    // 4. Validate Pipeline Stages
    // Pipeline Stage 1: Resolve
    expect(mockRegistry.resolve).toHaveBeenCalledWith('dummy.tool');
    
    // Pipeline Stage 2: Policy Validation
    expect(mockPolicyEngine.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      action: 'execute:dummy.tool',
      userId: 'u-456'
    }));

    // Pipeline Stage 3: Tool Authorization
    expect(mockTool.authorize).toHaveBeenCalledWith(context);

    // Pipeline Stage 4: Input Validation
    expect(mockTool.validate).toHaveBeenCalledWith({ query: 'test' });

    // Pipeline Stage 5: Execution
    expect(mockTool.execute).toHaveBeenCalledWith({ query: 'test' }, context);
    expect(execution.success).toBe(true);
    expect(execution.output).toEqual({ result: 'success' });

    // Pipeline Stage 6: Audit (Platform + Tool)
    expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({
      tool: 'dummy.tool',
      actor: 'u-456',
      action: 'execute'
    }));
    expect(mockTool.audit).toHaveBeenCalledWith(execution);

    // Pipeline Stage 7: Telemetry (Platform + Tool)
    expect(mockTelemetry.emit).toHaveBeenCalledWith(expect.objectContaining({
      tool: 'dummy.tool',
      success: true,
      latencyMs: expect.any(Number)
    }));
    expect(mockTool.telemetry).toHaveBeenCalledWith(execution);
  });
});
