import { adminDb } from "../../lib/firebase-admin.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }
  
  try {
    const { candidate, orgId, userId, userRole } = req.body;
    
    if (!candidate || !candidate.id) {
      return res.status(400).json({ success: false, error: "Missing candidate payload" });
    }

    const docRef = adminDb.collection("candidatePool").doc(candidate.id);
    await docRef.set({
      ...candidate,
      vendorId: candidate.vendorId || orgId || "HQ",
      ownerId: candidate.ownerId || userId || "system",
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return res.status(200).json({ success: true, id: candidate.id });
  } catch (error: any) {
    console.error("Upsert error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
