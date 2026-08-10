import { adminDb } from "../../lib/firebase-admin.js";
import { ResumeScreeningService } from "../services/ResumeScreeningService.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  if (!adminDb) {
    return res.status(503).json({ error: "Firebase Admin Database not initialized." });
  }

  try {
    const { candidateId, resumeText } = req.body || {};

    if (!candidateId || !resumeText) {
      return res.status(400).json({ error: "candidateId and resumeText are required." });
    }

    const screeningResult = await ResumeScreeningService.screenAndEnrichCandidate(
      candidateId,
      resumeText
    );

    return res.status(200).json({
      success: true,
      candidateId,
      aiIntelligence: screeningResult
    });
  } catch (err: any) {
    console.error("[CandidateScreenAPI] Error screening candidate:", err);
    return res.status(500).json({ error: err.message || "Failed to screen candidate" });
  }
}
