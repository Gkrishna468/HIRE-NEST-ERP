/**
 * HireNestOS Unified Resume Processing Pipeline
 * Orchestrates deterministic, zero-AI document extraction, rule-based parsing,
 * state machine transitions, authoritative ledger updates, and candidate persistence.
 */

import crypto from "crypto";
import { ResumeLedgerService } from "../ledger/ResumeLedgerService.js";
import { extractDocumentText } from "../extractors/index.js";
import { parseResumeDeterministically } from "../parser/resume-parser.js";
import { 
  CandidateProfile, 
  ResumeProcessingLedgerEntry, 
  ExtractionMethod,
  PipelineStage,
  LedgerStatus 
} from "../types.js";

export interface ProcessResumeOptions {
  buffer?: Buffer;
  text?: string;
  filename: string;
  mimeType?: string;
  candidateId?: string;
  orgId?: string;
  userRole?: string;
  userId?: string;
  forceRescan?: boolean;
  adminDb?: any;
  resumeUrl?: string;
  resumeFileName?: string;
}

export interface ProcessResumeResponse {
  success: boolean;
  processingId: string;
  candidateId?: string;
  status: LedgerStatus;
  stage: PipelineStage;
  candidateName: string;
  email: string;
  phone: string;
  location: string;
  skillsFound: number;
  skills: string[];
  experienceYears: number;
  currentRole: string;
  extractionMethod: ExtractionMethod;
  ocrUsed: boolean;
  textLength: number;
  parserVersion: string;
  startedAt: string;
  completedAt?: string;
  timeline: any[];
  ledgerEntry: ResumeProcessingLedgerEntry;
  candidateProfile?: CandidateProfile;
  error?: string;
  requiresManualReview?: boolean;
}

