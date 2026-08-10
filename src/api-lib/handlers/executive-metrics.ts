import express from "express";
import { adminDb } from "../../lib/firebase-admin.js";

const executiveMetricsHandler = express.Router();

executiveMetricsHandler.get("/dashboard", async (req: any, res: any) => {
  try {
    const tenantId = req.user?.organizationId || "TENANT-HQ";
    const isAdmin = req.user?.role === "admin" || req.user?.role === "super_admin" || tenantId === "ORG-GLOBAL-HQ";

    // 1. Requirement Metrics
    const reqsSnap = await adminDb.collection("requirements_public").get();
    const totalRequirements = reqsSnap.size;
    const activeRequirements = reqsSnap.docs.filter(d => d.data().status === "ACTIVE").length;

    // 2. Candidate Pipeline
    const candSnap = await adminDb.collection("candidatePool").get();
    const totalCandidates = candSnap.size;

    // 3. Submissions Funnel
    const subSnap = await adminDb.collection("submissions").get();
    const totalSubmissions = subSnap.size;
    
    let interviewsCount = 0;
    let placementsCount = 0;
    
    subSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.status === "INTERVIEW_SCHEDULED" || data.status === "INTERVIEWING") interviewsCount++;
        if (data.status === "PLACED" || data.status === "HIRED" || data.status === "OFFER_ACCEPTED") placementsCount++;
    });

    // 4. Revenue (Derived from placements/requirements)
    let expectedRevenue = 0;
    let confirmedRevenue = placementsCount * 15000; // Mock average placement fee for now, since actual revenue isn't fully modeled in SSOT
    
    reqsSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.status === "ACTIVE") {
        expectedRevenue += 20000; // Mock average expected per requirement
      }
    });

    // 5. AI & Automation ROI
    const eventsSnap = await adminDb.collection("system_events")
        .orderBy("timestamp", "desc")
        .limit(1000)
        .get();
        
    let aiScreenings = 0;
    let aiMatches = 0;
    let estimatedHoursSaved = 0;
    
    eventsSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.eventType === "AI_SCREENING_COMPLETED") {
            aiScreenings++;
            estimatedHoursSaved += 0.25; // 15 mins saved per screen
        }
        if (data.eventType === "CANDIDATE_MATCHED" || data.source === "MATCHING_ENGINE") {
            aiMatches++;
            estimatedHoursSaved += 0.5; // 30 mins saved per match
        }
    });

    // 6. Risk & Exceptions
    const execSnap = await adminDb.collection("automation_executions")
        .orderBy("startedAt", "desc")
        .limit(100)
        .get();
        
    let failedAutomations = 0;
    let successAutomations = 0;
    
    execSnap.docs.forEach(doc => {
        if (doc.data().status === "FAILED") failedAutomations++;
        if (doc.data().status === "COMPLETED") successAutomations++;
    });
    
    const commAuditSnap = await adminDb.collection("communication_guard_audit")
        .where("decision.success", "==", false)
        .limit(50)
        .get();
    
    const communicationBlocks = commAuditSnap.size;

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
            activeKillSwitches: 0 // In a real scenario, fetch from Kill Switch state
        }
      }
    });
  } catch (err: any) {
    console.error("[ExecutiveMetrics] Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default executiveMetricsHandler;
