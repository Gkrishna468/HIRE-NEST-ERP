/**
 * HireNestOS Resume Processing Ledger Service
 * Records deterministic audit trails of all resume parsing runs.
 */

import crypto from "crypto";
import { 
  ResumeProcessingLedgerEntry, 
  LedgerStatus, 
  PipelineStage, 
  ExtractionMethod,
  ResumeProcessingTimelineEvent 
} from "../types.js";

// In-memory fallback ledger for fast deduplication and offline test resilience
const memoryLedger = new Map<string, ResumeProcessingLedgerEntry>();
const memoryHashIndex = new Map<string, string>(); // SHA-256 -> resumeProcessingId

export class ResumeLedgerService {
  public static readonly PARSER_VERSION = "2.5.0";
  public static readonly OCR_VERSION = "Tesseract.js-v7";

  /**
   * Generates a SHA-256 hash from a Buffer or string.
   */
  public static computeHash(content: Buffer | string): string {
    const hash = crypto.createHash("sha256");
    if (typeof content === "string") {
      hash.update(content.trim());
    } else {
      hash.update(content);
    }
    return hash.digest("hex");
  }

  /**
   * Invalidates memory cache for a given hash (e.g. on forceRescan).
   */
  public static invalidateHash(documentHash: string) {
    if (memoryHashIndex.has(documentHash)) {
      const id = memoryHashIndex.get(documentHash);
      if (id) memoryLedger.delete(id);
      memoryHashIndex.delete(documentHash);
    }
  }

  /**
   * Checks if a document with this hash has already been processed.
   */
  public static async findDuplicate(documentHash: string, adminDb?: any): Promise<ResumeProcessingLedgerEntry | null> {
    // 1. Check in-memory index
    const existingId = memoryHashIndex.get(documentHash);
    if (existingId && memoryLedger.has(existingId)) {
      const entry = memoryLedger.get(existingId)!;
      if (entry.status === "COMPLETED" || entry.status === "SUCCESS") {
        return entry;
      }
    }

    // 2. Check Firestore if adminDb provided
    if (adminDb) {
      try {
        const snap = await adminDb.collection("resume_processing_ledger")
          .where("documentHash", "==", documentHash)
          .where("status", "in", ["COMPLETED", "SUCCESS"])
          .limit(1)
          .get();

        if (!snap.empty) {
          const data = snap.docs[0].data() as ResumeProcessingLedgerEntry;
          memoryLedger.set(data.resumeProcessingId, data);
          memoryHashIndex.set(documentHash, data.resumeProcessingId);
          return data;
        }
      } catch (err: any) {
        console.warn("[LEDGER] Error querying duplicate from Firestore:", err?.message || err);
      }
    }

    return null;
  }

