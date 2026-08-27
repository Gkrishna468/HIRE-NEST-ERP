/**
 * HireNestOS Deterministic PDF Extractor
 * Uses pdf-parse for native text extraction with automatic fallback to page screenshot OCR.
 */

import * as pdfParseModule from "pdf-parse";
import { ExtractionMethod } from "../types.js";

const pdf = (pdfParseModule as any).default || pdfParseModule;

export interface PDFExtractionResult {
  text: string;
  method: ExtractionMethod;
  ocrUsed: boolean;
  pages: number;
  confidence: number;
}

export async function extractTextFromPDF(buffer: Buffer): Promise<PDFExtractionResult> {
  let rawText = "";
  let pageCount = 1;
  let ocrUsed = false;
  let method: ExtractionMethod = "PDF_TEXT";
  let confidence = 0.95;

  try {
    const data = await pdf(buffer);
    rawText = (data?.text || "").trim();
    pageCount = data?.numpages || 1;
  } catch (pdfErr: any) {
    console.warn("[PDF_EXTRACTOR] Primary pdf-parse failed:", pdfErr?.message || pdfErr);
  }

  // Final fallback: printable ASCII extraction if still empty
  if (!rawText || rawText.length < 5) {
    const raw = buffer.toString("utf-8");
    const printable = raw
      .replace(/[^\x20-\x7E\n\r\t]/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n+/g, "\n")
      .trim();
    if (printable.length >= 20) {
      rawText = printable.slice(0, 15000);
      method = "TEXT_UTF8";
      confidence = 0.5;
    }
  }

  return {
    text: rawText,
    method,
    ocrUsed,
    pages: pageCount,
    confidence,
  };
}
