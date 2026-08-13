export type AgentRole =
  | 'ceo'
  | 'product'
  | 'architecture'
  | 'security'
  | 'release_manager'
  | 'qa'
  | 'documentation'
  | 'recruiter'
  | 'bdm'
  | 'vendor_manager'
  | 'submission_manager'
  | 'matching_engine'
  | 'compliance_officer'
  | 'executive_brief';

export type AgentDomain =
  | 'RECRUITMENT'
  | 'CRM'
  | 'OPERATIONS'
  | 'COMMUNICATION'
  | 'COMPLIANCE';

export type AgentPermissionLevel = 'READ' | 'PROPOSE' | 'EXECUTE';

export type AgentRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AgentModelPolicy {
  primary: string;
  fallback?: string;
}

export interface AgentMetadata {
  id: string;
  name: string;
  role: AgentRole | string;
  purpose: string;
  capabilities: string[];
  tools: string[];
  permissions: string[];
  priority: number;
  enabled: boolean;
  version: string;
  owner: 'system' | 'business';
  executionMode: 'interactive' | 'background' | 'scheduled';
  preferredCapability: 'fast-chat' | 'reasoning' | 'vision' | 'long-context' | string;
  maxExecutionTimeMs: number;

  // Agent Governance Control Plane Extensions
  domain?: AgentDomain;
  allowedTools?: string[];
  permissionLevel?: AgentPermissionLevel;
  requiresHumanApproval?: boolean;
  allowedRoles?: string[];
  maxExecutionRisk?: AgentRiskLevel;
  modelPolicy?: AgentModelPolicy;
  auditRequired?: boolean;
}

export interface AgentMemory {
  previousExecutions: any[];
  learnedPreferences: Record<string, any>;
  cachedContexts: Record<string, any>;
  customState: Record<string, any>;
}

export interface AgentExecutionContext {
  userId?: string;
  orgId?: string;
  role?: string;
  tenantId?: string;
  taskId?: string;
  permissions?: string[];
  sessionHistory?: { role: 'user' | 'agent'; content: string }[];
  memory?: AgentMemory;
  additionalParams?: Record<string, any>;
}

export interface AgentResult {
  success: boolean;
  agentId: string;
  output: string;
  parsedData?: any;
  error?: string;
  latencyMs: number;
  metrics?: {
    tokensUsed?: number;
    estimatedCostUsd?: number;
    provider?: string;
    model?: string;
    cached?: boolean;
  };
}

export interface HireNestAgent {
  metadata: AgentMetadata;
  execute(prompt: string, context: AgentExecutionContext): Promise<AgentResult>;
}
