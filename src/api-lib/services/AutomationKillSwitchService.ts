import { adminDb } from "../../lib/firebase-admin.js";

export type KillSwitchScope = 'GLOBAL' | 'CHANNEL' | 'WORKFLOW' | 'TENANT' | 'AGENT';

export interface KillSwitchRecord {
  id: string;
  scope: KillSwitchScope;
  target: string; // e.g. 'ALL', 'EMAIL', 'CANDIDATE_MATCH', 'TENANT-HQ', 'recruiter_agent'
  status: 'ACTIVE' | 'INACTIVE';
  reason: string;
  activatedBy: string;
  activatedAt: string;
  deactivatedBy?: string;
  deactivatedAt?: string;
  updatedAt: string;
}

export interface KillSwitchCheckRequest {
  channel?: string;     // e.g. 'EMAIL', 'WHATSAPP', 'SMS'
  workflowId?: string;  // e.g. 'CANDIDATE_MATCH', 'RECOVERY_COACHING'
  tenantId?: string;    // e.g. 'TENANT-HQ'
  agentId?: string;     // e.g. 'recruiter_agent', 'matching_agent'
  actorId?: string;     // e.g. 'ADMIN'
  eventId?: string;
}

export interface KillSwitchEvaluationResult {
  blocked: boolean;
  reason: string;
  matchedSwitch?: {
    id: string;
    scope: KillSwitchScope;
    target: string;
    reason: string;
  };
  evaluatedAt: string;
}

export class AutomationKillSwitchService {
  private static COLLECTION_SWITCHES = "automation_kill_switches";
  private static COLLECTION_AUDIT = "automation_kill_switch_audit";

  // In-memory cache for high throughput and zero-latency checks
  private static memoryActiveSwitches = new Map<string, KillSwitchRecord>();
  private static lastCacheFetchMs = 0;
  private static CACHE_TTL_MS = 5000; // 5 seconds cache refresh

  /**
   * Sync active kill switches from Firestore into memory cache
   */
  private static async syncCache(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCacheFetchMs < this.CACHE_TTL_MS) {
      return;
    }

    if (!adminDb) return;

