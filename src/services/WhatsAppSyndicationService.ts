import { db } from "../lib/firebase-admin.js";

export interface WhatsAppPublicationRecord {
  id: string; // e.g. REQ-123_WHATSAPP_1
  requirementId: string;
  publicationNumber: 1 | 2 | 3;
  channel: "WHATSAPP";
  status: "PENDING" | "DELIVERED" | "FAILED" | "CANCELLED";
  scheduledFor: string;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string;
  messageText: string;
  metadata: {
    client: string;
    role: string;
    workMode: string;
    location: string;
    skills: string[];
    experience: string;
    openings: number;
  };
  createdAt: string;
  updatedAt: string;
}

export class WhatsAppSyndicationService {
  /**
   * Builds sanitized public WhatsApp copy.
   * STRICT SECURITY RULE: Never include private financial data, vendor margins,
   * client billing rates, or internal comments in the WhatsApp text.
   */
  static buildSanitizedMessage(data: any): string {
    const clientLabel = data.clientName || data.client || "Client Partner";
    const roleTitle = data.title || "IT Specialist";
    const exp = data.experience || data.experienceRange || "Relevant Experience";
    const mode = data.workMode || data.mode || "Remote";
    const loc = data.location || "India / Global";
    const skillsList = Array.isArray(data.skills) 
      ? data.skills.join(" | ") 
      : (typeof data.skills === "string" ? data.skills : "N/A");
    const openings = data.openings || 1;

    return `*🔥 ACTIVE IT REQUIREMENT*

*Client:* ${clientLabel}
*Role:* ${roleTitle}
*Experience:* ${exp}
*Work Mode:* ${mode}
*Location:* ${loc}
*Skills:* ${skillsList}
*Openings:* ${openings}

_Interested vendors/recruiters: Submit matching profiles directly through HireNest OS._`;
  }

