import multer from "multer";
import { ErrorMonitor } from "../telemetry/errorMonitor.js";
import { AuditLogger } from "../telemetry/auditLogger.js";
import { ResumeProcessingPipeline } from "../../resume-engine/pipeline/ResumeProcessingPipeline.js";
import { adminDb } from "../../lib/firebase-admin.js";

// Configure multer storage in memory with size limits to prevent Denial of Service (DoS)
const multerFunc =
  typeof multer === "function" ? multer : (multer as any).default;
const storage = multerFunc.memoryStorage();
const upload = multerFunc({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req: any, file: any, cb: any) => {
    // Whitelist document-related MIME types and images for OCR
    const allowedMimeTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
      "text/markdown",
      "text/csv",
      "application/rtf",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "application/octet-stream", // generic fallback check by extension
    ];

    const ext = file.originalname.split(".").pop()?.toLowerCase() || "";
    const allowedExtensions = ["pdf", "docx", "doc", "txt", "md", "csv", "rtf", "png", "jpg", "jpeg", "webp"];

    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Security Alert: Blocked upload with unsupported file type (${file.mimetype || ext})`,
        ),
      );
    }
  },
}).single("file");

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  upload(req, res, async (err: any) => {
    if (err) {
      console.error("[EXTRACTION_ERROR] Multer file upload failed:", err.message);
      return res.status(400).json({
        success: false,
        message: err.message || "File upload validation failed",
        error: err.message,
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file was provided in the request body",
        error: "Missing file payload",
      });
    }

    const { originalname, mimetype, buffer, size: fileSize } = req.file;
    const requestId = `ext_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const forceRescan = req.query.forceRescan === "true" || req.body?.forceRescan === "true" || req.body?.forceRescan === true;
    const orgId = req.headers["x-org-id"] || req.body?.orgId || "HQ";
    const userRole = req.user?.role || "recruiter";
    const userId = req.user?.uid || "system";

    console.log(
      `[EXTRACTION] [${requestId}] Ingesting "${originalname}" (${mimetype}, ${fileSize} bytes, forceRescan: ${forceRescan})...`,
    );

    // Non-blocking Audit Logging
    try {
      await AuditLogger.log({
        action: "RESUME_UPLOADED",
        details: `File uploaded for extraction: ${originalname}`,
        metadata: { mimetype, size: fileSize, requestId, forceRescan }
      });
    } catch (auditError: any) {
      console.warn(`[EXTRACTION] [${requestId}] Audit logging failed; continuing cleanly:`, auditError?.message || auditError);
    }

    try {
      // Execute Deterministic Pipeline (Zero AI dependency)
      const pipelineResult = await ResumeProcessingPipeline.processResume({
        buffer,
        filename: originalname,
        mimeType: mimetype,
        candidateId: req.body?.candidateId,
        orgId,
        userRole,
        userId,
        forceRescan,
        adminDb,
      });

      if (!pipelineResult.success) {
        return res.status(422).json({
          success: false,
          message: pipelineResult.error || "Extraction process failed",
          error: pipelineResult.error,
          text: "",
          requestId,
          filename: originalname,
          status: pipelineResult.status,
          stage: pipelineResult.stage,
          extractionMethod: pipelineResult.extractionMethod,
          processingId: pipelineResult.processingId,
        });
      }

      console.log(
        `[EXTRACTION] [${requestId}] Success! Candidate: "${pipelineResult.candidateName}", Method: ${pipelineResult.extractionMethod}, Skills: ${pipelineResult.skillsFound}, Status: ${pipelineResult.status}`,
      );

      return res.status(200).json({
        success: true,
        text: pipelineResult.candidateProfile?.resumeText || "",
        rawText: pipelineResult.candidateProfile?.resumeText || "",
        requestId,
        filename: originalname,
        processingId: pipelineResult.processingId,
        ledgerId: pipelineResult.processingId,
        candidateId: pipelineResult.candidateId,
        status: pipelineResult.status,
        stage: pipelineResult.stage,
        candidateName: pipelineResult.candidateName,
        email: pipelineResult.email,
        phone: pipelineResult.phone,
        location: pipelineResult.location,
        skillsFound: pipelineResult.skillsFound,
        skills: pipelineResult.skills,
        experienceYears: pipelineResult.experienceYears,
        currentRole: pipelineResult.currentRole,
        extractionMethod: pipelineResult.extractionMethod,
        ocrUsed: pipelineResult.ocrUsed,
        textLength: pipelineResult.textLength,
        confidence: pipelineResult.ledgerEntry?.confidence || 0.95,
        parserVersion: pipelineResult.parserVersion,
        startedAt: pipelineResult.startedAt,
        completedAt: pipelineResult.completedAt,
        timeline: pipelineResult.timeline,
        requiresManualReview: pipelineResult.requiresManualReview,
        candidateProfile: pipelineResult.candidateProfile,
      });

    } catch (parseError: any) {
      console.error(
        `[EXTRACTION] [${requestId}] Unexpected extraction exception for "${originalname}":`,
        parseError?.message || parseError,
      );

      try {
        await ErrorMonitor.captureError({
          requestId,
          context: `/api/extract-text`,
          errorType: "OCR_FAILURE",
          errorMessage: parseError?.message || "Extraction process failed",
          metadata: { originalname, mimetype, fileSize, stack: parseError?.stack }
        });
      } catch {
        // Non-blocking telemetry
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error during document text extraction",
        error: parseError?.message || "Unknown extraction error",
        requestId,
        filename: originalname,
      });
    }
  });
}
