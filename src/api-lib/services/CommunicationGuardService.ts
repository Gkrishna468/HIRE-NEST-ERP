import crypto from "crypto";
import { adminDb } from "../../lib/firebase-admin.js";
import { AutomationKillSwitchService } from "./AutomationKillSwitchService.js";

export interface CommunicationRequest {
  eventId?: string;
  traceId?: string;
  idempotencyKey?: string;
  recipient: string; // email address or phone number
  recipientId?: string; // candidateId, vendorId, clientId, etc.
  recipientType?: 'CANDIDATE' | 'VENDOR' | 'CLIENT' | 'RECRUITER' | 'SYSTEM' | 'UNKNOWN';
  channel: 'EMAIL' | 'WHATSAPP' | 'SMS';
  templateId: string;
  content?: string;
  tenantId?: string;
  actorId?: string;
  metadata?: Record<string, any>;
}

export type DecisionReasonCode = 
  | 'ALLOWED'
  | 'INVALID_RECIPIENT_FORMAT'
  | 'INVALID_RECIPIENT_ENTITY'
  | 'CONSENT_OPTED_OUT'
  | 'UNSUPPORTED_CHANNEL'
  | 'UNAPPROVED_TEMPLATE'
  | 'RECIPIENT_RATE_LIMIT_EXCEEDED'
  | 'ORG_RATE_LIMIT_EXCEEDED'
  | 'DUPLICATE_SEND_PREVENTED'
  | 'KILL_SWITCH_ACTIVE';

export interface CommunicationGuardDecision {
  allowed: boolean;
  reasonCode: DecisionReasonCode;
  reason: string;
  idempotencyKey: string;
  auditId: string;
  evaluatedAt: string;
}

export interface CommunicationGuardResult {
  success: boolean;
  decision: CommunicationGuardDecision;
  dispatched: boolean;
  auditId: string;
  error?: string;
  dispatchResponse?: any;
}

export class CommunicationGuardService {
  private static COLLECTION_AUDIT = "communication_guard_audit";
  private static COLLECTION_CONSENTS = "communication_consents";
  private static COLLECTION_TEMPLATES = "communication_templates";
  private static COLLECTION_IDEMPOTENCY = "communication_idempotency";
  private static COLLECTION_RATE_LIMITS = "communication_rate_limits";

  private static APPROVED_TEMPLATES = new Set<string>([
    "MATCH_NOTIFICATION",
    "INTERVIEW_INVITE",
    "CANDIDATE_SUBMITTED",
    "RECOVERY_COACHING",
    "STATUS_UPDATE",
    "JOB_ALERT",
    "INTERVIEW_SCHEDULED",
    "SYSTEM_ALERT",
    "WELCOME_NOTIFICATION",
    "CANDIDATE_MATCH",
    "REQUIREMENT_CREATED"
  ]);

  private static RECIPIENT_RATE_LIMIT_PER_HOUR = 5;
  private static ORG_RATE_LIMIT_PER_HOUR = 100;

  // In-memory rate limit store as fast secondary fallback/cache
  private static memoryRateLimits = new Map<string, number[]>();

  /**
   * Set or update consent status for a recipient email or phone
   */
  public static async setConsent(
    recipient: string,
    status: 'OPTED_IN' | 'OPTED_OUT',
    actorId: string = 'SYSTEM'
  ): Promise<void> {
    const cleanRecipient = recipient.trim().toLowerCase();
    const docRef = adminDb.collection(this.COLLECTION_CONSENTS).doc(cleanRecipient);
    await docRef.set({
      recipient: cleanRecipient,
      status,
      updatedAt: new Date().toISOString(),
      actorId
    }, { merge: true });
  }

  /**
   * Register a new approved template dynamically
   */
  public static async registerApprovedTemplate(
    templateId: string,
    channel: string = 'ALL',
    description: string = 'Dynamic template'
  ): Promise<void> {
    this.APPROVED_TEMPLATES.add(templateId);
    if (adminDb) {
      await adminDb.collection(this.COLLECTION_TEMPLATES).doc(templateId).set({
        templateId,
        channel,
        description,
        registeredAt: new Date().toISOString(),
        approved: true
      }, { merge: true });
    }
  }

  /**
   * Reset rate limit counters (useful for unit tests or admin overrides)
   */
  public static async resetRateLimits(targetKey?: string): Promise<void> {
    if (targetKey) {
      this.memoryRateLimits.delete(targetKey.toLowerCase());
    } else {
      this.memoryRateLimits.clear();
    }
  }

