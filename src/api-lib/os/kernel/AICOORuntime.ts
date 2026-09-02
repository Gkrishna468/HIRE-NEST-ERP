import { db } from "../../../lib/firebase-admin.js";
import { BusinessEvent } from "./RuntimeTypes.js";

export class AICOORuntime {
  /**
   * Called by the Event Bus to enqueue a business event for the AI COO.
   */
  static async enqueueEvent(event: BusinessEvent) {
    const { FeatureFlags } = await import("./FeatureFlags.js");
    if (!FeatureFlags.AI_RUNTIME_ENABLED) return;

    if (!db) return;
    await db.collection("coo_inbox").add({
      eventId: event.eventId,
      type: event.eventType, // Using the new property
      status: "PENDING",
      enqueuedAt: new Date().toISOString(),
      priority: event.priority || "NORMAL",
      tenantId: event.tenantId,
      retryCount: event.retryCount || 0,
    });

    // Trigger background processing (non-blocking)
    this.triggerProcessing().catch((e) =>
      console.error("[AICOORuntime] trigger failed", e),
    );
  }

  private static async triggerProcessing() {
    // This used to fire an HTTP self-request to /api/ops?action=process_coo,
    // but in a serverless deployment there is no listener at
    // NEXT_PUBLIC_API_URL (usually unset, defaulting to a dead
    // http://localhost:3000) and that route also requires an auth bearer
    // token this background trigger never had — so the request always
    // failed silently and coo_inbox items sat PENDING forever. Since this
    // runs in the same process as the caller, just invoke the work directly.
    try {
      const { OutboxDispatcher } = await import("./OutboxDispatcher.js");
      await OutboxDispatcher.dispatchOutbox();
      await this.processInbox();
    } catch (e) {
      console.error("[AICOORuntime] trigger failed", e);
    }
  }

  /**
   * Processes the COO inbox. Looks at PENDING events, determines which offices
   * should act, and enqueues tasks for those offices.
   * Respects Priority: CRITICAL, HIGH, NORMAL, LOW, BACKGROUND.
   */
  static async processInbox() {
    if (!db) return;

    let snap;
    try {
      snap = await db
        .collection("coo_inbox")
        .where("status", "==", "PENDING")
        .orderBy("enqueuedAt", "asc")
        .limit(50)
        .get();
    } catch (err: any) {
      console.log("[AICOORuntime] Missing index for coo_inbox, falling back to memory sort", err.message);
      const rawSnap = await db
        .collection("coo_inbox")
        .where("status", "==", "PENDING")
        .get();
      const sortedDocs = rawSnap.docs.sort((a, b) => {
        const tA = new Date(a.data().enqueuedAt || 0).getTime();
        const tB = new Date(b.data().enqueuedAt || 0).getTime();
        return tA - tB;
      });
      snap = { empty: sortedDocs.length === 0, docs: sortedDocs.slice(0, 100) };
    }

    if (snap.empty) return;

    const docs = snap.docs.map((d) => ({
      id: d.id,
      ref: d.ref,
      data: d.data(),
    }));

    // Priority ranking
    const prioRank: Record<string, number> = {
      CRITICAL: 5,
      HIGH: 4,
      NORMAL: 3,
      LOW: 2,
      BACKGROUND: 1,
    };

    docs.sort((a, b) => {
      const prioA = prioRank[a.data.priority] || 3;
      const prioB = prioRank[b.data.priority] || 3;
      if (prioA !== prioB) return prioB - prioA; // higher first
      return (
        new Date(a.data.enqueuedAt).getTime() -
        new Date(b.data.enqueuedAt).getTime()
      );
    });

    const batch = db.batch();
    let processedCount = 0;

    for (const doc of docs) {
      if (processedCount >= 20) break; // limit processing batch

      const data = doc.data;
      const eventId = data.eventId;
      const eventType = data.type;
      const tenantId = data.tenantId || "GLOBAL";

      // Mark as processing
      batch.update(doc.ref, {
        status: "PROCESSING",
        processedAt: new Date().toISOString(),
      });

      // Determine offices based on eventType
      const targetOffices = await this.determineOffices(eventType);

      for (const office of targetOffices) {
        const inboxRef = db.collection("office_inbox").doc();
        batch.set(inboxRef, {
          office,
          eventId,
          eventType,
          status: "PENDING",
          enqueuedAt: new Date().toISOString(),
          priority: data.priority,
          tenantId,
          retryCount: 0,
        });
      }

      // Mark COO inbox item as complete
      batch.update(doc.ref, { status: "COMPLETED" });
      processedCount++;
    }
    await batch.commit();

    // Trigger office processing
    this.triggerOfficeProcessing().catch((e) =>
      console.error("[AICOORuntime] trigger office failed", e),
    );
  }

  private static async determineOffices(eventType: string): Promise<string[]> {
    const { OfficeCapabilityRegistry } =
      await import("./OfficeCapabilityRegistry.js");
    const registeredOffices =
      await OfficeCapabilityRegistry.getOfficesForEvent(eventType);

    return registeredOffices;
  }

  private static async triggerOfficeProcessing() {
    // Same self-fetch problem as triggerProcessing() above — replaced with a
    // direct in-process call to each office's queue processor.
    try {
      const officeModules = [
        { mod: "./MatchingOffice.js", cls: "MatchingOffice" },
        { mod: "./RecruitmentOffice.js", cls: "RecruitmentOffice" },
        { mod: "./IntakeOffice.js", cls: "IntakeOffice" },
        { mod: "./VendorOffice.js", cls: "VendorOffice" },
        { mod: "./SubmissionOffice.js", cls: "SubmissionOffice" },
        { mod: "./ClientOffice.js", cls: "ClientOffice" },
        { mod: "./FounderOffice.js", cls: "FounderOffice" },
      ];
      for (const { mod, cls } of officeModules) {
        const imported: any = await import(mod);
        const OfficeClass = imported[cls];
        const office = new OfficeClass();
        await office.processQueue();
      }
    } catch (e) {
      console.error("[AICOORuntime] trigger office failed", e);
    }
  }
}
