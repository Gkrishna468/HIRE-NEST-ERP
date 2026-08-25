/**
 * HireNestOS Deterministic DOCX Extractor
 * Uses mammoth for native document extraction with embedded image OCR fallback.
 */

import mammoth from "mammoth";
import { performOCR } from "./ocr.js";
import { ExtractionMethod } from "../types.js";

async function extractImagesFromDOCX(buffer: Buffer): Promise<string> {
  try {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buffer);
    const mediaFolder = zip.folder("word/media");
    let ocrCombined = "";

    if (mediaFolder) {
      const files = Object.entries(mediaFolder.files);
      for (const [relativePath, file] of files) {
        if (!file.dir && /\.(png|jpe?g|gif|webp|tiff?)$/i.test(relativePath)) {
          const imgBuffer = await file.async("nodebuffer");
          const res = await performOCR(imgBuffer);
          if (res.text) {
            ocrCombined += res.text + "\n";
          }
        }
      }
    }
    return ocrCombined.trim();
  } catch (err: any) {
    console.warn("[DOCX_EXTRACTOR] Error extracting embedded images:", err?.message || err);
    return "";
  }
}

export async function extractTextFromDOCX(buffer: Buffer): Promise<{
  text: string;
  method: ExtractionMethod;
  ocrUsed: boolean;
  confidence: number;
}> {
  let text = "";
  let ocrUsed = false;
  let method: ExtractionMethod = "DOCX_MAMMOTH";
  let confidence = 0.95;

  try {
    const parsed = await mammoth.extractRawText({ buffer });
    text = (parsed?.value || "").trim();

    // If text is sparse, try embedded image OCR
    if (text.length < 40) {
      console.log(`[DOCX_EXTRACTOR] Sparse text (${text.length} chars). Checking for embedded images...`);
      const imgText = await extractImagesFromDOCX(buffer);
      if (imgText.length > text.length) {
        text = imgText;
        ocrUsed = true;
        method = "DOCX_IMAGE_OCR";
        confidence = 0.85;
      }
    }
  } catch (docxErr: any) {
    console.warn("[DOCX_EXTRACTOR] Mammoth parsing failed, falling back to embedded image OCR:", docxErr?.message || docxErr);
    const imgText = await extractImagesFromDOCX(buffer);
    if (imgText.length > 0) {
      text = imgText;
      ocrUsed = true;
      method = "DOCX_IMAGE_OCR";
      confidence = 0.8;
    } else {
      // Fallback to printable ascii
      const raw = buffer.toString("utf-8");
      text = raw.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim().slice(0, 15000);
      method = "TEXT_UTF8";
      confidence = 0.4;
    }
  }

  return { text, method, ocrUsed, confidence };
}
