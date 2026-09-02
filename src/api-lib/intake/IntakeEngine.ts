import { IntakeEnvelope } from "./IntakeEnvelope.js";
import { SourceNormalizer } from "./SourceNormalizer.js";
import { EntityClassifier } from "./EntityClassifier.js";
import { IntakeValidator } from "./IntakeValidator.js";
import { DuplicateResolver } from "./DuplicateResolver.js";
import { OrganizationResolver } from "./OrganizationResolver.js";
import { IntakeEventType } from "./IntakeEvents.js";
import { adminDb } from "../../lib/firebase-admin.js";
import { IntakeMetrics } from "./IntakeMetrics.js";
import { IntakeAudit } from "./IntakeAudit.js";
import { ManualReviewQueue } from "./ManualReviewQueue.js";
import { RelationshipBuilder } from "./RelationshipBuilder.js";
import { GraphRepository } from "../services/GraphRepository.js";

export class IntakeEngine {
  static async process(rawPayload: any, source: string): Promise<any> {
    const startTime = Date.now();
    console.log(`[IntakeEngine] Processing intake from ${source}`);

    // 1. Normalize
    const envelope = SourceNormalizer.normalize(rawPayload, source);
    await this.logEvent(envelope, IntakeEventType.INTAKE_RECEIVED, {
      source: envelope.source,
    });
    await IntakeMetrics.increment(envelope.tenantId, `source_${envelope.source}`);

    // 2. Classify
    const classification = await EntityClassifier.classify(envelope);
    await this.logEvent(
      envelope,
      IntakeEventType.ENTITY_CLASSIFIED,
      classification,
    );

    // 3. Resolve Organization
    const orgContext = await OrganizationResolver.resolve(
      envelope.sender,
      envelope.tenantId,
    );

    // 4. Validate
    const isValid = IntakeValidator.validate(envelope, classification);
    if (!isValid) {
      await this.logEvent(envelope, IntakeEventType.INTAKE_FAILED, {
        reason: "Validation Failed or Low Confidence",
        classification,
      });
      await ManualReviewQueue.enqueue(envelope, classification, "Validation Failed or Low Confidence");
      await IntakeMetrics.increment(envelope.tenantId, `status_manual_review`);
      
      await IntakeAudit.log(envelope, {
          correlationId: envelope.correlationId,
          source: envelope.source,
          confidence: classification.confidence,
          rulesUsed: classification.evidence,
          executionTimeMs: Date.now() - startTime,
          status: "MANUAL_REVIEW",
          createdEntities: [],
          relationships: []
      });
      
      return { status: "manual_review_required", envelope, classification };
    }

    // 5. Deduplicate
    const dupResult = await DuplicateResolver.isDuplicate(
      envelope.body,
      classification.type,
      envelope.tenantId,
    );
    if (dupResult.isDuplicate) {
      await this.logEvent(envelope, IntakeEventType.INTAKE_FAILED, {
        reason: "Duplicate Detected",
        mergeCandidate: dupResult.matchedEntityId,
        confidence: dupResult.confidence
      });
      await IntakeMetrics.increment(envelope.tenantId, `status_duplicate`);
      
      await IntakeAudit.log(envelope, {
          correlationId: envelope.correlationId,
          source: envelope.source,
          confidence: classification.confidence,
          rulesUsed: classification.evidence,
          executionTimeMs: Date.now() - startTime,
          status: "DUPLICATE",
          createdEntities: [],
          relationships: []
      });
      
      // Save merge preview for UI
      if (adminDb) {
        await adminDb.collection("merge_previews").add({
            tenantId: envelope.tenantId,
            type: classification.type,
            status: 'PENDING_REVIEW',
            incoming: { envelope, classification },
            existing: { id: dupResult.matchedEntityId, data: dupResult.matchedEntity },
            confidence: dupResult.confidence,
            createdAt: new Date().toISOString()
        });
      }
      
      return { status: "duplicate", envelope, mergePreviewId: dupResult.matchedEntityId };
    }

    // 6. Create Entities
    // This used to be a hardcoded `[{ id: "mock-id-1", type: classification.type }]`
    // placeholder — every intake that made it this far (e.g. every inbound
    // WhatsApp message once that channel is wired up) was silently discarded:
    // classified and audited, but never actually turned into a record.
    // Requirement/Resume/Vendor/Partnership get a real (if minimal) record
    // here via GraphRepository, the same repository the Gmail path uses.
    // Everything else (Invoice, Offer, Interview, Contract, Joining, Client,
    // Unknown) has no entity-creation logic defined anywhere in this system
    // yet, so — rather than fabricate a record type nothing else understands —
    // it's routed to manual review, same as a low-confidence classification.
    const channelLabel = envelope.source.toUpperCase();
    const sourceEmail = envelope.channel?.includes("@") ? envelope.sender : undefined;
    let createdEntities: { id: string; type: string }[] = [];

    try {
      if (classification.type === "Requirement") {
        const node = await GraphRepository.createRequirement(
          envelope.tenantId,
          {
            title: envelope.subject || `Untitled Requirement (auto-captured via ${channelLabel})`,
            description: envelope.body?.slice(0, 3000) || "",
            skills: [],
            location: "Unknown",
            workModel: "remote",
            source: `${channelLabel}_AUTO_INTAKE`,
            sourceEmail,
            sourceChannel: envelope.channel,
          },
          "system-intake-engine",
        );
        createdEntities = [{ id: node.id, type: classification.type }];
      } else if (classification.type === "Resume") {
        const node = await GraphRepository.createCandidate(
          envelope.tenantId,
          {
            firstName: "Unknown",
            lastName: "Candidate",
            email: sourceEmail || "",
            phone: sourceEmail ? "" : envelope.sender,
            summary: envelope.body?.slice(0, 3000) || "",
            skills: [],
            source: `${channelLabel}_AUTO_INTAKE`,
            sourceEmail,
            sourceChannel: envelope.channel,
          },
          "system-intake-engine",
        );
        createdEntities = [{ id: node.id, type: classification.type }];
      } else if (classification.type === "Vendor" || classification.type === "Partnership") {
        const node = await GraphRepository.createVendor(
          envelope.tenantId,
          {
            companyName: envelope.sender,
            contactEmail: sourceEmail || "",
            location: "Unknown",
            status: "PENDING_REVIEW",
            notes: envelope.body?.slice(0, 3000) || "",
            source: `${channelLabel}_AUTO_INTAKE`,
            sourceChannel: envelope.channel,
          },
          "system-intake-engine",
        );
        createdEntities = [{ id: node.id, type: classification.type }];
      } else {
        await ManualReviewQueue.enqueue(
          envelope,
          classification,
          `No entity-creation logic exists for classification type "${classification.type}" yet — routed for manual handling instead of being silently dropped.`,
        );
      }
    } catch (createErr: any) {
      console.error("[IntakeEngine] Entity creation failed:", createErr?.message || createErr);
      await ManualReviewQueue.enqueue(envelope, classification, `Entity creation failed: ${createErr?.message || createErr}`);
    }

    await IntakeMetrics.increment(envelope.tenantId, `type_${classification.type.toLowerCase()}`);

    if (createdEntities.length === 0) {
      // Either this classification type has no creation logic yet, or
      // creation threw — either way nothing was actually created, so this
      // must not be reported as a success (the caller, IntakeOffice, uses
      // status === "success" to decide whether to publish a
      // REQUIREMENT_CREATED/CANDIDATE_CREATED event downstream).
      await IntakeMetrics.increment(envelope.tenantId, `status_manual_review`);
      await IntakeAudit.log(envelope, {
        correlationId: envelope.correlationId,
        source: envelope.source,
        confidence: classification.confidence,
        rulesUsed: classification.evidence,
        executionTimeMs: Date.now() - startTime,
        status: "MANUAL_REVIEW",
        createdEntities: [],
        relationships: [],
      });
      return { status: "manual_review_required", envelope, classification };
    }

    await this.logEvent(envelope, IntakeEventType.ENTITY_CREATED, {
      type: classification.type,
      orgContext,
      createdEntities,
    });

    // 7. Business Graph & Match
    await RelationshipBuilder.build(envelope, classification, createdEntities, orgContext);
    await this.logEvent(envelope, IntakeEventType.BUSINESS_GRAPH_UPDATED, {});

    if (
      classification.type === "Requirement" ||
      classification.type === "Resume"
    ) {
      await this.logEvent(envelope, IntakeEventType.MATCH_REQUESTED, {});
    }

    await IntakeMetrics.increment(envelope.tenantId, `status_success`);
    await IntakeAudit.log(envelope, {
          correlationId: envelope.correlationId,
          source: envelope.source,
          confidence: classification.confidence,
          rulesUsed: classification.evidence,
          executionTimeMs: Date.now() - startTime,
          status: "SUCCESS",
          createdEntities,
          relationships: [] // To be populated if needed
    });

    return { status: "success", envelope, classification, orgContext };
  }

  private static async logEvent(
    envelope: IntakeEnvelope,
    eventType: IntakeEventType,
    data: any,
  ) {
    if (!adminDb) return;
    try {
      await adminDb.collection("intake_events").add({
        intakeId: envelope.id,
        tenantId: envelope.tenantId,
        eventType,
        timestamp: new Date().toISOString(),
        data,
      });
      console.log(
        `[IntakeEngine] Event logged: ${eventType} for ${envelope.id}`,
      );
    } catch (e) {
      console.error("[IntakeEngine] Event log failed", e);
    }
  }
}
