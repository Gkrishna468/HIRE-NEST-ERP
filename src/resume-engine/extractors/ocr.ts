/**
 * HireNestOS Deterministic OCR Engine
 * Uses Tesseract.js with worker lifecycle management and timeout boundaries.
 */

import path from "path";
import fs from "fs";

function isValidTrainedData(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    const stats = fs.statSync(filePath);
    return stats.size >= 512 * 1024; // Minimum 512KB
  } catch {
    return false;
  }
}

export async function performOCR(imageBuffer: Buffer, timeoutMs: number = 15000): Promise<{ text: string; confidence: number }> {
  let worker: any = null;
  let timeoutId: any = null;

  try {
    const { createWorker } = await import("tesseract.js");

    let resolvedCachePath = "/tmp";
    try {
      fs.accessSync("/tmp", fs.constants.W_OK);
    } catch {
      resolvedCachePath = process.cwd();
    }

    const localTessdataPath = path.join(process.cwd(), "tessdata");
    const localFileGz = path.join(localTessdataPath, "eng.traineddata.gz");
    const localFile = path.join(localTessdataPath, "eng.traineddata");

    let langPathOption = "https://tessdata.projectnaptha.com/4.0.0_fast";
    if (isValidTrainedData(localFileGz) || isValidTrainedData(localFile)) {
      langPathOption = localTessdataPath;
    }

    const ocrPromise = (async () => {
      worker = await createWorker("eng", 1, {
        langPath: langPathOption,
        cachePath: resolvedCachePath,
      });

      const res = await worker.recognize(imageBuffer);
      const text = res?.data?.text || "";
      const confidence = typeof res?.data?.confidence === "number" ? res.data.confidence / 100 : 0.85;
      return { text: text.trim(), confidence };
    })();

    const timeoutPromise = new Promise<{ text: string; confidence: number }>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("OCR_TIMEOUT"));
      }, timeoutMs);
    });

    const result = await Promise.race([ocrPromise, timeoutPromise]);
    return result;
  } catch (err: any) {
    console.warn("[OCR_ENGINE] performOCR safely handled failure:", err?.message || err);
    return { text: "", confidence: 0 };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        // Silently discard
      }
    }
  }
}