  /**
   * Records the start of a resume processing operation.
   */
  public static async createEntry(params: {
    documentHash: string;
    filename: string;
    mimeType: string;
    fileSize: number;
    extractionMethod: ExtractionMethod;
    ocrUsed: boolean;
    candidateId?: string;
    initialStage?: PipelineStage;
    metadata?: Record<string, any>;
  }, adminDb?: any): Promise<ResumeProcessingLedgerEntry> {
    const resumeProcessingId = `rpl_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const startedAt = new Date().toISOString();
    const stage: PipelineStage = params.initialStage || "QUEUED";

    const initialTimeline: ResumeProcessingTimelineEvent[] = [
      {
        stage,
        status: "IN_PROGRESS",
        timestamp: startedAt,
        message: `Resume processing initialized for "${params.filename}" (${params.fileSize} bytes).`,
      }
    ];

    const entry: ResumeProcessingLedgerEntry = {
      resumeProcessingId,
      candidateId: params.candidateId,
      documentHash: params.documentHash,
      filename: params.filename,
      mimeType: params.mimeType,
      fileSize: params.fileSize,
      parserVersion: this.PARSER_VERSION,
      ocrVersion: params.ocrUsed ? this.OCR_VERSION : undefined,
      extractionMethod: params.extractionMethod,
      ocrUsed: params.ocrUsed,
      startedAt,
      updatedAt: startedAt,
      status: "PROCESSING",
      stage,
      textLength: 0,
      confidence: 0,
      timeline: initialTimeline,
      metadata: params.metadata,
    };

    memoryLedger.set(resumeProcessingId, entry);
    memoryHashIndex.set(params.documentHash, resumeProcessingId);

    if (adminDb) {
      try {
        await adminDb.collection("resume_processing_ledger").doc(resumeProcessingId).set(entry);
      } catch (err: any) {
        console.warn("[LEDGER] Error creating Firestore ledger record:", err?.message || err);
      }
    }

    return entry;
  }

  /**
   * Transitions the processing stage and records a timeline event.
   */
  public static async updateStage(
    resumeProcessingId: string,
    stage: PipelineStage,
    message: string,
    extraUpdates?: Partial<ResumeProcessingLedgerEntry>,
    adminDb?: any
  ): Promise<ResumeProcessingLedgerEntry | null> {
    const entry = memoryLedger.get(resumeProcessingId);
    const now = new Date().toISOString();

    const timeline = entry?.timeline ? [...entry.timeline] : [];
    // Mark previous in-progress timeline event as SUCCESS
    if (timeline.length > 0 && timeline[timeline.length - 1].status === "IN_PROGRESS") {
      timeline[timeline.length - 1].status = "SUCCESS";
    }

    timeline.push({
      stage,
      status: (stage === "COMPLETED" || stage === "DUPLICATE") ? "SUCCESS" : stage === "FAILED" ? "FAILED" : "IN_PROGRESS",
      timestamp: now,
      message,
    });

    const updatedEntry: ResumeProcessingLedgerEntry = {
      ...(entry || {
        resumeProcessingId,
        documentHash: "",
        filename: "unknown",
        mimeType: "unknown",
        fileSize: 0,
        parserVersion: this.PARSER_VERSION,
        extractionMethod: "TEXT_UTF8",
        ocrUsed: false,
        startedAt: now,
        status: "PROCESSING",
        textLength: 0,
        confidence: 0,
        timeline: [],
      }),
      ...extraUpdates,
      stage,
      updatedAt: now,
      timeline,
    };

    memoryLedger.set(resumeProcessingId, updatedEntry);

    if (adminDb) {
      try {
        await adminDb.collection("resume_processing_ledger").doc(resumeProcessingId).set(updatedEntry, { merge: true });
      } catch (err: any) {
        console.warn("[LEDGER] Error updating Firestore ledger stage:", err?.message || err);
      }
    }

    return updatedEntry;
  }

  /**
   * Finalizes the ledger entry with final extraction/parsing results.
   */
  public static async finalizeEntry(
    resumeProcessingId: string,
    updates: {
      status: LedgerStatus;
      stage?: PipelineStage;
      candidateId?: string;
      candidateName?: string;
      email?: string;
      phone?: string;
      location?: string;
      totalExperience?: number;
      skillsFound?: number;
      skills?: string[];
      extractionMethod?: ExtractionMethod;
      ocrUsed?: boolean;
      textLength?: number;
      confidence?: number;
      errorCode?: string;
      errorMessage?: string;
      requiresManualReview?: boolean;
      message?: string;
      metadata?: Record<string, any>;
    },
    adminDb?: any
  ): Promise<ResumeProcessingLedgerEntry | null> {
    const entry = memoryLedger.get(resumeProcessingId);
    const completedAt = new Date().toISOString();
    const finalStage: PipelineStage = updates.stage || (
      updates.status === "COMPLETED" || updates.status === "SUCCESS" ? "COMPLETED" :
      updates.status === "DUPLICATE" ? "DUPLICATE" :
      updates.status === "MANUAL_REVIEW" ? "MANUAL_REVIEW" :
      "FAILED"
    );

    const timeline = entry?.timeline ? [...entry.timeline] : [];
    if (timeline.length > 0 && timeline[timeline.length - 1].status === "IN_PROGRESS") {
      timeline[timeline.length - 1].status = (finalStage === "FAILED") ? "FAILED" : "SUCCESS";
    }

    const defaultMsg = finalStage === "COMPLETED" 
      ? `Processing complete. Candidate: ${updates.candidateName || "Extracted"}. Skills found: ${updates.skillsFound || updates.skills?.length || 0}.`
      : finalStage === "DUPLICATE"
      ? "Duplicate document matched in repository. Reusing verified parsing results."
      : finalStage === "MANUAL_REVIEW"
      ? (updates.errorMessage || "Candidate identity could not be confidently extracted. Flagged for manual review.")
      : (updates.errorMessage || "Processing failed during document ingestion.");

    timeline.push({
      stage: finalStage,
      status: finalStage === "FAILED" ? "FAILED" : "SUCCESS",
      timestamp: completedAt,
      message: updates.message || defaultMsg,
    });

    const updatedEntry: ResumeProcessingLedgerEntry = {
      ...(entry || {
        resumeProcessingId,
        documentHash: "",
        filename: "unknown",
        mimeType: "unknown",
        fileSize: 0,
        parserVersion: this.PARSER_VERSION,
        extractionMethod: updates.extractionMethod || "TEXT_UTF8",
        ocrUsed: updates.ocrUsed || false,
        startedAt: completedAt,
        status: updates.status,
        stage: finalStage,
        textLength: updates.textLength || 0,
        confidence: updates.confidence || 1.0,
        timeline: [],
      }),
      ...updates,
      status: updates.status === "SUCCESS" ? "COMPLETED" : updates.status,
      stage: finalStage,
      updatedAt: completedAt,
      completedAt,
      timeline,
    };

    memoryLedger.set(resumeProcessingId, updatedEntry);
    if (updatedEntry.documentHash) {
      memoryHashIndex.set(updatedEntry.documentHash, resumeProcessingId);
    }

    if (adminDb) {
      try {
        await adminDb.collection("resume_processing_ledger").doc(resumeProcessingId).set(updatedEntry, { merge: true });
      } catch (err: any) {
        console.warn("[LEDGER] Error updating Firestore ledger record:", err?.message || err);
      }
    }

    return updatedEntry;
  }

  /**
   * Watchdog: Scans and recovers stale processing records older than maxAgeMs (default 2 minutes = 120000ms).
   */
  public static async checkAndRecoverStaleEntries(maxAgeMs: number = 120_000, adminDb?: any): Promise<number> {
    const now = Date.now();
    let recoveredCount = 0;

    // 1. Recover in-memory entries
    for (const [id, entry] of memoryLedger.entries()) {
      if (entry.status === "PROCESSING" || entry.status === "QUEUED") {
        const startTime = new Date(entry.startedAt).getTime();
        if (now - startTime > maxAgeMs) {
          console.warn(`[LEDGER WATCHDOG] Stale processing detected for ${id} (elapsed: ${Math.round((now - startTime) / 1000)}s). Marking as FAILED.`);
          await this.finalizeEntry(id, {
            status: "FAILED",
            stage: "FAILED",
            errorCode: "WATCHDOG_TIMEOUT",
            errorMessage: `Operation timed out after ${Math.round(maxAgeMs / 1000)} seconds watchdog limit.`,
          }, adminDb);
          recoveredCount++;
        }
      }
    }

    // 2. Recover Firestore entries if adminDb is available
    if (adminDb) {
      try {
        const cutoffIso = new Date(now - maxAgeMs).toISOString();
        const staleSnap = await adminDb.collection("resume_processing_ledger")
          .where("status", "in", ["PROCESSING", "QUEUED"])
          .where("startedAt", "<=", cutoffIso)
          .limit(50)
          .get();

        for (const doc of staleSnap.docs) {
          const data = doc.data() as ResumeProcessingLedgerEntry;
          if (!memoryLedger.has(data.resumeProcessingId)) {
            console.warn(`[LEDGER WATCHDOG] Stale Firestore processing detected for ${data.resumeProcessingId}. Marking as FAILED.`);
            await this.finalizeEntry(data.resumeProcessingId, {
              status: "FAILED",
              stage: "FAILED",
              errorCode: "WATCHDOG_TIMEOUT",
              errorMessage: `Operation timed out after ${Math.round(maxAgeMs / 1000)} seconds watchdog limit.`,
            }, adminDb);
            recoveredCount++;
          }
        }
      } catch (err: any) {
        console.warn("[LEDGER WATCHDOG] Error checking stale entries from Firestore:", err?.message || err);
      }
    }

    return recoveredCount;
  }

  /**
   * Retrieves a ledger entry by ID. Automatically checks watchdog timeout on retrieval.
   */
  public static async getEntry(resumeProcessingId: string, adminDb?: any): Promise<ResumeProcessingLedgerEntry | null> {
    let entry: ResumeProcessingLedgerEntry | null = null;

    if (memoryLedger.has(resumeProcessingId)) {
      entry = memoryLedger.get(resumeProcessingId)!;
    } else if (adminDb) {
      try {
        const doc = await adminDb.collection("resume_processing_ledger").doc(resumeProcessingId).get();
        if (doc.exists) {
          entry = doc.data() as ResumeProcessingLedgerEntry;
          memoryLedger.set(resumeProcessingId, entry);
        }
      } catch (err: any) {
        console.warn("[LEDGER] Error fetching ledger entry from Firestore:", err?.message || err);
      }
    }

    // Check if retrieved entry is stale (> 2 min in PROCESSING/QUEUED)
    if (entry && (entry.status === "PROCESSING" || entry.status === "QUEUED")) {
      const elapsed = Date.now() - new Date(entry.startedAt).getTime();
      if (elapsed > 120_000) {
        console.warn(`[LEDGER WATCHDOG] Entry ${resumeProcessingId} is stale on read (${Math.round(elapsed / 1000)}s). Updating to FAILED.`);
        entry = await this.finalizeEntry(resumeProcessingId, {
          status: "FAILED",
          stage: "FAILED",
          errorCode: "WATCHDOG_TIMEOUT",
          errorMessage: "Operation timed out after 2 minutes watchdog limit.",
        }, adminDb);
      }
    }

    return entry;
  }

  /**
   * Returns recent ledger entries for operational telemetry and audit UI.
   */
  public static async getRecentEntries(limitCount: number = 20, adminDb?: any): Promise<ResumeProcessingLedgerEntry[]> {
    if (adminDb) {
      try {
        const snap = await adminDb.collection("resume_processing_ledger")
          .orderBy("startedAt", "desc")
          .limit(limitCount)
          .get();

        if (!snap.empty) {
          return snap.docs.map((d: any) => d.data() as ResumeProcessingLedgerEntry);
        }
      } catch (err: any) {
        console.warn("[LEDGER] Error querying recent entries from Firestore, falling back to memory:", err?.message || err);
      }
    }

    return Array.from(memoryLedger.values())
      .sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""))
      .slice(0, limitCount);
  }
}
