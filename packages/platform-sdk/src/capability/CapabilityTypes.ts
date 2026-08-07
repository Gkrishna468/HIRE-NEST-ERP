export interface CapabilityDefinition {
  name: string;
  version: string;
  category: string;
  description?: string;
  owner: string;
  domain: string;
  supportedProviders: string[];
  primaryProvider: string;
  fallbackProviders: string[];
  sla: string;
  timeoutMs: number;
  costClass: 'low' | 'medium' | 'high';
  healthState: 'healthy' | 'degraded' | 'offline';
  documentationUrl?: string;
  examples?: any[];
  inputSchema?: any;
  outputSchema?: any;
  status: 'draft' | 'active' | 'deprecated';
}

export interface CapabilityRegistryAPI {
  register(capability: CapabilityDefinition): void;
  resolve(name: string): CapabilityDefinition | undefined;
  list(): CapabilityDefinition[];
  updateHealth(name: string, state: 'healthy' | 'degraded' | 'offline'): void;
}
