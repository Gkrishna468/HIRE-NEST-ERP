import { adminDb } from "../../lib/firebase-admin.js";
import { EventBus } from "../services/EventBus.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  if (!adminDb) {
    return res.status(503).json({
      success: false,
      error: "Firebase Admin Database not initialized."
    });
  }

  try {
    const {
      eventId,
      eventType,
      timestamp = new Date().toISOString(),
      tenantId = "TENANT-HQ",
      candidateId,
      requirementId,
      vendorId,
      clientId,
      actorId = "SYSTEM_AUTOMATION",
      source = "N8N_AUTOMATION",
      payload = {}
    } = req.body || {};

    if (!eventId || !eventType) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: eventId and eventType are mandatory."
      });
    }

    const idempotencyRef = adminDb.collection("automation_event_idempotency").doc(eventId);
    const executionId = `exec_${eventId}`;
    const executionRef = adminDb.collection("automation_executions").doc(executionId);

    // Transactional Idempotency Check & Processing
    const isAlreadyProcessed = await adminDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(idempotencyRef);
      if (doc.exists) {
        return true;
      }

      transaction.set(idempotencyRef, {
        eventId,
        eventType,
        processedAt: new Date().toISOString(),
        actorId,
        source
      });

      transaction.set(executionRef, {
        executionId,
        eventId,
        workflowName: eventType,
        status: "RUNNING",
        startedAt: timestamp,
        completedAt: null,
        retryCount: 0,
        error: null,
        candidateId: candidateId || payload.candidateId || null,
        requirementId: requirementId || payload.requirementId || null,
        vendorId: vendorId || payload.vendorId || null,
        clientId: clientId || payload.clientId || null
      });

      return false;
    });

    if (isAlreadyProcessed) {
      return res.status(200).json({
        success: true,
        idempotent: true,
        message: "Event already processed safely.",
        eventId
      });
    }

    const cleanedPayload = {
      ...payload,
      eventId,
      candidateId: candidateId || payload.candidateId || null,
      requirementId: requirementId || payload.requirementId || null,
      vendorId: vendorId || payload.vendorId || null,
      clientId: clientId || payload.clientId || null,
      actorId: actorId || null
    };

    // Delegate to canonical EventBus
    await EventBus.publish(
      eventType,
      cleanedPayload,
      source,
      tenantId
    );

    // Update execution status to COMPLETED
    await executionRef.update({
      status: "COMPLETED",
      completedAt: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      eventId,
      executionId,
      status: "COMPLETED"
    });
  } catch (err: any) {
    console.error("[AutomationEventAPI] Execution error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to process automation event."
    });
  }
}
