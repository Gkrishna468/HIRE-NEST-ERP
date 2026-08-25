import { adminDb } from "../../lib/firebase-admin.js";
import { ResumeLedgerService } from "../../resume-engine/ledger/ResumeLedgerService.js";

export default async function handler(req: any, res: any) {
  const method = req.method;

  if (method === "GET") {
    const processingId = req.query.id || req.query.processingId || req.query.resumeProcessingId;
    
    if (processingId) {
      const entry = await ResumeLedgerService.getEntry(processingId, adminDb);
      if (!entry) {
        return res.status(404).json({ success: false, message: "Ledger record not found" });
      }
      return res.status(200).json({ success: true, entry });
    }

    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const entries = await ResumeLedgerService.getRecentEntries(limit, adminDb);
    return res.status(200).json({ success: true, entries, count: entries.length });
  }

  if (method === "POST") {
    // Watchdog check trigger
    const maxAgeMs = Number(req.body.maxAgeMs) || 120_000;
    const recoveredCount = await ResumeLedgerService.checkAndRecoverStaleEntries(maxAgeMs, adminDb);
    return res.status(200).json({
      success: true,
      message: `Watchdog check completed. Recovered ${recoveredCount} stale entries.`,
      recoveredCount,
    });
  }

  return res.status(405).json({ message: "Method not allowed" });
}
