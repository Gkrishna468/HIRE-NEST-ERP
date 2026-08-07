import { 
  WorkflowEngineAPI, WorkflowDefinition, WorkflowExecution, WorkflowStep,
  EventPlatformAPI, MemoryPlatformAPI, ObservabilityPlatformAPI,
  ApprovalPlatformAPI, WorkflowCatalogAPI
} from '@hirenest/platform-sdk';

export interface WorkflowDependencies {
  aiGateway: any; // Using any for AIGateway to avoid circular deps with ai-gateway, or we could define an interface in SDK
  mcpExecutor: any; 
  eventPlatform: EventPlatformAPI;
  memoryPlatform: MemoryPlatformAPI;
  observability: ObservabilityPlatformAPI;
  approvalPlatform: ApprovalPlatformAPI;
  workflowCatalog: WorkflowCatalogAPI;
}

export class WorkflowEngine implements WorkflowEngineAPI {
  private executions: Map<string, WorkflowExecution> = new Map();

  constructor(private deps: WorkflowDependencies) {}

  async execute(workflow: WorkflowDefinition, initialEvent?: any): Promise<WorkflowExecution> {
    const executionId = `exec-${Date.now()}`;
    const execution: WorkflowExecution = {
      workflowId: workflow.id,
      executionId,
      status: 'running',
      state: initialEvent || {}
    };
    this.executions.set(executionId, execution);

    // Emit workflow started event
    await this.deps.eventPlatform.publish({
      eventId: `ev-${Date.now()}`,
      type: 'WorkflowStarted',
      version: '1.0',
      source: 'workflow-engine',
      workspaceId: 'system',
      timestamp: new Date().toISOString(),
      payload: { workflowId: workflow.id, executionId },
      correlationId: executionId
    });

    // We execute steps asynchronously
    this.runSteps(workflow, execution).catch(console.error);

    return execution;
  }

  private async runSteps(workflow: WorkflowDefinition, execution: WorkflowExecution) {
    const startTime = Date.now();
    try {
      for (const step of workflow.steps) {
        execution.currentStep = step.id;
        
        // Check for Assisted mode approval
        if (step.executionMode === 'Assisted') {
          execution.status = 'awaiting_approval';
          console.log(`[WorkflowEngine] Step ${step.id} requires approval.`);
          const approval = await this.deps.approvalPlatform.request({
            id: `appr-${Date.now()}`,
            executionId: execution.executionId,
            stepId: step.id,
            agentId: 'system-workflow-engine',
            action: step.mcpTool || step.capability || 'step_execution',
            payload: step.inputs,
            timestamp: new Date().toISOString()
          });

          if (approval.status === 'rejected') {
            throw new Error(`Step ${step.id} was rejected by approver ${approval.approverId}`);
          }
          execution.status = 'running';
        }

        if (step.capability) {
           const result = await this.deps.aiGateway.executeCapability({
             capabilityName: step.capability,
             operation: 'chat', // Simplified
             payload: step.inputs,
             context: { userId: 'system', workspaceId: 'system', correlationId: execution.executionId }
           });
           execution.state[step.id] = result;
        } else if (step.mcpTool) {
           const result = await this.deps.mcpExecutor.execute(
             step.mcpTool, 
             step.inputs, 
             { userId: 'system', workspaceId: 'system', correlationId: execution.executionId, timestamp: new Date().toISOString() }
           );
           execution.state[step.id] = result;
        }

        // Publish step completed event
        await this.deps.eventPlatform.publish({
          eventId: `ev-${Date.now()}`,
          type: 'WorkflowStepCompleted',
          version: '1.0',
          source: 'workflow-engine',
          workspaceId: 'system',
          timestamp: new Date().toISOString(),
          payload: { workflowId: workflow.id, executionId: execution.executionId, stepId: step.id },
          correlationId: execution.executionId
        });
      }

      execution.status = 'completed';
      await this.deps.observability.record({
        traceId: execution.executionId,
        workflowId: workflow.id,
        latencyMs: Date.now() - startTime,
        businessOutcome: 'Workflow Completed',
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      execution.status = 'failed';
      execution.state.error = error.message;
      await this.deps.observability.record({
        traceId: execution.executionId,
        workflowId: workflow.id,
        latencyMs: Date.now() - startTime,
        businessOutcome: 'Workflow Failed',
        errorCategory: 'ExecutionError',
        timestamp: new Date().toISOString()
      });
    }
  }

  async status(executionId: string): Promise<WorkflowExecution> {
    const exec = this.executions.get(executionId);
    if (!exec) throw new Error('Execution not found');
    return exec;
  }
}
