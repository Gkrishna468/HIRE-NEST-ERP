import { BaseAIOffice } from "./BaseAIOffice.js";
import { BusinessEvent, OfficeExecutionResult } from "./RuntimeTypes.js";
import { IntakeEngine } from "../../intake/IntakeEngine.js";
import { EventBus } from "../../services/EventBus.js";

export class IntakeOffice extends BaseAIOffice {
  readonly name = "IntakeOffice";

  readonly policy = {
    supportedEvents: ["EMAIL_RECEIVED", "WHATSAPP_MESSAGE_RECEIVED"],
    priority: "HIGH" as const,
    concurrency: 5,
    maximumRuntimeMs: 30000,
    dependencies: [],
    maxRetries: 3,
    retryDelayMs: 2000,
    backoffMultiplier: 2,
    maximumDelayMs: 30000,
    retryableErrorTypes: ["timeout"],
    permanentErrorTypes: ["validation_error"],
    healthCheckIntervalMs: 60000,
    heartbeatIntervalMs: 15000,
  };

  protected async decisionEngine(
    event: BusinessEvent,
    memory: any,
  ): Promise<boolean> {
    return this.policy.supportedEvents.includes(event.eventType);
  }

  protected async execute(
    event: BusinessEvent,
    memory: any,
  ): Promise<OfficeExecutionResult> {
    try {
      if (event.eventType === "EMAIL_RECEIVED" && event.payload.messageId) {
        const { MailOSService } = await import("../../services/MailOSService.js");
        const uid = event.payload.uid || 'system';
        const orgId = event.tenantId || event.payload.workspaceId || 'GLOBAL';
        const result = await MailOSService.analyzeMessage(uid, orgId, event.payload.messageId);
        
        return {
          success: true,
          actionTaken: `Processed EMAIL_RECEIVED via MailOSService: ${result.id}`,
          tokensUsed: 0,
          model: "N/A",
        };
      }

      const source = event.eventType === "EMAIL_RECEIVED" ? "gmail" : "whatsapp";
      const result = await IntakeEngine.process(event.payload, source);

      // IntakeEngine currently logs internally. Let's emit the proper domain event based on classification
      if (event.eventType === "EMAIL_RECEIVED" && event.payload.messageId) {
        const { db } = await import("../../../lib/firebase-admin.js");
        if (db) {
            await db.collection("mail_messages").doc(event.payload.messageId).set({
                status: result.status === "success" ? "PROCESSED_BY_INTAKE" : "FAILED",
                classification: result.classification || { type: "Unknown", confidence: 0 }
            }, { merge: true });
        }
      }

      // NOTE: this used to fall back to `result.envelope?.id` (the intake
      // envelope's own internally-generated id) whenever a real entity id
      // wasn't threaded through — which, before IntakeEngine actually created
      // anything, was always. Now that IntakeEngine returns the real
      // Firestore doc id(s) it created, use that; if nothing was actually
      // created (manual_review_required, or no creation logic for this
      // classification type) don't publish a CREATED event at all — there is
      // no entity to reference.
      if (result.status === "success" && result.classification) {
        const createdEntityId = (result as any).createdEntities?.[0]?.id;
        if (createdEntityId && result.classification.type === "Requirement") {
           await EventBus.publishInternal({
            eventId: `evt-intake-req-${Date.now()}`,
            eventType: "REQUIREMENT_CREATED",
            eventVersion: 1,
            correlationId: event.correlationId,
            causationId: event.eventId,
            entityType: "REQUIREMENT",
            entityId: createdEntityId,
            tenantId: event.tenantId,
            source: this.name,
            priority: "HIGH",
            createdAt: new Date().toISOString(),
            publishedAt: new Date().toISOString(),
            retryCount: 0,
            traceId: event.traceId,
            payload: { ...event.payload, classification: result.classification, source },
            metadata: {},
            type: "REQUIREMENT_CREATED",
          });
        } else if (createdEntityId && result.classification.type === "Resume") {
           await EventBus.publishInternal({
            eventId: `evt-intake-cand-${Date.now()}`,
            eventType: "CANDIDATE_CREATED",
            eventVersion: 1,
            correlationId: event.correlationId,
            causationId: event.eventId,
            entityType: "CANDIDATE",
            entityId: createdEntityId,
            tenantId: event.tenantId,
            source: this.name,
            priority: "HIGH",
            createdAt: new Date().toISOString(),
            publishedAt: new Date().toISOString(),
            retryCount: 0,
            traceId: event.traceId,
            payload: { ...event.payload, classification: result.classification, source },
            metadata: {},
            type: "CANDIDATE_CREATED",
          });
        } else if (createdEntityId && (result.classification.type === "Vendor" || result.classification.type === "Partnership")) {
           await EventBus.publishInternal({
            eventId: `evt-intake-vendor-${Date.now()}`,
            eventType: "VENDOR_CREATED",
            eventVersion: 1,
            correlationId: event.correlationId,
            causationId: event.eventId,
            entityType: "VENDOR",
            entityId: createdEntityId,
            tenantId: event.tenantId,
            source: this.name,
            priority: "HIGH",
            createdAt: new Date().toISOString(),
            publishedAt: new Date().toISOString(),
            retryCount: 0,
            traceId: event.traceId,
            payload: { ...event.payload, classification: result.classification, source },
            metadata: {},
            type: "VENDOR_CREATED",
          });
        }
      }

      return {
        success: true,
        actionTaken: `Processed via IntakeEngine: ${result.status}`,
        tokensUsed: 0, // Handled inside IntakeEngine
        model: "N/A",
      };
    } catch (error: any) {
      return {
        success: false,
        reason: error.message,
        errorType: "SYSTEM_ERROR",
        errorStack: error.stack,
      };
    }
  }
}
