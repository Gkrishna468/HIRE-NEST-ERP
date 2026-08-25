import { adminDb } from "../../lib/firebase-admin.js";
import { ResumeProcessingPipeline } from "../../resume-engine/pipeline/ResumeProcessingPipeline.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    if (!adminDb) {
      return res.status(500).json({ error: "adminDb not initialized" });
    }

    const orgId = req.headers["x-org-id"] || req.body?.orgId || "HQ";
    const userRole = req.user?.role || "admin";
    const userId = req.user?.uid || "system";

    const candidatesRef = adminDb.collection("candidatePool");
    const qSnap = await candidatesRef.get();
    let repaired = 0;
    let failed = 0;

    for (const doc of qSnap.docs) {
      const data = doc.data();
      const name = data.name || data.fullName || "";
      const email = data.email || data.primaryEmail || "";

      if (
        name.includes("Candidate Missing Skill") ||
        name.startsWith("CAND_P6D_FAIL") ||
        name.includes("Processing") ||
        name.includes("Unknown Candidate") ||
        name.includes("Unnamed Candidate") ||
        email === "No email provided" ||
        data.status === "PARSE_FAILED" ||
        data.status === "PROCESSING"
      ) {
        if (data.resumeText && data.resumeText.trim().length > 50) {
          try {
            // Found a source resume, re-run deterministic pipeline
            const pipelineResult = await ResumeProcessingPipeline.processResume({
              text: data.resumeText,
              filename: data.fileName || "Recovered_Resume.txt",
              candidateId: doc.id,
              orgId: data.vendorId || orgId,
              userRole,
              userId: data.ownerId || userId,
              forceRescan: true,
              adminDb,
            });

            if (pipelineResult.success && pipelineResult.status === "COMPLETED") {
              // Update processing ledger status to indicate recovery
              if (pipelineResult.processingId) {
                 await adminDb.collection("resume_processing_ledger").doc(pipelineResult.processingId).set({
                   recoveryStatus: "RECOVERED",
                   recoveredCandidateId: pipelineResult.candidateId,
                   recoveredAt: new Date().toISOString(),
                   recoveryMethod: "REPAIR_ENDPOINT"
                 }, { merge: true });
              }
              repaired++;
            } else {
              failed++;
            }
          } catch (e) {
            console.error(`Failed to repair candidate ${doc.id}:`, e);
            failed++;
          }
        } else {
          // No resume text, this is a dead record
          await doc.ref.update({
             status: "DELETED",
             recoveryStatus: "UNRECOVERABLE",
             recoveredAt: new Date().toISOString(),
             recoveryMethod: "REPAIR_ENDPOINT_DELETION"
          });
          failed++;
        }
      }
    }

    res.status(200).json({ message: "Repairs executing...", repaired, failed });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
