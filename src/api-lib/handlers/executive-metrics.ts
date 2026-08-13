import express from "express";
import { adminDb } from "../../lib/firebase-admin.js";

const executiveMetricsHandler = express.Router();

executiveMetricsHandler.get("/dashboard", async (req: any, res: any) => {
  try {
    const tenantId = req.user?.organizationId || "TENANT-HQ";
    const isAdmin = req.user?.role === "admin" || req.user?.role === "super_admin" || tenantId === "ORG-GLOBAL-HQ";

    let totalRequirements = 0;
    let activeRequirements = 0;
    let reqsDocs: any[] = [];
    if (adminDb) {
      try {
        const reqsSnap = await adminDb.collection("requirements_public").get();
        totalRequirements = reqsSnap.size;
        activeRequirements = reqsSnap.docs.filter(d => d.data().status === "ACTIVE").length;
        reqsDocs = reqsSnap.docs;
      } catch (e: any) {
        console.warn("[ExecutiveMetrics] Failed to fetch requirements_public:", e.message);
      }
    }

    let totalCandidates = 0;
    if (adminDb) {
      try {
        const candSnap = await adminDb.collection("candidatePool").get();
        totalCandidates = candSnap.size;
      } catch (e: any) {
        console.warn("[ExecutiveMetrics] Failed to fetch candidatePool:", e.message);
      }
    }

    let totalSubmissions = 0;
    let interviewsCount = 0;
    let placementsCount = 0;
    if (adminDb) {
      try {
        const subSnap = await adminDb.collection("submissions").get();
        totalSubmissions = subSnap.size;
        subSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data.status === "INTERVIEW_SCHEDULED" || data.status === "INTERVIEWING") interviewsCount++;
          if (data.status === "PLACED" || data.status === "HIRED" || data.status === "OFFER_ACCEPTED") placementsCount++;
        });
      } catch (e: any) {
        console.warn("[ExecutiveMetrics] Failed to fetch submissions:", e.message);
      }
    }

    let expectedRevenue = 0;
    let confirmedRevenue = placementsCount * 15000;
    reqsDocs.forEach(doc => {
      const data = doc.data();
      if (data.status === "ACTIVE") {
        expectedRevenue += 20000;
      }
    });

    let aiScreenings = 0;
    let aiMatches = 0;
    let estimatedHoursSaved = 0;
    if (adminDb) {
      try {
        const eventsSnap = await adminDb.collection("system_events")
          .limit(1000)
          .get();
        eventsSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data.eventType === "AI_SCREENING_COMPLETED") {
            aiScreenings++;
            estimatedHoursSaved += 0.25;
          }
          if (data.eventType === "CANDIDATE_MATCHED" || data.source === "MATCHING_ENGINE") {
            aiMatches++;
            estimatedHoursSaved += 0.5;
          }
        });
      } catch (e: any) {
        console.warn("[ExecutiveMetrics] Failed to fetch system_events:", e.message);
      }
    }

    let failedAutomations = 0;
    let successAutomations = 0;
    if (adminDb) {
      try {
        const execSnap = await adminDb.collection("automation_executions")
          .limit(100)
          .get();
        execSnap.docs.forEach(doc => {
          if (doc.data().status === "FAILED") failedAutomations++;
          if (doc.data().status === "COMPLETED") successAutomations++;
        });
      } catch (e: any) {
        console.warn("[ExecutiveMetrics] Failed to fetch automation_executions:", e.message);
      }
    }

    let communicationBlocks = 0;
    if (adminDb) {
      try {
        const commAuditSnap = await adminDb.collection("communication_guard_audit")
          .limit(50)
          .get();
        communicationBlocks = commAuditSnap.docs.filter(d => d.data()?.decision?.success === false).length;
      } catch (e: any) {
        console.warn("[ExecutiveMetrics] Failed to fetch communication_guard_audit:", e.message);
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        revenue: {
          expected: expectedRevenue,
          confirmed: confirmedRevenue
        },
        pipeline: {
          activeRequirements,
          totalRequirements,
          totalCandidates,
          submissions: totalSubmissions,
          interviews: interviewsCount,
          placements: placementsCount
        },
        aiRoi: {
          aiScreenings,
          aiMatches,
          estimatedHoursSaved: Math.round(estimatedHoursSaved),
          automationSuccess: successAutomations
        },
        risks: {
          failedAutomations,
          communicationBlocks,
          activeKillSwitches: 0
        }
      }
    });
  } catch (err: any) {
    console.error("[ExecutiveMetrics] Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default executiveMetricsHandler;
