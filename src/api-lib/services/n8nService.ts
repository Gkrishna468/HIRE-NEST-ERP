import crypto from 'crypto';
import { adminDb } from '../../lib/firebase-admin.js';

export interface N8NWorkflowTriggerPayload {
  workflowId?: string;
  workflowName: string;
  eventId: string;
  eventType: string;
  candidateId?: string;
  requirementId?: string;
  traceId?: string;
  tenantId?: string;
  source?: string;
  actorId?: string;
  timestamp?: string;
  payload?: any;
}

export class n8nService {
  /**
   * Resolves the target n8n webhook URL based on event/workflow type
   */
  public static getWebhookUrl(workflowName: string, eventType: string): string | null {
    const normWorkflow = (workflowName || '').toLowerCase();
    const normEvent = (eventType || '').toUpperCase();

    if (
      normWorkflow.includes('resume') ||
      normWorkflow.includes('screening') ||
      normEvent === 'RESUME_UPLOADED' ||
      normEvent === 'RESUME_PARSED'
    ) {
      if (process.env.N8N_RESUME_SCREENING_WEBHOOK) {
        return process.env.N8N_RESUME_SCREENING_WEBHOOK.trim();
      }
    }

    if (
      normWorkflow.includes('match') ||
      normWorkflow.includes('candidate-match') ||
      normEvent === 'REQUIREMENT_CREATED' ||
      normEvent === 'REQUIREMENT_UPDATED' ||
      normEvent === 'CANDIDATE_MATCH'
    ) {
      if (process.env.N8N_CANDIDATE_MATCH_WEBHOOK) {
        return process.env.N8N_CANDIDATE_MATCH_WEBHOOK.trim();
      }
    }

    if (process.env.N8N_FIRESTORE_EVENT_WEBHOOK) {
      return process.env.N8N_FIRESTORE_EVENT_WEBHOOK.trim();
    }

    if (process.env.N8N_BASE_URL) {
      const baseUrl = process.env.N8N_BASE_URL.replace(/\/$/, '');
      const endpoint = normWorkflow.replace(/[^a-z0-9]/g, '-');
      return `${baseUrl}/webhook/hirenest/${endpoint}`;
    }

    if (process.env.N8N_WEBHOOK_URL) {
      return process.env.N8N_WEBHOOK_URL.trim();
    }

    return null;
  }

  /**
   * Dispatches an event to n8n workflow automation orchestrator.
   * Note: n8n acts ONLY as an external workflow orchestrator. It does not replace business rules or matching logic.
   */
  static async triggerWorkflow(
    data: N8NWorkflowTriggerPayload
  ): Promise<{ success: boolean; status: string; httpStatus?: number; url?: string; responseBody?: string; error?: string }> {
    const targetUrl = this.getWebhookUrl(data.workflowName, data.eventType);

    if (!targetUrl) {
      console.warn(`[n8nService] No target webhook URL configured for workflow ${data.workflowName}`);
      return { success: false, status: "UNCONFIGURED", error: "Missing webhook URL configuration" };
    }

    try {
      console.log(`[n8nService] Triggering workflow '${data.workflowName}' at '${targetUrl}' for event ${data.eventId}`);

      const payload = {
        ...data,
        triggeredAt: new Date().toISOString()
      };

      const bodyString = JSON.stringify(payload);

      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };

      const secret = process.env.N8N_WEBHOOK_SECRET;
      if (secret) {
        const signature = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');
        headers["X-HireNest-Signature"] = signature;
      }

      const response = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: bodyString,
        signal: AbortSignal.timeout(2000)
      });

      const responseText = await response.text();

      if (!response.ok) {
        // Record failure in automation_executions
        if (adminDb) {
          await adminDb.collection("automation_executions").doc(`exec_${data.eventId}`).set({
            executionId: `exec_${data.eventId}`,
            eventId: data.eventId,
            workflowName: data.workflowName,
            status: "FAILED",
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            retryCount: 1,
            error: `HTTP ${response.status}: ${responseText.slice(0, 500)}`,
            candidateId: data.candidateId || null,
            requirementId: data.requirementId || null
          }, { merge: true });
        }

        throw new Error(`n8n webhook returned HTTP ${response.status}: ${responseText.slice(0, 200)}`);
      }

      // Record successful dispatch in automation_executions
      if (adminDb) {
        await adminDb.collection("automation_executions").doc(`exec_${data.eventId}`).set({
          executionId: `exec_${data.eventId}`,
          eventId: data.eventId,
          workflowName: data.workflowName,
          status: "DISPATCHED",
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          retryCount: 0,
          error: null,
          candidateId: data.candidateId || null,
          requirementId: data.requirementId || null,
          responseSnippet: responseText.slice(0, 500)
        }, { merge: true });
      }

      return {
        success: true,
        status: "DISPATCHED",
        httpStatus: response.status,
        url: targetUrl,
        responseBody: responseText
      };
    } catch (err: any) {
      console.warn(`[n8nService] n8n trigger warning for ${data.workflowName}:`, err.message);

      // Record error in automation_executions
      if (adminDb) {
        try {
          await adminDb.collection("automation_executions").doc(`exec_${data.eventId}`).set({
            executionId: `exec_${data.eventId}`,
            eventId: data.eventId,
            workflowName: data.workflowName,
            status: "FAILED",
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            retryCount: 1,
            error: err.message,
            candidateId: data.candidateId || null,
            requirementId: data.requirementId || null
          }, { merge: true });
        } catch (dbErr) {
          console.warn("[n8nService] Failed to record execution failure in Firestore:", dbErr);
        }
      }

      return {
        success: false,
        status: "FAILED_OR_UNREACHABLE",
        url: targetUrl,
        error: err.message
      };
    }
  }
}

