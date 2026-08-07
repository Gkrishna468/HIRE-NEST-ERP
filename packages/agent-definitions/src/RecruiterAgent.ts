import { AgentManifest } from '@hirenest/platform-sdk';

export const RecruiterAgentManifest: AgentManifest = {
  id: 'agent-recruiter-001',
  name: 'HireNest Recruiter',
  version: '1.0.0',
  role: 'Senior Executive Recruiter',
  description: 'Specializes in strategic talent acquisition, candidate evaluation, and executive matching.',
  permissions: ['candidate.read', 'requirement.read', 'submission.write'],
  memorySegments: ['operational', 'business', 'knowledge'],
  capabilities: ['talent.reasoning', 'talent.matching', 'market.intelligence'],
  mcpTools: ['candidate.search', 'requirement.get', 'submission.create'],
  modelConfig: {
    reasoning: {
      capability: 'talent.reasoning'
    }
  },
  observability: {
    audit: 'HIGH'
  }
};
