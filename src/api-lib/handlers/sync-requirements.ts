import express from "express";
import { RequirementSyncService } from "../../services/requirementSyncService.js";
import { WhatsAppSyndicationService } from "../../services/WhatsAppSyndicationService.js";
import { db } from "../../lib/firebase-admin.js";

const syncRequirementsHandler = express.Router();

/**
 * Trigger requirements synchronization from Google Sheets
 * Endpoint: POST /api/sync-requirements
 */
syncRequirementsHandler.post("/", async (req: any, res: any) => {
  try {
    const { overrideUrl } = req.body || {};
    const result = await RequirementSyncService.syncGoogleSheets(overrideUrl);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: "Google Sheets Requirements Synchronized successfully.",
        syncRunId: result.syncRunId,
        syncedCount: result.syncedCount,
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        isFallbackPreview: result.isFallbackPreview,
        syncStatus: result.syncStatus,
        details: result.details
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Failed to synchronize requirements.",
        syncRunId: result.syncRunId,
        details: result.details
      });
    }
  } catch (err: any) {
    console.error("[SyncRequirementsHandler] Sync execution failed:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "An internal error occurred during requirement sync."
    });
  }
});

/**
 * Trigger requirements synchronization from Google Sheets
 * Endpoint: GET /api/sync-requirements
 */
syncRequirementsHandler.get("/", async (req: any, res: any) => {
  try {
    const overrideUrl = req.query?.overrideUrl as string | undefined;
    const result = await RequirementSyncService.syncGoogleSheets(overrideUrl);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: "Google Sheets Requirements Synchronized successfully.",
        syncRunId: result.syncRunId,
        syncedCount: result.syncedCount,
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        isFallbackPreview: result.isFallbackPreview,
        syncStatus: result.syncStatus,
        details: result.details
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Failed to synchronize requirements.",
        syncRunId: result.syncRunId,
        details: result.details
      });
    }
  } catch (err: any) {
    console.error("[SyncRequirementsHandler] GET Sync execution failed:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "An internal error occurred during requirement sync."
    });
  }
});

/**
 * Trigger WhatsApp syndication processing cycle
 * Endpoint: POST /api/sync-requirements/process-whatsapp
 */
syncRequirementsHandler.post("/process-whatsapp", async (req: any, res: any) => {
  try {
    const forceImmediate = req.body?.forceImmediate === true;
    const result = await WhatsAppSyndicationService.processPendingPublications(forceImmediate);

    return res.status(200).json({
      success: true,
      message: "WhatsApp Syndication processing executed.",
      ...result
    });
  } catch (err: any) {
    console.error("[SyncRequirementsHandler] WhatsApp syndication error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to process WhatsApp syndication."
    });
  }
});

/**
 * Inspect active WhatsApp Queue and recent delivery history
 * Endpoint: GET /api/sync-requirements/whatsapp-queue
 */
syncRequirementsHandler.get("/whatsapp-queue", async (req: any, res: any) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not initialized" });
    }

    const queueSnap = await db.collection("whatsapp_queue").limit(50).get();
    const logsSnap = await db.collection("whatsapp_delivery_logs").limit(50).get();

    const queue = queueSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const logs = logsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    return res.status(200).json({
      success: true,
      queueCount: queue.length,
      logsCount: logs.length,
      queue,
      logs
    });
  } catch (err: any) {
    console.error("[SyncRequirementsHandler] Failed to fetch WhatsApp queue:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to fetch WhatsApp queue."
    });
  }
});

export default syncRequirementsHandler;

