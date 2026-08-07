export type ExecutionMode = 'ReadOnly' | 'Assisted' | 'Autonomous';

export interface WorkflowStep {
  id: string;
  capability?: string;
  mcpTool?: string;
  inputs: Record<string, any>;
  outputs: Record<string, string>;
  retryPolicy?: 'none' | 'linear' | 'exponential';
  timeoutMs?: number;
  conditions?: Record<string, any>;
  executionMode?: ExecutionMode;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  triggerEvent?: string;
  steps: WorkflowStep[];
}

export interface WorkflowExecution {
  workflowId: string;
  executionId: string;
  status: 'running' | 'completed' | 'failed' | 'awaiting_approval';
  currentStep?: string;
  state: Record<string, any>;
}

export interface WorkflowEngineAPI {
  execute(workflow: WorkflowDefinition, initialEvent?: any): Promise<WorkflowExecution>;
  status(executionId: string): Promise<WorkflowExecution>;
}

export interface WorkflowCatalogAPI {
  register(definition: WorkflowDefinition): Promise<void>;
  resolve(workflowId: string): Promise<WorkflowDefinition | undefined>;
  list(): Promise<WorkflowDefinition[]>;
}

export interface ApprovalRequest {
  id: string;
  executionId: string;
  stepId: string;
  agentId: string;
  action: string;
  payload: any;
  timestamp: string;
}

export interface ApprovalResponse {
  approvalId: string;
  status: 'approved' | 'rejected';
  reason?: string;
  approverId: string;
}

export interface ApprovalPlatformAPI {
  request(request: ApprovalRequest): Promise<ApprovalResponse>;
  getPending(): Promise<ApprovalRequest[]>;
}
