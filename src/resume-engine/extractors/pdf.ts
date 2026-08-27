/**
 * HireNestOS Deterministic PDF Extractor
 * Uses pdf-parse for native text extraction with automatic fallback to page screenshot OCR.
 */

import { PDFParse } from "pdf-parse";
import { performOCR } from "./ocr.js";
import { ExtractionMethod } from "../types.js";

export interface PDFExtractionResult {
  text: string;
  method: ExtractionMethod;
  ocrUsed: boolean;
  pages: number;
  confidence: number;
}

export async function extractTextFromPDF(buffer: Buffer): Promise<PDFExtractionResult> {
  let parser: any = null;
  let rawText = "";
  let pageCount = 1;
  let ocrUsed = false;
  let method: ExtractionMethod = "PDF_TEXT";
  let confidence = 0.95;

  try {
    parser = new PDFParse({ data: buffer });
    const parseResult = await parser.getText();
    rawText = (parseResult?.text || "").trim();
    pageCount = parseResult?.total || 1;

    // Check if the extracted text is sparse (e.g. scanned resume in a PDF container)
    if (rawText.length < 40 && typeof parser.getScreenshot === "function") {
      console.log(`[PDF_EXTRACTOR] Sparse text (${rawText.length} chars). Invoking page screenshot OCR fallback...`);
      try {
        const screenshotResult = await parser.getScreenshot();
        const pages = screenshotResult?.pages || [];
        if (pages.length > 0) {
          let ocrCombined = "";
          let totalConfidence = 0;
          for (let i = 0; i < pages.length; i++) {
            const p = pages[i];
            if (p && p.data) {
              const pageBuf = Buffer.from(p.data);
              const ocrRes = await performOCR(pageBuf);
              if (ocrRes.text) {
                ocrCombined += ocrRes.text + "\n";
                totalConfidence += ocrRes.confidence;
              }
            }
          }
          if (ocrCombined.trim().length > rawText.length) {
            rawText = ocrCombined.trim();
            ocrUsed = true;
            method = "PDF_SCANNED_OCR";
            confidence = pages.length > 0 ? totalConfidence / pages.length : 0.85;
          }
        }
      } catch (ocrErr: any) {
        console.warn("[PDF_EXTRACTOR] Scanned page OCR attempt failed:", ocrErr?.message || ocrErr);
      }
    }
  } catch (pdfErr: any) {
    console.warn("[PDF_EXTRACTOR] Primary pdf-parse getText failed:", pdfErr?.message || pdfErr);
    if (parser && typeof parser.getScreenshot === "function") {
      try {
        const screenshotResult = await parser.getScreenshot();
        const pages = screenshotResult?.pages || [];
        if (pages.length > 0) {
          let ocrCombined = "";
          for (const p of pages) {
            if (p && p.data) {
              const ocrRes = await performOCR(Buffer.from(p.data));
              if (ocrRes.text) ocrCombined += ocrRes.text + "\n";
            }
          }
          if (ocrCombined.trim().length > 0) {
            rawText = ocrCombined.trim();
            ocrUsed = true;
            method = "PDF_RECOVERY_OCR";
            confidence = 0.8;
          }
        }
      } catch (recoveryErr: any) {
        console.warn("[PDF_EXTRACTOR] Recovery OCR failed:", recoveryErr?.message || recoveryErr);
      }
    }
  } finally {
    if (parser && typeof parser.destroy === "function") {
      try {
        await parser.destroy();
      } catch {
        // Discard
      }
    }
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
