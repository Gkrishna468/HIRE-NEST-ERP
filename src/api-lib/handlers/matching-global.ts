import { adminDb } from "../../lib/firebase-admin.js";
import { runComprehensiveMatch } from "../ai/matchingEngine.js";
import { getScopedCandidateUniverse } from "../utils/governance.js";

const dispatchWorkflowEvent = async (db: any, payload: any) => {
  console.log(`[EVENT MATCHING MOCK] Dispatched: ${payload.type}`);
};

function normalizeSkills(skills: string[]): string[] {
  const mappings: Record<string, string> = {
    "react.js": "react",
    reactjs: "react",
    "node.js": "node",
    nodejs: "node",
    "vue.js": "vue",
    vuejs: "vue",
    "next.js": "nextjs",
    aws: "amazon web services",
    gcp: "google cloud",
    typescript: "ts",
    javascript: "js",
  };
  return skills.map((s) => mappings[s] || s);
}

export default async function matchingGlobalHandler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { requirementId, skills } = req.query;
  const targetReqId = requirementId || "";

  if (!targetReqId) {
    return res
      .status(400)
      .json({ error: "requirementId is required for contextual matching" });
  }

  const userId = req.user?.uid;
  let role = req.user?.role;
  let orgId = req.user?.organizationId;

  if (adminDb && userId) {
    try {
      const userDoc = await adminDb.collection("users").doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        role = userData?.role || role;
        orgId = userData?.organizationId || orgId;
      }
    } catch (e) {
      console.error("[AUTH] Failed to fetch user doc", e);
    }
  }

  const isAdmin =
    role === "admin" ||
    role === "super_admin" ||
    role === "ops_admin" ||
    role === "hq_admin" ||
    role === "hq" ||
    orgId === "ORG-GLOBAL-HQ" ||
    orgId === "ADMIN";

  if (!isAdmin) {
    return res.status(403).json({ error: "Forbidden: Match Intelligence is restricted to administrators." });
  }

  // Parse skills array
  let reqSkills: string[] = [];
  if (skills) {
    reqSkills = String(skills)
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s, i, arr) => s.length > 0 && arr.indexOf(s) === i);
    reqSkills = normalizeSkills(reqSkills);
  }

  try {
    const matchedCandidates: any[] = [];
    const fallbackCandidates: any[] = [];
    const jdObject = { skills: reqSkills };

    if (adminDb) {
      try {
        const isAdmin =
          role === "admin" ||
          role === "super_admin" ||
          role === "ops_admin" ||
          orgId === "ORG-GLOBAL-HQ" ||
          orgId === "ADMIN";

        const docsToEvaluate: any[] = [];

        const poolSnapshot = await getScopedCandidateUniverse(
          adminDb,
          "candidatePool",
          role,
          orgId,
        ).get();

        poolSnapshot.docs.forEach((d: any) => {
          const cand = d.data();
          if (
            cand.status === "DELETED" ||
            cand.isActive === false ||
            cand.active === false ||
            cand.distillationStatus === "FAILED"
          )
            return;
          docsToEvaluate.push({ id: d.id, ...cand });
        });

        for (const cand of docsToEvaluate) {
          // PIPELINE ISOLATION:
          // If a candidate is explicitly mapped to a specific job requirement pipeline,
          // they belong uniquely to that pipeline and must not leak into global sweeping algorithms
          // for other un-related JDs.
          if (cand.mappedJobId && cand.mappedJobId !== targetReqId) {
            continue;
          }

          // Normalize candidate skills
          if (cand.skills && Array.isArray(cand.skills)) {
            cand.skills = normalizeSkills(
              cand.skills.map((s: string) => s.toLowerCase()),
            );
          }

          // Execute contextual semantic mapping
          const matchResult = await runComprehensiveMatch(jdObject, cand);

          // AI RERANKING Factors (Boosts)
          let enhancedScore = matchResult.overallScore;

          if (cand.experience && parseInt(cand.experience) > 5)
            enhancedScore += 5;
          if (cand.noticePeriod && parseInt(cand.noticePeriod) <= 30)
            enhancedScore += 3;
          if (cand.vendorTrustScore && cand.vendorTrustScore > 80)
            enhancedScore += 2;

          if (cand.aiMatchScore) {
            enhancedScore = cand.aiMatchScore;
          } else {
            enhancedScore = Math.min(Math.round(enhancedScore), 100);
          }

          const resultObj = {
            id: cand.id || cand.candidateId || "unknown",
            candidateId: cand.candidateId || cand.id || "unknown",
            name: cand.fullName,
            email: cand.primaryEmail || cand.email || "No Email Provided",
            phone: cand.phoneHash || cand.phone || "No Phone Provided",
            linkedin: cand.linkedin || "",
            skills: cand.skills || [],
            experience: cand.experience || "Not Specified",
            vendorId: cand.vendorId || "ORG-EXTERNAL-VENDOR",
            pipelineStage: cand.pipelineStage || "Match Identified",
            matchScore: enhancedScore,
            originalScore: matchResult.overallScore,
            visibilityStatus: cand.visibility || "federated",
            isGlobalMatch: true,
            breakdown: matchResult.breakdown,
            skillsMatched: (matchResult as any).skillsMatched || [],
            skillsMissing: (matchResult as any).skillsMissing || [],
            strengths: matchResult.explanation?.recruiterView?.strengths || [],
            gaps: matchResult.explanation?.recruiterView?.gaps || [],
            suitabilitySummary:
              "Match evaluated contextually against federated talent pool.",
          };

          // Requirements Filtering (Fallback)
          if (enhancedScore >= 70) {
            matchedCandidates.push(resultObj);
          }
        }
      } catch (dbErr) {
        console.warn(
          "[MATCHING_REQUIREMENT_DB_WARN] Failed to query mapped candidates:",
          dbErr,
        );
      }
    }

    // Generate Ledger Validation Counts (Single Source of Truth)
    const ledgerCounts = {
      matches: 0,
      floated: 0,
      submitted: 0,
      interviewing: 0,
      offers: 0,
      placed: 0,
      rejected: 0,
    };

    let ledgerCandidates: any[] = [];

    if (adminDb) {
      try {
        const isAdmin =
          role === "admin" ||
          role === "super_admin" ||
          role === "ops_admin" ||
          orgId === "ORG-GLOBAL-HQ" ||
          orgId === "ADMIN";

        let allCandidatesSnap;
        let allSubsSnap;

        allCandidatesSnap = await getScopedCandidateUniverse(
          adminDb,
          "candidatePool",
          role,
          orgId,
        )
          .where("mappedJobId", "==", targetReqId)
          .get();
        allSubsSnap = await getScopedCandidateUniverse(
          adminDb,
          "submissions",
          role,
          orgId,
        )
          .where("requirementId", "==", targetReqId)
          .get();

        const uniqueMap = new Map();

        matchedCandidates.forEach((c: any) =>
          uniqueMap.set(c.candidateId, { ...c, sysSource: "AI_MATCH" }),
        );

        allCandidatesSnap.docs.forEach((d: any) => {
          const candData = d.data();
          if (
            candData.status === "DELETED" ||
            candData.isActive === false ||
            candData.active === false
          )
            return;
          const existing = uniqueMap.get(d.id);
          uniqueMap.set(d.id, {
            ...candData,
            id: d.id,
            sysSource: "VENDOR_FLOATED",
            matchScore:
              candData.matchScore ||
              candData.aiMatchScore ||
              existing?.matchScore ||
              null,
          });
        });

        allSubsSnap.docs.forEach((d: any) => {
          const subData = d.data();
          if (subData.status === "DELETED" || subData.isActive === false)
            return;
          const candId = subData.candidateId || d.id;
          const existing = uniqueMap.get(candId);
          uniqueMap.set(candId, {
            ...existing,
            ...subData,
            id: candId,
            sysSource: "SUBMISSION",
            submissionId: d.id,
          });
        });

        ledgerCandidates = Array.from(uniqueMap.values());

        ledgerCandidates.forEach((c: any) => {
          const stage = c.pipelineStage || c.status || "Matched";
          if (stage === "Matched") ledgerCounts.matches++;
          else if (stage === "Added") ledgerCounts.floated++;
          else if (
            stage === "Submitted" ||
            stage === "Deal Room Active" ||
            stage.includes("SUBMITTED")
          )
            ledgerCounts.submitted++;
          else if (stage === "Interviewing" || stage.includes("interview"))
            ledgerCounts.interviewing++;
          else if (stage === "Offer") ledgerCounts.offers++;
          else if (stage === "Placed" || stage === "hired")
            ledgerCounts.placed++;
          else if (stage === "Rejected") ledgerCounts.rejected++;
        });
      } catch (e) {}
    }

    const sortedMatches = matchedCandidates.sort(
      (a, b) => (b.matchScore || 0) - (a.matchScore || 0),
    );

    const sortedFallback = fallbackCandidates
      .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
      .slice(0, 15);

    if (sortedMatches.length > 0) {
      try {
        await dispatchWorkflowEvent(adminDb, {
          eventType: "REQUIREMENT_MATCH_EVALUATED",
          producer: "api/matching-scoped",
          status: "QUEUED",
          payload: {
            jobId: targetReqId,
            count: sortedMatches.length,
            topScore: sortedMatches[0]?.matchScore,
          },
        });
      } catch (evtErr) {}
    }

    return res.status(200).json({
      matches: sortedMatches,
      fallbackMatches: sortedFallback,
      ledgerCounts,
      ledgerCandidates,
      count: sortedMatches.length,
      fallbackCount: sortedFallback.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[SCOPED_MATCHING_ERR] Core execution failed:", error);
    return res.status(500).json({ error: error.message });
  }
}
