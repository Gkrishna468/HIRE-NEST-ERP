import { EventBus } from './EventBus.js';

export interface N8NWorkflowTriggerPayload {
  workflowId?: string;
  workflowName: string;
  eventId: string;
  eventType: string;
  candidateId?: string;
  requirementId?: string;
  payload?: any;
}

export class n8nService {
  private static webhookBaseUrl = process.env.N8N_WEBHOOK_URL || "https://n8n.hirenest.infra/webhook";

  /**
   * Dispatches an event to n8n workflow automation orchestrator.
   * Note: n8n acts ONLY as an external workflow orchestrator. It does not replace business rules or matching logic.
   */
  static async triggerWorkflow(data: N8NWorkflowTriggerPayload): Promise<{ success: boolean; status: string }> {
    try {
      console.log(`[n8nService] Triggering workflow '${data.workflowName}' for event ${data.eventId}`);
      
      const webhookEndpoint = `${this.webhookBaseUrl}/${data.workflowName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      
      if (process.env.NODE_ENV !== 'production' && !process.env.N8N_WEBHOOK_URL) {
        // Log locally if n8n endpoint is not configured in dev
        console.log(`[n8nService] Local simulation: n8n trigger for ${data.workflowName} executed successfully.`);
        return { success: true, status: "SIMULATED_LOCAL" };
      }

      const response = await fetch(webhookEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          triggeredAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`n8n webhook returned status ${response.status}`);
      }

      return { success: true, status: "DISPATCHED" };
    } catch (err: any) {
      console.warn(`[n8nService] n8n trigger warning for ${data.workflowName}:`, err.message);
      return { success: false, status: "FAILED_OR_UNREACHABLE" };
    }
  }
}
