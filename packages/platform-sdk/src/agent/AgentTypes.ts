export type AgentStatus = 'DRAFT' | 'TESTING' | 'PRODUCTION' | 'DEPRECATED' | 'ARCHIVED';

export interface AgentManifest {
  id: string;
  name: string;
  version: string;
  role: string;
  status: AgentStatus;
  owner: string;
  description: string;
  permissions: string[];
  memorySegments: string[];
  capabilities: string[];
  mcpTools: string[];
  modelConfig: {
    reasoning: { capability: string };
  };
  observability: {
    audit: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  };
}

export interface AgentContext {
  userId: string;
  workspaceId: string;
  correlationId: string;
  sessionId: string;
}

export interface AgentResponse {
  text: string;
  toolCalls?: any[];
  usage?: any;
}

export interface AgentRuntimeAPI {
  spawn(manifest: AgentManifest): Promise<void>;
  chat(agentId: string, input: string, context: AgentContext): Promise<AgentResponse>;
}

export interface AgentRegistryAPI {
  register(manifest: AgentManifest): Promise<void>;
  updateStatus(agentId: string, status: AgentStatus): Promise<void>;
  resolve(agentId: string): Promise<AgentManifest | undefined>;
  list(filters?: Partial<AgentManifest>): Promise<AgentManifest[]>;
}
