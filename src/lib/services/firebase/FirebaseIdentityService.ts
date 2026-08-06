import { doc, getDoc, updateDoc, setDoc, collection, query, where, getDocs, deleteDoc, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { IIdentityService } from '../contracts/IIdentityService';

export class FirebaseIdentityService implements IIdentityService {
  async getUserProfile(uid: string): Promise<any> {
    try {
      const d = await getDoc(doc(db, "users", uid));
      if (d.exists()) {
        return d.data();
      }
      return null;
    } catch (offlineError) {
      console.warn("Failed to get user doc, possibly offline.", offlineError);
      return null;
    }
  }

  async updateUserProfile(uid: string, data: Partial<Record<string, any>>): Promise<void> {
    const docRef = doc(db, "users", uid);
    await setDoc(docRef, data, { merge: true });
  }

  async updateDemoFlag(uid: string, hasSeenDemo: boolean): Promise<void> {
    const docRef = doc(db, "users", uid);
    await setDoc(docRef, { hasSeenDemo }, { merge: true });
  }

  async updatePilotMode(uid: string, enabled: boolean): Promise<void> {
    const docRef = doc(db, "users", uid);
    await setDoc(docRef, { pilotMode: enabled }, { merge: true });
  }

  async executeAdminCleanup(email: string): Promise<void> {
    try {
      const q = query(
        collection(db, "users"),
        where("email", "==", email),
      );
      const reqs = await getDocs(q);
      if (!reqs.empty) {
        for (let rUser of reqs.docs) {
          const uId = rUser.id;
          const uData = rUser.data();
          // reset onboarding flag
          if (uData.onboardingCompleted) {
            await updateDoc(doc(db, "users", uId), {
              onboardingCompleted: false,
              ndaUploaded: false,
              verificationStatus: "PENDING",
            });
          }
          const orgId = uData.organizationId || uData.orgId || uId;

          // Reset Org
          try {
            await updateDoc(doc(db, "organizations", orgId), {
              onboardingCompleted: false,
              ndaUploaded: false,
              verificationStatus: "PENDING",
            });
          } catch (e) {}

          // Submissions / DealRooms / Requirements
          const qReq = await getDocs(
            query(
              collection(db, "requirements"),
              where("clientId", "==", orgId),
            ),
          );
          let reqIds: string[] = [];
          for (let rDoc of qReq.docs) {
            reqIds.push(rDoc.id);
            await deleteDoc(rDoc.ref);
          }

          try {
            const qCand = await getDocs(query(collection(db, "candidatePool"), limit(50)));
            for (let cDoc of qCand.docs) {
              const cd = cDoc.data();
              if (
                cd.vendorId === orgId ||
                cd.clientId === orgId ||
                reqIds.includes(cd.mappedJobId)
              ) {
                await deleteDoc(cDoc.ref);
              }
            }
          } catch (cleanupErr) {
            console.error(
              "Cleanup script error on candidatePool:",
              cleanupErr,
            );
          }

          const qDeal = await getDocs(query(collection(db, "dealRooms"), limit(25)));
          for (let dDoc of qDeal.docs) {
            const dd = dDoc.data();
            if (dd.requirementId && reqIds.includes(dd.requirementId)) {
              await deleteDoc(dDoc.ref);
            } else if (dd.clientId === orgId || dd.vendorId === orgId) {
              await deleteDoc(dDoc.ref);
            }
          }
          console.log(`[CLEANUP] Wiped ${email} context.`);
        }
      }
    } catch (cle) {
      console.warn("[CLEANUP] Failed", cle);
    }
  }
}
