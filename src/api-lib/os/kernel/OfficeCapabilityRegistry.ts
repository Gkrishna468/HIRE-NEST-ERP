import { db } from "../../../lib/firebase-admin.js";
import { OfficePolicy, OfficeCapability } from "./RuntimeTypes.js";

export class OfficeCapabilityRegistry {
  /**
   * Called by an office to register its capabilities.
   */
  static async registerOffice(name: string, policy: OfficePolicy) {
    if (!db) return;

    await db.collection("office_registry").doc(name).set(
      {
        name,
        policy,
        lastRegisteredAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }

  /**
   * Self-heals the office registry the same way EventBus.ensureDefaultSubscriptions()
   * self-heals event subscriptions. Previously, every office (IntakeOffice,
   * MatchingOffice, RecruitmentOffice, VendorOffice, SubmissionOffice,
   * ClientOffice, FounderOffice) only ever got into "office_registry" via a
   * one-off manual call to POST /api/ops?action=register_offices — which
   * itself was unreachable in production until the api/index.ts routing gap
   * was fixed. Without a registered office, getOfficesForEvent() always
   * returned an empty list, so AICOORuntime.processInbox() had nothing to
   * hand events to: no office (including IntakeOffice, which is what
   * actually creates records for inbound WhatsApp messages) ever ran.
   */
  private static registeredThisProcess = false;
  static async ensureDefaultOfficesRegistered(): Promise<void> {
    if (!db || this.registeredThisProcess) return;

    const snap = await db.collection("office_registry").limit(1).get();
    if (!snap.empty) {
      this.registeredThisProcess = true;
      return;
    }

    console.log("[OfficeCapabilityRegistry] No offices registered. Seeding default office registry...");
    const officeModules: { mod: string; cls: string }[] = [
      { mod: "./IntakeOffice.js", cls: "IntakeOffice" },
      { mod: "./MatchingOffice.js", cls: "MatchingOffice" },
      { mod: "./RecruitmentOffice.js", cls: "RecruitmentOffice" },
      { mod: "./VendorOffice.js", cls: "VendorOffice" },
      { mod: "./SubmissionOffice.js", cls: "SubmissionOffice" },
      { mod: "./ClientOffice.js", cls: "ClientOffice" },
      { mod: "./FounderOffice.js", cls: "FounderOffice" },
    ];

    for (const { mod, cls } of officeModules) {
      try {
        const imported: any = await import(mod);
        const OfficeClass = imported[cls];
        const office = new OfficeClass();
        await this.registerOffice(office.name, office.policy);
      } catch (e: any) {
        console.error(`[OfficeCapabilityRegistry] Failed to register ${cls}:`, e.message || e);
      }
    }
    this.registeredThisProcess = true;
  }

  /**
   * Get an office by capability
   */
  static async findOfficesByCapability(
    capabilityName: string,
  ): Promise<string[]> {
    if (!db) return [];

    const snap = await db.collection("office_registry").get();
    const results: string[] = [];

    for (const doc of snap.docs) {
      const data = doc.data();
      const capabilities: OfficeCapability[] = data.policy?.capabilities || [];
      if (capabilities.some((c) => c.name === capabilityName)) {
        results.push(data.name);
      }
    }

    return results;
  }

  /**
   * Get all offices that support an event type
   */
  static async getOfficesForEvent(eventType: string): Promise<string[]> {
    if (!db) return [];
    await this.ensureDefaultOfficesRegistered();

    const snap = await db.collection("office_registry").get();
    const results: string[] = [];

    for (const doc of snap.docs) {
      const data = doc.data();
      const supportedEvents: string[] = data.policy?.supportedEvents || [];
      if (supportedEvents.includes(eventType)) {
        results.push(data.name);
      }
    }

    return results;
  }

  /**
   * Get all registered offices
   */
  static async getAllOffices(): Promise<string[]> {
    if (!db) return [];
    const snap = await db.collection("office_registry").get();
    return snap.docs.map((doc) => doc.data().name);
  }
}
