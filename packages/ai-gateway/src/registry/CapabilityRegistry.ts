import { CapabilityRegistryAPI, CapabilityDefinition } from '@hirenest/platform-sdk';

export class CapabilityRegistry implements CapabilityRegistryAPI {
  private capabilities: Map<string, CapabilityDefinition> = new Map();

  register(capability: CapabilityDefinition): void {
    this.capabilities.set(capability.name, capability);
  }

  resolve(name: string): CapabilityDefinition | undefined {
    return this.capabilities.get(name);
  }

  list(): CapabilityDefinition[] {
    return Array.from(this.capabilities.values());
  }

  updateHealth(name: string, state: 'healthy' | 'degraded' | 'offline'): void {
    const capability = this.capabilities.get(name);
    if (capability) {
      capability.healthState = state;
    }
  }
}
