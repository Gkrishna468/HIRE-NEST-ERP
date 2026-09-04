import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  getDocs,
  limit,
  where,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  addDoc,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  Star,
  Building2,
  Users,
  Briefcase,
  Zap,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Activity,
  Bot,
  FileCheck,
  History,
  UserCheck,
  RefreshCw,
  HelpCircle,
  Send,
  CheckCircle2,
  Plus,
  Search,
  Filter,
  ShieldCheck,
  Layers,
  SlidersHorizontal,
  Check,
  X,
  Sparkles,
} from "lucide-react";
import { useSystemStore } from "../stores/SystemStore";
import { ExplainableEvidenceCard } from "../components/ExplainableEvidenceCard";
import { cn } from "../lib/utils";
import { TimelineEvent } from "../components/LifecycleTimeline";
import HireNestLoader from "../components/HireNestLoader";
import {
  checkIsAdmin,
  checkIsClient,
  checkIsVendor,
  checkIsRecruiter,
  checkIsIndependent,
} from "../lib/permissions";
import { formatINR, formatCompactINR, formatBudget } from "../lib/currency";
import { CandidateMatchingService } from "../services/CandidateMatchingService";

/**
 * Dynamically computes criterion-level fitment matrix for a candidate and requirement.
 * Uses canonical candidate and requirement profile attributes without any hardcoded synthetic data.
 */
export const getOrInitializeMatrix = (match: any, req: any, cand?: any) => {
  if (
    match?.fitmentMatrix &&
    Array.isArray(match.fitmentMatrix) &&
    match.fitmentMatrix.length > 0
  ) {
    return {
      matrix: match.fitmentMatrix,
      recommendation:
        match.recommendation ||
        ((match.score || match.matchScore || 0) >= 80
          ? "PRIMARY"
          : (match.score || match.matchScore || 0) >= 60
            ? "BACKUP"
            : "HOLD"),
      hardGateStatus: match.hardGateStatus || "PASSED",
      hardGateReason: match.hardGateReason || undefined,
      screeningQuestions: match.screeningQuestions || [],
    };
  }

  // Evaluate dynamically using CandidateMatchingService fitment logic
  const candidateSkills: string[] = Array.isArray(cand?.skills)
    ? cand.skills
    : typeof cand?.skills === "string"
      ? cand.skills.split(",").map((s: string) => s.trim())
      : [];

  const requirementSkills: string[] = Array.isArray(req?.skills)
    ? req.skills
    : Array.isArray(req?.requiredSkills)
      ? req.requiredSkills
      : typeof req?.skills === "string"
        ? req.skills.split(",").map((s: string) => s.trim())
        : [];

  const candidateExp =
    typeof cand?.experienceYears === "number"
      ? cand.experienceYears
      : parseInt(
          cand?.experience || cand?.yearsOfExperience || cand?.exp || "0",
          10,
        ) || 0;

  const reqExpMin =
    parseInt(req?.minExperience || req?.experience || "0", 10) || 0;

  const fitment = CandidateMatchingService.evaluateFitment(
    {
      skills: candidateSkills,
      experienceYears: candidateExp,
      location: cand?.location || cand?.city || "",
      preferredWorkMode: cand?.preferredWorkMode || cand?.workMode || "",
    },
    {
      skills: requirementSkills,
      experience: req?.experience || req?.minExperience || "0",
      minExperience: req?.minExperience || "0",
      location: req?.location || req?.city || "",
      workMode: req?.workMode || "",
      mandatorySkills: req?.mandatorySkills || [],
    },
  );

  // Construct dynamic criterion-level mapping matrix
  const matrix: Array<{
    criterion: string;
    evidence: string;
    result: "STRONG" | "VALIDATE" | "GAP" | "OVERQUALIFIED";
  }> = [];

  // 1. Skill evaluation criteria
  if (requirementSkills.length > 0) {
    requirementSkills.forEach((skill) => {
      const isOverlap = fitment.skillsOverlap.some(
        (os) => os.toLowerCase() === skill.toLowerCase(),
      );
      if (isOverlap) {
        matrix.push({
          criterion: `Skill: ${skill}`,
          evidence: `Candidate profile confirms ${skill} competency in technical stack.`,
          result: "STRONG",
        });
      } else {
        matrix.push({
          criterion: `Skill: ${skill}`,
          evidence: `Skill "${skill}" not explicitly verified on candidate profile.`,
          result: "GAP",
        });
      }
    });
  } else {
    matrix.push({
      criterion: "Core Competency",
      evidence: "Candidate skills aligned with primary role objectives.",
      result: "STRONG",
    });
  }

  // 2. Experience criterion
  if (reqExpMin > 0) {
    if (candidateExp >= reqExpMin) {
      matrix.push({
        criterion: `Experience (${reqExpMin}+ Years Required)`,
        evidence: `Candidate has ${candidateExp} years verified professional experience.`,
        result:
          candidateExp > reqExpMin + 5 ? "OVERQUALIFIED" : "STRONG",
      });
    } else if (candidateExp >= Math.max(1, reqExpMin - 2)) {
      matrix.push({
        criterion: `Experience (${reqExpMin}+ Years Required)`,
        evidence: `Candidate has ${candidateExp} years experience. Close to required threshold.`,
        result: "VALIDATE",
      });
    } else {
      matrix.push({
        criterion: `Experience (${reqExpMin}+ Years Required)`,
        evidence: `Candidate profile indicates ${candidateExp} years experience (minimum ${reqExpMin} years requested).`,
        result: "GAP",
      });
    }
  }

  // 3. Location / Work Mode criterion
  const reqLoc = req?.location || req?.city || req?.workMode || "Flexible";
  const candLoc = cand?.location || cand?.city || "Flexible";
  matrix.push({
    criterion: `Work Mode & Location (${reqLoc})`,
    evidence: `Candidate current/preferred location: ${candLoc}.`,
    result:
      reqLoc.toLowerCase() === "remote" ||
      candLoc.toLowerCase().includes(reqLoc.toLowerCase()) ||
      reqLoc.toLowerCase().includes(candLoc.toLowerCase())
        ? "STRONG"
        : "VALIDATE",
  });

  // 4. Budget / CTC compatibility criterion
  const clientBilling =
    req?.financials?.clientBilling || req?.budgetMax || req?.budget || 0;
  const candidateCtc =
    cand?.expectedCtc || cand?.desiredRate || cand?.ctc || 0;
  if (clientBilling > 0 && candidateCtc > 0) {
    matrix.push({
      criterion: `Compensation Alignment (${formatINR(clientBilling)} max)`,
      evidence: `Candidate expected: ${formatINR(candidateCtc)}.`,
      result: candidateCtc <= clientBilling ? "STRONG" : "VALIDATE",
    });
  }

  // Dynamic screening questions for gaps
  const screeningQuestions: Array<{ criterion: string; question: string }> = [];
  fitment.missingSkills.forEach((skill) => {
    screeningQuestions.push({
      criterion: `Skill: ${skill}`,
      question: `Please detail your hands-on production experience with ${skill}, including specific projects and versions.`,
    });
  });

  if (screeningQuestions.length === 0) {
    screeningQuestions.push({
      criterion: "System Architecture",
      question:
        "Describe your most significant technical achievement or architecture challenge related to this stack.",
    });
  }

  const hardGateStatus =
    fitment.hardGateVerdict === "FAIL"
      ? "FAILED"
      : matrix.some((m) => m.result === "VALIDATE")
        ? "WARNING"
        : "PASSED";

  const score = match.score || match.matchScore || fitment.score;
  const recommendation =
    hardGateStatus === "FAILED"
      ? "HOLD"
      : score >= 80 && hardGateStatus === "PASSED"
        ? "PRIMARY"
        : score >= 60
          ? "BACKUP"
          : "HOLD";

  return {
    matrix,
    recommendation,
    hardGateStatus,
    hardGateReason: fitment.hardGateReason,
    screeningQuestions,
  };
};