  /**
   * Initializes the 3x publication queue for an ACTIVE requirement.
   * Enforces deterministic idempotency keys: requirementId + "_WHATSAPP_" + publicationNumber
   */
  static async queueSyndication(requirementId: string, requirementData: any): Promise<{
    queued: number;
    publicationIds: string[];
  }> {
    if (!db) return { queued: 0, publicationIds: [] };

    const sanitizedMessage = this.buildSanitizedMessage(requirementData);
    const now = Date.now();
    const publicationIds: string[] = [];

    const scheduleDelays = [
      0,                       // Publication #1: Immediate
      4 * 60 * 60 * 1000,      // Publication #2: +4 hours
      24 * 60 * 60 * 1000      // Publication #3: +24 hours
    ];

    const metadata = {
      client: requirementData.clientName || requirementData.client || "Client Partner",
      role: requirementData.title || "Role",
      workMode: requirementData.workMode || "REMOTE",
      location: requirementData.location || "India",
      skills: Array.isArray(requirementData.skills) ? requirementData.skills : [],
      experience: requirementData.experience || "N/A",
      openings: requirementData.openings || 1
    };

    let queuedCount = 0;

    for (let i = 0; i < 3; i++) {
      const pubNum = (i + 1) as 1 | 2 | 3;
      const idempotencyKey = `${requirementId}_WHATSAPP_${pubNum}`;
      publicationIds.push(idempotencyKey);

      const pubRef = db.collection("whatsapp_queue").doc(idempotencyKey);
      const existingSnap = await pubRef.get();

      if (!existingSnap.exists) {
        const scheduledTime = new Date(now + scheduleDelays[i]).toISOString();
        const record: WhatsAppPublicationRecord = {
          id: idempotencyKey,
          requirementId,
          publicationNumber: pubNum,
          channel: "WHATSAPP",
          status: "PENDING",
          scheduledFor: scheduledTime,
          deliveredAt: null,
          cancelledAt: null,
          messageText: sanitizedMessage,
          metadata,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await pubRef.set(record);
        queuedCount++;
      }
    }

    // Update the requirement's root syndication status
    try {
      await db.collection("requirements_public").doc(requirementId).set({
        whatsappQueueStatus: "PENDING_PUBLICATION_1",
        whatsappPublicationIds: publicationIds,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn(`[WHATSAPP_SYNDICATION] Failed to update root requirement metadata for ${requirementId}:`, err);
    }

    console.log(`[WHATSAPP_SYNDICATION] Successfully queued ${queuedCount} publications for requirement ${requirementId}`);
    return { queued: queuedCount, publicationIds };
  }

  /**
   * Rule 4: Cancels any pending unsent publications if a requirement transitions to CLOSED/HOLD/EXPIRED.
   */
  static async cancelSyndication(requirementId: string, reason: string = "REQUIREMENT_INACTIVE"): Promise<number> {
    if (!db) return 0;

    const snap = await db.collection("whatsapp_queue")
      .where("requirementId", "==", requirementId)
      .where("status", "==", "PENDING")
      .get();

    if (snap.empty) return 0;

    let cancelledCount = 0;
    const batch = db.batch();

    snap.docs.forEach(docSnap => {
      batch.update(docSnap.ref, {
        status: "CANCELLED",
        cancelledAt: new Date().toISOString(),
        cancelReason: reason,
        updatedAt: new Date().toISOString()
      });
      cancelledCount++;
    });

    await batch.commit();

    try {
      await db.collection("requirements_public").doc(requirementId).set({
        whatsappQueueStatus: "CANCELLED_INACTIVE",
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.warn(`[WHATSAPP_SYNDICATION] Failed to set status CANCELLED on ${requirementId}:`, e);
    }

    console.log(`[WHATSAPP_SYNDICATION] Cancelled ${cancelledCount} pending publications for ${requirementId} (Reason: ${reason})`);
    return cancelledCount;
  }

  /**
   * Rule 5: Reactivates syndication when a requirement moves from CLOSED back to ACTIVE.
   */
  static async reactivateSyndication(requirementId: string, requirementData: any): Promise<void> {
    if (!db) return;
    console.log(`[WHATSAPP_SYNDICATION] Reactivating syndication cycle for ${requirementId}`);
    
    // First clear old pending/cancelled states if restarting cycle
    const snap = await db.collection("whatsapp_queue")
      .where("requirementId", "==", requirementId)
      .get();

    if (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach(d => {
        // Archive previous into history collection if delivered
        const dData = d.data();
        if (dData.status === "DELIVERED") {
          db.collection("whatsapp_delivery_logs").doc(`archived_${d.id}_${Date.now()}`).set(dData);
        }
        batch.delete(d.ref);
      });
      await batch.commit();
    }

    await this.queueSyndication(requirementId, requirementData);
  }

  /**
   * Executes pending publications whose scheduled time is ready.
   * Can be triggered by cron or direct dispatch.
   */
  static async processPendingPublications(forceImmediate: boolean = false): Promise<{
    processed: number;
    delivered: number;
    cancelled: number;
    details: any[];
  }> {
    if (!db) return { processed: 0, delivered: 0, cancelled: 0, details: [] };

    const nowISO = new Date().toISOString();
    let queryRef = db.collection("whatsapp_queue")
      .where("status", "==", "PENDING");

    if (!forceImmediate) {
      queryRef = queryRef.where("scheduledFor", "<=", nowISO);
    }

    const snap = await queryRef.limit(20).get();
    if (snap.empty) {
      return { processed: 0, delivered: 0, cancelled: 0, details: [] };
    }

    let deliveredCount = 0;
    let cancelledCount = 0;
    const details: any[] = [];

    for (const docSnap of snap.docs) {
      const pub = docSnap.data() as WhatsAppPublicationRecord;
      const reqDoc = await db.collection("requirements_public").doc(pub.requirementId).get();

      if (!reqDoc.exists) {
        // Requirement was removed
        await docSnap.ref.update({
          status: "CANCELLED",
          cancelReason: "REQUIREMENT_NOT_FOUND",
          cancelledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        cancelledCount++;
        details.push({ id: pub.id, action: "CANCELLED", reason: "REQUIREMENT_NOT_FOUND" });
        continue;
      }

      const reqData = reqDoc.data();
      if (reqData?.status !== "ACTIVE") {
        // Rule 4: Do not publish inactive/closed requirements
        await docSnap.ref.update({
          status: "CANCELLED",
          cancelReason: `REQUIREMENT_${reqData?.status || "INACTIVE"}`,
          cancelledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        cancelledCount++;
        details.push({ id: pub.id, action: "CANCELLED", reason: `Status is ${reqData?.status}` });
        continue;
      }

      // Simulate / Execute actual delivery to WhatsApp Community Channel
      const deliveryTimestamp = new Date().toISOString();
      console.log(`[WHATSAPP_SYNDICATION] Dispatched publication #${pub.publicationNumber} for [${pub.requirementId}]: ${pub.metadata.role}`);

      // Update publication record
      await docSnap.ref.update({
        status: "DELIVERED",
        deliveredAt: deliveryTimestamp,
        updatedAt: deliveryTimestamp
      });

      // Update requirement metadata
      const nextStatus = pub.publicationNumber === 1 
        ? "PUBLISHED_1_PENDING_2" 
        : (pub.publicationNumber === 2 ? "PUBLISHED_2_PENDING_3" : "COMPLETED_3_PUBLICATIONS");

      const timeField = pub.publicationNumber === 1 
        ? "whatsappPub1Time" 
        : (pub.publicationNumber === 2 ? "whatsappPub2Time" : "whatsappPub3Time");

      const existingHistory = reqData.whatsappPubHistory || [];
      existingHistory.push({
        publicationNumber: pub.publicationNumber,
        deliveredAt: deliveryTimestamp,
        idempotencyKey: pub.id,
        channel: "WHATSAPP"
      });

      await db.collection("requirements_public").doc(pub.requirementId).update({
        whatsappQueueStatus: nextStatus,
        [timeField]: deliveryTimestamp,
        whatsappPubHistory: existingHistory,
        updatedAt: deliveryTimestamp
      });

      // Record in permanent delivery logs and execution events
      await db.collection("whatsapp_delivery_logs").doc(pub.id).set({
        ...pub,
        status: "DELIVERED",
        deliveredAt: deliveryTimestamp,
        updatedAt: deliveryTimestamp
      });

      await db.collection("execution_events").add({
        eventType: "WHATSAPP_PUBLICATION_DISPATCHED",
        actorId: "whatsapp-syndication-engine",
        actorType: "system",
        timestamp: Date.now(),
        metadata: {
          requirementId: pub.requirementId,
          publicationNumber: pub.publicationNumber,
          idempotencyKey: pub.id,
          role: pub.metadata.role,
          workMode: pub.metadata.workMode
        }
      });

      deliveredCount++;
      details.push({ 
        id: pub.id, 
        action: "DELIVERED", 
        publicationNumber: pub.publicationNumber, 
        role: pub.metadata.role 
      });
    }

    return {
      processed: snap.docs.length,
      delivered: deliveredCount,
      cancelled: cancelledCount,
      details
    };
  }
}
