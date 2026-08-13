import { AgentPermissionLevel } from './types.js';

export interface AgentToolDefinition {
  id: string;
  name: string;
  description: string;
  permissionLevel: AgentPermissionLevel;
  requiresHumanApproval: boolean;
  category: 'RECRUITMENT' | 'CRM' | 'OPERATIONS' | 'COMMUNICATION' | 'COMPLIANCE';
  parametersSchema?: Record<string, any>;
  handler: (params: any, context: any) => Promise<any>;
}

export class AgentToolRegistry {
  private tools: Map<string, AgentToolDefinition> = new Map();

  constructor() {
    this.registerDefaultTools();
  }

  registerTool(tool: AgentToolDefinition): void {
    this.tools.set(tool.id, tool);
    console.log(`[AgentToolRegistry] Registered Tool: ${tool.name} (${tool.id}) [Level: ${tool.permissionLevel}]`);
  }

  getTool(id: string): AgentToolDefinition | undefined {
    return this.tools.get(id);
  }

  getAllTools(): AgentToolDefinition[] {
    return Array.from(this.tools.values());
  }

  private registerDefaultTools() {
    // 1. READ LEVEL TOOLS
    this.registerTool({
      id: 'inspect_candidate_profile',
      name: 'Inspect Candidate Profile',
      description: 'Reads profile, resume skills, and history for candidate',
      permissionLevel: 'READ',
      requiresHumanApproval: false,
      category: 'RECRUITMENT',
      handler: async (params, ctx) => {
        return { action: 'INSPECT_CANDIDATE', candidateId: params.candidateId, status: 'SUCCESS' };
      }
    });

    this.registerTool({
      id: 'inspect_requirement',
      name: 'Inspect Requirement',
      description: 'Reads requirements, job specifications, and status',
      permissionLevel: 'READ',
      requiresHumanApproval: false,
      category: 'RECRUITMENT',
      handler: async (params, ctx) => {
        return { action: 'INSPECT_REQUIREMENT', requirementId: params.requirementId, status: 'SUCCESS' };
      }
    });

    this.registerTool({
      id: 'inspect_client_account',
      name: 'Inspect Client Account',
      description: 'Reads client account info, contacts, and active roles',
      permissionLevel: 'READ',
      requiresHumanApproval: false,
      category: 'CRM',
      handler: async (params, ctx) => {
        return { action: 'INSPECT_CLIENT', clientId: params.clientId, status: 'SUCCESS' };
      }
    });

    // 2. PROPOSE LEVEL TOOLS
    this.registerTool({
      id: 'propose_candidate_match',
      name: 'Propose Candidate Match',
      description: 'Generates match scoring, rationale, and recommendation for recruiter review',
      permissionLevel: 'PROPOSE',
      requiresHumanApproval: true,
      category: 'RECRUITMENT',
      handler: async (params, ctx) => {
        return { action: 'PROPOSE_MATCH', matchScore: params.score || 88, status: 'PROPOSED' };
      }
    });

    this.registerTool({
      id: 'propose_bdm_battlecard',
      name: 'Propose BDM Battlecard',
      description: 'Generates account intelligence, hiring signals, and entry strategy for client',
      permissionLevel: 'PROPOSE',
      requiresHumanApproval: true,
      category: 'CRM',
      handler: async (params, ctx) => {
        return { action: 'PROPOSE_BATTLECARD', clientId: params.clientId, status: 'PROPOSED' };
      }
    });

    this.registerTool({
      id: 'propose_stale_requirement_action',
      name: 'Propose Stale Requirement Action',
      description: 'Flags requirement with 0 submissions and proposes re-engagement or vendor broadcast',
      permissionLevel: 'PROPOSE',
      requiresHumanApproval: true,
      category: 'OPERATIONS',
      handler: async (params, ctx) => {
        return { action: 'PROPOSE_STALE_ACTION', requirementId: params.requirementId, status: 'PROPOSED' };
      }
    });

    // 3. EXECUTE LEVEL CONTROLLED TOOLS
    this.registerTool({
      id: 'create_follow_up_task',
      name: 'Create Follow-Up Task',
      description: 'Schedules follow-up reminder or CRM task for BDM / Recruiter',
      permissionLevel: 'EXECUTE',
      requiresHumanApproval: false,
      category: 'OPERATIONS',
      handler: async (params, ctx) => {
        return { action: 'CREATE_TASK', taskId: `task-${Date.now()}`, title: params.title, status: 'CREATED' };
      }
    });

    this.registerTool({
      id: 'submit_candidate_controlled',
      name: 'Submit Candidate (Controlled)',
      description: 'Triggers candidate submission through Governance Gate & Candidate Ownership Vault',
      permissionLevel: 'EXECUTE',
      requiresHumanApproval: true, // Sensitive action: Mandatory approval
      category: 'RECRUITMENT',
      handler: async (params, ctx) => {
        return { action: 'SUBMIT_CANDIDATE', candidateId: params.candidateId, requirementId: params.requirementId, status: 'SUBMITTED' };
      }
    });
  }
}

export const globalAgentToolRegistry = new AgentToolRegistry();