  /**
   * Validate recipient string format (Email or Phone)
   */
  private static validateRecipientFormat(recipient: string, channel: string): boolean {
    if (!recipient || typeof recipient !== 'string') return false;
    const clean = recipient.trim();

    if (channel === 'EMAIL') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(clean);
    }

    if (channel === 'WHATSAPP' || channel === 'SMS') {
      // Must contain 7 to 15 digits (E.164 phone format or clean digits)
      const phoneDigits = clean.replace(/\D/g, '');
      return phoneDigits.length >= 7 && phoneDigits.length <= 15;
    }

    return false;
  }

  /**
   * Primary Evaluation Function: Checks Policy Guard controls
   */
  public static async evaluateCommunication(
    request: CommunicationRequest
  ): Promise<CommunicationGuardDecision> {
    const evaluatedAt = new Date().toISOString();
    const auditId = `audit_cg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const tenantId = request.tenantId || 'TENANT-HQ';
    const actorId = request.actorId || 'SYSTEM_AUTOMATION';
    const channel = request.channel?.toUpperCase() as 'EMAIL' | 'WHATSAPP' | 'SMS';
    const cleanRecipient = request.recipient ? request.recipient.trim().toLowerCase() : '';

    // Generate deterministic idempotency key if not provided
    const idempotencyKey = request.idempotencyKey || request.eventId || crypto
      .createHash('sha256')
      .update(`${cleanRecipient}_${channel}_${request.templateId}_${request.content || ''}`)
      .digest('hex');

    // Helper to log decision to Firestore and return decision
    const finalizeDecision = async (
      allowed: boolean,
      reasonCode: DecisionReasonCode,
      reason: string
    ): Promise<CommunicationGuardDecision> => {
      const decision: CommunicationGuardDecision = {
        allowed,
        reasonCode,
        reason,
        idempotencyKey,
        auditId,
        evaluatedAt
      };

      try {
        if (adminDb) {
          await adminDb.collection(this.COLLECTION_AUDIT).doc(auditId).set({
            auditId,
            eventId: request.eventId || null,
            traceId: request.traceId || request.eventId || null,
            idempotencyKey,
            recipient: cleanRecipient,
            recipientId: request.recipientId || null,
            recipientType: request.recipientType || 'UNKNOWN',
            channel,
            templateId: request.templateId,
            status: allowed ? 'ALLOWED' : 'BLOCKED',
            reasonCode,
            reason,
            tenantId,
            actorId,
            evaluatedAt
          });
        }
      } catch (err: any) {
        console.warn("[CommunicationGuardService] Audit log write warning:", err.message);
      }

      return decision;
    };

    // 0. Automation Kill Switch Evaluation (Strict Enforcement)
    const killSwitchRes = await AutomationKillSwitchService.evaluateKillSwitch({
      channel,
      workflowId: request.templateId,
      tenantId,
      agentId: request.actorId,
      eventId: request.eventId
    });

    if (killSwitchRes.blocked) {
      return await finalizeDecision(
        false,
        'KILL_SWITCH_ACTIVE',
        killSwitchRes.reason
      );
    }

    // 1. Channel Validation
    if (!['EMAIL', 'WHATSAPP', 'SMS'].includes(channel)) {
      return await finalizeDecision(false, 'UNSUPPORTED_CHANNEL', `Channel '${request.channel}' is not supported by Communication Guard.`);
    }

    // 2. Recipient Format Check
    if (!this.validateRecipientFormat(cleanRecipient, channel)) {
      return await finalizeDecision(
        false,
        'INVALID_RECIPIENT_FORMAT',
        `Recipient '${request.recipient}' is not a valid format for channel ${channel}.`
      );
    }

    // 3. Recipient Entity Existence Check (if recipientId provided)
    if (request.recipientId && adminDb) {
      try {
        const collectionsToCheck = ['candidatePool', 'organizations', 'users', 'clients'];
        let entityFound = false;
        for (const col of collectionsToCheck) {
          const docSnap = await adminDb.collection(col).doc(request.recipientId).get();
          if (docSnap.exists) {
            entityFound = true;
            break;
          }
        }
        if (!entityFound) {
          return await finalizeDecision(
            false,
            'INVALID_RECIPIENT_ENTITY',
            `Recipient entity ID '${request.recipientId}' does not exist in system.`
          );
        }
      } catch (err: any) {
        console.warn("[CommunicationGuardService] Entity verification check error:", err.message);
      }
    }

    // 4. Consent / Opt-Out Check
    if (adminDb) {
      try {
        const consentSnap = await adminDb.collection(this.COLLECTION_CONSENTS).doc(cleanRecipient).get();
        if (consentSnap.exists) {
          const consentData = consentSnap.data();
          if (consentData?.status === 'OPTED_OUT' || consentData?.status === 'UNSUBSCRIBED') {
            return await finalizeDecision(
              false,
              'CONSENT_OPTED_OUT',
              `Recipient '${cleanRecipient}' has explicitly opted out or unsubscribed from ${channel} communications.`
            );
          }
        }

        // Check candidate/organization doc directly if recipientId provided
        if (request.recipientId) {
          const candSnap = await adminDb.collection('candidatePool').doc(request.recipientId).get();
          if (candSnap.exists) {
            const candData = candSnap.data();
            if (candData?.optOut === true || candData?.consent === 'OPTED_OUT') {
              return await finalizeDecision(
                false,
                'CONSENT_OPTED_OUT',
                `Candidate entity '${request.recipientId}' has optOut set to true.`
              );
            }
          }
        }
      } catch (err: any) {
        console.warn("[CommunicationGuardService] Consent check error:", err.message);
      }
    }

    // 5. Approved Template Check
    const templateIdUpper = (request.templateId || '').trim();
    if (!this.APPROVED_TEMPLATES.has(templateIdUpper)) {
      // Check dynamic templates in DB
      let isApprovedInDb = false;
      if (adminDb) {
        try {
          const tmplSnap = await adminDb.collection(this.COLLECTION_TEMPLATES).doc(templateIdUpper).get();
          if (tmplSnap.exists && tmplSnap.data()?.approved === true) {
            isApprovedInDb = true;
          }
        } catch (e) {
          // ignore
        }
      }

      if (!isApprovedInDb) {
        return await finalizeDecision(
          false,
          'UNAPPROVED_TEMPLATE',
          `Template '${request.templateId}' is unapproved or free-form automated messaging is blocked.`
        );
      }
    }

    // 6. Duplicate / Idempotency Check
    if (adminDb) {
      try {
        const idempotencyDoc = await adminDb.collection(this.COLLECTION_IDEMPOTENCY).doc(idempotencyKey).get();
        if (idempotencyDoc.exists) {
          return await finalizeDecision(
            false,
            'DUPLICATE_SEND_PREVENTED',
            `Duplicate communication prevented for idempotency key '${idempotencyKey}'.`
          );
        }
      } catch (err: any) {
        console.warn("[CommunicationGuardService] Idempotency check error:", err.message);
      }
    }

    // 7. Rate Limiting Check
    const nowMs = Date.now();
    const oneHourAgoMs = nowMs - 60 * 60 * 1000;

    // Recipient Rate Limit Check
    const recipientKey = `recip_${cleanRecipient}`;
    const recipTimestamps = (this.memoryRateLimits.get(recipientKey) || []).filter(t => t > oneHourAgoMs);
    if (recipTimestamps.length >= this.RECIPIENT_RATE_LIMIT_PER_HOUR) {
      return await finalizeDecision(
        false,
        'RECIPIENT_RATE_LIMIT_EXCEEDED',
        `Recipient '${cleanRecipient}' exceeded rate limit of ${this.RECIPIENT_RATE_LIMIT_PER_HOUR} messages per hour.`
      );
    }

    // Org Rate Limit Check
    const orgKey = `org_${tenantId}`;
    const orgTimestamps = (this.memoryRateLimits.get(orgKey) || []).filter(t => t > oneHourAgoMs);
    if (orgTimestamps.length >= this.ORG_RATE_LIMIT_PER_HOUR) {
      return await finalizeDecision(
        false,
        'ORG_RATE_LIMIT_EXCEEDED',
        `Tenant '${tenantId}' exceeded rate limit of ${this.ORG_RATE_LIMIT_PER_HOUR} messages per hour.`
      );
    }

    // All Policy Checks Passed!
    return await finalizeDecision(
      true,
      'ALLOWED',
      'All policy checks passed: Recipient valid, consent verified, approved template, rate limits respected.'
    );
  }

  /**
   * Primary Dispatch Function: Evaluates policy, records idempotency/rate limits, and dispatches message safely.
   */
  public static async sendCommunication(
    request: CommunicationRequest
  ): Promise<CommunicationGuardResult> {
    // Step 1: Policy Guard Evaluation
    const decision = await this.evaluateCommunication(request);

    if (!decision.allowed) {
      return {
        success: false,
        decision,
        dispatched: false,
        auditId: decision.auditId,
        error: decision.reason
      };
    }

    // Step 2: Record Rate Limit & Idempotency
    const nowMs = Date.now();
    const cleanRecipient = request.recipient.trim().toLowerCase();
    const tenantId = request.tenantId || 'TENANT-HQ';

    // Update memory rate limit stores
    const recipKey = `recip_${cleanRecipient}`;
    const recipTimes = this.memoryRateLimits.get(recipKey) || [];
    recipTimes.push(nowMs);
    this.memoryRateLimits.set(recipKey, recipTimes);

    const orgKey = `org_${tenantId}`;
    const orgTimes = this.memoryRateLimits.get(orgKey) || [];
    orgTimes.push(nowMs);
    this.memoryRateLimits.set(orgKey, orgTimes);

    // Save idempotency key in Firestore
    if (adminDb) {
      try {
        await adminDb.collection(this.COLLECTION_IDEMPOTENCY).doc(decision.idempotencyKey).set({
          idempotencyKey: decision.idempotencyKey,
          auditId: decision.auditId,
          recipient: cleanRecipient,
          channel: request.channel,
          templateId: request.templateId,
          sentAt: new Date().toISOString()
        });
      } catch (e: any) {
        console.warn("[CommunicationGuardService] Failed to set idempotency doc:", e.message);
      }
    }

    // Step 3: Dispatch to Provider with Failure Isolation
    try {
      let dispatchResponse: any = { status: 'DELIVERED', provider: `${request.channel}_GATEWAY` };

      // Simulated/Integrated Provider Call
      if (request.metadata?.simulatedProviderError) {
        throw new Error(request.metadata.simulatedProviderError);
      }

      // Update Audit log status to DISPATCHED
      if (adminDb) {
        await adminDb.collection(this.COLLECTION_AUDIT).doc(decision.auditId).set({
          status: 'DISPATCHED',
          dispatchedAt: new Date().toISOString(),
          dispatchResponse
        }, { merge: true });
      }

      return {
        success: true,
        decision,
        dispatched: true,
        auditId: decision.auditId,
        dispatchResponse
      };
    } catch (dispatchErr: any) {
      console.warn("[CommunicationGuardService] Provider dispatch failed (Isolated):", dispatchErr.message);

      // Record dispatch failure safely in audit ledger without crashing core business state
      if (adminDb) {
        try {
          await adminDb.collection(this.COLLECTION_AUDIT).doc(decision.auditId).set({
            status: 'DISPATCH_FAILED',
            dispatchError: dispatchErr.message,
            failedAt: new Date().toISOString()
          }, { merge: true });
        } catch (e) {
          // ignore
        }
      }

      return {
        success: false,
        decision,
        dispatched: false,
        auditId: decision.auditId,
        error: `Provider dispatch failed: ${dispatchErr.message}`
      };
    }
  }

  /**
   * Retrieve audit logs filtered by criteria
   */
  public static async getAuditLogs(filter?: {
    recipient?: string;
    tenantId?: string;
    status?: string;
    limit?: number;
  }): Promise<any[]> {
    if (!adminDb) return [];
    try {
      let query: any = adminDb.collection(this.COLLECTION_AUDIT);
      if (filter?.recipient) {
        query = query.where("recipient", "==", filter.recipient.trim().toLowerCase());
      }
      if (filter?.tenantId) {
        query = query.where("tenantId", "==", filter.tenantId);
      }
      if (filter?.status) {
        query = query.where("status", "==", filter.status);
      }
      const snap = await query.limit(filter?.limit || 100).get();
      const logs = snap.docs.map((d: any) => d.data());
      logs.sort((a: any, b: any) => (b.evaluatedAt || '').localeCompare(a.evaluatedAt || ''));
      return logs.slice(0, filter?.limit || 50);
    } catch (err: any) {
      console.warn("[CommunicationGuardService] Failed to query audit logs:", err.message);
      return [];
    }
  }
}