    try {
      const snap = await adminDb
        .collection(this.COLLECTION_SWITCHES)
        .where("status", "==", "ACTIVE")
        .get();

      this.memoryActiveSwitches.clear();
      snap.docs.forEach((doc: any) => {
        const data = doc.data() as KillSwitchRecord;
        this.memoryActiveSwitches.set(doc.id, data);
      });
      this.lastCacheFetchMs = now;
    } catch (err: any) {
      console.warn("[AutomationKillSwitchService] Sync cache warning:", err.message);
    }
  }

  /**
   * Force manual cache invalidation / refresh
   */
  public static invalidateCache(): void {
    this.lastCacheFetchMs = 0;
    this.memoryActiveSwitches.clear();
  }

  /**
   * Activate a Kill Switch for a specific scope and target
   */
  public static async activateKillSwitch(params: {
    scope: KillSwitchScope;
    target: string;
    reason: string;
    activatedBy?: string;
  }): Promise<KillSwitchRecord> {
    const scope = params.scope;
    const target = (params.target || "ALL").trim();
    const cleanTarget = scope === 'GLOBAL' ? 'ALL' : target;
    const switchId = `ks_${scope.toLowerCase()}_${cleanTarget.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;
    const nowStr = new Date().toISOString();
    const activatedBy = params.activatedBy || "SYSTEM_ADMIN";

    const record: KillSwitchRecord = {
      id: switchId,
      scope,
      target: cleanTarget,
      status: "ACTIVE",
      reason: params.reason || "Manual kill switch activation",
      activatedBy,
      activatedAt: nowStr,
      updatedAt: nowStr
    };

    // Update Memory
    this.memoryActiveSwitches.set(switchId, record);
    this.lastCacheFetchMs = Date.now();

    // Persist in Firestore
    if (adminDb) {
      await adminDb.collection(this.COLLECTION_SWITCHES).doc(switchId).set(record, { merge: true });

      // Audit Log
      const auditId = `audit_ks_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await adminDb.collection(this.COLLECTION_AUDIT).doc(auditId).set({
        auditId,
        action: "ACTIVATED",
        switchId,
        scope,
        target: cleanTarget,
        reason: record.reason,
        actorId: activatedBy,
        timestamp: nowStr
      });
    }

    console.log(`[AutomationKillSwitch] 🛑 KILL SWITCH ACTIVATED: Scope=${scope}, Target=${cleanTarget}, Reason=${record.reason}`);
    return record;
  }

  /**
   * Deactivate a Kill Switch (Emergency Recovery)
   */
  public static async deactivateKillSwitch(
    switchId: string,
    deactivatedBy: string = "SYSTEM_ADMIN",
    reason: string = "Manual emergency recovery"
  ): Promise<boolean> {
    const nowStr = new Date().toISOString();

    // Remove from Memory
    this.memoryActiveSwitches.delete(switchId);
    this.lastCacheFetchMs = Date.now();

    if (adminDb) {
      const docRef = adminDb.collection(this.COLLECTION_SWITCHES).doc(switchId);
      const snap = await docRef.get();
      if (!snap.exists) return false;

      const data = snap.data() as KillSwitchRecord;
      await docRef.update({
        status: "INACTIVE",
        deactivatedBy,
        deactivatedAt: nowStr,
        updatedAt: nowStr
      });

      // Audit Log
      const auditId = `audit_ks_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await adminDb.collection(this.COLLECTION_AUDIT).doc(auditId).set({
        auditId,
        action: "DEACTIVATED",
        switchId,
        scope: data.scope,
        target: data.target,
        reason,
        actorId: deactivatedBy,
        timestamp: nowStr
      });
    }

    console.log(`[AutomationKillSwitch] ✅ KILL SWITCH DEACTIVATED: ID=${switchId}, By=${deactivatedBy}`);
    return true;
  }

  /**
   * Clear all active kill switches (Reset to operational state)
   */
  public static async clearAllKillSwitches(actorId: string = "SYSTEM_ADMIN"): Promise<void> {
    this.memoryActiveSwitches.clear();
    this.lastCacheFetchMs = Date.now();

    if (adminDb) {
      const snap = await adminDb
        .collection(this.COLLECTION_SWITCHES)
        .where("status", "==", "ACTIVE")
        .get();

      const batch = adminDb.batch();
      const nowStr = new Date().toISOString();

      snap.docs.forEach((doc: any) => {
        batch.update(doc.ref, {
          status: "INACTIVE",
          deactivatedBy: actorId,
          deactivatedAt: nowStr,
          updatedAt: nowStr
        });
      });

      await batch.commit();

      const auditId = `audit_ks_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await adminDb.collection(this.COLLECTION_AUDIT).doc(auditId).set({
        auditId,
        action: "CLEAR_ALL",
        scope: "ALL",
        target: "ALL",
        reason: "Reset all kill switches",
        actorId,
        timestamp: nowStr
      });
    }
  }

  /**
   * Primary Evaluation Logic - Evaluates if action is blocked by ANY active Kill Switch.
   * STRICT FAIL-CLOSED GUARANTEE: If any DB error or unknown exception occurs, DEFAULTS TO BLOCKED.
   */
  public static async evaluateKillSwitch(
    req: KillSwitchCheckRequest
  ): Promise<KillSwitchEvaluationResult> {
    const evaluatedAt = new Date().toISOString();

    try {
      // Step 1: Sync cache with Firestore
      await this.syncCache();

      // Step 2: Retrieve list of active switches from Memory / Cache
      const activeSwitches = Array.from(this.memoryActiveSwitches.values());

      // If memory cache is empty, double check DB directly for maximum accuracy
      let dbSwitches: KillSwitchRecord[] = activeSwitches;
      if (adminDb) {
        try {
          const snap = await adminDb
            .collection(this.COLLECTION_SWITCHES)
            .where("status", "==", "ACTIVE")
            .get();

          dbSwitches = snap.docs.map((d: any) => d.data() as KillSwitchRecord);
        } catch (dbErr: any) {
          console.warn("[AutomationKillSwitchService] DB query warning during evaluation:", dbErr.message);
          // If memory has switches, use memory; if DB fails and memory is empty, Fail-Closed if request looks risky
        }
      }

      // Step 3: Match against active kill switches
      let matchedSwitch: KillSwitchRecord | undefined;

      for (const sw of dbSwitches) {
        if (sw.status !== 'ACTIVE') continue;

        // 3a. GLOBAL
        if (sw.scope === 'GLOBAL' || sw.target?.toUpperCase() === 'ALL') {
          matchedSwitch = sw;
          break;
        }

        // 3b. CHANNEL
        if (
          sw.scope === 'CHANNEL' &&
          req.channel &&
          sw.target?.toUpperCase() === req.channel.toUpperCase()
        ) {
          matchedSwitch = sw;
          break;
        }

        // 3c. WORKFLOW
        if (
          sw.scope === 'WORKFLOW' &&
          req.workflowId &&
          sw.target?.toUpperCase() === req.workflowId.toUpperCase()
        ) {
          matchedSwitch = sw;
          break;
        }

        // 3d. TENANT
        if (
          sw.scope === 'TENANT' &&
          req.tenantId &&
          sw.target?.toUpperCase() === req.tenantId.toUpperCase()
        ) {
          matchedSwitch = sw;
          break;
        }

        // 3e. AGENT
        if (
          sw.scope === 'AGENT' &&
          req.agentId &&
          sw.target?.toLowerCase() === req.agentId.toLowerCase()
        ) {
          matchedSwitch = sw;
          break;
        }
      }

      if (matchedSwitch) {
        // Record Audit block
        if (adminDb) {
          const auditId = `audit_ks_blk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await adminDb.collection(this.COLLECTION_AUDIT).doc(auditId).set({
            auditId,
            action: "BLOCKED",
            switchId: matchedSwitch.id,
            scope: matchedSwitch.scope,
            target: matchedSwitch.target,
            triggerReason: matchedSwitch.reason,
            request: {
              channel: req.channel || null,
              workflowId: req.workflowId || null,
              tenantId: req.tenantId || null,
              agentId: req.agentId || null,
              actorId: req.actorId || null,
              eventId: req.eventId || null
            },
            timestamp: evaluatedAt
          }).catch(() => {});
        }

        return {
          blocked: true,
          reason: `Action blocked by ${matchedSwitch.scope} Kill Switch (${matchedSwitch.target}): ${matchedSwitch.reason}`,
          matchedSwitch: {
            id: matchedSwitch.id,
            scope: matchedSwitch.scope,
            target: matchedSwitch.target,
            reason: matchedSwitch.reason
          },
          evaluatedAt
        };
      }

      // No active switch matched -> ALLOWED
      return {
        blocked: false,
        reason: "No active kill switch matched.",
        evaluatedAt
      };
    } catch (err: any) {
      // 🚨 FAIL-CLOSED REQUIREMENT: If error occurs during check, block execution safely!
      console.error("[AutomationKillSwitchService] Critical error during kill switch evaluation (FAIL-CLOSED):", err);
      return {
        blocked: true,
        reason: `FAIL-CLOSED: Kill switch evaluation error (${err.message || 'Unknown error'}). Outbound automation blocked for safety.`,
        evaluatedAt
      };
    }
  }

  /**
   * Get all currently active or past kill switches
   */
  public static async getKillSwitches(): Promise<KillSwitchRecord[]> {
    if (!adminDb) return Array.from(this.memoryActiveSwitches.values());
    try {
      const snap = await adminDb.collection(this.COLLECTION_SWITCHES).get();
      return snap.docs.map((d: any) => d.data() as KillSwitchRecord);
    } catch (e) {
      return Array.from(this.memoryActiveSwitches.values());
    }
  }

  /**
   * Get audit log entries
   */
  public static async getAuditLogs(limit: number = 50): Promise<any[]> {
    if (!adminDb) return [];
    try {
      const snap = await adminDb.collection(this.COLLECTION_AUDIT).limit(limit).get();
      const logs = snap.docs.map((d: any) => d.data());
      logs.sort((a: any, b: any) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      return logs;
    } catch (e) {
      return [];
    }
  }
}
