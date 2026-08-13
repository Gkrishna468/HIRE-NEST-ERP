import { globalAgentRegistry } from '../../ai/orchestrator/AgentRegistry.js';
import { aiOrchestrator } from '../../ai/orchestrator/AgentOrchestrator.js';
import { AgentExecutionLedger } from '../../ai/orchestrator/AgentExecutionLedger.js';
import { AgentCertificationGate } from '../../ai/orchestrator/AgentCertificationGate.js';

export default async function agentsExecuteHandler(req: any, res: any) {
  const method = req.method;

  if (method === 'GET') {
    try {
      if (req.query?.ledger === 'true') {
        const logs = await AgentExecutionLedger.getRecentExecutions({
          agentId: req.query?.agentId as string,
          limit: req.query?.limit ? parseInt(req.query.limit as string, 10) : 50
        });
        return res.json({ success: true, ledger: logs });
      }

      if (req.query?.certify) {
        const agentId = req.query.certify as string;
        const agent = globalAgentRegistry.getAgent(agentId);
        if (!agent) {
          return res.status(404).json({ success: false, error: `Agent '${agentId}' not found for certification.` });
        }
        const report = await AgentCertificationGate.certifyAgent(agent);
        return res.json({ success: true, certificationReport: report });
      }

      const allMetadata = globalAgentRegistry.getAllMetadata();
      return res.json({
        success: true,
        agents: allMetadata
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (method === 'POST') {
    try {
      const { prompt, agentId } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      console.log(`[API][agents/execute] Executing routeAndExecute. AgentId preference: ${agentId || 'auto-detect'} | Prompt: "${prompt.substring(0, 60)}..."`);

      const result = await aiOrchestrator.routeAndExecute(prompt, {
        targetAgentId: agentId,
        context: {
          permissions: req.user?.permissions || [],
          role: req.user?.role || 'recruiter',
          userId: req.user?.uid || 'anonymous'
        }
      });

      return res.json(result);
    } catch (err: any) {
      console.error('[API][agents/execute] Error executing agent:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Execution failed'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
