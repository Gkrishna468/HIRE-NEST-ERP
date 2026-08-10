import { db } from "../firebase";
import { collection, doc, setDoc, getDoc, query, where, getDocs, serverTimestamp, addDoc } from "firebase/firestore";
import { adminDb } from "../firebase-admin";

export interface OwnershipRecord {
  candidateId: string;
  ownerType: 'VENDOR' | 'CLIENT' | 'ADMIN';
  ownerId: string;
  ownedFrom: string;
  lockUntil: string;
}

export class CandidateOwnershipEngine {
  /**
   * Registers ownership of a candidate to a specific vendor/org for a set duration.
   * Typical lock period for agency submissions is 90 days or 180 days.
   */
  static async establishOwnership(
    candidateId: string,
    ownerId: string,
    ownerType: 'VENDOR' | 'CLIENT' | 'ADMIN' = 'VENDOR',
    lockDays: number = 90
  ) {
    try {
      const now = new Date();
      const lockUntil = new Date(now);
      lockUntil.setDate(now.getDate() + lockDays);

      const record = {
        candidateId,
        ownerType,
        ownerId,
        ownedFrom: now.toISOString(),
        lockUntil: lockUntil.toISOString()
      };

      let vendorName = ownerId === "HQ" || ownerId === "ORG-GLOBAL-HQ" ? "HQ" : ownerId;

      if (adminDb) {
        await adminDb.collection("candidateOwnership").doc(`${candidateId}_${ownerId}`).set(record);
        await adminDb.collection("operationalEvents").add({
          entityId: candidateId,
          type: "Ownership Established",
          actorRole: ownerType,
          metadata: {
            ownerId,
            vendorName,
            lockUntil: record.lockUntil
          },
          timestamp: new Date().toISOString()
        });
        return { success: true, record };
      }

      // Client SDK fallback
      await setDoc(doc(db, "candidateOwnership", `${candidateId}_${ownerId}`), {
        ...record,
        timestamp: serverTimestamp()
      });
      
      await addDoc(collection(db, "operationalEvents"), {
        entityId: candidateId,
        type: "Ownership Established",
        actorRole: ownerType,
        metadata: {
          ownerId,
          vendorName,
          lockUntil: record.lockUntil
        },
        timestamp: serverTimestamp()
      });

      return { success: true, record };
    } catch (error) {
      console.error("Failed to establish candidate ownership:", error);
      throw error;
    }
  }

  /**
   * Verifies if a vendor/org has valid ownership rights for a candidate
   */
  static async verifyOwnership(
    candidateId: string,
    vendorId: string
  ): Promise<boolean> {
    try {
      if (adminDb) {
        const snap = await adminDb.collection("candidateOwnership").doc(`${candidateId}_${vendorId}`).get();
        if (!snap.exists) return false;
        const data = snap.data();
        if (!data?.lockUntil) return false;
        return new Date(data.lockUntil) > new Date();
      }

      const snap = await getDoc(doc(db, "candidateOwnership", `${candidateId}_${vendorId}`));
      if (!snap.exists()) return false;
      const data = snap.data();
      if (!data?.lockUntil) return false;
      return new Date(data.lockUntil) > new Date();
    } catch (e) {
      console.error("Failed to verify ownership:", e);
      return false;
    }
  }

  /**
   * Checks if a candidate is currently locked by any OTHER vendor
   */
  static async verifyOwnershipAndCheckConflicts(
    candidateId: string,
    requestingOrgId: string
  ): Promise<{ canProceed: boolean; lockedBy?: string; lockUntil?: string }> {
    try {
      const now = new Date();

      if (adminDb) {
        const snap = await adminDb.collection("candidateOwnership")
          .where("candidateId", "==", candidateId)
          .get();

        let lockedByOther: any = null;
        for (const d of snap.docs) {
          const data = d.data();
          if (data.ownerId !== requestingOrgId) {
            const lockEnd = new Date(data.lockUntil);
            if (lockEnd > now) {
              lockedByOther = data;
              break;
            }
          }
        }

        if (lockedByOther) {
          return {
            canProceed: false,
            lockedBy: lockedByOther.ownerId,
            lockUntil: lockedByOther.lockUntil
          };
        }
        return { canProceed: true };
      }

      const q = query(
        collection(db, "candidateOwnership"), 
        where("candidateId", "==", candidateId)
      );
      
      const snap = await getDocs(q);
      
      let lockedByOther: any = null;
      
      for (const d of snap.docs) {
        const data = d.data();
        if (data.ownerId !== requestingOrgId) {
          const lockEnd = new Date(data.lockUntil);
          if (lockEnd > now) {
            lockedByOther = data;
            break;
          }
        }
      }
      
      if (lockedByOther) {
        return {
          canProceed: false,
          lockedBy: lockedByOther.ownerId,
          lockUntil: lockedByOther.lockUntil
        };
      }
      
      return { canProceed: true };
    } catch (e) {
      console.error("Failed to verify candidate ownership:", e);
      return { canProceed: true }; // Fail open for safety if there's no data
    }
  }
}
