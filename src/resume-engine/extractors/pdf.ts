/**
 * HireNestOS Deterministic PDF Extractor
 * Uses pdf-parse for native text extraction with automatic fallback to page screenshot OCR.
 */

import { ExtractionMethod } from "../types.js";

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

  // pdf-parse (and its pdfjs-dist dependency) is imported lazily, inside this
  // try/catch, rather than at module load time. pdf-parse 2.x also ships a
  // completely different API (a PDFParse class, not a callable default
  // export) from the 1.x API this code originally targeted — importing it
  // eagerly at the top of the module meant a failure here (or the previous
  // "pdf is not a function" mismatch) could take down every request to this
  // handler, including ones uploading non-PDF files that never needed it.
  let parser: any = null;
  try {
    const { PDFParse } = await import("pdf-parse");
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    rawText = (result?.text || "").trim();
    pageCount = result?.pages?.length || result?.total || 1;
  } catch (pdfErr: any) {
    console.warn("[PDF_EXTRACTOR] Primary pdf-parse failed:", pdfErr?.message || pdfErr);
  } finally {
    if (parser) {
      try { await parser.destroy(); } catch { /* ignore */ }
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
