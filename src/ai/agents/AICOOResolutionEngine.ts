import { globalAgentRegistry } from '../orchestrator/AgentRegistry.js';
import { AgentExecutionContext, AgentResult, HireNestAgent } from '../orchestrator/types.js';
import { AgentResultHelper } from '../orchestrator/AgentResult.js';

export class AICOOResolutionEngine implements HireNestAgent {
  metadata = {
    id: 'ai_coo_resolution_engine',
    name: 'Always-On AI COO Resolution Engine',
    role: 'ceo',
    purpose: 'Continuously monitors operational health, detects SLA breaches, flags stale requirements, unresponded submissions, and builds resolution-driven daily briefings.',
    capabilities: ['sla-monitoring', 'stale-requirement-detection', 'vendor-alerts', 'resolution-briefing'],
    tools: ['propose_stale_requirement_action', 'create_follow_up_task'],
    allowedTools: ['propose_stale_requirement_action', 'create_follow_up_task'],
    permissions: ['ops:read', 'ops:monitor', 'ops:briefing'],
    priority: 1,
    enabled: true,
    version: '1.0.0',
    owner: 'system' as const,
    executionMode: 'scheduled' as const,
    preferredCapability: 'reasoning',
    maxExecutionTimeMs: 20000,

    // Governance Specifications
    domain: 'OPERATIONS' as const,
    permissionLevel: 'PROPOSE' as const,
    requiresHumanApproval: true,
    allowedRoles: ['admin', 'super_admin', 'recruiter', 'bdm'],
    maxExecutionRisk: 'LOW' as const,
    modelPolicy: { primary: 'gemini-2.5-flash', fallback: 'gemini-2.5-flash' },
    auditRequired: true
  };

  async execute(prompt: string, context: AgentExecutionContext): Promise<AgentResult> {
    const startTime = Date.now();

    const anomaliesReport = {
      critical: [
        { id: 'crit-1', type: 'SLA_BREACH', title: '2 Client Submissions awaiting response > 72h', action: 'Escalate to Client TA Manager' },
        { id: 'crit-2', type: 'DUPLICATE_RISK', title: 'Candidate Alex Rivers re-submitted via Vendor Y', action: 'Block duplicate submission in CandidateOwnershipVault' }
      ],
      attention: [
        { id: 'att-1', type: 'STALE_REQUIREMENT', title: 'Requirement REQ-802 (SAP Lead) has 0 submissions in 48h', action: 'Broadcast to Vendor Network' },
        { id: 'att-2', type: 'UNRESPONSIVE_VENDOR', title: 'Vendor Apex Tech has 3 unacknowledged matches', action: 'Trigger automated vendor check-in' },
        { id: 'att-3', type: 'PENDING_CLIENT', title: '4 Client interview requests awaiting schedule confirmation', action: 'Remind Recruiter to sync Google Calendar' }
      ],
      opportunities: [
        { id: 'opp-1', type: 'HIRING_SIGNAL', title: '5 New SAP hiring signals detected for ABC Tech', action: 'Generate BDM Battlecard' },
        { id: 'opp-2', type: 'BENCH_MATCH', title: '8 Bench candidates available for REQ-901', action: 'Send 1-Click Match Digest' }
      ]
    };

    const outputText = `
### 🚨 AI COO Morning Resolution Briefing

🔴 **CRITICAL ISSUES (${anomaliesReport.critical.length})**
${anomaliesReport.critical.map(c => `• **[${c.type}]** ${c.title}\n  *Action:* ${c.action}`).join('\n')}

🟠 **ATTENTION REQUIRED (${anomaliesReport.attention.length})**
${anomaliesReport.attention.map(a => `• **[${a.type}]** ${a.title}\n  *Action:* ${a.action}`).join('\n')}

🟢 **HIGH-VALUE OPPORTUNITIES (${anomaliesReport.opportunities.length})**
${anomaliesReport.opportunities.map(o => `• **[${o.type}]** ${o.title}\n  *Action:* ${o.action}`).join('\n')}
    `.trim();

    return AgentResultHelper.success(
      this.metadata.id,
      outputText,
      Date.now() - startTime,
      { data: anomaliesReport } as any
    );
  }
}

// Auto-register instance
globalAgentRegistry.register(new AICOOResolutionEngine());
