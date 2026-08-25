import { adminDb } from "../../lib/firebase-admin.js";
import { getScopedCandidateUniverse } from "../utils/governance.js";

export default async function handler(req: any, res: any) {
  const role = req.user?.role || req.query?.role;
  const orgId = req.user?.organizationId || req.query?.orgId || req.user?.orgId;
  const userId = req.user?.uid || "system";

  try {
    if (!adminDb) {
      return res.status(200).json({ success: true, candidates: [] });
    }

    if (req.method === "DELETE") {
      const candidateId = req.query?.id || req.body?.id;
      if (!candidateId) {
        return res.status(400).json({ success: false, error: "Missing candidate ID" });
      }

      const candidateRef = adminDb.collection("candidatePool").doc(candidateId);
      const docSnap = await candidateRef.get();

      if (!docSnap.exists) {
        return res.status(404).json({ success: false, error: "Candidate not found" });
      }

      const candidate = docSnap.data() as any;

      // Ensure proper authorization
      const isMainAdmin = ['admin', 'super_admin', 'platform_authority', 'hq_admin', 'ceo', 'ops_admin'].includes(role);
      const isVendorAdmin = role === 'vendor_admin';
      
      let isAllowed = false;
      if (isMainAdmin) {
        isAllowed = true;
      } else if (isVendorAdmin) {
        if (candidate.vendorId === orgId && candidate.ownershipType !== 'DIRECT') {
          isAllowed = true;
        }
      }

      if (!isAllowed) {
        return res.status(403).json({ success: false, error: "Forbidden: Cannot delete candidate" });
      }

      // Soft delete candidate
      await candidateRef.update({
        status: "DELETED",
        isActive: false,
        deletedAt: new Date().toISOString(),
        deletedBy: userId,
        deletionReason: req.body?.reason || "Admin Requested Deletion"
      });

      // Soft delete related ownerships
      const ownershipSnap = await adminDb.collection("ownershipVault").where("candidateId", "==", candidateId).get();
      for (const d of ownershipSnap.docs) {
        await d.ref.update({ isActive: false, status: "DELETED" });
      }

      // Soft delete related submissions
      const submissionsSnap = await adminDb.collection("submissions").where("candidateId", "==", candidateId).get();
      for (const d of submissionsSnap.docs) {
        await d.ref.update({ isActive: false, status: "DELETED" });
      }

      // Soft delete dealRooms
      const dealRoomsSnap = await adminDb.collection("dealRooms").where("candidateId", "==", candidateId).get();
      for (const d of dealRoomsSnap.docs) {
        await d.ref.update({ isActive: false, status: "DELETED" });
      }

      // Create Audit Log
      await adminDb.collection("audit_logs").add({
        action: "CANDIDATE_DELETED",
        candidateId: candidateId,
        deletedBy: userId,
        deletedByRole: role,
        vendorId: orgId,
        deletedAt: new Date().toISOString(),
        reason: req.body?.reason || "Admin Requested Deletion",
        source: "GLOBAL_HQ"
      });

      return res.status(200).json({ success: true });
    }

    if (!orgId || orgId === "undefined" || orgId === "null") {
      console.warn(
        "[CANDIDATES_API_WARN] orgId is undefined or missing, cannot execute scoped query.",
      );
      return res.status(200).json({ success: true, candidates: [] });
    }

    const snapshot = await getScopedCandidateUniverse(
      adminDb,
      "candidatePool",
      role,
      orgId,
    )
      .limit(50)
      .get();
    let candidates = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({ success: true, candidates });
  } catch (error: any) {
    if (error.code === 16 || error.message?.includes("UNAUTHENTICATED")) {
      console.warn(
        "[CANDIDATES_API_WARN] adminDb unauthenticated, falling back to client-side query.",
      );
    } else {
      console.error(
        "[CANDIDATES_API_ERR] Error fetching/deleting candidates:",
        error.message,
      );
    }
    return res.status(500).json({ success: false, error: error.message });
  }
}
