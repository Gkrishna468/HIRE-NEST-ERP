export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface AuthorizationResult {
  authorized: boolean;
  reason?: string;
  constraints?: Record<string, any>;
}

export interface ToolContext {
  workspaceId: string;
  userId: string;
  agentId?: string;
  correlationId: string;
  timestamp: string;
}

export interface ToolExecution<TInput = any, TOutput = any> {
  context: ToolContext;
  input: TInput;
  output?: TOutput;
  error?: Error;
  latencyMs: number;
  success: boolean;
}
