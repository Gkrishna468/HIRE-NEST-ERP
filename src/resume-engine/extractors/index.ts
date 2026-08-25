/**
 * HireNestOS Deterministic Extraction Pipeline
 * Coordinates document classification, SHA-256 hashing, duplicate checks, extraction, and ledger tracking.
 */

import { extractTextFromPDF } from "./pdf.js";
import { extractTextFromDOCX } from "./docx.js";
import { extractTextFromImage } from "./image.js";
import { ResumeLedgerService } from "../ledger/ResumeLedgerService.js";
import { ExtractionMethod, ResumeProcessingLedgerEntry } from "../types.js";

export interface UnifiedExtractionResult {
  text: string;
  normalizedText: string;
  documentHash: string;
  isDuplicate: boolean;
  duplicateOf?: string;
  extractionMethod: ExtractionMethod;
  ocrUsed: boolean;
  confidence: number;
  filename: string;
  mimeType: string;
  fileSize: number;
  ledgerEntry: ResumeProcessingLedgerEntry;
}

export function normalizeResumeText(rawText: string): string {
  if (!rawText) return "";

  return rawText
    // Standardize line endings
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Remove non-printable control characters while preserving tabs and newlines
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
    // Fix hyphenated line breaks (e.g. "experi-\nence" -> "experience")
    .replace(/(\w+)-\n(\w+)/g, "$1$2")
    // Normalize excessive horizontal whitespace within lines
    .replace(/[ \t]+/g, " ")
    // Normalize excessive newlines (max 2 consecutive)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractDocumentText(params: {
  buffer: Buffer;
  filename: string;
  mimeType?: string;
  candidateId?: string;
  adminDb?: any;
}): Promise<UnifiedExtractionResult> {
  const { buffer, filename, candidateId, adminDb } = params;
  const fileSize = buffer?.length || 0;
  const ext = (filename.split(".").pop() || "").toLowerCase();
  const mimeType = params.mimeType || "application/octet-stream";

  // 1. Calculate deterministic SHA-256 hash
  const documentHash = ResumeLedgerService.computeHash(buffer);

  // 2. Check for duplicate upload
  const existingLedger = await ResumeLedgerService.findDuplicate(documentHash, adminDb);
  const isDuplicate = !!existingLedger;

  // 3. Initialize ledger entry
  let initialMethod: ExtractionMethod = "TEXT_UTF8";
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
    candidateId,
  }, adminDb);

  let rawText = "";
  let extractionMethod: ExtractionMethod = initialMethod;
  let ocrUsed = false;
  let confidence = 0.95;

  try {
    // 4. Dispatch based on document classification
    if (mimeType.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(ext)) {
      const res = await extractTextFromImage(buffer);
      rawText = res.text;
      extractionMethod = res.method;
      ocrUsed = res.ocrUsed;
      confidence = res.confidence;
    } else if (mimeType.includes("pdf") || ext === "pdf") {
      const res = await extractTextFromPDF(buffer);
      rawText = res.text;
      extractionMethod = res.method;
      ocrUsed = res.ocrUsed;
      confidence = res.confidence;
    } else if (mimeType.includes("wordprocessingml") || ext === "docx") {
      const res = await extractTextFromDOCX(buffer);
      rawText = res.text;
      extractionMethod = res.method;
      ocrUsed = res.ocrUsed;
      confidence = res.confidence;
    } else if (mimeType.includes("msword") || ext === "doc") {
      // Legacy .doc handling via mammoth buffer fallback or printable text
      try {
        const mammoth = (await import("mammoth")).default;
        const res = await mammoth.extractRawText({ buffer }).catch(() => null);
        if (res && res.value && res.value.trim().length > 20) {
          rawText = res.value;
          extractionMethod = "DOCX_MAMMOTH";
        } else {
          rawText = buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
          extractionMethod = "TEXT_UTF8";
        }
      } catch {
        rawText = buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
        extractionMethod = "TEXT_UTF8";
      }
    } else {
      // Plain text, markdown, CSV, RTF
      rawText = buffer.toString("utf-8");
      extractionMethod = "TEXT_UTF8";
      confidence = 1.0;
    }

    const normalizedText = normalizeResumeText(rawText);

    // 5. Update Ledger with completion
    const finalStatus = normalizedText.length >= 10 ? (isDuplicate ? "DUPLICATE" : "SUCCESS") : "FAILED";
    await ResumeLedgerService.finalizeEntry(ledgerEntry.resumeProcessingId, {
      status: finalStatus,
      extractionMethod,
      ocrUsed,
      textLength: normalizedText.length,
      confidence,
      candidateId,
      errorCode: finalStatus === "FAILED" ? "EMPTY_EXTRACTION" : undefined,
      errorMessage: finalStatus === "FAILED" ? "Document contained no readable text characters" : undefined,
    }, adminDb);

    return {
      text: rawText,
      normalizedText,
      documentHash,
      isDuplicate,
      duplicateOf: existingLedger?.resumeProcessingId,
      extractionMethod,
      ocrUsed,
      confidence,
      filename,
      mimeType,
      fileSize,
      ledgerEntry,
    };
  } catch (extractErr: any) {
    console.error(`[EXTRACT_PIPELINE] Error extracting "${filename}":`, extractErr?.message || extractErr);
    await ResumeLedgerService.finalizeEntry(ledgerEntry.resumeProcessingId, {
      status: "FAILED",
      errorCode: "EXTRACTION_EXCEPTION",
      errorMessage: extractErr?.message || "Unknown extraction exception",
    }, adminDb);

    throw extractErr;
  }
}
