import express from "express";
import crypto from "crypto";
import { CommunicationGuardService, CommunicationRequest } from "../services/CommunicationGuardService.js";

const communicationHandler = express.Router();

// Middleware for optional HMAC verification if caller is automated/n8n
const verifyHmacIfPresent = (req: any, res: any, next: any) => {
  const signature = req.headers["x-hirenest-signature"] || req.headers["X-HireNest-Signature"];
  if (signature) {
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET || "IsxD4vM3BTAAphK3xlv/PWHikuARJwoc/vnTUtKpj90/iP4+tIvG229Ky4lwJtO4";
    const rawPayload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawPayload)
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(403).json({
        success: false,
        error: "Invalid signature checksum for Communication Guard."
      });
    }
  }
  next();
};

/**
 * Evaluate Communication Request against Policy Guard
 */
communicationHandler.post("/evaluate", verifyHmacIfPresent, async (req: any, res: any) => {
  try {
    const request: CommunicationRequest = req.body || {};
    if (!request.recipient || !request.channel || !request.templateId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: recipient, channel, and templateId are mandatory."
      });
    }

    const decision = await CommunicationGuardService.evaluateCommunication(request);
    return res.status(200).json({
      success: decision.allowed,
      decision
    });
  } catch (err: any) {
    console.error("[CommunicationHandler] Evaluation error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to evaluate communication policy."
    });
  }
});

/**
 * Send Communication Request through Policy Guard
 */
communicationHandler.post("/send", verifyHmacIfPresent, async (req: any, res: any) => {
  try {
    const request: CommunicationRequest = req.body || {};
    if (!request.recipient || !request.channel || !request.templateId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: recipient, channel, and templateId are mandatory."
      });
    }

    const result = await CommunicationGuardService.sendCommunication(request);
    const statusCode = result.success ? 200 : (result.decision?.reasonCode === 'CONSENT_OPTED_OUT' || result.decision?.reasonCode === 'UNAPPROVED_TEMPLATE' || result.decision?.reasonCode === 'RECIPIENT_RATE_LIMIT_EXCEEDED' ? 422 : 400);

    return res.status(statusCode).json({
      success: result.success,
      decision: result.decision,
      dispatched: result.dispatched,
      auditId: result.auditId,
      error: result.error,
      dispatchResponse: result.dispatchResponse
    });
  } catch (err: any) {
    console.error("[CommunicationHandler] Send error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to process communication dispatch."
    });
  }
});

/**
 * Update Consent Status for a Recipient
 */
communicationHandler.post("/consent", async (req: any, res: any) => {
  try {
    const { recipient, status, actorId = "SYSTEM" } = req.body || {};
    if (!recipient || !status || !['OPTED_IN', 'OPTED_OUT'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Missing or invalid fields: recipient and status ('OPTED_IN' | 'OPTED_OUT') are required."
      });
    }

    await CommunicationGuardService.setConsent(recipient, status, actorId);
    return res.status(200).json({
      success: true,
      recipient,
      status,
      updatedAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.error("[CommunicationHandler] Consent update error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to update consent status."
    });
  }
});

/**
 * Retrieve Audit Trail
 */
communicationHandler.get("/audit", async (req: any, res: any) => {
  try {
    const { recipient, tenantId, status, limit } = req.query || {};
    const logs = await CommunicationGuardService.getAuditLogs({
      recipient: recipient as string,
      tenantId: tenantId as string,
      status: status as string,
      limit: limit ? parseInt(limit as string, 10) : 50
    });

    return res.status(200).json({
      success: true,
      logs
    });
  } catch (err: any) {
    console.error("[CommunicationHandler] Audit fetch error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to fetch audit logs."
    });
  }
});

export default communicationHandler;