export class ResumeProcessingPipeline {
  /**
   * Main entry point for end-to-end resume ingestion and parsing.
   */
  public static async processResume(options: ProcessResumeOptions): Promise<ProcessResumeResponse> {
    const {
      buffer,
      text: providedText,
      filename,
      mimeType = "application/octet-stream",
      candidateId: inputCandidateId,
      orgId = "HQ",
      userRole = "recruiter",
      userId = "system",
      forceRescan = false,
      adminDb,
      resumeUrl,
      resumeFileName,
    } = options;

    const startedAt = new Date().toISOString();
    const effectiveBuffer = buffer || Buffer.from(providedText || "", "utf-8");
    const fileSize = effectiveBuffer.length;
    const documentHash = ResumeLedgerService.computeHash(effectiveBuffer);

    console.log(`[PIPELINE] Starting ingestion for "${filename}" (Hash: ${documentHash.slice(0, 10)}, ForceRescan: ${forceRescan})`);

    // 1. Force Rescan Cache Invalidation
    if (forceRescan) {
      ResumeLedgerService.invalidateHash(documentHash);
    }

    // 2. Deduplication check (if not forceRescan)
    if (!forceRescan) {
      const duplicateEntry = await ResumeLedgerService.findDuplicate(documentHash, adminDb);
      if (duplicateEntry && duplicateEntry.candidateName) {
        console.log(`[PIPELINE] Duplicate found for hash ${documentHash.slice(0, 10)} (ID: ${duplicateEntry.resumeProcessingId})`);
        return {
          success: true,
          processingId: duplicateEntry.resumeProcessingId,
          candidateId: duplicateEntry.candidateId,
          status: "DUPLICATE",
          stage: "COMPLETED",
          candidateName: duplicateEntry.candidateName || "",
          email: duplicateEntry.email || "",
          phone: duplicateEntry.phone || "",
          location: duplicateEntry.location || "",
          skillsFound: duplicateEntry.skillsFound || duplicateEntry.skills?.length || 0,
          skills: duplicateEntry.skills || [],
          experienceYears: duplicateEntry.totalExperience || 0,
          currentRole: "",
          extractionMethod: "CACHE_HIT",
          ocrUsed: duplicateEntry.ocrUsed || false,
          textLength: duplicateEntry.textLength,
          parserVersion: duplicateEntry.parserVersion,
          startedAt: duplicateEntry.startedAt,
          completedAt: duplicateEntry.completedAt,
          timeline: duplicateEntry.timeline || [],
          ledgerEntry: duplicateEntry,
        };
      }
    }

    // 3. Stage: QUEUED -> Create Initial Ledger Entry
    let initialMethod: ExtractionMethod = "TEXT_UTF8";
    const ext = (filename.split(".").pop() || "").toLowerCase();
    if (mimeType.includes("pdf") || ext === "pdf") initialMethod = "PDF_TEXT";
    else if (mimeType.includes("word") || ext === "docx") initialMethod = "DOCX_MAMMOTH";
    else if (mimeType.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(ext)) initialMethod = "IMAGE_OCR";

    const ledgerEntry = await ResumeLedgerService.createEntry({
      documentHash,
      filename,
      mimeType,
      fileSize,
      extractionMethod: initialMethod,
      ocrUsed: initialMethod === "IMAGE_OCR",
      candidateId: inputCandidateId,
      initialStage: "QUEUED",
      metadata: { orgId, userRole, userId, forceRescan },
    }, adminDb);

    let extractedText = providedText || "";
    let extractionMethod: ExtractionMethod = initialMethod;
    let ocrUsed = initialMethod === "IMAGE_OCR";
    let confidence = 0.95;

    // 4. Stage: EXTRACTING & OCR
    if (!providedText || providedText.trim().length === 0) {
      await ResumeLedgerService.updateStage(
        ledgerEntry.resumeProcessingId,
        "EXTRACTING",
        `Extracting document text from ${filename} (${fileSize} bytes)...`,
        undefined,
        adminDb
      );

      try {
        const extraction = await extractDocumentText({
          buffer: effectiveBuffer,
          filename,
          mimeType,
          candidateId: inputCandidateId,
          adminDb,
        });

        extractedText = extraction.normalizedText;
        extractionMethod = extraction.extractionMethod;
        ocrUsed = extraction.ocrUsed;
        confidence = extraction.confidence;

        if (ocrUsed) {
          await ResumeLedgerService.updateStage(
            ledgerEntry.resumeProcessingId,
            "OCR",
            `OCR optical character recognition completed via ${extractionMethod}.`,
            { ocrUsed: true, extractionMethod },
            adminDb
          );
        }
      } catch (extractErr: any) {
        console.error(`[PIPELINE] Text extraction error for "${filename}":`, extractErr);
        const finalized = await ResumeLedgerService.finalizeEntry(ledgerEntry.resumeProcessingId, {
          status: "FAILED",
          stage: "FAILED",
          errorCode: "EXTRACTION_FAILED",
          errorMessage: extractErr.message || "Failed to extract text from document.",
        }, adminDb);

        return {
          success: false,
          processingId: ledgerEntry.resumeProcessingId,
          candidateId: inputCandidateId,
          status: "FAILED",
          stage: "FAILED",
          candidateName: "",
          email: "",
          phone: "",
          location: "",
          skillsFound: 0,
          skills: [],
          experienceYears: 0,
          currentRole: "",
          extractionMethod,
          ocrUsed,
          textLength: 0,
          parserVersion: ResumeLedgerService.PARSER_VERSION,
          startedAt: ledgerEntry.startedAt,
          timeline: finalized?.timeline || [],
          ledgerEntry: finalized!,
          error: extractErr.message,
        };
      }
    }

    const textLength = extractedText.trim().length;
    if (textLength < 10) {
      console.warn(`[PIPELINE] Document "${filename}" contains no readable text characters.`);
      const finalized = await ResumeLedgerService.finalizeEntry(ledgerEntry.resumeProcessingId, {
        status: "FAILED",
        stage: "FAILED",
        errorCode: "EMPTY_EXTRACTION",
        errorMessage: "No readable characters could be extracted from the document.",
        textLength: 0,
      }, adminDb);

      return {
        success: false,
        processingId: ledgerEntry.resumeProcessingId,
        candidateId: inputCandidateId,
        status: "FAILED",
        stage: "FAILED",
        candidateName: "",
        email: "",
        phone: "",
        location: "",
        skillsFound: 0,
        skills: [],
        experienceYears: 0,
        currentRole: "",
        extractionMethod,
        ocrUsed,
        textLength: 0,
        parserVersion: ResumeLedgerService.PARSER_VERSION,
        startedAt: ledgerEntry.startedAt,
        timeline: finalized?.timeline || [],
        ledgerEntry: finalized!,
        error: "No readable characters could be extracted from the document.",
      };
    }

    // 5. Stage: PARSING
    await ResumeLedgerService.updateStage(
      ledgerEntry.resumeProcessingId,
      "PARSING",
      `Executing deterministic parsing on ${textLength} characters...`,
      { textLength },
      adminDb
    );

    const candidateProfile = parseResumeDeterministically({
      text: extractedText,
      filename,
      documentHash,
    });

    // 6. Identity & Completeness Check (Zero fake records!)
    const hasName = Boolean(candidateProfile.candidateName && candidateProfile.candidateName.trim().length > 0);
    const isSynthetic = !hasName || 
      candidateProfile.candidateName === "Candidate Missing Skill" ||
      candidateProfile.candidateName === "Parsing Pending" ||
      candidateProfile.candidateName === "Needs Manual Review" ||
      candidateProfile.candidateName === "Candidate Profile" ||
      candidateProfile.candidateName === "Unnamed Candidate" ||
      candidateProfile.candidateName === "Unknown Candidate" ||
      candidateProfile.candidateName === "Local Mock Generated";

    const resolvedCandidateId = inputCandidateId || `HN-CAN-${crypto.randomBytes(4).toString("hex")}`;
    const nowIso = new Date().toISOString();

    if (isSynthetic || candidateProfile.status === "MANUAL_REVIEW_REQUIRED") {
      console.warn(`[PIPELINE] Identity incomplete for "${filename}". Flagging as MANUAL_REVIEW and creating canonical document.`);
      
      const rawName = isSynthetic ? "Unnamed Candidate" : (candidateProfile.candidateName || "Unnamed Candidate");
      const rawEmail = candidateProfile.email || "";
      const rawPhone = candidateProfile.phone || "";
      const finalEmail = (rawEmail.includes("pending@") || rawEmail.includes("mock@") || rawEmail.trim() === "") ? null : rawEmail.trim();
      const finalPhone = (rawPhone.trim() === "") ? null : rawPhone.trim();

      const candidateDoc = {
        candidateId: resolvedCandidateId,
        id: resolvedCandidateId,
        fullName: rawName,
        name: rawName,
        primaryEmail: finalEmail,
        email: finalEmail,
        phone: finalPhone,
        phoneHash: finalPhone,
        ownerUserId: userId || "system",
        ownerId: userId || "system",
        ownerType: userRole === "vendor" ? "Vendor" : "Internal Recruiter",
        organizationId: orgId,
        vendorId: orgId,
        sourceOrganizations: [orgId],
        candidateHash: documentHash,
        resumeHash: documentHash,
        resumeUrl: resumeUrl || null,
        resumeFileName: resumeFileName || filename,
        fileName: resumeFileName || filename,
        currentTitle: candidateProfile.currentRole || "Needs Manual Review",
        currentRole: candidateProfile.currentRole || "Needs Manual Review",
        skills: candidateProfile.normalizedSkills || [],
        rawSkills: candidateProfile.skills || [],
        experience: `${candidateProfile.totalExperience || 0} Years`,
        totalExperience: candidateProfile.totalExperience || 0,
        location: candidateProfile.location || "Remote / Flexible",
        currentLocation: candidateProfile.location || "Remote / Flexible",
        parsingStatus: "MANUAL_REVIEW",
        parsingQuality: "LOW",
        source: "resume_upload",
        companies: candidateProfile.companies || [],
        designations: candidateProfile.designations || [],
        employmentHistory: candidateProfile.employmentHistory || [],
        currentCompany: candidateProfile.currentCompany || "",
        education: candidateProfile.education || [],
        certifications: candidateProfile.certifications || [],
        noticePeriod: candidateProfile.noticePeriod || "",
        summary: candidateProfile.summary || "",
        linkedin: candidateProfile.linkedin || "",
        github: candidateProfile.github || "",
        portfolio: candidateProfile.portfolio || "",
        resumeText: extractedText,
        resumeProcessingId: ledgerEntry.resumeProcessingId,
        resumeProcessingStatus: "MANUAL_REVIEW",
        status: "MANUAL_REVIEW",
        distillationStatus: "MANUAL_REVIEW",
        pipelineStage: "Manual Review",
        requiresManualReview: true,
        createdFrom: userRole === "vendor" ? "VENDOR" : "RECRUITER",
        createdVia: "IMPORT",
        createdByRole: (userRole || "recruiter").toUpperCase(),
        acquiredAt: nowIso,
        acquisitionMethod: "IMPORT",
        resumeLastParsedAt: nowIso,
        resumeParserVersion: ResumeLedgerService.PARSER_VERSION,
        resumeSource: forceRescan ? "force_rescan" : "deterministic_pipeline",
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      if (adminDb) {
        try {
          await adminDb.collection("candidatePool").doc(resolvedCandidateId).set(candidateDoc, { merge: true });
          console.log(`[PIPELINE] Created MANUAL_REVIEW document in candidatePool for ${resolvedCandidateId}`);
        } catch (dbErr: any) {
          console.error(`[PIPELINE] Critical: Failed to save manual review candidate to candidatePool:`, dbErr);
          throw new Error(`Failed to save manual review candidate: ${dbErr?.message || dbErr}`);
        }
      }

      const finalized = await ResumeLedgerService.finalizeEntry(ledgerEntry.resumeProcessingId, {
        status: "MANUAL_REVIEW",
        stage: "MANUAL_REVIEW",
        candidateId: resolvedCandidateId,
        candidateName: isSynthetic ? "" : candidateProfile.candidateName,
        email: candidateProfile.email || "",
        phone: candidateProfile.phone || "",
        location: candidateProfile.location || "",
        totalExperience: candidateProfile.totalExperience,
        skillsFound: candidateProfile.normalizedSkills.length,
        skills: candidateProfile.normalizedSkills,
        extractionMethod,
        ocrUsed,
        textLength,
        confidence,
        requiresManualReview: true,
        errorCode: "IDENTITY_INCOMPLETE",
        errorMessage: "Candidate identity could not be confidently extracted.",
      }, adminDb);

      return {
        success: true,
        processingId: ledgerEntry.resumeProcessingId,
        candidateId: resolvedCandidateId,
        status: "MANUAL_REVIEW",
        stage: "MANUAL_REVIEW",
        candidateName: isSynthetic ? "Not detected" : candidateProfile.candidateName,
        email: candidateProfile.email || "Not detected",
        phone: candidateProfile.phone || "Not detected",
        location: candidateProfile.location || "Not detected",
        skillsFound: candidateProfile.normalizedSkills.length,
        skills: candidateProfile.normalizedSkills,
        experienceYears: candidateProfile.totalExperience,
        currentRole: candidateProfile.currentRole || "Unspecified",
        extractionMethod,
        ocrUsed,
        textLength,
        parserVersion: ResumeLedgerService.PARSER_VERSION,
        startedAt: ledgerEntry.startedAt,
        completedAt: finalized?.completedAt,
        timeline: finalized?.timeline || [],
        ledgerEntry: finalized!,
        candidateProfile,
        requiresManualReview: true,
        error: "Candidate identity could not be confidently extracted.",
      };
    }

    // 7. Stage: PERSISTING
    await ResumeLedgerService.updateStage(
      ledgerEntry.resumeProcessingId,
      "PERSISTING",
      `Persisting verified profile for "${candidateProfile.candidateName}" into candidate pool...`,
      {
        candidateName: candidateProfile.candidateName,
        email: candidateProfile.email,
        phone: candidateProfile.phone,
      },
      adminDb
    );

    // Resolve identity aliases: name / full_name / candidateName, email / emailAddress, phone / mobile / mobileNumber / phoneNumber
    const rawName = candidateProfile.candidateName || candidateProfile.name || "Unnamed Candidate";
    const rawEmail = candidateProfile.email || "";
    const rawPhone = candidateProfile.phone || "";

    // Normalize empty/null explicitly. Do NOT use fake pending@ or placeholder emails
    const finalEmail = (rawEmail.includes("pending@") || rawEmail.includes("mock@") || rawEmail.trim() === "")
      ? null
      : rawEmail.trim();

    const finalPhone = (rawPhone.trim() === "")
      ? null
      : rawPhone.trim();

    // Determine parsing quality
    const hasEmailPhone = Boolean(finalEmail && finalPhone);
    const parsingQuality = hasEmailPhone && candidateProfile.normalizedSkills.length > 5 ? "HIGH" : "MEDIUM";

    const candidateDoc = {
      candidateId: resolvedCandidateId,
      id: resolvedCandidateId,
      fullName: rawName,
      name: rawName,
      primaryEmail: finalEmail,
      email: finalEmail,
      phone: finalPhone,
      phoneHash: finalPhone,
      ownerUserId: userId || "system",
      ownerId: userId || "system",
      ownerType: userRole === "vendor" ? "Vendor" : "Internal Recruiter",
      organizationId: orgId,
      vendorId: orgId,
      sourceOrganizations: [orgId],
      candidateHash: documentHash,
      resumeHash: documentHash,
      resumeUrl: resumeUrl || null,
      resumeFileName: resumeFileName || filename,
      fileName: resumeFileName || filename,
      currentTitle: candidateProfile.currentRole || candidateProfile.designations?.[0] || "Software Engineer",
      currentRole: candidateProfile.currentRole || candidateProfile.designations?.[0] || "Software Engineer",
      skills: candidateProfile.normalizedSkills || [],
      rawSkills: candidateProfile.skills || [],
      experience: `${candidateProfile.totalExperience} Years`,
      totalExperience: candidateProfile.totalExperience,
      location: candidateProfile.location || "Remote / Flexible",
      currentLocation: candidateProfile.currentLocation || candidateProfile.location || "Remote / Flexible",
      parsingStatus: "COMPLETED",
      parsingQuality: parsingQuality,
      source: "resume_upload",
      
      companies: candidateProfile.companies || [],
      designations: candidateProfile.designations || [],
      employmentHistory: candidateProfile.employmentHistory || [],
      currentCompany: candidateProfile.currentCompany || "",
      education: candidateProfile.education || [],
      certifications: candidateProfile.certifications || [],
      noticePeriod: candidateProfile.noticePeriod || "",
      summary: candidateProfile.summary || "",
      linkedin: candidateProfile.linkedin || "",
      github: candidateProfile.github || "",
      portfolio: candidateProfile.portfolio || "",
      resumeText: extractedText,
      resumeProcessingId: ledgerEntry.resumeProcessingId,
      resumeProcessingStatus: "COMPLETED",
      status: "COMPLETED",
      distillationStatus: "COMPLETED",
      pipelineStage: "Candidate Added",
      requiresManualReview: false,
      createdFrom: userRole === "vendor" ? "VENDOR" : "RECRUITER",
      createdVia: "IMPORT",
      createdByRole: (userRole || "recruiter").toUpperCase(),
      acquiredAt: nowIso,
      acquisitionMethod: "IMPORT",
      resumeLastParsedAt: nowIso,
      resumeParserVersion: ResumeLedgerService.PARSER_VERSION,
      resumeSource: forceRescan ? "force_rescan" : "deterministic_pipeline",
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    if (adminDb) {
      try {
        await adminDb.collection("candidatePool").doc(resolvedCandidateId).set(candidateDoc, { merge: true });
        console.log(`[PIPELINE] Successfully persisted canonical candidate ${resolvedCandidateId} ("${rawName}")`);

        // Save candidate versions snapshot referencing candidateId
        const versionPayload = {
          candidateId: resolvedCandidateId,
          name: rawName,
          email: finalEmail,
          phone: finalPhone,
          title: candidateDoc.currentTitle,
          skills: candidateDoc.skills,
          createdAt: nowIso
        };
        await adminDb.collection("candidate_versions").doc().set(versionPayload);
        console.log(`[PIPELINE] Saved candidate snapshot in candidate_versions for ${resolvedCandidateId}`);

        // Publish CANDIDATE_PARSED event only after Firestore persistence succeeds
        try {
          const eventPayload = {
            candidateId: resolvedCandidateId,
            candidateName: rawName,
            email: finalEmail || "Not provided",
            phone: finalPhone || "Not provided",
            ownerUserId: userId,
            ownerType: userRole === "vendor" ? "Vendor" : "Internal Recruiter",
            organizationId: orgId
          };
          const { EventBus } = await import("../../api-lib/services/EventBus.js");
          await EventBus.publish("CANDIDATE_PARSED", eventPayload, "RESUME_INGESTION_PIPELINE", orgId);
          console.log(`[PIPELINE] Published CANDIDATE_PARSED event successfully for ${resolvedCandidateId}`);
        } catch (evErr) {
          console.error(`[PIPELINE] Event publishing for CANDIDATE_PARSED failed:`, evErr);
        }

      } catch (dbErr: any) {
        console.error(`[PIPELINE] Critical Firestore candidate write failed:`, dbErr?.message || dbErr);
        throw new Error(`Candidate persistence failed: ${dbErr?.message || dbErr}`);
      }
    }

    // 8. Stage: COMPLETED -> Finalize Ledger Entry
    const finalized = await ResumeLedgerService.finalizeEntry(ledgerEntry.resumeProcessingId, {
      status: "COMPLETED",
      stage: "COMPLETED",
      candidateId: resolvedCandidateId,
      candidateName: candidateProfile.candidateName,
      email: candidateProfile.email,
      phone: candidateProfile.phone,
      location: candidateProfile.location,
      totalExperience: candidateProfile.totalExperience,
      skillsFound: candidateProfile.normalizedSkills.length,
      skills: candidateProfile.normalizedSkills,
      extractionMethod,
      ocrUsed,
      textLength,
      confidence,
      requiresManualReview: false,
    }, adminDb);

    console.log(`[PIPELINE] Completed processing "${filename}" for candidate "${candidateProfile.candidateName}" (Skills: ${candidateProfile.normalizedSkills.length}, Exp: ${candidateProfile.totalExperience}y).`);

    return {
      success: true,
      processingId: ledgerEntry.resumeProcessingId,
      candidateId: resolvedCandidateId,
      status: "COMPLETED",
      stage: "COMPLETED",
      candidateName: candidateProfile.candidateName,
      email: candidateProfile.email,
      phone: candidateProfile.phone,
      location: candidateProfile.location,
      skillsFound: candidateProfile.normalizedSkills.length,
      skills: candidateProfile.normalizedSkills,
      experienceYears: candidateProfile.totalExperience,
      currentRole: candidateProfile.currentRole,
      extractionMethod,
      ocrUsed,
      textLength,
      parserVersion: ResumeLedgerService.PARSER_VERSION,
      startedAt: ledgerEntry.startedAt,
      completedAt: finalized?.completedAt,
      timeline: finalized?.timeline || [],
      ledgerEntry: finalized!,
      candidateProfile,
    };
  }

  /**
   * Rescans an existing candidate's resume text or document buffer with forceRescan=true.
   */
  public static async rescanCandidate(options: {
    candidateId: string;
    resumeText?: string;
    buffer?: Buffer;
    filename?: string;
    orgId?: string;
    userRole?: string;
    userId?: string;
    adminDb?: any;
  }): Promise<ProcessResumeResponse> {
    const { candidateId, resumeText, buffer, filename, orgId, userRole, userId, adminDb } = options;

    let textToProcess = resumeText;
    let nameFromDb = "";

    // Fetch current candidate record if text is not directly passed
    if ((!textToProcess || textToProcess.trim().length < 10) && !buffer && adminDb) {
      try {
        const snap = await adminDb.collection("candidatePool").doc(candidateId).get();
        if (snap.exists) {
          const data = snap.data();
          textToProcess = data.resumeText || "";
          nameFromDb = data.fullName || data.name || "";
        }
      } catch (err: any) {
        console.warn(`[PIPELINE RESCAN] Failed to fetch candidate ${candidateId}:`, err);
      }
    }

    const resolvedFilename = filename || (nameFromDb ? `${nameFromDb.replace(/\s+/g, "_")}_Resume.txt` : `Candidate_${candidateId}_Resume.txt`);

    return this.processResume({
      buffer,
      text: textToProcess,
      filename: resolvedFilename,
      candidateId,
      orgId,
      userRole,
      userId,
      forceRescan: true,
      adminDb,
    });
  }
}
