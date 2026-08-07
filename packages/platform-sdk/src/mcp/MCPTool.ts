import { MCPToolManifest } from './MCPToolManifest';
import { ToolContext, ValidationResult, AuthorizationResult, ToolExecution } from './MCPTypes';

/**
 * The standard contract for all tools, agents, and capabilities 
 * executed within the HireNestOS platform.
 */
export interface MCPTool<TInput = any, TOutput = any> {
  /**
   * The static metadata and registry information for the tool.
   */
  readonly manifest: MCPToolManifest;

  /**
   * Validates the tool's input payload prior to execution.
   */
  validate(input: TInput): Promise<ValidationResult>;

  /**
   * Authorizes the execution context (RBAC/ABAC) via the Policy Engine.
   */
  authorize(context: ToolContext): Promise<AuthorizationResult>;

  /**
   * The core business logic of the tool.
   */
  execute(
    input: TInput,
    context: ToolContext
  ): Promise<TOutput>;

  /**
   * Emits immutable audit records for compliance.
   */
  audit(
    execution: ToolExecution<TInput, TOutput>
  ): Promise<void>;

  /**
   * Emits observability metrics and latency telemetry.
   */
  telemetry(
    execution: ToolExecution<TInput, TOutput>
  ): Promise<void>;
}
