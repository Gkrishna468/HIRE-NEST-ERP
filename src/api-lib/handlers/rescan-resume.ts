import { adminDb } from "../../lib/firebase-admin.js";
import { ResumeProcessingPipeline } from "../../resume-engine/pipeline/ResumeProcessingPipeline.js";
import { ResumeLedgerService } from "../../resume-engine/ledger/ResumeLedgerService.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed. Use POST." });
  }

  // Trigger watchdog cleanup in background
  ResumeLedgerService.checkAndRecoverStaleEntries(120_000, adminDb).catch(() => {});

  const {
    candidateId,
    resumeText,
    filename,
    forceRescan = true,
    orgId,
    userRole,
    userId,
  } = req.body;

  if (!candidateId && !resumeText) {
    return res.status(400).json({
      success: false,
      message: "Missing required parameters: please provide candidateId or resumeText.",
    });
  }

  const effectiveOrgId = orgId || req.user?.orgId || "HQ";
  const effectiveRole = userRole || req.user?.role || "recruiter";
  const effectiveUserId = userId || req.user?.uid || "system";

  console.log(`[API /api/rescan-resume] Rescanning candidate "${candidateId}" (forceRescan: ${forceRescan})...`);

  try {
    const result = await ResumeProcessingPipeline.rescanCandidate({
      candidateId: candidateId || `HN-CAN-${Date.now()}`,
      resumeText,
      filename: filename || (candidateId ? `Candidate_${candidateId}_Resume.txt` : "Resume.txt"),
      orgId: effectiveOrgId,
      userRole: effectiveRole,
      userId: effectiveUserId,
      adminDb,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    console.error("[API /api/rescan-resume] Rescan failed with exception:", err);
    return res.status(500).json({
      success: false,
      status: "FAILED",
      stage: "FAILED",
      message: "Failed to rescan resume.",
      error: err.message,
    });
  }
}
