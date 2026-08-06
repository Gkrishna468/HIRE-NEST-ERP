import { adminDb } from "../../lib/firebase-admin.js";


async function getCachedAnalytics(cacheKey: string, computeFn: () => Promise<any>): Promise<any> {
  const cacheRef = adminDb.collection("dashboard_cache").doc(cacheKey);
  const cacheDoc = await cacheRef.get();
  
  const now = Date.now();
  if (cacheDoc.exists) {
    const data = cacheDoc.data();
    const age = now - (data.lastUpdated || 0);
    if (age < 5 * 60 * 1000) {
      return data.metrics;
    }
    computeFn().then(metrics => cacheRef.set({ metrics, lastUpdated: Date.now() })).catch(e => console.error("Cache refresh failed", e));
    return data.metrics;
  }
  
  const metrics = await computeFn();
  await cacheRef.set({ metrics, lastUpdated: now });
  return metrics;
}

export default async function analyticsHandler(req: any, res: any) {
  const pathString = req.path || req.url || "";
  const apiPathMatch = pathString.match(/analytics\/(.*)/);
  const typeParam = req.query?.type || "";
  const apiPath =
    apiPathMatch && apiPathMatch[1]
      ? apiPathMatch[1].split("?")[0]
      : typeParam || pathString.replace(/^\/?analytics\//, "").split("?")[0];

  try {
    if (!adminDb) {
      return res.status(200).json({
        fallbackRequired: true,
        revenue: 0,
        spending: 0,
        activeDeals: 0,
        placements: 0,
        avgMargin: 0,
        vendorQuality: 0,
        recruiterProductivity: 0,
        totalJobs: 0,
        totalCandidates: 0,
        interviewsToday: 0,
        aiMatches: 0,
        readyForSubmission: 0,
        heatmaps: [],
      });
    }

    const orgId = req.query?.orgId || "";
    const queryUserId = req.query?.userId || "";
    const queryRole = req.query?.role || "guest";
    const userId = queryUserId || req.user?.uid || "";
    const userRole =
      queryRole !== "guest" ? queryRole : req.user?.role || "guest";
    let verifiedOrgId = orgId;

    // Security check to prevent Analytics Isolation Bypass
    if (userId) {
      const userDoc = await adminDb.collection("users").doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        const role = userData?.role || "guest";
        const isAdmin =
          role === "admin" ||
          role === "super_admin" ||
          role === "ops_admin" ||
          role === "hq_admin" ||
          userData?.organizationId === "ORG-GLOBAL-HQ";

        if (!isAdmin) {
          verifiedOrgId = userData?.organizationId;
          if (orgId && orgId !== verifiedOrgId) {
            console.warn(
              `[SECURITY] User ${userId} attempted to access analytics for org ${orgId} but belongs to ${verifiedOrgId}`,
            );
            return res.status(403).json({
              error: "Access Denied: Analytics Domain Isolation Violation",
            });
          }
        }
      }
    }

    if (apiPath === "client") {
      const cacheKey = `analytics_client_${orgId || 'no_org'}_${userId || 'no_user'}`;
      const metrics = await getCachedAnalytics(cacheKey, async () => {

      // Query jobs
      const reqsSnap = await adminDb
        .collection("requirements_public")
        .where("clientId", "==", verifiedOrgId || "UNKNOWN")
        .get();
      const subsSnap = await adminDb
        .collection("submissions")
        .where("clientId", "==", verifiedOrgId || "UNKNOWN")
        .get();

      let totalSpend = 0;
      let activeReqs = reqsSnap.docs.length; // Count all client requirements

      reqsSnap.docs.forEach((d: any) => {
        const data = d.data();
        if (data.financials) {
          totalSpend += Number(data.financials.clientBudget) || 0;
        } else if (data.vendorVisibleBudget) {
          totalSpend += Number(data.vendorVisibleBudget) || 0;
        } else if (data.budget?.amount) {
          totalSpend += Number(data.budget.amount) || 0;
        }
      });

      let pendingReview = 0;
      let interviews = 0;
      let placements = 0;

      subsSnap.docs.forEach((d: any) => {
        const data = d.data();
        if (data.status === "DELETED" || data.isActive === false) return;
        const status = (data.status || "").toUpperCase();
        if (
          status === "SUBMITTED" ||
          status === "REVIEW_PENDING" ||
          status === "PENDING"
        )
          pendingReview++;
        if (status.includes("INTERVIEW") || status === "SHORTLISTED")
          interviews++;
        if (
          [
            "OFFER_RELEASED",
            "OFFER_ACCEPTED",
            "ONBOARDED",
            "HIRED",
            "PLACED",
          ].includes(status)
        )
          placements++;
      });

      return {
        spending: totalSpend,
        totalJobs: activeReqs, // Represents "Active Requirements"
        openJobs: activeReqs,
        totalCandidates: pendingReview, // Represents "Pending Review" on Client Dash
        interviewsToday: interviews, // Represents "Interviews Scheduled"
        placements: placements,
      };
      });
      return res.status(200).json(metrics);
    }

    if (apiPath === "vendor") {
      const cacheKey = `analytics_vendor_${orgId || 'no_org'}_${userId || 'no_user'}`;
      const metrics = await getCachedAnalytics(cacheKey, async () => {

      const reqsSnapPublic = await adminDb
        .collection("requirements_public")
        .where("visibility", "==", "VENDOR_NETWORK")
        .where("status", "==", "PUBLISHED")
        .get();
      const reqsSnapAssigned = await adminDb
        .collection("requirements_public")
        .where(
          "assignedVendorIds",
          "array-contains",
          verifiedOrgId || "UNKNOWN",
        )
        .get();

      // Combine them using a Map to ensure distinct reqs
      const allocatedReqs = new Map();
      reqsSnapPublic.docs.forEach((d: any) =>
        allocatedReqs.set(d.id, d.data()),
      );
      reqsSnapAssigned.docs.forEach((d: any) =>
        allocatedReqs.set(d.id, d.data()),
      );

      const activeReqs = allocatedReqs.size;

      const candsSnap = await adminDb
        .collection("candidatePool")
        .where("vendorId", "==", verifiedOrgId || "UNKNOWN")
        .get();
      const subsSnap = await adminDb
        .collection("submissions")
        .where("vendorId", "==", verifiedOrgId || "UNKNOWN")
        .get();
      const matchesSnap = await adminDb
        .collection("candidate_matches")
        .where("vendorId", "==", verifiedOrgId || "UNKNOWN")
        .get();

      let revenue = 0;
      let interviews = 0;
      let placements = 0;
      let readyForSubmit = 0;

      const aiMatches = matchesSnap.docs.length;

      let activeSubs = 0;
      subsSnap.docs.forEach((d: any) => {
        const data = d.data();
        if (data.status === "DELETED" || data.isActive === false) return;
        activeSubs++;
        const status = (data.status || "").toUpperCase();
        if (status.includes("INTERVIEW") || status === "SHORTLISTED")
          interviews++;
        if (
          [
            "OFFER_RELEASED",
            "OFFER_ACCEPTED",
            "ONBOARDED",
            "HIRED",
            "PLACED",
          ].includes(status)
        ) {
          placements++;
          revenue +=
            Number(data.vendorPayout || data.financials?.vendorPayout) || 0;
        }
      });

      let activeCands = 0;
      candsSnap.docs.forEach((d: any) => {
        const data = d.data();
        if (data.status !== "DELETED" && data.isActive !== false) {
          activeCands++;
          const stage = (data.pipelineStage || "").toUpperCase();
          if (
            stage === "MATCHED" ||
            stage === "READY" ||
            stage === "AVAILABLE" ||
            stage === ""
          ) {
            readyForSubmit++;
          }
        }
      });

      // Also check ownerVendorId if different
      const ownerCandsSnap = await adminDb
        .collection("candidatePool")
        .where("ownerVendorId", "==", verifiedOrgId || "UNKNOWN")
        .get();
      ownerCandsSnap.docs.forEach((d: any) => {
        const data = d.data();
        if (
          data.status !== "DELETED" &&
          data.isActive !== false &&
          data.vendorId !== verifiedOrgId
        ) {
          activeCands++;
          const stage = (data.pipelineStage || "").toUpperCase();
          if (
            stage === "MATCHED" ||
            stage === "READY" ||
            stage === "AVAILABLE" ||
            stage === ""
          ) {
            readyForSubmit++;
          }
        }
      });

      const ownerSubsSnap = await adminDb
        .collection("submissions")
        .where("ownerVendorId", "==", verifiedOrgId || "UNKNOWN")
        .get();
      ownerSubsSnap.docs.forEach((d: any) => {
        const data = d.data();
        if (
          data.status === "DELETED" ||
          data.isActive === false ||
          data.vendorId === verifiedOrgId
        )
          return;
        activeSubs++;
        const status = (data.status || "").toUpperCase();
        if (status.includes("INTERVIEW") || status === "SHORTLISTED")
          interviews++;
        if (
          [
            "OFFER_RELEASED",
            "OFFER_ACCEPTED",
            "ONBOARDED",
            "HIRED",
            "PLACED",
          ].includes(status)
        ) {
          placements++;
          revenue +=
            Number(data.vendorPayout || data.financials?.vendorPayout) || 0;
        }
      });

      // We already computed activeReqs above
      let vendorAllocatedReqs = activeReqs;

      return {
        revenue: revenue,
        totalJobs: vendorAllocatedReqs, // Represents "Allocated Requirements" on Vendor Dash
        totalCandidates: activeCands, // Represents "Bench Candidates" on Vendor Dash
        interviewsToday: interviews, // Represents "Interviews Scheduled"
        activeDeals: activeSubs,
        placements: placements, // Represents "Active Placements"
        aiMatches: aiMatches,
        readyForSubmission: readyForSubmit,
      };
      });
      return res.status(200).json(metrics);
    }

    if (apiPath === "recruiter") {
      const cacheKey = `analytics_recruiter_${orgId || 'no_org'}_${userId || 'no_user'}`;
      const metrics = await getCachedAnalytics(cacheKey, async () => {

      const reqsSnap = await adminDb.collection("requirements_public").select("status", "financials").get();
      const candsSnap = await adminDb.collection("candidatePool").select("assignedRecruiterId", "uploaderId", "vendorId", "status").get();
      const subsSnap = await adminDb.collection("submissions").select("recruiterId", "vendorId", "status", "candidateId").get();

      let activeCandidates = 0;
      let pendingSubmissions = 0;
      let interviews = 0;
      let offers = 0;
      let placements = 0;
      let pendingFeedback = 0;

      candsSnap.docs.forEach((d: any) => {
        const data = d.data();
        const p =
          data.assignedRecruiterId ||
          data.uploaderId ||
          (data.vendorId === "ORG-GLOBAL-HQ" ? "ADMIN_HQ" : null);
        if (p === userId || p === "ADMIN_HQ") {
          activeCandidates++;
        }
      });

      subsSnap.docs.forEach((d: any) => {
        const data = d.data();
        const p = data.assignedRecruiterId || data.uploaderId || "ADMIN_HQ";
        if (p === userId || p === "ADMIN_HQ") {
          const status = (data.status || "").toUpperCase();
          if (status === "MATCHED" || status === "QUEUED") pendingSubmissions++;
          if (status.includes("INTERVIEW") || status === "SHORTLISTED")
            interviews++;
          if (["OFFER_RELEASED", "OFFER_ACCEPTED"].includes(status)) offers++;
          if (["ONBOARDED", "HIRED", "PLACED"].includes(status)) placements++;
          if (status === "SUBMITTED" || status.includes("INTERVIEW_ROUND"))
            pendingFeedback++;
        }
      });

      let activeReqs = 0;
      reqsSnap.docs.forEach((d: any) => {
        const data = d.data();
        if (data.status === "PUBLISHED" || data.status === "ACTIVE")
          activeReqs++;
      });

      return {
        totalJobs: activeReqs, // Represents "New Requirements"
        pendingSubmissions: pendingSubmissions,
        interviewsToday: interviews,
        pendingFeedback: pendingFeedback,

        activeCandidates: activeCandidates,
        actionQueue: interviews, // Represents "Interviewing"
        offers: offers,
        placements: placements,

        conversionRate:
          activeCandidates > 0
            ? Math.round((placements / activeCandidates) * 100)
            : 0,
        recruiterProductivity:
          activeCandidates > 0 ? (placements / activeCandidates) * 100 : 0,
      };
      });
      return res.status(200).json(metrics);
    }

    if (apiPath === "hq") {
      const cacheKey = `analytics_hq_${orgId || 'no_org'}_${userId || 'no_user'}`;
      const metrics = await getCachedAnalytics(cacheKey, async () => {

      const reqsSnap = await adminDb.collection("requirements_public").select("status", "financials").get();
      const candsSnap = await adminDb.collection("candidatePool").select("assignedRecruiterId", "uploaderId", "vendorId", "status").get();
      const subsSnap = await adminDb.collection("submissions").select("recruiterId", "vendorId", "status", "candidateId").get();

      let platformRevenue = 0;
      reqsSnap.docs.forEach((d: any) => {
        const data = d.data();
        if (data.financials) {
          platformRevenue += Number(data.financials.platformProfit) || 0;
        }
      });

      return {
        revenue: platformRevenue,
        totalJobs: reqsSnap.size,
        totalCandidates: candsSnap.size,
        activeDeals: subsSnap.size,
        placements: subsSnap.docs.filter(
          (d: any) =>
            d.data().status === "HIRED" || d.data().status === "PLACED",
        ).length,
      };
      });
      return res.status(200).json(metrics);
    }

    if (apiPath === "hq-production-health") {
      const cacheKey = `analytics_hq-production-health_${orgId || 'no_org'}_${userId || 'no_user'}`;
      const metrics = await getCachedAnalytics(cacheKey, async () => {

      if (
        userRole !== "admin" &&
        userRole !== "hq_admin" &&
        userRole !== "super_admin" &&
        userRole !== "ops_admin"
      ) {
        return res
          .status(403)
          .json({ error: "Access Denied. HQ Role required." });
      }

      const reqsSnap = await adminDb.collection("requirements_public").select("status", "financials").get();
      const candsSnap = await adminDb.collection("candidatePool").select("assignedRecruiterId", "uploaderId", "vendorId", "status").get();
      const subsSnap = await adminDb.collection("submissions").select("recruiterId", "vendorId", "status", "candidateId").get();

      const allReqs = reqsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const allCands = candsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const allSubs = subsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Requirement Integrity & Parity
      let parityHealthy = 0;
      let parityFailure = 0;
      let reqsNoMatches = 0;
      let reqsStale = 0;
      let healthyReqs = 0;

      const now = new Date();

      allReqs.forEach((r: any) => {
        const hasMatches = (r.matchesCount || 0) > 0;
        if (!hasMatches) reqsNoMatches++;

        const isStale = r.updatedAt
          ? now.getTime() - new Date(r.updatedAt).getTime() >
            7 * 24 * 60 * 60 * 1000
          : true;
        if (isStale && r.status === "PUBLISHED") reqsStale++;

        // Mock Parity Check (checking if match count anomalies exist)
        if (
          r.adminHQMatches === undefined ||
          r.adminHQMatches === r.matchesCount
        ) {
          parityHealthy++;
          if (hasMatches && !isStale) healthyReqs++;
        } else {
          parityFailure++;
        }
      });

      // Candidate Ledger
      let mappedCorrectly = 0;
      let orphaned = 0;
      let missingVendor = 0;

      allCands.forEach((c: any) => {
        if (!c.vendorId && !c.uploaderId) missingVendor++;
        if (c.canonicalRequirementId) {
          mappedCorrectly++;
        } else {
          orphaned++;
        }
      });

      // Submissions Health
      const submissionsByStatus = allSubs.reduce((acc: any, s: any) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
      }, {});

      const waiting48 = allSubs.filter(
        (s: any) =>
          s.updatedAt &&
          now.getTime() - new Date(s.updatedAt).getTime() >
            2 * 24 * 60 * 60 * 1000 &&
          ["SUBMITTED", "INTERVIEWING"].includes(s.status),
      ).length;
      const waiting7d = allSubs.filter(
        (s: any) =>
          s.updatedAt &&
          now.getTime() - new Date(s.updatedAt).getTime() >
            7 * 24 * 60 * 60 * 1000,
      ).length;

      return {
        integrity: {
          healthyReqs,
          parityHealthy,
          parityFailure,
          reqsNoMatches,
          reqsStale,
        },
        ledger: {
          totalCandidates: allCands.length,
          mappedCorrectly,
          orphaned,
          duplicate: 0, // Mock duplicates for now until vector deduplication
          missingVendor,
        },
        submissions: {
          submitted: submissionsByStatus["SUBMITTED"] || 0,
          interviewing: submissionsByStatus["INTERVIEWING"] || 0,
          offers: submissionsByStatus["OFFER"] || 0,
          placed:
            submissionsByStatus["PLACED"] || submissionsByStatus["HIRED"] || 0,
          waiting48,
          waiting7d,
        },
      };
      });
      return res.status(200).json(metrics);
    }

    if (apiPath === "hq-health") {
      const cacheKey = `analytics_hq-health_${orgId || 'no_org'}_${userId || 'no_user'}`;
      const metrics = await getCachedAnalytics(cacheKey, async () => {

      // Only accessible if role is 'admin', 'hq_admin', or 'super_admin'
      if (
        userRole !== "admin" &&
        userRole !== "hq_admin" &&
        userRole !== "super_admin" &&
        userRole !== "ops_admin"
      ) {
        return res
          .status(403)
          .json({ error: "Access Denied. HQ Role required." });
      }

      // Analytics aggregation snapshot
      const eventsSnap = await adminDb
        .collection("operationalEvents")
        .orderBy("timestamp", "desc")
        .limit(500)
        .get();

      const events = eventsSnap.docs.map((d) => d.data());

      const eventThroughput = eventsSnap.size;

      const failedAIParses = events.filter(
        (e) =>
          e.type === "CandidateEnriched" &&
          (e.metadata?.status?.includes("failed") ||
            e.metadata?.status?.includes("error")),
      ).length;
      const failedMatches = events.filter(
        (e) =>
          e.type === "CandidateMatched" &&
          (e.metadata?.status?.includes("failed") ||
            e.metadata?.status?.includes("error")),
      ).length;
      const submissionVelocity = events.filter((e) =>
        ["SubmissionCreated", "Submission"].includes(e.type),
      ).length;
      const dealRoomGrowth = events.filter(
        (e) => e.type === "DealRoomOpened",
      ).length;
      const systemErrors = events.filter(
        (e) =>
          e.metadata?.isError === true ||
          e.metadata?.status === "error" ||
          e.type?.includes("Error"),
      ).length;

      return {
        eventThroughput,
        failedAIParses,
        failedMatches,
        submissionVelocity,
        dealRoomGrowth,
        systemErrors,
        eventsAnalyzed: events.length,
      };
      });
      return res.status(200).json(metrics);
    }

    return res.status(404).json({ error: "Unknown analytics route" });
  } catch (err: any) {
    if (
      err.message &&
      (err.message.includes("UNAUTHENTICATED") ||
        err.message.includes("PERMISSION_DENIED"))
    ) {
      // Fallback for missing admin credentials (suppress loud error log)
      console.warn(
        "[ANALYTICS] Using fallback data due to missing admin credentials.",
      );
      return res.status(200).json({
        fallbackRequired: true,
        revenue: 0,
        spending: 0,
        activeDeals: 0,
        placements: 0,
        avgMargin: 0,
        vendorQuality: 0,
        recruiterProductivity: 0,
        totalJobs: 0,
        totalCandidates: 0,
        interviewsToday: 0,
        aiMatches: 0,
        readyForSubmission: 0,
        heatmaps: [],
      });
    }
    return res.status(500).json({ error: err.message });
  }
}
