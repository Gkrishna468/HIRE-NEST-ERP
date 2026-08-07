import { MCPTool } from '../mcp/MCPTool';
import { ToolContext, ToolExecution } from '../mcp/MCPTypes';
import { RegistryAPI } from '../registry/Registry';
import { PolicyEngineAPI, PolicyContext } from '../policy/PolicyTypes';
import { TelemetryServiceAPI, TelemetryEnvelope } from '../telemetry/TelemetryTypes';
import { AuditServiceAPI, AuditRecord } from '../audit/AuditTypes';

export class MCPExecutor {
  constructor(
    private registry: RegistryAPI,
    private policyEngine: PolicyEngineAPI,
    private telemetry: TelemetryServiceAPI,
    private audit: AuditServiceAPI
  ) {}

  async execute<TInput, TOutput>(
    toolId: string,
    input: TInput,
    context: ToolContext
  ): Promise<ToolExecution<TInput, TOutput>> {
    const startTime = Date.now();
    let execution: ToolExecution<TInput, TOutput> = {
      context,
      input,
      latencyMs: 0,
      success: false
    };

    let resolvedTool: MCPTool<TInput, TOutput> | undefined;

    try {
      // 1. Resolve Tool
      resolvedTool = this.registry.resolve(toolId) as MCPTool<TInput, TOutput>;
      if (!resolvedTool) throw new Error(`Tool not found: ${toolId}`);

      // 2. Validate Policy (Platform Level)
      const policyCtx: PolicyContext = {
        userId: context.userId,
        workspaceId: context.workspaceId,
        action: `execute:${resolvedTool.manifest.id}`
      };
      const decision = await this.policyEngine.evaluate(policyCtx);
      if (decision.type === 'Deny') {
        throw new Error(`Policy denied: ${decision.reason}`);
      }

      // 3. Tool Authorization (Tool Level ABAC/RBAC)
      const authResult = await resolvedTool.authorize(context);
      if (!authResult.authorized) {
        throw new Error(`Tool authorization failed: ${authResult.reason}`);
      }

      // 4. Validate Input
      const valResult = await resolvedTool.validate(input);
      if (!valResult.valid) {
        throw new Error(`Input validation failed: ${valResult.errors?.join(', ')}`);
      }

      // 5. Execute
      const output = await resolvedTool.execute(input, context);
      
      execution.output = output;
      execution.success = true;
      
    } catch (error: any) {
      execution.error = error;
      execution.success = false;
    } finally {
      execution.latencyMs = Date.now() - startTime;
      
      // 6. Audit Logging (Platform Layer)
      const auditRecord: AuditRecord = {
        actor: context.userId,
        tool: toolId,
        action: 'execute',
        entity: 'tool',
        timestamp: context.timestamp,
        correlationId: context.correlationId,
        workspaceId: context.workspaceId,
        after: { success: execution.success, error: execution.error?.message }
      };
      await this.audit.log(auditRecord).catch(() => {});

      // Call tool-specific audit if it resolved
      if (resolvedTool) {
        await resolvedTool.audit(execution).catch(() => {});
      }

      // 7. Telemetry (Platform Layer)
      const envelope: TelemetryEnvelope = {
        requestId: context.correlationId,
        tool: toolId,
        version: resolvedTool?.manifest.version || 'unknown',
        workspaceId: context.workspaceId,
        agentId: context.agentId,
        latencyMs: execution.latencyMs,
        success: execution.success,
        error: execution.error?.message,
        timestamp: new Date().toISOString()
      };
      await this.telemetry.emit(envelope).catch(() => {});

      // Call tool-specific telemetry if it resolved
      if (resolvedTool) {
        await resolvedTool.telemetry(execution).catch(() => {});
      }
    }

    return execution;
  }
}
