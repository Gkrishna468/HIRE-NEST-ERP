/**
 * HireNestOS Public Candidate Resume Parser
 * Dedicated anonymous endpoint for candidate self-registration & CV ingestion.
 * Strictly deterministic, zero-AI document extraction and rule-based parsing.
 * NO database writes, NO account creation, NO AI/Gemini calls.
 */

import multer from "multer";
import { extractTextFromPDF } from "../../resume-engine/extractors/pdf.js";
import { extractTextFromDOCX } from "../../resume-engine/extractors/docx.js";
import { extractTextFromImage } from "../../resume-engine/extractors/image.js";
import { normalizeResumeText } from "../../resume-engine/extractors/index.js";
import { parseResumeDeterministically } from "../../resume-engine/parser/resume-parser.js";
import { ExtractionMethod } from "../../resume-engine/types.js";

const multerFunc =
  typeof multer === "function" ? multer : (multer as any).default;
const storage = multerFunc.memoryStorage();

const upload = multerFunc({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req: any, file: any, cb: any) => {
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
      "application/octet-stream",
    ];

    const ext = file.originalname.split(".").pop()?.toLowerCase() || "";
    const allowedExtensions = [
      "pdf",
      "docx",
      "doc",
      "txt",
      "md",
      "csv",
      "rtf",
      "png",
      "jpg",
      "jpeg",
      "webp",
    ];

    if (
      allowedMimeTypes.includes(file.mimetype) ||
      allowedExtensions.includes(ext)
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported file type (${file.mimetype || ext}). Supported formats: PDF, DOCX, DOC, TXT, RTF, PNG, JPG.`,
        ),
      );
    }
  },
}).single("file");

export default async function publicCandidateResumeHandler(
  req: any,
  res: any,
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      success: false,
      error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed. Use POST." },
      message: "Method not allowed. Use POST.",
    });
  }

  upload(req, res, async (err: any) => {
    if (err) {
      return res.status(400).json({
        ok: false,
        success: false,
        error: { code: "UPLOAD_VALIDATION_ERROR", message: err.message || "File upload validation failed" },
        message: err.message || "File upload validation failed",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        ok: false,
        success: false,
        error: { code: "MISSING_FILE", message: "No resume file was provided in the request payload" },
        message: "No resume file was provided in the request payload",
      });
    }

    const { originalname, mimetype, buffer, size: fileSize } = req.file;
    const ext = (originalname.split(".").pop() || "").toLowerCase();

    console.log(
      `[PUBLIC_RESUME] Ingesting "${originalname}" (${mimetype}, ${fileSize} bytes)...`,
    );

    let rawText = "";
    let extractionMethod: ExtractionMethod = "TEXT_UTF8";
    let ocrUsed = false;

    try {
      if (
        mimetype.startsWith("image/") ||
        ["png", "jpg", "jpeg", "webp"].includes(ext)
      ) {
        const result = await extractTextFromImage(buffer);
        rawText = result.text;
        extractionMethod = result.method;
        ocrUsed = result.ocrUsed;
      } else if (mimetype.includes("pdf") || ext === "pdf") {
        const result = await extractTextFromPDF(buffer);
        rawText = result.text;
        extractionMethod = result.method;
        ocrUsed = result.ocrUsed;
      } else if (
        mimetype.includes("wordprocessingml") ||
        ext === "docx"
      ) {
        const result = await extractTextFromDOCX(buffer);
        rawText = result.text;
        extractionMethod = result.method;
        ocrUsed = result.ocrUsed;
      } else if (mimetype.includes("msword") || ext === "doc") {
        try {
          const mammoth = (await import("mammoth")).default;
          const result = await mammoth
            .extractRawText({ buffer })
            .catch(() => null);
          if (result && result.value && result.value.trim().length > 20) {
            rawText = result.value;
            extractionMethod = "DOCX_MAMMOTH";
          } else {
            rawText = buffer
              .toString("utf-8")
              .replace(/[^\x20-\x7E\n\r\t]/g, " ")
              .replace(/\s+/g, " ")
              .trim();
            extractionMethod = "TEXT_UTF8";
          }
        } catch {
          rawText = buffer
            .toString("utf-8")
            .replace(/[^\x20-\x7E\n\r\t]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          extractionMethod = "TEXT_UTF8";
        }
      } else {
        rawText = buffer.toString("utf-8");
        extractionMethod = "TEXT_UTF8";
      }

      const normalizedText = normalizeResumeText(rawText);

      if (!normalizedText || normalizedText.trim().length < 10) {
        console.warn(
          `[PUBLIC_RESUME] File "${originalname}" contained no extractable text characters.`,
        );
        return res.status(422).json({
          ok: false,
          success: false,
          error: {
            code: "EMPTY_EXTRACTION",
            message: "No readable text could be extracted from the uploaded document. Please upload a standard text or PDF resume.",
          },
          message:
            "No readable text could be extracted from the uploaded document. Please upload a standard text or PDF resume.",
          filename: originalname,
        });
      }

      // Execute deterministic, rule-based parsing (Zero AI/Gemini)
      const parsedProfile = parseResumeDeterministically({
        text: normalizedText,
        filename: originalname,
      });

      console.log(
        `[PUBLIC_RESUME] Successfully parsed "${originalname}": Candidate "${parsedProfile.candidateName}", Skills: ${parsedProfile.normalizedSkills.length}, Exp: ${parsedProfile.totalExperience}y`,
      );

      return res.status(200).json({
        ok: true,
        success: true,
        candidateProfile: {
          candidateName: parsedProfile.candidateName || "",
          name: parsedProfile.candidateName || "",
          email: parsedProfile.email || "",
          phone: parsedProfile.phone || "",
          location: parsedProfile.location || "Remote / Flexible",
          currentLocation:
            parsedProfile.currentLocation ||
            parsedProfile.location ||
            "Remote / Flexible",
          skills: parsedProfile.normalizedSkills || [],
          rawSkills: parsedProfile.skills || [],
          totalExperience: parsedProfile.totalExperience || 0,
          experienceYears: parsedProfile.totalExperience || 0,
          currentRole:
            parsedProfile.currentRole || "Software Specialist",
          currentCompany: parsedProfile.currentCompany || "",
          headline:
            parsedProfile.currentRole || "Software Specialist",
          summary: parsedProfile.summary || "",
          education: parsedProfile.education || [],
          certifications: parsedProfile.certifications || [],
          noticePeriod: parsedProfile.noticePeriod || "Immediate",
          linkedin: parsedProfile.linkedin || "",
          github: parsedProfile.github || "",
          portfolio: parsedProfile.portfolio || "",
          resumeText: normalizedText,
        },
        data: {
          candidateName: parsedProfile.candidateName || "",
          email: parsedProfile.email || "",
          phone: parsedProfile.phone || "",
          skills: parsedProfile.normalizedSkills || [],
          experienceYears: parsedProfile.totalExperience || 0,
          currentRole: parsedProfile.currentRole || "Software Specialist",
          summary: parsedProfile.summary || "",
        },
        text: normalizedText,
        rawText: normalizedText,
        skills: parsedProfile.normalizedSkills || [],
        candidateName: parsedProfile.candidateName || "",
        email: parsedProfile.email || "",
        phone: parsedProfile.phone || "",
        location: parsedProfile.location || "Remote / Flexible",
        experienceYears: parsedProfile.totalExperience || 0,
        currentRole:
          parsedProfile.currentRole || "Software Specialist",
        filename: originalname,
        fileSize,
        extractionMethod,
        ocrUsed,
      });
    } catch (parseErr: any) {
      console.error(
        `[PUBLIC_RESUME] Parsing exception for "${originalname}":`,
        parseErr?.message || parseErr,
      );
      return res.status(422).json({
        ok: false,
        success: false,
        error: {
          code: "PARSING_FAILED",
          message: parseErr?.message || "Failed to extract and parse document structure.",
        },
        message:
          parseErr?.message ||
          "Failed to extract and parse document structure.",
        filename: originalname,
      });
    }
  });
}
