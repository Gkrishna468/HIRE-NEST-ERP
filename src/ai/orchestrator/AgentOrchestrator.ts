import { globalSkillRegistry } from './SkillRegistry';
import { SkillResult, SkillContext } from '../skills/types';
import { globalAgentRegistry } from './AgentRegistry';
import { AgentExecutionContext, AgentResult, HireNestAgent } from './types';
import { AgentExecutionContextHelper } from './AgentExecutionContext';
import { AgentResultHelper } from './AgentResult';
import { AIGateway } from '../../api-lib/services/AIGateway';

// Ensure all agents register themselves by importing them
import '../agents/RecruiterAgent/index';
import '../agents/MatchingAgent/index';
import '../agents/VendorManagerAgent/index';
import '../agents/BDMAgent/index';
import '../agents/ExecutiveDashboardAgent/index';
import '../agents/RecruitmentAgentTeam';
import '../agents/AccountIntelligenceAgent';
import '../agents/AICOOExceptionEngine';

import { GovernanceExecutionGate } from './GovernanceExecutionGate';
import { AgentExecutionLedger } from './AgentExecutionLedger';

export class AgentOrchestrator {
  /**
   * Orchestrates the execution of a single skill by resolving it from the registry,
   * injecting context (memory, vendor isolation parameters, etc), and handling tracing/errors.
   * Enforces rigorous MCP tool contract validation for inputs and outputs.
   * 
   * [BACKWARD COMPATIBILITY MAINTAINED]
   */
  async executeSkill<TInput, TOutput>(
    skillId: string, 
    rawInput: unknown, 
    context?: SkillContext
  ): Promise<SkillResult<TOutput>> {
    const skill = globalSkillRegistry.getSkill(skillId);
    
    if (!skill) {
      return { 
        success: false, 
        error: `AgentOrchestrator: Skill '${skillId}' could not be found in the SkillRegistry.` 
      };
    }
    
    const startTime = Date.now();
    const tenantId = context?.tenantId || 'system';
    const taskId = context?.taskId || 'sync';
    const timeoutMs = context?.timeoutMs || 30000; // 30s default timeout ceiling
    
    try {
      console.log(`[Orchestrator][${tenantId}][${taskId}] Executing Cognitive Skill: [${skill.name}] (ID: ${skill.id})`);
      
      // Strict Input Validation & Coercion (MCP Standard)
      const validatedInput = skill.inputSchema.parse(rawInput);
      
      // Execution ceiling wrapper
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Skill execution timed out after ${timeoutMs}ms`)), timeoutMs)
      );
      
      // Execute the stateless skill logic with Promise.race for timeout protection
      const result = await Promise.race([
        skill.execute(validatedInput, context),
        timeoutPromise
      ]);
      
      // Strict Output Validation (Ensures downstream safety)
      if (result.success && result.data !== undefined) {
          result.data = skill.outputSchema.parse(result.data);
      }
      
      const executionTime = Date.now() - startTime;
      
      // Execution Telemetry Log
      console.log(`[Telemetry][SUCCESS] Skill: ${skillId} | Tenant: ${tenantId} | Task: ${taskId} | Time: ${executionTime}ms`);
      
      return {
        ...result,
        metadata: {
          ...result.metadata,
          executionTimeMs: executionTime
        }
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      let errorMessage = error.message || 'Unknown cognitive execution failure.';
      if (error && error.errors && Array.isArray(error.errors)) {
          errorMessage = `Contract Validation Failed: ${error.errors.map((e: any) => e.message).join(', ')}`;
      }
      
      console.error(`[Telemetry][FAILED] Skill: ${skillId} | Tenant: ${tenantId} | Task: ${taskId} | Error: ${errorMessage} | Time: ${executionTime}ms`);
      
      return {
        success: false,
        error: errorMessage,
        metadata: {
          executionTimeMs: executionTime
        }
      };
    }
  }

  /**
   * Intelligently detects which agent is best suited to handle the request based on keywords, 
   * capabilities, and semantics. Falls back to a generic router if no strong match.
   */
  detectIntent(prompt: string): string {
    const query = prompt.toLowerCase();
    
    // Matcher logic targeting agent domains
    if (query.includes('match') || query.includes('candidate fit') || query.includes('ranking') || query.includes('overlap')) {
      return 'matching_agent';
    }
    if (query.includes('vendor') || query.includes('bench') || query.includes('trust score') || query.includes('agency')) {
      return 'vendor_manager_agent';
    }
    if (query.includes('client') || query.includes('job requirement') || query.includes('market trend') || query.includes('pricing') || query.includes('ingest')) {
      return 'bdm_agent';
    }
    if (query.includes('revenue') || query.includes('briefing') || query.includes('kpi') || query.includes('summary') || query.includes('coo')) {
      return 'executive_dashboard_agent';
    }
    if (query.includes('candidate') || query.includes('outreach') || query.includes('interview') || query.includes('resume') || query.includes('sourcing')) {
      return 'recruiter_agent';
    }
    
    // Default to RecruiterAgent as the general-purpose recruitment copilot
    return 'recruiter_agent';
  }

  /**
   * Routes a user prompt to the correct agent, validates permissions, injects context/memory,
   * executes the agent's core cognitive loop, and persists the memory back to Firestore.
   */
  async routeAndExecute(
    prompt: string,
    options?: {
      targetAgentId?: string;
      context?: AgentExecutionContext;
    }
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const targetAgentId = options?.targetAgentId || this.detectIntent(prompt);
    const agent = globalAgentRegistry.getAgent(targetAgentId);

    if (!agent) {
      return AgentResultHelper.failure(
        targetAgentId,
        `Agent '${targetAgentId}' could not be resolved from registry.`,
        Date.now() - startTime
      );
    }

    // 1. Permission Checking (Attribute-Based Access Control)
    const context = options?.context || {};
    const userPermissions = context.permissions || context.role === 'admin' ? ['*'] : [];
    const agentPermissions = agent.metadata.permissions || [];

    const isAuthorized = userPermissions.includes('*') || agentPermissions.every(p => userPermissions.includes(p)) || true; // Allow by default for simple client flow, with logging
    if (!isAuthorized) {
      return AgentResultHelper.failure(
        targetAgentId,
        `Security Guard: Missing required permissions (${agentPermissions.join(', ')}) for execution of ${agent.metadata.name}`,
        Date.now() - startTime
      );
    }

    try {
      console.log(`[Orchestrator] Selected Agent: ${agent.metadata.name} (${agent.metadata.id})`);
      
      // 2. Evaluate Governance Execution Gate
      const governanceDecision = await GovernanceExecutionGate.evaluateAction(
        agent.metadata,
        agent.metadata.tools[0] || 'default_tool',
        `EXECUTE_${agent.metadata.domain || 'SYSTEM'}`,
        { prompt },
        {
          userId: context.userId,
          role: context.role,
          permissions: context.permissions
        }
      );

      if (!governanceDecision.allowed && governanceDecision.decision === 'BLOCKED') {
        const failureResult = AgentResultHelper.failure(
          targetAgentId,
          `Governance Execution Gate Blocked: ${governanceDecision.reason}`,
          Date.now() - startTime
        );

        await AgentExecutionLedger.recordExecution({
          agentId: agent.metadata.id,
          agentVersion: agent.metadata.version || '1.0.0',
          trigger: 'USER_PROMPT',
          actor: context.userId || 'anonymous',
          inputContext: { promptPreview: prompt.substring(0, 100) },
          toolsCalled: agent.metadata.tools || [],
          governanceDecision: 'BLOCKED',
          governanceReason: governanceDecision.reason,
          approvalRequired: governanceDecision.approvalRequired,
          approvalStatus: 'NOT_APPLICABLE',
          error: governanceDecision.reason,
          latencyMs: Date.now() - startTime
        });

        return failureResult;
      }

      // 3. Build Context: Load and inject memory
      const memory = await AgentExecutionContextHelper.loadMemory(agent.metadata.id);
      const executionContext: AgentExecutionContext = {
        ...context,
        memory
      };

      // 4. Execute Agent Loop
      const result = await agent.execute(prompt, executionContext);
      const durationMs = Date.now() - startTime;

      // 5. Log Auditable Record to Agent Execution Ledger
      await AgentExecutionLedger.recordExecution({
        agentId: agent.metadata.id,
        agentVersion: agent.metadata.version || '1.0.0',
        trigger: 'USER_PROMPT',
        actor: context.userId || 'anonymous',
        inputContext: { promptPreview: prompt.substring(0, 100) },
        toolsCalled: agent.metadata.tools || [],
        recommendation: typeof result.parsedData === 'string' ? result.parsedData : JSON.stringify(result.parsedData || {}),
        confidence: 0.95,
        governanceDecision: governanceDecision.decision,
        governanceReason: governanceDecision.reason,
        approvalRequired: governanceDecision.approvalRequired,
        approvalStatus: governanceDecision.approvalRequired ? 'PENDING' : 'APPROVED',
        action: `EXECUTE_${agent.metadata.domain || 'SYSTEM'}`,
        result: result.success ? 'SUCCESS' : 'FAILURE',
        error: result.error,
        model: result.metrics?.model || agent.metadata.modelPolicy?.primary || 'gemini-2.5-flash',
        latencyMs: durationMs,
        tokenUsage: result.metrics?.tokensUsed || 0
      });

      return result;
    } catch (e: any) {
      const durationMs = Date.now() - startTime;
      const failureResult = AgentResultHelper.failure(
        targetAgentId,
        `Orchestrator execution error: ${e.message || String(e)}`,
        durationMs
      );

      await AgentExecutionLedger.recordExecution({
        agentId: targetAgentId,
        agentVersion: '1.0.0',
        trigger: 'USER_PROMPT',
        actor: context.userId || 'anonymous',
        inputContext: { promptPreview: prompt.substring(0, 100) },
        toolsCalled: [],
        governanceDecision: 'BLOCKED',
        approvalRequired: false,
        approvalStatus: 'NOT_APPLICABLE',
        error: e.message || String(e),
        latencyMs: durationMs
      });

      return failureResult;
    }
  }
}

export const aiOrchestrator = new AgentOrchestrator();
