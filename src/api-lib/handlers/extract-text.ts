import multer from "multer";
import mammoth from "mammoth";
import path from "path";
import { ErrorMonitor } from "../telemetry/errorMonitor.js";
import { AuditLogger } from "../telemetry/auditLogger.js";

// Configure multer storage in memory with size limits to prevent Denial of Service (DoS)
const multerFunc =
  typeof multer === "function" ? multer : (multer as any).default;
const storage = multerFunc.memoryStorage();
const upload = multerFunc({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Strict 5MB limit to prevent server exhaustion
  },
  fileFilter: (req: any, file: any, cb: any) => {
    // Whitelist document-related MIME types and images for OCR
    const allowedMimeTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
      "text/markdown",
      "application/rtf",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp"
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Security Alert: Blocked upload with unsupported file type (${file.mimetype})`,
        ),
      );
    }
  },
}).single("file");

function cleanBufferText(buffer: Buffer): string {
  // Gracefully converts buffer to UTF-8 and filters printable ASCII characters
  const raw = buffer.toString("utf-8");
  const printable = raw
    .replace(/[^\x20-\x7E\n\r\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return printable.slice(0, 15000);
}

function generateSyntheticProfile(filename: string): string {
  const cleanName =
    filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ") || "Candidate";
  return `PARSING_PENDING
Filename: ${filename}
Candidate Name: ${cleanName}

This resume has been securely stored.
AI parsing is currently queued for background processing due to capacity limits.
`;
}

// Perform Tesseract OCR using local traineddata
async function performOCR(imageBuffer: Buffer): Promise<string> {
  let worker = null;
  try {
    const { createWorker } = await import("tesseract.js");
    worker = await createWorker("eng", 1, {
      langPath: path.join(process.cwd(), "tessdata"),
      cachePath: path.join(process.cwd(), "tessdata"),
    });
    
    console.log("[OCR] Initialized Tesseract worker with local langPath");
    const { data: { text } } = await worker.recognize(imageBuffer);
    return text || "";
  } catch (err) {
    console.error("[OCR] Tesseract OCR failed:", err);
    return "";
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
}

// Render scanned PDF pages to PNG and run OCR
async function extractTextFromScannedPDF(buffer: Buffer): Promise<string> {
  try {
    const pdfjs = await import("pdfjs-dist");
    const { createCanvas } = await import("@napi-rs/canvas");
    
    const workerPath = path.join(
      process.cwd(),
      "node_modules/pdfjs-dist/build/pdf.worker.mjs",
    );
    pdfjs.GlobalWorkerOptions.workerSrc = workerPath;

    const data = new Uint8Array(buffer);
    const loadingTask = pdfjs.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true,
    });

    const pdfDoc = await loadingTask.promise;
    let text = "";

    console.log(`[OCR] Scanned PDF detected, rendering ${pdfDoc.numPages} pages for OCR...`);
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext("2d");
      
      await page.render({
        canvasContext: context as any,
        viewport: viewport,
        canvas: canvas as any
      }).promise;

      const pngBuffer = await canvas.toBuffer("image/png");
      const pageText = await performOCR(pngBuffer);
      text += pageText + "\n";
    }
    return text;
  } catch (err) {
    console.error("[OCR] Failed to render PDF to canvas:", err);
    return "";
  }
}

// Extract images from DOCX and perform OCR on them
async function extractTextFromDOCXImages(buffer: Buffer): Promise<string> {
  try {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buffer);
    const mediaFolder = zip.folder("word/media");
    let ocrText = "";
    if (mediaFolder) {
      const files = Object.entries(mediaFolder.files);
      console.log(`[OCR] Found ${files.length} media files in DOCX, checking for images...`);
      for (const [relativePath, file] of files) {
        if (!file.dir && /\.(png|jpe?g|gif|webp|tiff?)$/i.test(relativePath)) {
          console.log(`[OCR] Running OCR on DOCX image: ${relativePath}`);
          const imgBuffer = await file.async("nodebuffer");
          const text = await performOCR(imgBuffer);
          ocrText += text + "\n";
        }
      }
    }
    return ocrText;
  } catch (err) {
    console.error("[OCR] Failed to extract images from DOCX:", err);
    return "";
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // Parse the multipart form-data file upload using multer
  upload(req, res, async (err: any) => {
    if (err) {
      console.error("[EXTRACTION] Multer error:", err);
      const isSecurityOrLimit =
        err.message.includes("Security Alert") ||
        err.code === "LIMIT_FILE_SIZE";
        
      await ErrorMonitor.captureError({
          requestId: req.requestId,
          context: '/api/extract-text',
          errorType: 'OCR_FAILURE',
          errorMessage: err.message || "File upload validation failed",
          metadata: { isSecurityOrLimit }
      });

      return res.status(isSecurityOrLimit ? 400 : 500).json({
        message: isSecurityOrLimit
          ? "Validation/Security constraints violated"
          : "Error processing file upload",
        error: err.message,
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { buffer, originalname, mimetype } = req.file;
    const fileExtension = originalname.split(".").pop()?.toLowerCase() || "";

    console.log(
      `[EXTRACTION] Processing file: ${originalname}, Type: ${mimetype}, Ext: ${fileExtension}`,
    );

    await AuditLogger.log({
        action: 'RESUME_UPLOADED',
        details: `File uploaded for extraction: ${originalname}`,
        metadata: { mimetype, size: buffer.length }
    });

    try {
      let extractedText = "";

      if (mimetype.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(fileExtension)) {
        console.log(`[EXTRACTION] Direct image upload detected: ${originalname}`);
        extractedText = await performOCR(buffer);
      } else if (mimetype === "application/pdf" || fileExtension === "pdf") {
        try {
          // Dynamically import pdfjs-dist on-demand to prevent pre-load native module issues
          const pdfjs = await import("pdfjs-dist");

          // Configure worker absolute path safely from the current server context
          const workerPath = path.join(
            process.cwd(),
            "node_modules/pdfjs-dist/build/pdf.worker.mjs",
          );
          pdfjs.GlobalWorkerOptions.workerSrc = workerPath;

          const data = new Uint8Array(buffer);
          const loadingTask = pdfjs.getDocument({
            data,
            useSystemFonts: true,
            disableFontFace: true,
          });

          const pdfDoc = await loadingTask.promise;
          let text = "";

          for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join(" ");
            text += pageText + "\n";
          }

          extractedText = text || "";
          console.log(
            `[EXTRACTION] PDFJS-Dist Parsed ${pdfDoc.numPages} pages successfully from ${originalname}`,
          );

          // If PDF contains no/little text, run scanned PDF OCR
          if (!extractedText || extractedText.trim().length < 40) {
            console.log(`[EXTRACTION] PDF has sparse text (${extractedText.trim().length} chars). Falling back to scanned PDF OCR...`);
            extractedText = await extractTextFromScannedPDF(buffer);
          }
        } catch (pdfErr: any) {
          console.warn(
            "[EXTRACTION] pdfjs-dist parser failed, reverting to scanned PDF OCR...",
            pdfErr,
          );
          await ErrorMonitor.captureError({
              requestId: req.requestId,
              context: '/api/extract-text (pdfjs)',
              errorType: 'OCR_FAILURE',
              errorMessage: pdfErr.message || "PDF parse error",
              metadata: { originalname }
          });
          extractedText = await extractTextFromScannedPDF(buffer);
        }
      } else if (
        mimetype ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        fileExtension === "docx"
      ) {
        try {
          const parsed = await mammoth.extractRawText({ buffer });
          extractedText = parsed.value || "";
          
          // If DOCX has sparse text, check for embedded images and OCR them
          if (!extractedText || extractedText.trim().length < 40) {
            console.log(`[EXTRACTION] DOCX has sparse text (${extractedText.trim().length} chars). Falling back to DOCX embedded images OCR...`);
            extractedText = await extractTextFromDOCXImages(buffer);
          }
        } catch (docxErr) {
          console.warn(
            "[EXTRACTION] Mammoth DOCX parse failed, trying image extraction fallback...",
            docxErr,
          );
          extractedText = await extractTextFromDOCXImages(buffer);
        }
      } else if (mimetype === "application/msword" || fileExtension === "doc") {
        try {
          const parsed = await mammoth
            .extractRawText({ buffer })
            .catch(() => null);
          if (parsed && parsed.value) {
            extractedText = parsed.value;
          } else {
            extractedText = cleanBufferText(buffer);
          }
        } catch (docErr) {
          extractedText = cleanBufferText(buffer);
        }
      } else {
        // Fallback for plain text, csv, Markdown, or rtf files
        extractedText = buffer.toString("utf-8");
      }

      // Check if we managed to extract any valid text contents; if not, return empty string
      if (!extractedText || extractedText.trim().length < 5) {
        console.warn(
          `[EXTRACTION] Zero-byte/insufficient text from ${originalname}. Returning empty string.`,
        );
        extractedText = "";
      }

      console.log(
        `[EXTRACTION] Success! Extracted ${extractedText.length} characters from ${originalname}`,
      );
      return res.status(200).json({ text: extractedText });
    } catch (parseError: any) {
      console.warn(
        `[EXTRACTION] Parser had an unexpected failure for ${originalname}. Returning empty string:`,
        parseError,
      );
      
      await ErrorMonitor.captureError({
          requestId: req.requestId,
          context: '/api/extract-text (fallback)',
          errorType: 'OCR_FAILURE',
          errorMessage: parseError.message || "Fatal parse error",
          metadata: { originalname }
      });

      const recoveredText = "";
      return res.status(200).json({ text: recoveredText });
    }
  });
}
