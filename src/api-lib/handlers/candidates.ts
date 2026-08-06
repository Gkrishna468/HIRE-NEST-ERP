import { adminDb } from "../../lib/firebase-admin.js";
import { getScopedCandidateUniverse } from "../utils/governance.js";

export default async function handler(req: any, res: any) {
  const role = req.user?.role || req.query?.role;
  const orgId = req.user?.organizationId || req.query?.orgId || req.user?.orgId;
  const scan = req.query.scan;

  try {
    if (!adminDb) {
      return res.status(200).json({ success: true, candidates: [] });
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
        "[CANDIDATES_API_ERR] Error fetching candidates:",
        error.message,
      );
    }
    return res.status(200).json({ success: true, candidates: [] });
  }
}
