import { adminDb } from "../../lib/firebase-admin.js";
import { FieldValue } from "firebase-admin/firestore";
import { MatchingOffice } from "../services/MatchingOffice.js";

export async function runMatchIntelligenceEngine(
  reqId?: string,
  orgId?: string,
  role?: string,
  onProgress?: (progress: { current: number; total: number; processedReqs: string[]; count: number }) => void,
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
    
    if (onProgress) {
      onProgress({ current: 1, total: 1, processedReqs: [reqId], count: countSnap.size });
    }
    return countSnap.size;
  } else {
    // Global rescan across requirements - limit to 21 to prevent timeout/high load
    const reqsSnapshot = await adminDb.collection("requirements_public").limit(21).get();
    const docs = reqsSnapshot.docs;
    const total = docs.length;
    let matchUpdatesCount = 0;

    for (let i = 0; i < total; i += 3) {
      const batch = docs.slice(i, i + 3);
      const batchPromises = batch.map(async (d) => {
        await MatchingOffice.matchRequirement(d.id, orgId);
        const countSnap = await adminDb
          .collection("candidate_matches")
          .where("requirementId", "==", d.id)
          .get();
        return countSnap.size;
      });

      const results = await Promise.all(batchPromises);
      const batchCount = results.reduce((a, b) => a + b, 0);
      matchUpdatesCount += batchCount;

      if (onProgress) {
        onProgress({
          current: Math.min(i + batch.length, total),
          total,
          processedReqs: batch.map((d) => d.id),
          count: matchUpdatesCount,
        });
      }

      // Pause 200ms after every batch of 3 (unless it is the final batch)
      if (i + 3 < total) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
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

  // Configure response for streaming / chunked transfer
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Connection", "keep-alive");

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
        createdAt: FieldValue.serverTimestamp(),
      });

    res.write(JSON.stringify({ success: true, status: "started", executionId }) + "\n");

    const matchUpdatesCount = await runMatchIntelligenceEngine(
      reqId,
      orgId,
      role,
      (progress) => {
        res.write(
          JSON.stringify({
            success: true,
            status: "progress",
            current: progress.current,
            total: progress.total,
            processedReqs: progress.processedReqs,
            matchUpdatesCount: progress.count,
          }) + "\n",
        );
      },
    );

    const duration = Date.now() - startTime;
    await adminDb
      .collection("agent_executions")
      .doc(executionId)
      .update({
        status: "success",
        duration,
        logs: `Successfully evaluated matches. ${matchUpdatesCount} opportunities created or updated.`,
        completedAt: FieldValue.serverTimestamp(),
      });

    res.write(
      JSON.stringify({
        success: true,
        status: "completed",
        matchUpdatesCount,
        duration,
      }) + "\n",
    );
    res.end();
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
        completedAt: FieldValue.serverTimestamp(),
      })
      .catch(console.error);

    res.write(JSON.stringify({ success: false, error: e.message }) + "\n");
    res.end();
  }
}
