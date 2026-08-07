import { AgentManifest, AgentRegistryAPI, AgentStatus } from '@hirenest/platform-sdk';

export class AgentRegistry implements AgentRegistryAPI {
  private agents: Map<string, AgentManifest> = new Map();

  async register(manifest: AgentManifest): Promise<void> {
    this.agents.set(manifest.id, manifest);
  }

  async updateStatus(agentId: string, status: AgentStatus): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);
    agent.status = status;
  }

  async resolve(agentId: string): Promise<AgentManifest | undefined> {
    return this.agents.get(agentId);
  }

  async list(filters?: Partial<AgentManifest>): Promise<AgentManifest[]> {
    let list = Array.from(this.agents.values());
    if (filters) {
      if (filters.status) list = list.filter(a => a.status === filters.status);
      if (filters.owner) list = list.filter(a => a.owner === filters.owner);
    }
    return list;
  }
}
