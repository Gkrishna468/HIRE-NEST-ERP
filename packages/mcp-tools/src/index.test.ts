import { describe, it, expect, vi } from 'vitest';
import { 
  MCPExecutor, 
  RegistryAPI, 
  PolicyEngineAPI, 
  TelemetryServiceAPI, 
  AuditServiceAPI, 
  ToolContext 
} from '@hirenest/platform-sdk';

import { CandidateService, RequirementService, VendorService, ExecutiveService } from '@hirenest/core-services';

import { CandidateSearchTool } from './candidate/CandidateSearchTool';
import { RequirementSearchTool } from './requirement/RequirementSearchTool';
import { VendorSearchTool } from './vendor/VendorSearchTool';
import { ExecutiveKpiSummaryTool } from './executive/ExecutiveKpiSummaryTool';

describe('MCP Tools (Sprint 2 Validation)', () => {
  it('exercises full lifecycle for all domains', async () => {
    const mockRegistry: RegistryAPI = {
      resolve: vi.fn(),
      register: vi.fn(),
      discover: vi.fn(),
      health: vi.fn(),
      versions: vi.fn(),
      deprecate: vi.fn(),
      remove: vi.fn(),
    };
    const mockPolicyEngine: PolicyEngineAPI = { evaluate: vi.fn().mockResolvedValue({ type: 'Allow' }) };
    const mockTelemetry: TelemetryServiceAPI = { emit: vi.fn().mockResolvedValue(undefined) };
    const mockAudit: AuditServiceAPI = { log: vi.fn().mockResolvedValue(undefined), query: vi.fn() };

    const executor = new MCPExecutor(mockRegistry, mockPolicyEngine, mockTelemetry, mockAudit);
    const context: ToolContext = { workspaceId: 'ws', userId: 'u1', correlationId: 'req1', timestamp: new Date().toISOString() };

    // Set up mock services
    const candidateService = new CandidateService();
    vi.spyOn(candidateService, 'search');
    const requirementService = new RequirementService();
    vi.spyOn(requirementService, 'search');
    const vendorService = new VendorService();
    vi.spyOn(vendorService, 'search');
    const executiveService = new ExecutiveService();
    vi.spyOn(executiveService, 'getKpiSummary');

    // Register Tools in Mock Registry
    const tools = {
      'candidate.search': new CandidateSearchTool(candidateService),
      'requirement.search': new RequirementSearchTool(requirementService),
      'vendor.search': new VendorSearchTool(vendorService),
      'executive.kpi.summary': new ExecutiveKpiSummaryTool(executiveService)
    };

    vi.mocked(mockRegistry.resolve).mockImplementation((id) => (tools as any)[id]);

    // Test Candidate Search
    const cExec = await executor.execute('candidate.search', { location: 'NY' }, context);
    expect(cExec.success).toBe(true);
    expect(candidateService.search).toHaveBeenCalledWith({ location: 'NY' });
    expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ tool: 'candidate.search' }));
    
    // Test Requirement Search
    const rExec = await executor.execute('requirement.search', { title: 'Engineer' }, context);
    expect(rExec.success).toBe(true);
    expect(requirementService.search).toHaveBeenCalledWith({ title: 'Engineer' });
    expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ tool: 'requirement.search' }));

    // Test Vendor Search
    const vExec = await executor.execute('vendor.search', { tier: 'GOLD' }, context);
    expect(vExec.success).toBe(true);
    expect(vendorService.search).toHaveBeenCalledWith({ tier: 'GOLD' });
    expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ tool: 'vendor.search' }));

    // Test Executive KPI Summary
    const eExec = await executor.execute('executive.kpi.summary', { timeframe: 'month' }, context);
    expect(eExec.success).toBe(true);
    expect(executiveService.getKpiSummary).toHaveBeenCalledWith('month');
    expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ tool: 'executive.kpi.summary' }));
  });
});
