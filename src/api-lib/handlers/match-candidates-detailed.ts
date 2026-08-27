import { CandidateScreeningEngine } from "../services/CandidateScreeningEngine.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { jd, candidateProfile, candidateId, requirementId, forceRefresh } = req.body || {};
  if (!jd || !candidateProfile) {
    return res.status(400).json({
      message: "Missing jd or candidateProfile parameters in request body",
    });
  }

  try {
    const jdText = typeof jd === "string" ? jd : JSON.stringify(jd);
    const resumeText = typeof candidateProfile === "string" ? candidateProfile : JSON.stringify(candidateProfile);

    const screeningResult = await CandidateScreeningEngine.screenCandidateAgainstJob(
      resumeText,
      jdText,
      {
        candidateId,
        requirementId,
        forceRefresh: forceRefresh === true,
        userId: req.user?.uid || "recruiter"
      }
    );

    return res.status(200).json(screeningResult);
  } catch (error: any) {
    console.error("[DETAILED_MATCH_ERROR] Failed during candidate screening:", error);
    return res.status(500).json({
      error: error.message || "Screening execution failure",
      message: "System error during AI candidate screening.",
    });
  }
}

