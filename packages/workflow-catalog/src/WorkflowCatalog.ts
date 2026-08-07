import { WorkflowDefinition, WorkflowCatalogAPI } from '@hirenest/platform-sdk';

export class WorkflowCatalog implements WorkflowCatalogAPI {
  private workflows: Map<string, WorkflowDefinition> = new Map();

  async register(definition: WorkflowDefinition): Promise<void> {
    this.workflows.set(definition.id, definition);
  }

  async resolve(workflowId: string): Promise<WorkflowDefinition | undefined> {
    return this.workflows.get(workflowId);
  }

  async list(): Promise<WorkflowDefinition[]> {
    return Array.from(this.workflows.values());
  }
}
