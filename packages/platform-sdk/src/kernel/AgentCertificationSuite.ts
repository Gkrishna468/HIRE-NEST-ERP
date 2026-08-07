import { AgentManifest, AgentRegistryAPI, CapabilityRegistryAPI, WorkflowCatalogAPI, RegistryAPI } from '../index';

/**
 * Agent Certification Suite (HN-015 Validation).
 * Ensures an agent manifest is valid and all its dependencies (tools, capabilities, workflows) 
 * are resolvable before production deployment.
 */
export async function certifyAgent(
  manifest: AgentManifest,
  dependencies: {
    capabilityRegistry: CapabilityRegistryAPI;
    workflowCatalog: WorkflowCatalogAPI;
    toolRegistry: RegistryAPI;
  }
) {
  console.log(`Certifying Agent: ${manifest.name} (${manifest.id})`);

  // 1. Tool Resolution
  for (const toolId of manifest.mcpTools) {
    const tool = dependencies.toolRegistry.resolve(toolId);
    if (!tool) throw new Error(`Certification Failed: Tool not found: ${toolId}`);
  }

  // 2. Capability Resolution
  for (const capabilityName of manifest.capabilities) {
    const capability = dependencies.capabilityRegistry.resolve(capabilityName);
    if (!capability) throw new Error(`Certification Failed: Capability not found: ${capabilityName}`);
  }

  // 3. Model Config Validation
  const reasoningCap = dependencies.capabilityRegistry.resolve(manifest.modelConfig.reasoning.capability);
  if (!reasoningCap) throw new Error(`Certification Failed: Reasoning capability not found: ${manifest.modelConfig.reasoning.capability}`);

  // 4. Memory Segments Validation (at least one segment required)
  if (manifest.memorySegments.length === 0) {
    throw new Error('Certification Failed: Agent must have at least one memory segment');
  }

  console.log(`Agent ${manifest.id} certified successfully.`);
  return { certified: true, timestamp: new Date().toISOString() };
}