export default function MatchIntelligenceTab() {
  const { userData } = useSystemStore();

  const [matches, setMatches] = useState<any[]>([]);
  const [requirements, setRequirements] = useState<Record<string, any>>({});
  const [candidates, setCandidates] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [scanProgress, setScanProgress] = useState<string>("");

  const [viewMode, setViewMode] = useState<"requirements" | "candidates">(
    "requirements",
  );
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<
    Record<string, "matrix" | "resume" | "evidence">
  >({});
  const [askCandidateCriterion, setAskCandidateCriterion] = useState<
    Record<string, string | null>
  >({});
  const [candidateAnswerText, setCandidateAnswerText] = useState<
    Record<string, string>
  >({});
  const [processingMatch, setProcessingMatch] = useState<string | null>(null);
  const [updatingResume, setUpdatingResume] = useState<string | null>(null);

  // Search & Filtering States
  const [searchTerm, setSearchTerm] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("ALL");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Notifications
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Manual Match Modal State
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualCandId, setManualCandId] = useState("");
  const [manualReqId, setManualReqId] = useState("");
  const [isSavingManualMatch, setIsSavingManualMatch] = useState(false);

  // Skill Verification Modal State
  const [skillVerificationModal, setSkillVerificationModal] = useState<{
    match: any;
    cand: any;
    criterion: string;
  } | null>(null);
  const [verificationForm, setVerificationForm] = useState({
    years: "",
    project: "",
    company: "",
    details: "",
  });

  // Role Scoping Resolution
  const userRole = userData?.role || "";
  const userOrgId =
    userData?.organizationId ||
    userData?.tenantId ||
    userData?.vendorId ||
    userData?.clientId ||
    "";

  const roleIsAdmin = checkIsAdmin(userRole, userOrgId);
  const roleIsVendor = checkIsVendor(userRole);
  const roleIsRecruiter = checkIsRecruiter(userRole);
  const roleIsClient = checkIsClient(userRole);
  const roleIsIndependent = checkIsIndependent(userRole);

  const isAuthorized =
    roleIsAdmin ||
    roleIsVendor ||
    roleIsRecruiter ||
    roleIsClient ||
    roleIsIndependent;

  // Auto-dismiss notification after 4 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Firestore Realtime Subscriptions with Scope Isolation
  useEffect(() => {
    if (!userData) return;
    setLoading(true);

    const orgId = userOrgId;

    // 1. Candidate Matches Subscription
    let matchQuery;
    if (roleIsAdmin) {
      // HQ Admins see enterprise-wide canonical matches
      matchQuery = query(collection(db, "candidate_matches"), limit(150));
    } else if (roleIsClient && orgId) {
      // Clients see matches for their organization's requisitions
      matchQuery = query(
        collection(db, "candidate_matches"),
        where("clientId", "==", orgId),
        limit(150),
      );
    } else if (roleIsVendor && orgId) {
      // Vendors see matches for their candidate bench
      matchQuery = query(
        collection(db, "candidate_matches"),
        where("vendorId", "==", orgId),
        limit(150),
      );
    } else {
      // Internal Recruiters & Independent Partners
      matchQuery = query(collection(db, "candidate_matches"), limit(150));
    }

    const unsubMatches = onSnapshot(
      matchQuery,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMatches(list);
        setLoading(false);
      },
      (err) => {
        console.warn(
          "[MatchIntelligence] Scoped candidate_matches subscription fallback:",
          err?.message,
        );
        // Fallback to broader query if index or compound filter requires setup
        const fallbackQuery = query(
          collection(db, "candidate_matches"),
          limit(100),
        );
        onSnapshot(fallbackQuery, (snap) => {
          setMatches(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        });
      },
    );

    // 2. Requirements Subscription
    let reqQuery;
    if (roleIsClient && orgId) {
      reqQuery = query(
        collection(db, "requirements_public"),
        where("clientId", "==", orgId),
        limit(100),
      );
    } else {
      reqQuery = query(collection(db, "requirements_public"), limit(100));
    }

    const unsubReqs = onSnapshot(
      reqQuery,
      (snap) => {
        const reqMap: Record<string, any> = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          if (
            !data.status ||
            (data.status !== "DELETED" && data.status !== "ARCHIVED")
          ) {
            reqMap[d.id] = { id: d.id, ...data };
          }
        });
        setRequirements(reqMap);
      },
      (err) => {
        console.warn("[MatchIntelligence] Requirements note:", err?.message);
      },
    );

    // 3. Candidate Pool Subscription
    let candQuery;
    if (roleIsVendor && orgId) {
      // Vendors subscribe primarily to their candidate pool
      candQuery = query(
        collection(db, "candidatePool"),
        where("vendorId", "==", orgId),
        limit(150),
      );
    } else {
      candQuery = query(collection(db, "candidatePool"), limit(150));
    }

    const unsubCands = onSnapshot(
      candQuery,
      (snap) => {
        const candMap: Record<string, any> = {};
        snap.docs.forEach((d) => {
          candMap[d.id] = { id: d.id, ...d.data() };
        });

        // If vendor query returned 0, load general pool to allow vendor discovery
        if (roleIsVendor && snap.docs.length === 0) {
          getDocs(query(collection(db, "candidatePool"), limit(100))).then(
            (fallbackSnap) => {
              const fallbackMap: Record<string, any> = {};
              fallbackSnap.docs.forEach((d) => {
                fallbackMap[d.id] = { id: d.id, ...d.data() };
              });
              setCandidates(fallbackMap);
            },
          );
        } else {
          setCandidates(candMap);
        }
      },
      (err) => {
        console.warn("[MatchIntelligence] CandidatePool note:", err?.message);
      },
    );

    return () => {
      unsubMatches();
      unsubReqs();
      unsubCands();
    };
  }, [userData, userOrgId, roleIsAdmin, roleIsClient, roleIsVendor]);

  // Deal Room Creation Handler
  const handleCreateDealRoom = async (match: any, req: any, cand: any) => {
    if (processingMatch) return;
    setProcessingMatch(match.id);
    try {
      const candidateName =
        cand?.name || cand?.candidateName || match.candidateName || "Candidate";
      const requirementTitle = req?.title || "Staffing Requisition";

      const roomData = {
        candidateId: match.candidateId,
        candidateName,
        candidateEmail: cand?.email || "",
        candidatePhone: cand?.phone || "",
        requirementId: match.requirementId,
        requirementTitle,
        clientId: req?.clientId || "CLIENT-ORG",
        vendorId: cand?.vendorId || match.vendorId || userOrgId || "DIRECT",
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        createdBy: userData?.displayName || userData?.name || "Recruiter",
        matchScore: match.score || match.matchScore || 0,
        expectedFee: match.expectedRevenue || 0,
        role: "Deal Sponsor",
      };

      await addDoc(collection(db, "dealRooms"), roomData);

      // Update canonical match status
      await updateDoc(doc(db, "candidate_matches", match.id), {
        status: "SUBMITTED",
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Update local state immediately
      setMatches((prev) =>
        prev.map((m) =>
          m.id === match.id ? { ...m, status: "SUBMITTED" } : m,
        ),
      );

      setNotification({
        type: "success",
        message: `Deal Room created for ${candidateName} against "${requirementTitle}".`,
      });
    } catch (e: any) {
      console.error("Failed to create deal room", e);
      setNotification({
        type: "error",
        message: `Error submitting to deal room: ${e.message}`,
      });
    } finally {
      setProcessingMatch(null);
    }
  };

  // Update match matrix in Firestore
  const handleUpdateMatchMatrix = async (
    matchId: string,
    updatedFields: any,
  ) => {
    try {
      await updateDoc(doc(db, "candidate_matches", matchId), {
        ...updatedFields,
        updatedAt: new Date().toISOString(),
      });
      setMatches((prev) =>
        prev.map((m) => (m.id === matchId ? { ...m, ...updatedFields } : m)),
      );
    } catch (e: any) {
      console.error("Failed to save match matrix updates", e);
      setNotification({
        type: "error",
        message: `Failed to update matrix: ${e.message}`,
      });
    }
  };

  // Open Skill Verification Modal
  const handleOpenVerificationModal = (
    match: any,
    cand: any,
    criterionName: string,
  ) => {
    setSkillVerificationModal({ match, cand, criterion: criterionName });
    setVerificationForm({ years: "", project: "", company: "", details: "" });
  };

  // Execute Skill Verification & Resume Enhancement
  const handleVerifyAndEnhanceResume = async () => {
    if (!skillVerificationModal) return;
    const { match, cand, criterion } = skillVerificationModal;
    const cleanCriterion = criterion.replace(/^Skill:\s*/i, "").trim();
    const evidenceNotes = `${verificationForm.years ? verificationForm.years + " yrs at " : ""}${verificationForm.company || "Direct Client"}${verificationForm.project ? " (" + verificationForm.project + ")" : ""}. ${verificationForm.details || "Verified through technical screening interview."}`;

    if (!cand || !cand.id) {
      setNotification({
        type: "error",
        message: "Candidate document ID is missing.",
      });
      return;
    }

    setUpdatingResume(criterion);
    setSkillVerificationModal(null);

    try {
      const updatedSkills = Array.from(
        new Set([...(cand.skills || []), cleanCriterion]),
      );

      const auditEntry = {
        originalResumeSnapshot:
          cand.resumeText ||
          cand.experienceReasoning ||
          "Original parsed profile",
        enhancedCriterion: cleanCriterion,
        evidenceSource: evidenceNotes,
        verifiedBy:
          userData?.displayName || userData?.name || "Recruiter Conductor",
        dateVerified: new Date().toISOString(),
        requirementId: match.requirementId,
        requirementTitle:
          requirements[match.requirementId]?.title || "Staffing Requisition",
      };

      const candRef = doc(db, "candidatePool", cand.id);
      await updateDoc(candRef, {
        skills: updatedSkills,
        resumeEnhancements: arrayUnion(auditEntry),
      });

      // Update match matrix dynamically
      const matrixState = getOrInitializeMatrix(
        match,
        requirements[match.requirementId],
        cand,
      );
      const updatedMatrix = matrixState.matrix.map((item: any) => {
        if (
          item.criterion.toLowerCase().includes(cleanCriterion.toLowerCase())
        ) {
          return {
            ...item,
            result: "STRONG",
            evidence: `Verified: ${evidenceNotes}`,
          };
        }
        return item;
      });

      const hasGap = updatedMatrix.some((m: any) => m.result === "GAP");
      const hasValidate = updatedMatrix.some(
        (m: any) => m.result === "VALIDATE",
      );
      let newRecommendation = "PRIMARY";
      if (hasGap) newRecommendation = "HOLD";
      else if (hasValidate) newRecommendation = "BACKUP";

      await handleUpdateMatchMatrix(match.id, {
        fitmentMatrix: updatedMatrix,
        recommendation: newRecommendation,
        hardGateStatus: hasGap ? "WARNING" : "PASSED",
      });

      setNotification({
        type: "success",
        message: `Successfully verified "${cleanCriterion}" and updated candidate audit profile.`,
      });
    } catch (e: any) {
      console.error("Failed to enhance resume", e);
      setNotification({
        type: "error",
        message: `Error enhancing resume: ${e.message}`,
      });
    } finally {
      setUpdatingResume(null);
    }
  };

  // Run Automated Match Scan (Dual engine: API + client fallback)
  const handleRunMatchScan = async () => {
    setLoading(true);
    setScanProgress("Scanning candidates and requirements for matches...");

    try {
      let scanSucceeded = false;

      // Try server-side scan first
      try {
        const response = await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "rescan-matches",
            orgId: userOrgId,
            role: userRole,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            scanSucceeded = true;
            setScanProgress(
              `Scan complete. ${data.matchUpdatesCount || "Pipeline"} matches processed.`,
            );
          }
        }
      } catch (apiErr) {
        console.info(
          "Admin API scan unavailable; initiating client-side matching engine...",
        );
      }

      // If server API wasn't available, run deterministic client matching
      if (!scanSucceeded) {
        const candList: any[] = Object.values(candidates);
        const reqList: any[] = Object.values(requirements);
        let createdCount = 0;

        for (const req of reqList.slice(0, 15)) {
          for (const cand of candList.slice(0, 20)) {
            const fit = CandidateMatchingService.evaluateFitment(
              {
                skills: cand.skills || [],
                experienceYears: cand.experienceYears || 0,
                location: cand.location || "",
                preferredWorkMode: cand.preferredWorkMode || "",
              },
              {
                skills: req.skills || req.requiredSkills || [],
                experience: req.experience || req.minExperience || "0",
                minExperience: req.minExperience || "0",
                location: req.location || "",
                workMode: req.workMode || "",
                mandatorySkills: req.mandatorySkills || [],
              },
            );

            if (fit.score >= 50 && fit.hardGateVerdict !== "FAIL") {
              const matchId = `${cand.id}_${req.id}`;
              const matrixObj = getOrInitializeMatrix(
                { score: fit.score, candidateId: cand.id, requirementId: req.id },
                req,
                cand,
              );

              const marginVal =
                (req.financials?.clientBilling || 0) *
                ((req.financials?.commissionPercent || 15) / 100);
              const expectedRev = Math.round(
                marginVal * (Math.min(95, fit.score * 0.5) / 100),
              );

              const matchPayload = {
                id: matchId,
                candidateId: cand.id,
                candidateName: cand.name || cand.candidateName || "Candidate",
                requirementId: req.id,
                requirementTitle: req.title || "Requirement",
                canonicalRequirementId: req.id,
                vendorId: cand.vendorId || userOrgId || "DIRECT",
                clientId: req.clientId || "CLIENT",
                orgId: userOrgId || "ORG-GLOBAL-HQ",
                score: fit.score,
                matchScore: fit.score,
                matchTier: fit.tier,
                matchSource: "AUTO",
                status: "DISCOVERED",
                placementProbability: Math.min(95, Math.round(fit.score * 0.5)),
                expectedRevenue: expectedRev,
                fitmentMatrix: matrixObj.matrix,
                recommendation: matrixObj.recommendation,
                hardGateStatus: matrixObj.hardGateStatus,
                hardGateReason: matrixObj.hardGateReason || null,
                strengths: fit.skillsOverlap,
                missingSkills: fit.missingSkills,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };

              await setDoc(doc(db, "candidate_matches", matchId), matchPayload, {
                merge: true,
              });
              createdCount++;
            }
          }
        }
        setScanProgress(`Scan complete. ${createdCount} matches synthesized.`);
      }

      setNotification({
        type: "success",
        message: "Match scan completed successfully.",
      });
    } catch (err: any) {
      console.error("Match scan error:", err);
      setNotification({
        type: "error",
        message: `Match scan failed: ${err.message}`,
      });
    } finally {
      setLoading(false);
      setScanProgress("");
    }
  };

  // Save Manual Match Record to canonical candidate_matches
  const handleSaveManualMatch = async () => {
    if (!manualCandId || !manualReqId) {
      setNotification({
        type: "error",
        message: "Please select both a candidate and an active requirement.",
      });
      return;
    }

    const cand = candidates[manualCandId];
    const req = requirements[manualReqId];

    if (!cand || !req) {
      setNotification({
        type: "error",
        message: "Selected candidate or requirement record could not be loaded.",
      });
      return;
    }

    setIsSavingManualMatch(true);
    try {
      const matchId = `${cand.id}_${req.id}`;
      const fit = CandidateMatchingService.evaluateFitment(
        {
          skills: cand.skills || [],
          experienceYears: cand.experienceYears || 0,
          location: cand.location || "",
          preferredWorkMode: cand.preferredWorkMode || "",
        },
        {
          skills: req.skills || req.requiredSkills || [],
          experience: req.experience || req.minExperience || "0",
          minExperience: req.minExperience || "0",
          location: req.location || "",
          workMode: req.workMode || "",
          mandatorySkills: req.mandatorySkills || [],
        },
      );

      const matrixObj = getOrInitializeMatrix(
        { score: fit.score, candidateId: cand.id, requirementId: req.id },
        req,
        cand,
      );

      const marginVal =
        (req.financials?.clientBilling || 0) *
        ((req.financials?.commissionPercent || 15) / 100);
      const expectedRev = Math.round(
        marginVal * (Math.min(95, fit.score * 0.5) / 100),
      );

      const matchPayload = {
        id: matchId,
        candidateId: cand.id,
        candidateName: cand.name || cand.candidateName || "Candidate",
        requirementId: req.id,
        requirementTitle: req.title || "Requirement",
        canonicalRequirementId: req.id,
        vendorId: cand.vendorId || userOrgId || "DIRECT",
        clientId: req.clientId || "CLIENT",
        orgId: userOrgId || "ORG-GLOBAL-HQ",
        score: fit.score,
        matchScore: fit.score,
        matchTier: fit.tier,
        matchSource: "MANUAL",
        status: "ACTIVE",
        matchedBy:
          userData?.displayName || userData?.name || userData?.email || "Recruiter",
        matchedByRole: userRole,
        placementProbability: Math.min(95, Math.round(fit.score * 0.5)),
        expectedRevenue: expectedRev,
        fitmentMatrix: matrixObj.matrix,
        recommendation: matrixObj.recommendation,
        hardGateStatus: matrixObj.hardGateStatus,
        hardGateReason: matrixObj.hardGateReason || null,
        strengths: fit.skillsOverlap,
        missingSkills: fit.missingSkills,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "candidate_matches", matchId), matchPayload, {
        merge: true,
      });

      setShowManualModal(false);
      setManualCandId("");
      setManualReqId("");
      setNotification({
        type: "success",
        message: `Manual match created for ${cand.name || "Candidate"} → ${req.title}.`,
      });
    } catch (e: any) {
      console.error("Error creating manual match:", e);
      setNotification({
        type: "error",
        message: `Failed to save manual match: ${e.message}`,
      });
    } finally {
      setIsSavingManualMatch(false);
    }
  };

  // Dynamic Live Fitment preview for manual match modal
  const liveFitmentPreview = useMemo(() => {
    if (!manualCandId || !manualReqId) return null;
    const cand = candidates[manualCandId];
    const req = requirements[manualReqId];
    if (!cand || !req) return null;

    const fit = CandidateMatchingService.evaluateFitment(
      {
        skills: cand.skills || [],
        experienceYears: cand.experienceYears || 0,
        location: cand.location || "",
        preferredWorkMode: cand.preferredWorkMode || "",
      },
      {
        skills: req.skills || req.requiredSkills || [],
        experience: req.experience || req.minExperience || "0",
        minExperience: req.minExperience || "0",
        location: req.location || "",
        workMode: req.workMode || "",
        mandatorySkills: req.mandatorySkills || [],
      },
    );

    return { fit, cand, req };
  }, [manualCandId, manualReqId, candidates, requirements]);

  // Filtered Matches
  const filteredMatches = useMemo(() => {
    return matches.filter((match) => {
      const cand = candidates[match.candidateId] || {};
      const req = requirements[match.requirementId] || {};

      const candName = (cand.name || cand.candidateName || "").toLowerCase();
      const reqTitle = (req.title || match.requirementTitle || "").toLowerCase();
      const matchStatus = (match.status || "DISCOVERED").toUpperCase();
      const matchTier = (match.matchTier || "STRONG").toUpperCase();
      const matchSource = (match.matchSource || "AUTO").toUpperCase();

      // Search term filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const candSkills = (cand.skills || []).join(" ").toLowerCase();
        const reqSkills = (req.skills || []).join(" ").toLowerCase();
        if (
          !candName.includes(term) &&
          !reqTitle.includes(term) &&
          !candSkills.includes(term) &&
          !reqSkills.includes(term)
        ) {
          return false;
        }
      }

      // Tier filter
      if (tierFilter !== "ALL" && matchTier !== tierFilter) {
        return false;
      }

      // Source filter
      if (sourceFilter !== "ALL" && matchSource !== sourceFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== "ALL" && matchStatus !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [matches, candidates, requirements, searchTerm, tierFilter, sourceFilter, statusFilter]);

  // Metric Aggregates
  const totalExpectedValue = useMemo(() => {
    return filteredMatches.reduce(
      (sum, m) => sum + (m.expectedRevenue || 0),
      0,
    );
  }, [filteredMatches]);

  const highConfidenceCount = useMemo(() => {
    return filteredMatches.filter(
      (m) => (m.score || m.matchScore || 0) >= 80,
    ).length;
  }, [filteredMatches]);

  const hardGatePassRate = useMemo(() => {
    if (filteredMatches.length === 0) return 100;
    const passed = filteredMatches.filter(
      (m) => (m.hardGateStatus || "PASSED") !== "FAILED",
    ).length;
    return Math.round((passed / filteredMatches.length) * 100);
  }, [filteredMatches]);

  // Unauthorized State (e.g. Unauthenticated or Candidate Role)
  if (!isAuthorized) {
    return (
      <div
        id="match-intel-restricted-container"
        className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in pb-24"
      >
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 max-w-2xl mx-auto text-center space-y-6 shadow-sm">
          <div className="mx-auto w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center border border-indigo-100">
            <Zap size={24} className="animate-pulse" />
          </div>
          <div className="space-y-2">
            <span
              id="restriction-badge"
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 tracking-wider uppercase"
            >
              Enterprise Staffing Workspace
            </span>
            <h1 className="text-xl font-bold text-slate-900">
              Staffing Partner Authorization Required
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              Match Intelligence is provisioned for verified Vendors, Recruiters,
              Client Hiring Managers, and Administrators. If your organization
              requires access, please contact your workspace administrator.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading && matches.length === 0) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex justify-center items-center h-64">
        <HireNestLoader
          label={scanProgress || "Loading match intelligence..."}
          size="md"
        />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in pb-24">
      {/* Toast Notification */}
      {notification && (
        <div
          className={cn(
            "p-3 rounded-xl text-xs font-bold flex items-center justify-between shadow-sm transition-all border",
            notification.type === "success" &&
              "bg-emerald-50 text-emerald-800 border-emerald-200",
            notification.type === "error" &&
              "bg-rose-50 text-rose-800 border-rose-200",
            notification.type === "info" &&
              "bg-indigo-50 text-indigo-800 border-indigo-200",
          )}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 size={16} className="text-emerald-600" />
            ) : (
              <AlertTriangle size={16} />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 ml-4"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header & Scoping Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <Star className="text-amber-500" size={24} />
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Match Intelligence
            </h1>
            {/* Scoping Badge */}
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
                roleIsAdmin && "bg-purple-50 text-purple-700 border-purple-200",
                roleIsVendor && "bg-emerald-50 text-emerald-700 border-emerald-200",
                roleIsRecruiter && "bg-indigo-50 text-indigo-700 border-indigo-200",
                roleIsClient && "bg-blue-50 text-blue-700 border-blue-200",
              )}
            >
              <ShieldCheck size={12} />
              {roleIsAdmin && "HQ Global Scope"}
              {roleIsVendor && `Vendor: ${userOrgId || "Partner Bench"}`}
              {roleIsRecruiter && `Recruiter: ${userOrgId || "Internal Org"}`}
              {roleIsClient && `Client: ${userOrgId || "Requisitions"}`}
            </span>
          </div>
          <p className="text-slate-500 font-medium text-xs max-w-2xl leading-relaxed">
            Autonomous staffing matching pipeline. Evaluate candidates against open
            requisitions with deterministic skill verification and revenue forecasting.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto">
          {/* Action: Create Manual Match */}
          <button
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 transition-colors"
          >
            <Plus size={14} />
            Create Manual Match
          </button>

          {/* Action: Run Match Scan */}
          <button
            onClick={handleRunMatchScan}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Run Match Scan
          </button>

          {/* View Mode Toggle: Requirements vs Candidates */}
          <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode("requirements")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                viewMode === "requirements"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-900",
              )}
            >
              By Requirement
            </button>
            <button
              onClick={() => setViewMode("candidates")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                viewMode === "candidates"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-900",
              )}
            >
              By Candidate
            </button>
          </div>
        </div>
      </div>

      {/* 4 Financial & Operational Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm relative overflow-hidden">
          <Zap
            className="absolute -right-3 -bottom-3 text-amber-500/10 pointer-events-none"
            size={70}
          />
          <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
            Active Matches
          </p>
          <p className="text-2xl font-black text-slate-900 mt-1">
            {filteredMatches.length}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Scoped to current workspace
          </p>
        </div>

        <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm relative overflow-hidden">
          <Sparkles
            className="absolute -right-3 -bottom-3 text-indigo-500/10 pointer-events-none"
            size={70}
          />
          <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
            High Confidence (≥80%)
          </p>
          <p className="text-2xl font-black text-slate-900 mt-1">
            {highConfidenceCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Ready for instant client submission
          </p>
        </div>

        <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm relative overflow-hidden">
          <TrendingUp
            className="absolute -right-3 -bottom-3 text-emerald-500/10 pointer-events-none"
            size={70}
          />
          <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
            Expected Value
          </p>
          <p className="text-2xl font-black text-slate-900 mt-1">
            {formatINR(totalExpectedValue)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Weighted placement revenue
          </p>
        </div>

        <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm relative overflow-hidden">
          <ShieldCheck
            className="absolute -right-3 -bottom-3 text-blue-500/10 pointer-events-none"
            size={70}
          />
          <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
            Hard Gate Pass Rate
          </p>
          <p className="text-2xl font-black text-slate-900 mt-1">
            {hardGatePassRate}%
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Compliant with core JD criteria
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search candidates, skills, or titles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {/* Tier Filter */}
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="text-xs py-1.5 px-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-600 focus:outline-none"
          >
            <option value="ALL">All Tiers</option>
            <option value="STRONG">Strong Fits</option>
            <option value="VALIDATABLE">Validatable</option>
            <option value="GAP">Gaps</option>
          </select>

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="text-xs py-1.5 px-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-600 focus:outline-none"
          >
            <option value="ALL">All Sources</option>
            <option value="AUTO">Automatic</option>
            <option value="MANUAL">Manual</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs py-1.5 px-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-600 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="DISCOVERED">Discovered</option>
            <option value="ACTIVE">Active</option>
            <option value="SUBMITTED">Submitted</option>
          </select>

          {(searchTerm ||
            tierFilter !== "ALL" ||
            sourceFilter !== "ALL" ||
            statusFilter !== "ALL") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setTierFilter("ALL");
                setSourceFilter("ALL");
                setStatusFilter("ALL");
              }}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Opportunity Pipeline Area */}
      {filteredMatches.length === 0 ? (
        <div className="bg-white border text-center py-20 rounded-2xl border-slate-200 shadow-sm p-6">
          <Zap className="mx-auto mb-3 text-slate-300" size={40} />
          <h2 className="text-base font-black text-slate-800 mb-1">
            No Matching Records In Current Scope
          </h2>
          <p className="text-xs font-medium text-slate-500 mb-5 max-w-md mx-auto">
            No matches found matching the current search or organizational filters.
            Run an automatic scan or create a manual pair to evaluate candidates.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setShowManualModal(true)}
              className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 hover:bg-indigo-100 transition-colors"
            >
              Create Manual Match
            </button>
            <button
              onClick={handleRunMatchScan}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors"
            >
              Run Match Scan
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {viewMode === "requirements" ? (
            /* ============================================================
               VIEW 1: GROUPED BY REQUIREMENT (Requirement -> Candidates)
               ============================================================ */
            <div className="space-y-6">
              {Array.from(
                new Set(filteredMatches.map((m) => m.requirementId)),
              ).map((reqId) => {
                const req = requirements[reqId];
                const groupMatches = filteredMatches.filter(
                  (m) => m.requirementId === reqId,
                );
                if (groupMatches.length === 0) return null;

                const clientBudgetStr = req?.financials?.clientBilling
                  ? formatINR(req.financials.clientBilling)
                  : req?.budgetMax
                    ? formatBudget(req.budgetMin || 0, req.budgetMax)
                    : "--";

                return (
                  <div
                    key={reqId}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
                  >
                    {/* Requirement Header Bar */}
                    <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-black text-slate-900">
                            {req?.title || reqId}
                          </h3>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                            {req?.clientId || "Enterprise Client"}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500">
                            Location: {req?.location || req?.workMode || "Remote"}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500">
                            Budget: {clientBudgetStr}
                          </span>
                        </div>
                        {req?.skills && (
                          <div className="flex items-center gap-1 mt-2 flex-wrap">
                            {(Array.isArray(req.skills)
                              ? req.skills
                              : [req.skills]
                            ).map((s: string, idx: number) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 bg-white border border-slate-200 text-slate-600 rounded text-[10px] font-medium"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-700">
                          {groupMatches.length} Candidate Match
                          {groupMatches.length > 1 ? "es" : ""}
                        </span>
                      </div>
                    </div>

                    {/* Matched Candidates Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50/40 border-b border-slate-200 text-left">
                          <tr>
                            <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              Candidate & Score
                            </th>
                            <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              Fit Profile
                            </th>
                            <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              Hard Gate
                            </th>
                            <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              Recommendation
                            </th>
                            <th className="px-4 py-2.5 text-right text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              Expected Value
                            </th>
                            <th className="px-4 py-2.5 text-right text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {groupMatches
                            .sort(
                              (a, b) =>
                                (b.score || b.matchScore || 0) -
                                (a.score || a.matchScore || 0),
                            )
                            .map((match) => {
                              const cand =
                                candidates[match.candidateId] || match;
                              return (
                                <MatchRow
                                  key={match.id}
                                  match={match}
                                  req={req}
                                  cand={cand}
                                  expandedMatch={expandedMatch}
                                  setExpandedMatch={setExpandedMatch}
                                  activeSubTab={activeSubTab}
                                  setActiveSubTab={setActiveSubTab}
                                  askCandidateCriterion={askCandidateCriterion}
                                  setAskCandidateCriterion={
                                    setAskCandidateCriterion
                                  }
                                  candidateAnswerText={candidateAnswerText}
                                  setCandidateAnswerText={
                                    setCandidateAnswerText
                                  }
                                  handleCreateDealRoom={handleCreateDealRoom}
                                  handleOpenVerificationModal={
                                    handleOpenVerificationModal
                                  }
                                  handleUpdateMatchMatrix={
                                    handleUpdateMatchMatrix
                                  }
                                  processingMatch={processingMatch}
                                  updatingResume={updatingResume}
                                  viewType="candidate-info"
                                  userData={userData}
                                  roleIsAdmin={roleIsAdmin}
                                />
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ============================================================
               VIEW 2: GROUPED BY CANDIDATE (Candidate -> Requirements)
               ============================================================ */
            <div className="space-y-6">
              {Array.from(
                new Set(filteredMatches.map((m) => m.candidateId)),
              ).map((candId) => {
                const cand = candidates[candId];
                const groupMatches = filteredMatches.filter(
                  (m) => m.candidateId === candId,
                );
                if (groupMatches.length === 0) return null;

                const candidateCtcStr = cand?.expectedCtc
                  ? formatINR(cand.expectedCtc)
                  : "--";

                return (
                  <div
                    key={candId}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
                  >
                    {/* Candidate Header Bar */}
                    <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-black text-slate-900">
                            {cand?.name || cand?.candidateName || candId}
                          </h3>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Vendor: {cand?.vendorId || "Direct Bench"}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500">
                            Exp: {cand?.experienceYears || 0} Years
                          </span>
                          <span className="text-[10px] font-bold text-slate-500">
                            Location: {cand?.location || "Flexible"}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500">
                            Expected CTC: {candidateCtcStr}
                          </span>
                        </div>
                        {cand?.skills && (
                          <div className="flex items-center gap-1 mt-2 flex-wrap">
                            {(Array.isArray(cand.skills)
                              ? cand.skills
                              : [cand.skills]
                            ).map((s: string, idx: number) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 bg-white border border-slate-200 text-slate-600 rounded text-[10px] font-medium"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-700">
                          {groupMatches.length} Matching Requisition
                          {groupMatches.length > 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    {/* Matched Requirements Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50/40 border-b border-slate-200 text-left">
                          <tr>
                            <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              Requirement & Score
                            </th>
                            <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              Fit Profile
                            </th>
                            <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              Hard Gate
                            </th>
                            <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              Recommendation
                            </th>
                            <th className="px-4 py-2.5 text-right text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              Expected Value
                            </th>
                            <th className="px-4 py-2.5 text-right text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {groupMatches
                            .sort(
                              (a, b) =>
                                (b.score || b.matchScore || 0) -
                                (a.score || a.matchScore || 0),
                            )
                            .map((match) => {
                              const req = requirements[match.requirementId];
                              return (
                                <MatchRow
                                  key={match.id}
                                  match={match}
                                  req={req}
                                  cand={cand}
                                  expandedMatch={expandedMatch}
                                  setExpandedMatch={setExpandedMatch}
                                  activeSubTab={activeSubTab}
                                  setActiveSubTab={setActiveSubTab}
                                  askCandidateCriterion={askCandidateCriterion}
                                  setAskCandidateCriterion={
                                    setAskCandidateCriterion
                                  }
                                  candidateAnswerText={candidateAnswerText}
                                  setCandidateAnswerText={
                                    setCandidateAnswerText
                                  }
                                  handleCreateDealRoom={handleCreateDealRoom}
                                  handleOpenVerificationModal={
                                    handleOpenVerificationModal
                                  }
                                  handleUpdateMatchMatrix={
                                    handleUpdateMatchMatrix
                                  }
                                  processingMatch={processingMatch}
                                  updatingResume={updatingResume}
                                  viewType="requirement-info"
                                  userData={userData}
                                  roleIsAdmin={roleIsAdmin}
                                />
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          MODAL 1: CREATE MANUAL MATCH
          ============================================================ */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Plus size={18} className="text-indigo-600" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Create Manual Match
                </h3>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <p className="text-xs text-slate-500">
                Pair any candidate in your talent pool with an open requisition.
                The engine evaluates fitment in real time and registers a
                canonical match record.
              </p>

              {/* Select Candidate */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Select Candidate
                </label>
                <select
                  value={manualCandId}
                  onChange={(e) => setManualCandId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  <option value="">-- Choose Candidate --</option>
                  {Object.values(candidates).map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.candidateName || c.id} (
                      {c.skills?.slice(0, 3).join(", ") || "No skills listed"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Requirement */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Select Requirement
                </label>
                <select
                  value={manualReqId}
                  onChange={(e) => setManualReqId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  <option value="">-- Choose Requirement --</option>
                  {Object.values(requirements).map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.title || r.id} — {r.clientId || "Client"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Fitment Preview */}
              {liveFitmentPreview && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-slate-900 uppercase">
                      Calculated Fitment Score
                    </span>
                    <span className="text-sm font-black text-indigo-600">
                      {liveFitmentPreview.fit.score}% (
                      {liveFitmentPreview.fit.tier})
                    </span>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Matched Skills ({liveFitmentPreview.fit.skillsOverlap.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {liveFitmentPreview.fit.skillsOverlap.map((s, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800"
                        >
                          ✓ {s}
                        </span>
                      ))}
                      {liveFitmentPreview.fit.skillsOverlap.length === 0 && (
                        <span className="text-[10px] text-slate-400 italic">
                          No direct skill matches detected
                        </span>
                      )}
                    </div>
                  </div>

                  {liveFitmentPreview.fit.missingSkills.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Missing Required Skills (
                        {liveFitmentPreview.fit.missingSkills.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {liveFitmentPreview.fit.missingSkills.map((s, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800"
                          >
                            ✗ {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-600">Hard Gate:</span>
                    <span
                      className={cn(
                        "font-black px-2 py-0.5 rounded text-[10px]",
                        liveFitmentPreview.fit.hardGateVerdict === "PASS"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800",
                      )}
                    >
                      {liveFitmentPreview.fit.hardGateVerdict}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => setShowManualModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveManualMatch}
                disabled={
                  !manualCandId || !manualReqId || isSavingManualMatch
                }
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {isSavingManualMatch ? "Registering..." : "Save Match to Pipeline"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 2: SKILL VERIFICATION & RESUME ENHANCEMENT
          ============================================================ */}
      {skillVerificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Verify & Enhance Resume
                </h3>
                <p className="text-[11px] text-slate-500">
                  Criterion:{" "}
                  <strong className="text-indigo-600">
                    {skillVerificationModal.criterion}
                  </strong>
                </p>
              </div>
              <button
                onClick={() => setSkillVerificationModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">
                  Years of Hands-on Experience
                </label>
                <input
                  type="text"
                  placeholder="e.g. 4"
                  value={verificationForm.years}
                  onChange={(e) =>
                    setVerificationForm((prev) => ({
                      ...prev,
                      years: e.target.value,
                    }))
                  }
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">
                  Company / Organization Where Applied
                </label>
                <input
                  type="text"
                  placeholder="e.g. Previous Tech Employer"
                  value={verificationForm.company}
                  onChange={(e) =>
                    setVerificationForm((prev) => ({
                      ...prev,
                      company: e.target.value,
                    }))
                  }
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">
                  Project Title or Architecture Area
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cloud Migration Core Engine"
                  value={verificationForm.project}
                  onChange={(e) =>
                    setVerificationForm((prev) => ({
                      ...prev,
                      project: e.target.value,
                    }))
                  }
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">
                  Verification Screening Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Candidate answered technical screening questions satisfactorily..."
                  value={verificationForm.details}
                  onChange={(e) =>
                    setVerificationForm((prev) => ({
                      ...prev,
                      details: e.target.value,
                    }))
                  }
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => setSkillVerificationModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyAndEnhanceResume}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors"
              >
                Commit & Add to Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Reusable row component for rendering each match record and its expanded accordion.
 */
interface MatchRowProps {
  key?: React.Key;
  match: any;
  req: any;
  cand: any;
  expandedMatch: string | null;
  setExpandedMatch: (id: string | null) => void;
  activeSubTab: Record<string, "matrix" | "resume" | "evidence">;
  setActiveSubTab: React.Dispatch<
    React.SetStateAction<Record<string, "matrix" | "resume" | "evidence">>
  >;
  askCandidateCriterion: Record<string, string | null>;
  setAskCandidateCriterion: React.Dispatch<
    React.SetStateAction<Record<string, string | null>>
  >;
  candidateAnswerText: Record<string, string>;
  setCandidateAnswerText: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  handleCreateDealRoom: (match: any, req: any, cand: any) => void;
  handleOpenVerificationModal: (
    match: any,
    cand: any,
    criterion: string,
  ) => void;
  handleUpdateMatchMatrix: (matchId: string, fields: any) => void;
  processingMatch: string | null;
  updatingResume: string | null;
  viewType: "candidate-info" | "requirement-info";
  userData: any;
  roleIsAdmin: boolean;
}

function MatchRow({
  match,
  req,
  cand,
  expandedMatch,
  setExpandedMatch,
  activeSubTab,
  setActiveSubTab,
  askCandidateCriterion,
  setAskCandidateCriterion,
  candidateAnswerText,
  setCandidateAnswerText,
  handleCreateDealRoom,
  handleOpenVerificationModal,
  handleUpdateMatchMatrix,
  processingMatch,
  updatingResume,
  viewType,
  userData,
  roleIsAdmin,
}: MatchRowProps) {
  const matchId = match.id;
  const isExpanded = expandedMatch === matchId;
  const subTab = activeSubTab[matchId] || "matrix";

  const rowMatrixState = getOrInitializeMatrix(match, req, cand);

  // Financial calculations using standard INR formatters
  const clientBilling = req?.financials?.clientBilling || 0;
  const commissionPercent = req?.financials?.commissionPercent || 15;
  const marginVal = clientBilling * (commissionPercent / 100);

  let revenueStr = "--";
  let expectedRevStr = "--";

  if (roleIsAdmin || userData?.role === "hq") {
    revenueStr = req?.financials ? formatINR(marginVal) : "--";
    expectedRevStr = match.expectedRevenue
      ? formatINR(match.expectedRevenue)
      : req?.financials
        ? formatINR(
            Math.round(
              marginVal * ((match.placementProbability || 50) / 100),
            ),
          )
        : "--";
  } else {
    // Vendor / Recruiter budget view
    const vendorBudget = clientBilling - marginVal;
    revenueStr = req?.financials ? formatINR(vendorBudget) : "--";
    expectedRevStr = match.expectedRevenue
      ? formatINR(match.expectedRevenue)
      : req?.financials
        ? formatINR(
            Math.round(
              vendorBudget * ((match.placementProbability || 50) / 100),
            ),
          )
        : "--";
  }

  const matchScore = match.score || match.matchScore || 0;
  const matchTier = match.matchTier || (matchScore >= 80 ? "STRONG" : matchScore >= 60 ? "VALIDATABLE" : "GAP");
  const matchSource = match.matchSource || "AUTO";
  const placementProb = match.placementProbability || Math.min(95, Math.round(matchScore * 0.5));

  return (
    <React.Fragment key={matchId}>
      <tr
        className={cn(
          "hover:bg-slate-50/70 transition-colors cursor-pointer text-xs",
          isExpanded && "bg-slate-50",
        )}
        onClick={() => setExpandedMatch(isExpanded ? null : matchId)}
      >
        {/* Column 1: Status */}
        <td className="px-4 py-3 w-28">
          <span
            className={cn(
              "inline-flex items-center font-black px-2 py-0.5 rounded text-[9px] tracking-wider uppercase border",
              match.status === "SUBMITTED"
                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                : match.status === "ACTIVE"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-slate-100 text-slate-600 border-slate-200",
            )}
          >
            {match.status || "DISCOVERED"}
          </span>
        </td>

        {/* Column 2: Entity & Score */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <p className="font-bold text-slate-900 text-xs">
              {viewType === "candidate-info"
                ? cand?.name || cand?.candidateName || match.candidateName || match.candidateId
                : req?.title || match.requirementTitle || match.requirementId}
            </p>
            {isExpanded ? (
              <ChevronUp size={14} className="text-slate-400" />
            ) : (
              <ChevronDown size={14} className="text-slate-400" />
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="font-black text-indigo-600 text-[10px] uppercase">
              {matchScore}% MATCH
            </span>
            <span
              className={cn(
                "px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider",
                matchTier === "STRONG" && "bg-emerald-100 text-emerald-800",
                matchTier === "VALIDATABLE" && "bg-amber-100 text-amber-800",
                matchTier === "GAP" && "bg-rose-100 text-rose-800",
              )}
            >
              {matchTier}
            </span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-500 uppercase">
              {matchSource}
            </span>
          </div>
        </td>

        {/* Column 3: Fit Profile Progress */}
        <td className="px-4 py-3 text-left w-36">
          <div className="flex items-center gap-2">
            <div className="w-full bg-slate-200 rounded-full h-1.5 max-w-[60px]">
              <div
                className="bg-emerald-500 h-1.5 rounded-full"
                style={{ width: `${placementProb}%` }}
              ></div>
            </div>
            <span className="text-[11px] font-bold text-slate-700">
              {placementProb}%
            </span>
          </div>
        </td>

        {/* Column 4: Hard Gate */}
        <td className="px-4 py-3 text-left">
          <span
            className={cn(
              "inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-[10px] border",
              rowMatrixState.hardGateStatus === "PASSED" &&
                "bg-emerald-50 text-emerald-700 border-emerald-200",
              rowMatrixState.hardGateStatus === "WARNING" &&
                "bg-amber-50 text-amber-700 border-amber-200",
              rowMatrixState.hardGateStatus === "FAILED" &&
                "bg-rose-50 text-rose-700 border-rose-200",
            )}
          >
            {rowMatrixState.hardGateStatus === "PASSED"
              ? "✅ Passed"
              : rowMatrixState.hardGateStatus === "WARNING"
                ? "⚠️ Warning"
                : "❌ Failed"}
          </span>
        </td>

        {/* Column 5: Recommendation */}
        <td className="px-4 py-3 text-left">
          <span
            className={cn(
              "inline-flex items-center font-black px-2.5 py-0.5 rounded text-[9px] tracking-wider uppercase",
              rowMatrixState.recommendation === "PRIMARY" &&
                "bg-emerald-100 text-emerald-800",
              rowMatrixState.recommendation === "BACKUP" &&
                "bg-amber-100 text-amber-800",
              rowMatrixState.recommendation === "HOLD" &&
                "bg-rose-100 text-rose-800",
            )}
          >
            {rowMatrixState.recommendation}
          </span>
        </td>

        {/* Column 6: Expected Value */}
        <td className="px-4 py-3 text-right w-44">
          <p className="font-mono text-xs font-black text-slate-900">
            {expectedRevStr}
          </p>
          <p className="text-[9px] uppercase font-bold text-slate-400">
            Mgn: {revenueStr}
          </p>
        </td>

        {/* Column 7: Action */}
        <td className="px-4 py-3 text-right w-32">
          {match.status !== "SUBMITTED" ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCreateDealRoom(match, req, cand);
              }}
              disabled={processingMatch === matchId}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
            >
              {processingMatch === matchId ? "Submitting..." : "Submit"}
            </button>
          ) : (
            <span className="text-[10px] font-bold text-emerald-600">
              ✓ In Deal Room
            </span>
          )}
        </td>
      </tr>

      {/* Expanded Accordion: Fitment Matrix & Verification */}
      {isExpanded && (
        <tr>
          <td
            colSpan={7}
            className="px-4 py-4 bg-slate-50 border-t border-slate-200"
          >
            <div className="max-w-5xl mx-auto bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              {/* Sub-tab Headers */}
              <div className="flex border-b border-slate-200 bg-slate-50/70 p-1 gap-1">
                <button
                  onClick={() =>
                    setActiveSubTab((prev) => ({
                      ...prev,
                      [matchId]: "matrix",
                    }))
                  }
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all",
                    subTab === "matrix"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-900",
                  )}
                >
                  <UserCheck size={14} />
                  Fitment Matrix & Verification
                </button>
                <button
                  onClick={() =>
                    setActiveSubTab((prev) => ({
                      ...prev,
                      [matchId]: "resume",
                    }))
                  }
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all",
                    subTab === "resume"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-900",
                  )}
                >
                  <FileCheck size={14} />
                  Resume Enhancement
                </button>
                <button
                  onClick={() =>
                    setActiveSubTab((prev) => ({
                      ...prev,
                      [matchId]: "evidence",
                    }))
                  }
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all",
                    subTab === "evidence"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-900",
                  )}
                >
                  <Bot size={14} />
                  Explainable Evidence Graph
                </button>
              </div>

              <div className="p-5 space-y-6">
                {/* TAB 1: FITMENT MATRIX */}
                {subTab === "matrix" && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                          Criterion-Level Fitment Breakdown
                        </h4>
                        <span
                          className={cn(
                            "px-2.5 py-0.5 rounded text-[10px] font-black uppercase",
                            rowMatrixState.recommendation === "PRIMARY" &&
                              "bg-emerald-100 text-emerald-800",
                            rowMatrixState.recommendation === "BACKUP" &&
                              "bg-amber-100 text-amber-800",
                            rowMatrixState.recommendation === "HOLD" &&
                              "bg-rose-100 text-rose-800",
                          )}
                        >
                          Rec: {rowMatrixState.recommendation}
                        </span>
                      </div>

                      <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                        {rowMatrixState.matrix.map((row: any, idx: number) => (
                          <div
                            key={idx}
                            className="grid grid-cols-12 gap-3 p-3 hover:bg-slate-50/50 transition-colors items-center text-xs"
                          >
                            <div className="col-span-4 font-bold text-slate-800">
                              {row.criterion}
                            </div>
                            <div className="col-span-5 text-slate-500 italic text-[11px]">
                              {row.evidence}
                            </div>
                            <div className="col-span-3 flex justify-end items-center gap-2">
                              <span
                                className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase border",
                                  row.result === "STRONG" &&
                                    "bg-emerald-50 text-emerald-700 border-emerald-200",
                                  row.result === "VALIDATE" &&
                                    "bg-amber-50 text-amber-700 border-amber-200",
                                  row.result === "GAP" &&
                                    "bg-rose-50 text-rose-700 border-rose-200",
                                  row.result === "OVERQUALIFIED" &&
                                    "bg-purple-50 text-purple-700 border-purple-200",
                                )}
                              >
                                {row.result}
                              </span>
                              {row.result === "VALIDATE" && (
                                <button
                                  onClick={() =>
                                    setAskCandidateCriterion((prev) => ({
                                      ...prev,
                                      [matchId]: row.criterion,
                                    }))
                                  }
                                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline"
                                >
                                  Ask
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Candidate Verification / Q&A Panel */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between min-h-[320px]">
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <HelpCircle className="text-indigo-500" size={16} />
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                            Candidate Verification
                          </h4>
                        </div>

                        {askCandidateCriterion[matchId] ? (
                          <div className="space-y-3">
                            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                              <p className="text-[9px] font-black text-slate-400 uppercase">
                                Target Criterion
                              </p>
                              <p className="text-xs font-bold text-slate-800 mt-0.5">
                                {askCandidateCriterion[matchId]}
                              </p>
                            </div>

                            <div className="bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
                              <p className="text-[9px] font-black text-indigo-500 uppercase mb-0.5">
                                AI Screening Question
                              </p>
                              <p className="text-xs text-indigo-950 font-medium leading-relaxed">
                                {rowMatrixState.screeningQuestions.find(
                                  (q: any) =>
                                    q.criterion ===
                                    askCandidateCriterion[matchId],
                                )?.question ||
                                  `Please describe your hands-on experience and recent projects involving ${askCandidateCriterion[matchId]}.`}
                              </p>
                            </div>

                            <div>
                              <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">
                                Recruiter / Candidate Notes
                              </label>
                              <textarea
                                rows={3}
                                value={candidateAnswerText[matchId] || ""}
                                onChange={(e) =>
                                  setCandidateAnswerText((prev) => ({
                                    ...prev,
                                    [matchId]: e.target.value,
                                  }))
                                }
                                placeholder="Enter candidate's verified response..."
                                className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-12 text-slate-400">
                            <Bot
                              className="mx-auto mb-2 text-slate-300"
                              size={24}
                            />
                            <p className="text-xs font-medium">
                              Select a criterion with{" "}
                              <span className="font-bold text-amber-600">
                                VALIDATE
                              </span>{" "}
                              status to trigger screening questions.
                            </p>
                          </div>
                        )}
                      </div>

                      {askCandidateCriterion[matchId] && (
                        <div className="mt-3 pt-3 border-t border-slate-200 flex gap-2">
                          <button
                            onClick={() =>
                              setAskCandidateCriterion((prev) => ({
                                ...prev,
                                [matchId]: null,
                              }))
                            }
                            className="w-1/2 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={async () => {
                              const criterion = askCandidateCriterion[matchId];
                              const answer = candidateAnswerText[matchId];
                              if (!criterion) return;

                              const updatedMatrix = rowMatrixState.matrix.map(
                                (m: any) => {
                                  if (m.criterion === criterion) {
                                    return {
                                      ...m,
                                      result: "STRONG",
                                      evidence: `Verified: ${answer || "Confirmed directly in recruiter screening."}`,
                                    };
                                  }
                                  return m;
                                },
                              );

                              const hasGap = updatedMatrix.some(
                                (m: any) => m.result === "GAP",
                              );
                              const hasValidate = updatedMatrix.some(
                                (m: any) => m.result === "VALIDATE",
                              );
                              let newRec = "PRIMARY";
                              if (hasGap) newRec = "HOLD";
                              else if (hasValidate) newRec = "BACKUP";

                              await handleUpdateMatchMatrix(matchId, {
                                fitmentMatrix: updatedMatrix,
                                recommendation: newRec,
                                hardGateStatus: hasGap ? "WARNING" : "PASSED",
                              });

                              setAskCandidateCriterion((prev) => ({
                                ...prev,
                                [matchId]: null,
                              }));
                            }}
                            className="w-1/2 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                          >
                            Confirm Verified
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 2: RESUME ENHANCEMENT */}
                {subTab === "resume" && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="border border-slate-200 rounded-xl p-5 space-y-4">
                      <div>
                        <h5 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <FileCheck size={16} className="text-indigo-600" />
                          Target Gaps & Validatable Qualifications
                        </h5>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Verify missing qualifications with candidate to commit
                          structured credentials to their talent profile.
                        </p>
                      </div>

                      <div className="divide-y divide-slate-100 max-h-[260px] overflow-y-auto pr-1">
                        {rowMatrixState.matrix
                          .filter(
                            (item: any) =>
                              item.result === "VALIDATE" ||
                              item.result === "GAP",
                          )
                          .map((item: any, i: number) => (
                            <div
                              key={i}
                              className="py-3 flex items-center justify-between gap-3 text-xs"
                            >
                              <div>
                                <p className="font-bold text-slate-800">
                                  {item.criterion}
                                </p>
                                <p className="text-[10px] text-slate-400 italic">
                                  {item.evidence}
                                </p>
                              </div>
                              <button
                                disabled={updatingResume === item.criterion}
                                onClick={() =>
                                  handleOpenVerificationModal(
                                    match,
                                    cand,
                                    item.criterion,
                                  )
                                }
                                className="px-2.5 py-1 text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap"
                              >
                                {updatingResume === item.criterion
                                  ? "Saving..."
                                  : "✓ Verify & Add"}
                              </button>
                            </div>
                          ))}
                        {rowMatrixState.matrix.filter(
                          (item: any) =>
                            item.result === "VALIDATE" ||
                            item.result === "GAP",
                        ).length === 0 && (
                          <div className="py-8 text-center text-slate-400 text-xs">
                            All target criteria have been verified for this
                            candidate.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl p-5 space-y-4">
                      <h5 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <History size={16} className="text-indigo-600" />
                        Enhancement Audit Trail
                      </h5>

                      <div className="divide-y divide-slate-100 max-h-[260px] overflow-y-auto pr-1 space-y-2">
                        {cand?.resumeEnhancements &&
                        cand.resumeEnhancements.length > 0 ? (
                          cand.resumeEnhancements.map(
                            (log: any, idx: number) => (
                              <div key={idx} className="pt-2 text-xs space-y-1">
                                <div className="flex justify-between items-start">
                                  <span className="font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                                    {log.enhancedCriterion}
                                  </span>
                                  <span className="text-[9px] text-slate-400">
                                    {new Date(
                                      log.dateVerified,
                                    ).toLocaleDateString()}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-600 leading-normal">
                                  <strong className="text-slate-700">
                                    Evidence:
                                  </strong>{" "}
                                  {log.evidenceSource}
                                </p>
                                <div className="flex justify-between items-center text-[9px] text-slate-400 pt-0.5">
                                  <span>Verified by: {log.verifiedBy}</span>
                                  <span>Ref JD: {log.requirementTitle}</span>
                                </div>
                              </div>
                            ),
                          )
                        ) : (
                          <div className="py-10 text-center text-slate-400 text-xs">
                            No manual enhancements recorded yet. Use "Verify &
                            Add" to document verified credentials.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: EXPLAINABLE EVIDENCE GRAPH */}
                {subTab === "evidence" && (
                  <div className="max-w-3xl mx-auto">
                    <ExplainableEvidenceCard
                      isDark={false}
                      evidence={{
                        id: matchId,
                        decision: `Autonomous Recommendation: Match candidate to ${req?.title || "Requisition"}`,
                        confidence: matchScore,
                        graphNodes: match.graphNodes || [
                          "SKILLS",
                          "EXPERIENCE",
                          "LOCATION",
                          "CTC",
                        ],
                        experiences: match.experienceReasoning
                          ? [match.experienceReasoning]
                          : [
                              `Candidate has ${cand?.experienceYears || 0} years domain tenure`,
                              `Skill overlap: ${rowMatrixState.matrix.filter((m: any) => m.result === "STRONG").length} verified criteria`,
                            ],
                        decisionFactors: match.factors || [
                          "Deterministic Skill Mapping",
                          "Hard Gate Verification",
                          "CTC Compatibility",
                        ],
                        telemetrySnapshot: [
                          "Canonical Engine: CandidateMatchingService",
                          `Source: ${matchSource}`,
                          `Hard Gate: ${rowMatrixState.hardGateStatus}`,
                        ],
                        entityType: "candidate_match",
                        entityId: matchId,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}
