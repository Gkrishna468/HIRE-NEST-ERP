import { db } from "../../../lib/firebase-admin.js";
import { OfficePolicy, BusinessEvent } from "./RuntimeTypes.js";

export class AIGovernance {
  /**
   * Checks if the office is allowed to execute based on its governance policy.
   */
  static async canExecute(
    officeName: string,
    policy: OfficePolicy,
    event: BusinessEvent,
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (!policy.governance) return { allowed: true };

    const { maxHourlyExecutions, businessHoursOnly } = policy.governance;

    // 1. Business Hours check
    if (businessHoursOnly) {
      const currentHour = new Date().getHours();
      const currentDay = new Date().getDay();
      // Assuming Mon-Fri 9-17
      if (
        currentDay === 0 ||
        currentDay === 6 ||
        currentHour < 9 ||
        currentHour >= 17
      ) {
        return { allowed: false, reason: "Outside business hours" };
      }
    }

    if (!db) return { allowed: true };

    // 2. Hourly Executions Limit
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    let count = 0;
    try {
      const telemetrySnap = await db
        .collection("office_telemetry")
        .where("office", "==", officeName)
        .where("executedAt", ">=", oneHourAgo)
        .count()
        .get();
      count = telemetrySnap.data().count;
    } catch (indexErr) {
      // Fallback to single-field filter if composite index is missing or building
      try {
        const snap = await db
          .collection("office_telemetry")
          .where("office", "==", officeName)
          .limit(200)
          .get();
        count = snap.docs.filter((d) => (d.data()?.executedAt || "") >= oneHourAgo).length;
      } catch (fallbackErr) {
        console.warn("[AIGovernance] Telemetry count check fallback failed:", fallbackErr);
      }
    }

    if (count >= maxHourlyExecutions) {
      return { allowed: false, reason: "Hourly execution limit exceeded" };
    }

    return { allowed: true };
  }

  /**
   * Office Sandboxing check (to be invoked at runtime if wrapping db calls, or just statically checked)
   * For now, this is a placeholder where a secured context could enforce these bounds.
   */
  static validateDataAccess(
    policy: OfficePolicy,
    collection: string,
    operation: "read" | "write",
  ): boolean {
    if (!policy.permissions) return true; // Default allow if unspecified (can lock down later)

    if (operation === "read") {
      return (
        policy.permissions.canRead.includes(collection) ||
        policy.permissions.canRead.includes("*")
      );
    } else {
      return (
        policy.permissions.canWrite.includes(collection) ||
        policy.permissions.canWrite.includes("*")
      );
    }
  }
}
