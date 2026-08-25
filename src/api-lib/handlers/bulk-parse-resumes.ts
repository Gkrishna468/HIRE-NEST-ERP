import { adminDb } from "../../lib/firebase-admin.js";
import { ResumeProcessingPipeline } from "../../resume-engine/pipeline/ResumeProcessingPipeline.js";
import { ResumeLedgerService } from "../../resume-engine/ledger/ResumeLedgerService.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { resumeTexts, filenames, forceRescan = false } = req.body;
  if (!resumeTexts || !Array.isArray(resumeTexts)) {
    return res.status(400).json({
      message: "Missing or invalid resumeTexts array in request body",
    });
  }

  const orgId = req.headers["x-org-id"] || req.body?.orgId || "HQ";
  const userRole = req.user?.role || "recruiter";
  const userId = req.user?.uid || "system";

  try {
    const parsedResults = [];

    for (let i = 0; i < resumeTexts.length; i++) {
      const text = resumeTexts[i];
      const filename = (filenames && filenames[i]) ? filenames[i] : `resume_${i + 1}.txt`;

      console.log(`[BULK_PARSE] Processing resume ${i + 1}/${resumeTexts.length} ("${filename}")...`);

      const pipelineResult = await ResumeProcessingPipeline.processResume({
        text,
        filename,
        orgId,
        userRole,
        userId,
        forceRescan,
        adminDb,
      });

      const profile = pipelineResult.candidateProfile;

      const responseProfile = {
        candidateId: pipelineResult.candidateId,
        id: pipelineResult.candidateId,
        name: pipelineResult.candidateName,
        fullName: pipelineResult.candidateName,
        email: pipelineResult.email,
        phone: pipelineResult.phone,
        skills: pipelineResult.skills,
        rawSkills: profile?.skills || pipelineResult.skills,
        experience: `${pipelineResult.experienceYears} Years`,
        totalExperience: pipelineResult.experienceYears,
        currentRole: pipelineResult.currentRole || profile?.currentRole || "Unspecified",
        currentCompany: profile?.currentCompany || "",
        companies: profile?.companies || [],
        designations: profile?.designations || [],
        education: profile?.education || [],
        certifications: profile?.certifications || [],
        location: pipelineResult.location || "Remote / Flexible",
        noticePeriod: profile?.noticePeriod || "Immediate",
        linkedin: profile?.linkedin || "",
        github: profile?.github || "",
        portfolio: profile?.portfolio || "",
        summary: profile?.summary || "",
        status: pipelineResult.status,
        stage: pipelineResult.stage,
        pipelineStage: "Candidate Added",
        requiresManualReview: pipelineResult.requiresManualReview || pipelineResult.status === "MANUAL_REVIEW",
        documentHash: pipelineResult.ledgerEntry?.documentHash,
        resumeText: text,
        parserVersion: pipelineResult.parserVersion,
        processingId: pipelineResult.processingId,
        ledgerId: pipelineResult.processingId,
        timeline: pipelineResult.timeline,
        startedAt: pipelineResult.startedAt,
        completedAt: pipelineResult.completedAt,
        extractionMethod: pipelineResult.extractionMethod,
        ocrUsed: pipelineResult.ocrUsed,
      };

      parsedResults.push(responseProfile);
    }

    return res.status(200).json(parsedResults);
  } catch (err: any) {
    console.error("[BULK_PARSE_API_ERROR]", err);
    return res.status(500).json({
      message: "Failed during bulk parsing operations",
      error: err.message,
    });
  }
}
