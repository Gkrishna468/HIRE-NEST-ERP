import { globalAgentRegistry } from '../orchestrator/AgentRegistry.js';
import { AgentExecutionContext, AgentResult, HireNestAgent } from '../orchestrator/types.js';
import { AgentResultHelper } from '../orchestrator/AgentResult.js';

export class AccountIntelligenceAgent implements HireNestAgent {
  metadata = {
    id: 'account_intelligence_agent',
    name: 'AI Sales Intelligence & BDM Agent',
    role: 'bdm',
    purpose: 'Researches client account hiring signals, maps available vendor bench supply, generates BDM sales battlecards, and predicts next best actions.',
    capabilities: ['company-research', 'hiring-signal-detection', 'bench-mapping', 'battlecard-generation', 'next-best-action'],
    tools: ['inspect_client_account', 'propose_bdm_battlecard', 'create_follow_up_task'],
    allowedTools: ['inspect_client_account', 'propose_bdm_battlecard', 'create_follow_up_task'],
    permissions: ['crm:read', 'crm:propose', 'crm:task'],
    priority: 10,
    enabled: true,
    version: '1.0.0',
    owner: 'system' as const,
    executionMode: 'interactive' as const,
    preferredCapability: 'reasoning',
    maxExecutionTimeMs: 25000,

    // Governance Specifications
    domain: 'CRM' as const,
    permissionLevel: 'PROPOSE' as const,
    requiresHumanApproval: true,
    allowedRoles: ['admin', 'super_admin', 'bdm'],
    maxExecutionRisk: 'LOW' as const,
    modelPolicy: { primary: 'gemini-3.6-flash', fallback: 'gemini-3.6-flash' },
    auditRequired: true
  };

  async execute(prompt: string, context: AgentExecutionContext): Promise<AgentResult> {
    const startTime = Date.now();

    // 1. Account Intelligence & Hiring Signals
    const accountIntel = {
      clientName: 'ABC Technologies',
      hiringVelocityTrend: '+32% MoM',
      activeITRoles: 17,
      detectedSignals: [
        'SAP S/4HANA Enterprise Migration announced',
        'AWS Cloud Infrastructure expansion',
        'Data Engineering headcount growth'
      ]
    };

    // 2. HireNest Bench Supply Mapping
    const matchingBenchSupply = [
      { skill: 'SAP FICO / ABAP', availableProfiles: 12, topVendor: 'Apex Tech Solutions' },
      { skill: 'Data Engineering (Snowflake/PySpark)', availableProfiles: 14, topVendor: 'CloudMatrix Inc' },
      { skill: 'AWS Cloud Architects', availableProfiles: 8, topVendor: 'Nexus Talent' }
    ];

    // 3. Recommended BDM Action & Pitch
    const battlecard = {
      priority: 'HIGH' as const,
      recommendedEntry: 'SAP S/4HANA Staffing + C2C Bench Availability',
      suggestedContacts: [
        { role: 'VP of Enterprise Applications', focus: 'SAP Rollout' },
        { role: 'Head of Talent Acquisition', focus: 'IT Contract Hiring' }
      ],
      nextBestAction: 'Contact VP of Enterprise Applications today regarding ready SAP FICO bench profiles.',
      lastInteraction: '18 days ago'
    };

    const outputText = `
### 🏢 Account Intelligence & Sales Battlecard: ${accountIntel.clientName}

**Account Signals & Hiring Velocity**
• **Hiring Velocity:** ${accountIntel.hiringVelocityTrend}
• **Active Open IT Roles:** ${accountIntel.activeITRoles}
• **Key Signals Detected:**
${accountIntel.detectedSignals.map(s => `  - ${s}`).join('\n')}

**HireNest Available Bench Supply**
${matchingBenchSupply.map(b => `• **${b.skill}:** ${b.availableProfiles} candidates ready (Top Partner: ${b.topVendor})`).join('\n')}

**🎯 BDM Strategy & Recommended Pitch**
• **Priority Level:** **${battlecard.priority}**
• **Recommended Entry:** ${battlecard.recommendedEntry}
• **Suggested Contacts:**
${battlecard.suggestedContacts.map(c => `  - **${c.role}** (${c.focus})`).join('\n')}
• **Next Best Action:** ${battlecard.nextBestAction}
• **Last Touchpoint:** ${battlecard.lastInteraction}
    `.trim();

    return AgentResultHelper.success(
      this.metadata.id,
      outputText,
      Date.now() - startTime,
      {
        data: {
          accountIntel,
          matchingBenchSupply,
          battlecard
        }
      } as any
    );
  }
}

// Auto-register instance
globalAgentRegistry.register(new AccountIntelligenceAgent());
