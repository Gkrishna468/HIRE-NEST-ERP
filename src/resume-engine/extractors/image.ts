/**
 * HireNestOS Deterministic Image Resume Extractor
 * Uses Tesseract.js for PNG, JPG, JPEG, and WEBP resume scans.
 */

import { performOCR } from "./ocr.js";
import { ExtractionMethod } from "../types.js";

export async function extractTextFromImage(buffer: Buffer): Promise<{
  text: string;
  method: ExtractionMethod;
  ocrUsed: boolean;
  confidence: number;
}> {
  const result = await performOCR(buffer);
  return {
    text: result.text,
    method: "IMAGE_OCR",
    ocrUsed: true,
    confidence: result.confidence || 0.85,
  };
}
