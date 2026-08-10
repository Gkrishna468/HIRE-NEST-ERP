import { adminDb } from "../../lib/firebase-admin.js";
import { MatchingOffice } from "../services/MatchingOffice.js";

export async function runMatchIntelligenceEngine(
  reqId?: string,
  orgId?: string,
  role?: string,
) {
  if (!adminDb) return 0;

  if (reqId) {
    // Delete old matches for this requirement since we are refreshing
    const oldMatches = await adminDb
      .collection("candidate_matches")
      .where("requirementId", "==", reqId)
      .get();
    for (const doc of oldMatches.docs) {
      await doc.ref.delete();
    }
    
    await MatchingOffice.matchRequirement(reqId, orgId);

    const countSnap = await adminDb
      .collection("candidate_matches")
      .where("requirementId", "==", reqId)
      .get();
    return countSnap.size;
  } else {
    // Global rescan across open requirements
    const reqsSnapshot = await adminDb.collection("requirements_public").get();
    let matchUpdatesCount = 0;

    for (const d of reqsSnapshot.docs) {
      await MatchingOffice.matchRequirement(d.id, orgId);
      const countSnap = await adminDb
        .collection("candidate_matches")
        .where("requirementId", "==", d.id)
        .get();
      matchUpdatesCount += countSnap.size;
    }

    return matchUpdatesCount;
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
  if (!adminDb)
    return res.status(503).json({
      success: false,
      error:
        "Firebase Service Account configuration is missing. Cannot perform requirement refresh in client fallback mode.",
    });

  const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const startTime = Date.now();

  try {
    const { orgId, role, reqId } = req.body;

    await adminDb
      .collection("agent_executions")
      .doc(executionId)
      .set({
        id: executionId,
        agentName: "Match Intelligence Agent",
        agentType: "SYSTEM_AGENT",
        task: reqId
          ? `Evaluating matches for Requirement ${reqId}`
          : "Global Match Refresh",
        status: "running",
        targetId: reqId || "GLOBAL",
        createdAt: adminDb.doc("1/1").firestore.FieldValue.serverTimestamp(),
      });

    const matchUpdatesCount = await runMatchIntelligenceEngine(
      reqId,
      orgId,
      role,
    );

    const duration = Date.now() - startTime;
    await adminDb
      .collection("agent_executions")
      .doc(executionId)
      .update({
        status: "success",
        duration,
        logs: `Successfully evaluated matches. ${matchUpdatesCount} opportunities created or updated.`,
        completedAt: adminDb.doc("1/1").firestore.FieldValue.serverTimestamp(),
      });

    return res.status(200).json({ success: true, matchUpdatesCount });
  } catch (e: any) {
    console.error("Rescan Error:", e);
    const duration = Date.now() - startTime;
    await adminDb
      .collection("agent_executions")
      .doc(executionId)
      .update({
        status: "failed",
        duration,
        error: e.message,
        completedAt: adminDb.doc("1/1").firestore.FieldValue.serverTimestamp(),
      })
      .catch(console.error);

    return res.status(500).json({ error: e.message });
  }
}
