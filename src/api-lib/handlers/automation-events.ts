import crypto from "crypto";
import { adminDb } from "../../lib/firebase-admin.js";
import { EventBus } from "../services/EventBus.js";
import { MatchingOffice } from "../services/MatchingOffice.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // --- HMAC SHA256 Signature Security Check ---
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET || "IsxD4vM3BTAAphK3xlv/PWHikuARJwoc/vnTUtKpj90/iP4+tIvG229Ky4lwJtO4";
  if (webhookSecret) {
    const signature = req.headers["x-hirenest-signature"] || req.headers["X-HireNest-Signature"];
    if (!signature) {
      return res.status(401).json({
        success: false,
        error: "Missing required signature header: X-HireNest-Signature"
      });
    }

    const rawPayload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawPayload)
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(403).json({
        success: false,
        error: "Invalid signature checksum."
      });
    }
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

    // Delegate matching operations to canonical MatchingOffice
    if (["CANDIDATE_MATCH", "MATCH_REQUESTED", "REQUIREMENT_CREATED", "REQUIREMENT_UPDATED", "CANDIDATE_CREATED", "CANDIDATE_UPDATED"].includes(eventType)) {
      try {
        await MatchingOffice.handleEvent(eventType, cleanedPayload, tenantId);
      } catch (matchErr) {
        console.warn("[AutomationEventAPI] MatchingOffice event execution warning:", matchErr);
      }
    }

    // Business-level writeback to candidatePool if candidate ID is present in payload
    const targetCandidateId = candidateId || payload.candidateId;
    if (targetCandidateId && adminDb) {
      try {
        const candRef = adminDb.collection("candidatePool").doc(targetCandidateId);
        const candSnap = await candRef.get();
        if (candSnap.exists) {
          const existingData = candSnap.data() || {};
          const screeningData = payload.screeningResult || payload.aiSummary || payload.summary || payload.analysis;
          const score = payload.matchScore || payload.score || payload.rating;
          const skills = payload.skills || payload.skillsExtracted || [];

          await candRef.set({
            aiIntelligence: {
              ...(existingData.aiIntelligence || {}),
              summary: screeningData || existingData.aiIntelligence?.summary || "Screened via n8n AI workflow",
              score: score ?? existingData.aiIntelligence?.score ?? 85,
              skillsExtracted: Array.isArray(skills) && skills.length > 0 ? skills : (existingData.aiIntelligence?.skillsExtracted || []),
              screenedAt: new Date().toISOString(),
              screeningSource: "n8n_resume_screening",
              status: "SCREENED"
            },
            status: "SCREENED",
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
      } catch (writebackErr) {
        console.warn("[AutomationEventAPI] Writeback to candidatePool warning:", writebackErr);
      }
    }

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
