import express from "express";
import crypto from "crypto";
import { AutomationKillSwitchService, KillSwitchScope } from "../services/AutomationKillSwitchService.js";

const killSwitchHandler = express.Router();

// Middleware for optional HMAC verification
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
        error: "Invalid signature checksum for Kill Switch."
      });
    }
  }
  next();
};

/**
 * Activate a Kill Switch
 */
killSwitchHandler.post("/activate", verifyHmacIfPresent, async (req: any, res: any) => {
  try {
    const { scope, target, reason, activatedBy = "ADMIN_OPERATOR" } = req.body || {};
    if (!scope || !['GLOBAL', 'CHANNEL', 'WORKFLOW', 'TENANT', 'AGENT'].includes(scope)) {
      return res.status(400).json({
        success: false,
        error: "Invalid scope. Must be one of: 'GLOBAL', 'CHANNEL', 'WORKFLOW', 'TENANT', 'AGENT'."
      });
    }

    if (scope !== 'GLOBAL' && !target) {
      return res.status(400).json({
        success: false,
        error: `Target identifier is required for scope '${scope}'.`
      });
    }

    const record = await AutomationKillSwitchService.activateKillSwitch({
      scope: scope as KillSwitchScope,
      target: target || "ALL",
      reason: reason || "Emergency operational kill switch activated.",
      activatedBy
    });

    return res.status(200).json({
      success: true,
      message: `Kill switch activated for ${scope}:${record.target}`,
      record
    });
  } catch (err: any) {
    console.error("[KillSwitchHandler] Activate error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to activate kill switch."
    });
  }
});

/**
 * Deactivate a Kill Switch (Emergency Recovery)
 */
killSwitchHandler.post("/deactivate", verifyHmacIfPresent, async (req: any, res: any) => {
  try {
    const { switchId, deactivatedBy = "ADMIN_OPERATOR", reason = "Manual recovery" } = req.body || {};
    if (!switchId) {
      return res.status(400).json({
        success: false,
        error: "Field 'switchId' is required."
      });
    }

    const success = await AutomationKillSwitchService.deactivateKillSwitch(switchId, deactivatedBy, reason);
    if (!success) {
      return res.status(404).json({
        success: false,
        error: `Kill switch '${switchId}' not found or already inactive.`
      });
    }

    return res.status(200).json({
      success: true,
      message: `Kill switch '${switchId}' deactivated successfully.`,
      switchId
    });
  } catch (err: any) {
    console.error("[KillSwitchHandler] Deactivate error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to deactivate kill switch."
    });
  }
});

/**
 * Clear All Kill Switches (Reset)
 */
killSwitchHandler.post("/clear-all", verifyHmacIfPresent, async (req: any, res: any) => {
  try {
    const { actorId = "ADMIN_OPERATOR" } = req.body || {};
    await AutomationKillSwitchService.clearAllKillSwitches(actorId);

    return res.status(200).json({
      success: true,
      message: "All active kill switches have been cleared."
    });
  } catch (err: any) {
    console.error("[KillSwitchHandler] Clear-all error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to clear kill switches."
    });
  }
});

/**
 * Evaluate if an action is blocked by a Kill Switch
 */
killSwitchHandler.post("/evaluate", verifyHmacIfPresent, async (req: any, res: any) => {
  try {
    const { channel, workflowId, tenantId, agentId, actorId, eventId } = req.body || {};
    const result = await AutomationKillSwitchService.evaluateKillSwitch({
      channel,
      workflowId,
      tenantId,
      agentId,
      actorId,
      eventId
    });

    return res.status(200).json({
      success: !result.blocked,
      blocked: result.blocked,
      reason: result.reason,
      matchedSwitch: result.matchedSwitch,
      evaluatedAt: result.evaluatedAt
    });
  } catch (err: any) {
    console.error("[KillSwitchHandler] Evaluate error:", err);
    // FAIL-CLOSED REQUIREMENT
    return res.status(200).json({
      success: false,
      blocked: true,
      reason: `FAIL-CLOSED: Error evaluating kill switch (${err.message})`,
      evaluatedAt: new Date().toISOString()
    });
  }
});

/**
 * List all Kill Switches
 */
killSwitchHandler.get("/list", async (req: any, res: any) => {
  try {
    const switches = await AutomationKillSwitchService.getKillSwitches();
    return res.status(200).json({
      success: true,
      switches
    });
  } catch (err: any) {
    console.error("[KillSwitchHandler] List error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to list kill switches."
    });
  }
});

/**
 * List Audit Trail
 */
killSwitchHandler.get("/audit", async (req: any, res: any) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const logs = await AutomationKillSwitchService.getAuditLogs(limit);
    return res.status(200).json({
      success: true,
      logs
    });
  } catch (err: any) {
    console.error("[KillSwitchHandler] Audit error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to fetch audit logs."
    });
  }
});

export default killSwitchHandler;
