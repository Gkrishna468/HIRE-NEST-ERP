import { db } from '../../lib/firebase-admin.js';

export interface AgentExecutionRecord {
  executionId: string;
  agentId: string;
  agentVersion: string;
  trigger: string;
  actor: string;
  inputContext: Record<string, any>;
  toolsCalled: string[];
  recommendation?: string;
  confidence?: number;
  governanceDecision: 'ALLOWED' | 'BLOCKED' | 'APPROVAL_REQUIRED';
  governanceReason?: string;
  approvalRequired: boolean;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOT_APPLICABLE';
  action?: string;
  result?: any;
  error?: string;
  model?: string;
  latencyMs: number;
  tokenUsage?: number;
  createdAt: string;
}

export class AgentExecutionLedger {
  /**
   * Logs a full agent execution event to the dedicated agent_executions collection
   * and mirrors to system_events for platform audit compliance.
   */
  static async recordExecution(record: Omit<AgentExecutionRecord, 'executionId' | 'createdAt'>): Promise<string> {
    const executionId = `exec-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const createdAt = new Date().toISOString();

    const fullRecord: AgentExecutionRecord = {
      ...record,
      executionId,
      createdAt
    };

    if (db) {
      try {
        await db.collection('agent_executions').doc(executionId).set(fullRecord);

        // Mirror event to system_events for platform observability
        await db.collection('system_events').doc(`evt-${executionId}`).set({
          eventId: `evt-${executionId}`,
          eventType: 'AGENT_EXECUTION_COMPLETED',
          source: 'AGENT_EXECUTION_LEDGER',
          agentId: record.agentId,
          governanceDecision: record.governanceDecision,
          approvalStatus: record.approvalStatus,
          timestamp: createdAt,
          details: {
            actor: record.actor,
            latencyMs: record.latencyMs,
            toolsCalled: record.toolsCalled,
            hasError: !!record.error
          }
        });
      } catch (err: any) {
        console.warn(`[AgentExecutionLedger] Failed to persist log: ${err.message}`);
      }
    } else {
      console.log(`[AgentExecutionLedger][MOCK_PERSIST] Recorded: ${executionId} for agent ${record.agentId}`);
    }

    return executionId;
  }

  /**
   * Queries recent agent executions with optional filtering
   */
  static async getRecentExecutions(filter?: { agentId?: string; limit?: number }): Promise<AgentExecutionRecord[]> {
    if (!db) return [];

    try {
      let query: any = db.collection('agent_executions').orderBy('createdAt', 'desc');
      if (filter?.agentId) {
        query = query.where('agentId', '==', filter.agentId);
      }
      const snap = await query.limit(filter?.limit || 50).get();
      return snap.docs.map((d: any) => d.data() as AgentExecutionRecord);
    } catch (err: any) {
      console.warn(`[AgentExecutionLedger] Fetch error: ${err.message}`);
      return [];
    }
  }
}
