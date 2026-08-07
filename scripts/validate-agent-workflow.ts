import { 
  MCPExecutor, 
  RegistryAPI, 
  PolicyEngineAPI, 
  TelemetryServiceAPI, 
  AuditServiceAPI,
  CapabilityRegistryAPI,
  EventPlatformAPI,
  MemoryPlatformAPI,
  ObservabilityPlatformAPI,
  WorkflowDefinition,
  AgentContext,
  certifyAgent
} from '@hirenest/platform-sdk';

import { AIGateway } from '../packages/ai-gateway/src/gateway/AIGateway';
import { WorkflowEngine } from '../packages/workflow-engine/src/engine/WorkflowEngine';
import { AgentRuntime } from '../packages/agent-runtime/src/AgentRuntime';
import { AgentRegistry } from '../packages/agent-registry/src/AgentRegistry';
import { WorkflowCatalog } from '../packages/workflow-catalog/src/WorkflowCatalog';
import { ApprovalPlatform } from '../packages/approval-platform/src/ApprovalPlatform';
import { RecruiterAgentManifest } from '../packages/agent-definitions/src/RecruiterAgent';

async function validateAgentWorkflow() {
  console.log('--- HN-015 Enterprise Agent Platform Validation ---');

  // 1. Mock Infrastructure
  const tools = ['candidate.search', 'requirement.get', 'submission.create'];
  const mockRegistry: RegistryAPI = {
    register: () => {},
    resolve: (id) => {
      if (tools.includes(id)) {
        return {
          manifest: { id, name: id, version: '1.0.0' },
          execute: async () => [{ id: 'cand-1', name: 'John Doe', skills: ['Java', 'London'] }],
          validate: async () => ({ valid: true }),
          authorize: async () => ({ authorized: true }),
          audit: async () => {},
          telemetry: async () => {}
        } as any;
      }
      return undefined;
    },
    list: () => []
  };

  const capabilities = ['talent.reasoning', 'talent.matching', 'market.intelligence'];
  const mockCapabilityRegistry: CapabilityRegistryAPI = {
    register: () => {},
    resolve: (name) => {
      if (capabilities.includes(name)) {
        return {
          name,
          version: '1.0.0',
          category: 'reasoning',
          owner: 'hirenest',
          domain: 'talent',
          supportedProviders: ['mock-ai'],
          primaryProvider: 'mock-ai',
          fallbackProviders: [],
          sla: '99.9',
          timeoutMs: 5000,
          costClass: 'low',
          healthState: 'healthy',
          status: 'active'
        };
      }
      return undefined;
    },
    list: () => [],
    updateHealth: () => {}
  };

  const mockPolicyEngine: PolicyEngineAPI = {
    evaluate: async () => ({ type: 'Allow' }),
    updateRules: () => {}
  };

  const mockTelemetry: TelemetryServiceAPI = {
    emit: async (e) => console.log(`[Telemetry] ${e.tool} success=${e.success}`),
    query: async () => []
  };

  const mockAudit: AuditServiceAPI = {
    log: async (a) => console.log(`[Audit] ${a.tool} action=${a.action}`),
    query: async () => []
  };

  const mockEventBus: EventPlatformAPI = {
    publish: async (e) => console.log(`[Event] ${e.type}`),
    subscribe: () => {}
  };

  const mockMemory: MemoryPlatformAPI = {
    get: async () => ({}),
    set: async () => {},
    clear: async () => {}
  };

  const mockObservability: ObservabilityPlatformAPI = {
    record: async (r) => console.log(`[Observability] ${r.businessOutcome}`),
    track: async (t) => console.log(`[Observability Trace] ${t.name}`),
    getRecords: async () => []
  };

  const mockAIProvider = {
    id: 'mock-ai',
    chat: async () => ({ text: 'Based on your request, I will search for Java developers in London.', usage: { tokens: 100 } })
  };

  // 2. Initialize Enterprise Platforms
  const agentRegistry = new AgentRegistry();
  const workflowCatalog = new WorkflowCatalog();
  const approvalPlatform = new ApprovalPlatform();
  const aiGateway = new AIGateway(mockCapabilityRegistry, mockPolicyEngine, mockTelemetry, mockAudit);
  aiGateway.registerProvider(mockAIProvider as any);

  const mcpExecutor = new MCPExecutor(mockRegistry, mockPolicyEngine, mockTelemetry, mockAudit);

  const workflowEngine = new WorkflowEngine({
    aiGateway,
    mcpExecutor,
    eventPlatform: mockEventBus,
    memoryPlatform: mockMemory,
    observability: mockObservability,
    approvalPlatform,
    workflowCatalog
  });

  const agentRuntime = new AgentRuntime(
    aiGateway,
    workflowEngine,
    mockMemory,
    mockEventBus,
    mockObservability,
    agentRegistry
  );

  // 3. Agent Certification
  console.log('\n--- Certifying Recruiter Agent ---');
  const manifest = { ...RecruiterAgentManifest, status: 'PRODUCTION', owner: 'Recruiting' } as any;
  await certifyAgent(manifest, {
    capabilityRegistry: mockCapabilityRegistry,
    workflowCatalog: workflowCatalog,
    toolRegistry: mockRegistry
  });

  // 4. Spawn Recruiter Agent
  console.log('\n--- Spawning Recruiter Agent ---');
  await agentRuntime.spawn(manifest);

  // 5. Chat with Recruiter
  console.log('\n--- Chatting with Recruiter ---');
  const context: AgentContext = {
    userId: 'user-123',
    workspaceId: 'ws-456',
    correlationId: 'corr-789',
    sessionId: 'sess-000'
  };
  const response = await agentRuntime.chat(manifest.id, 'Find me Java developers in London', context);
  console.log('Agent Response:', response.text);

  // 6. Execute Assisted Workflow (Approval Required)
  console.log('\n--- Executing Assisted Workflow (Human Approval Required) ---');
  const assistedWorkflow: WorkflowDefinition = {
    id: 'wf-assisted-search-001',
    name: 'Assisted Search Workflow',
    version: '1.0.0',
    steps: [
      {
        id: 'search-step',
        mcpTool: 'candidate.search',
        inputs: { query: 'Java London' },
        outputs: { results: '$.data' },
        executionMode: 'Assisted'
      }
    ]
  };

  const execution = await workflowEngine.execute(assistedWorkflow);
  console.log('Workflow Started:', execution.executionId);

  // Wait for workflow to finish
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const finalStatus = await workflowEngine.status(execution.executionId);
  console.log('Workflow Final Status:', finalStatus.status);
  
  console.log('\n--- Validation Complete ---');
}

validateAgentWorkflow().catch(console.error);
