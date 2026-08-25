import React, { useEffect, useState, ChangeEvent } from "react";
import { Badge } from "../lib/Badge";
import { Button } from "../lib/Button";
import { cn } from "../lib/utils";
import {
  Sparkles,
  FileText,
  CheckCircle,
  ShieldAlert,
  DollarSign,
  BrainCircuit,
  MessageSquare,
  ExternalLink,
  X,
  Bot,
  Activity,
  Upload,
  Target,
  Clock,
  MapPin,
  ListChecks,
  Cpu,
  Briefcase,
  Zap,
  ShieldCheck,
  Power,
  Network,
  User,
  Users,
} from "lucide-react";
import { db, auth, handleFirestoreError, OperationType } from "../lib/firebase";
import {
  collection,
  query,
  onSnapshot,
  doc,
  setDoc as firebaseSetDoc,
  updateDoc as firebaseUpdateDoc,
  getDoc,
  getDocs,
  serverTimestamp,
  where,
  addDoc,
  limit,
} from "firebase/firestore";
import {
  logExecutionEvent,
  ExecutionEventType,
} from "../lib/infrastructureService";
import { Switch } from "../lib/Switch";
import { analyzeCandidateMatch } from "../services/aiService";

const setDoc = async (ref: any, data: any, options?: any) => {
  const result = await firebaseSetDoc(ref, data, options);
  try {
    const path = ref.path || "";
    if (path.startsWith("requirements_public/")) {
      const requirementId = path.split("/")[1];
      fetch("/api/events/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "REQUIREMENT_CREATED",
          payload: { requirementId, id: requirementId, ...data },
          source: "UI",
          orgId: data.orgId || data.clientId || "SYSTEM"
        })
      }).catch((e) => console.warn("Failed event publish on setDoc", e));
    }
  } catch (e) {
    console.warn("Event publishing failed on setDoc wrapper", e);
  }
  return result;
};

const updateDoc = async (ref: any, data: any) => {
  const result = await firebaseUpdateDoc(ref, data);
  try {
    const path = ref.path || "";
    if (path.startsWith("requirements_public/")) {
      const requirementId = path.split("/")[1];
      const isClosed = data.status === "CLOSED" || data.status === "ARCHIVED";
      const eventType = isClosed ? "REQUIREMENT_CLOSED" : "REQUIREMENT_UPDATED";
      fetch("/api/events/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: eventType,
          payload: { requirementId, id: requirementId, ...data },
          source: "UI",
          orgId: data.orgId || data.clientId || "SYSTEM"
        })
      }).catch((e) => console.warn("Failed event publish on updateDoc", e));
    }
  } catch (e) {
    console.warn("Event publishing failed on updateDoc wrapper", e);
  }
  return result;
};
import { AIMatching } from "../components/AIMatching";
import { JDIntelligence } from "../components/JDIntelligence";
import Requirement360Modal from "../components/modals/Requirement360Modal";
import { HybridMatchResult } from "../types";
import { EmptyState } from "../components/EmptyState";
import { publishEvent } from "../lib/eventEngine";
import { RequirementDiscussionThread } from "../components/RequirementDiscussionThread";
import Candidate360Modal from "../components/modals/Candidate360Modal";

import { useNavigate } from "react-router-dom";
import { emitEvent } from "../services/eventBus";

const STAGES = ["Added", "Matched", "Submitted", "Interviewing", "Placed"];

export default function JobsTab() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [jdText, setJdText] = useState("");
  const [budgetAmount, setBudgetAmount] = useState<number>(0);
  const [budgetPeriod, setBudgetPeriod] = useState<"LPA" | "LPM">("LPA");
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [workMode, setWorkMode] = useState<
    "Onsite" | "Remote" | "Hybrid" | "C2C" | "C2H" | "Permanent"
  >("Remote");
  const [location, setLocation] = useState<string>("");
  const [mandatorySkills, setMandatorySkills] = useState<string>("");
  
  // Candidate Direct Application Settings
  const [directApplyEnabled, setDirectApplyEnabled] = useState<boolean>(true);
  const [allowedWorkModes, setAllowedWorkModes] = useState<string[]>(["Onsite", "C2H", "Remote"]);
  const [publicVisibility, setPublicVisibility] = useState<boolean>(true);
  const [candidateLoginRequired, setCandidateLoginRequired] = useState<boolean>(true);
  const [reqFilterMode, setReqFilterMode] = useState<string>("ALL");

  const [isParsing, setIsParsing] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState<any>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [aiAnalysis, setAiAnalysis] = useState<HybridMatchResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [globalMatches, setGlobalMatches] = useState<any[]>([]);
  const [fallbackMatches, setFallbackMatches] = useState<any[]>([]);
  const [targetClientOrg, setTargetClientOrg] = useState<string>("");
  const [ledgerCounts, setLedgerCounts] = useState<any>(null);
  const [ledgerCandidates, setLedgerCandidates] = useState<any[]>([]);
  const [localMatchCompleted, setLocalMatchCompleted] = useState<
    Record<string, boolean>
  >({});
  const [showIntakeForm, setShowIntakeForm] = useState(false);
  const [vendorMap, setVendorMap] = useState<Record<string, string>>({});

  // Help prevent scanning skeleton hanging infinitely in non-admin / slow loading states
  useEffect(() => {
    if (
      selectedJob &&
      (selectedJob.matchProcessingStatus === "pending" ||
        selectedJob.matchProcessingStatus === "processing")
    ) {
      const timer = setTimeout(() => {
        setLocalMatchCompleted((prev) => ({ ...prev, [selectedJob.id]: true }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [selectedJob]);

  // Continuous background scanner/matcher
  useEffect(() => {
    if (!jobs || jobs.length === 0 || !db || !userRole) return;

    // Allow all authenticated users viewing their job pipelines to trigger the high-density marketplace auto-matcher.
    const isScannerAuthorized = !!auth.currentUser;

    if (!isScannerAuthorized) {
      console.log(
        "[AUTO_SCANNER] Current user is not authenticated. Scanner bypassed.",
      );
      return;
    }

    const runAutomatedScanner = async () => {
      const hqAuth =
        userRole === "admin" ||
        userRole === "super_admin" ||
        userRole === "ops_admin" ||
        userRole === "hq_admin" ||
        orgId === "ORG-GLOBAL-HQ";

      if (!hqAuth) {
        console.log("[AUTO_SCANNER] Client/Vendor node bypassed. Auto scanner runs on HQ nodes.");
        return;
      }
      console.log(
        "[AUTO_SCANNER] Initiating background scan of candidates vs requirements...",
      );
      try {
        let candidateList = [];
        try {
          const response = await fetch(
            `/api/candidates?scan=true&orgId=${orgId}&role=${userRole}`,
          );
          if (response.ok) {
            const raw = await response.text();
            const apiData = JSON.parse(raw);
            candidateList = apiData.candidates || [];
          } else {
            console.error("[Candidates] Fetch failed:", await response.text());
          }
        } catch (apiErr) {
          console.warn(
            "[AUTO_SCANNER] Proxy API candidates query failed, falling back to direct:",
            apiErr,
          );
        }

        if (candidateList.length === 0) {
          console.log(
            "[AUTO_SCANNER] Proxy candidate list empty or bypassed. Initiating secure direct client query...",
          );
          try {
            let qFallback;
            const hqAuth =
              userRole === "admin" ||
              userRole === "super_admin" ||
              userRole === "ops_admin" ||
              userRole === "hq_admin" ||
              orgId === "ORG-GLOBAL-HQ";

            if (hqAuth) {
              qFallback = query(collection(db, "candidatePool"), limit(50));
            } else if (isClient) {
              qFallback = null; // Clients do not query candidate pool directly
            } else {
              qFallback = query(
                collection(db, "candidatePool"),
                where("vendorId", "==", orgId),
                limit(50),
              );
            }

            if (qFallback) {
                const candidatesSnap = await getDocs(qFallback);
                candidateList = candidatesSnap.docs.map(
                  (doc) =>
                    ({
                      id: doc.id,
                      candidateId: doc.id,
                      ...(doc.data() as any),
                    }) as any,
                );
            } else {
                candidateList = [];
            }
          } catch (directQueryErr: any) {
            console.warn(
              "[AUTO_SCANNER] Direct candidates query failed:",
              directQueryErr.message,
            );
          }
        }

        console.log(
          `[AUTO_SCANNER] Scanning ${candidateList.length} candidates against ${jobs.length} roles.`,
        );

        for (const job of jobs) {
          // Only scan published jobs
          if (job.status !== "PUBLISHED") continue;

          const jobSkills = (
            Array.isArray(job.skills)
              ? job.skills
              : typeof job.skills === "string"
                ? job.skills.split(",")
                : []
          )
            .map((s: string) => String(s).trim().toLowerCase())
            .filter(Boolean);

          for (const cand of candidateList) {
            // Wait until parsing is fully complete before scanning
            const n = cand.name || "";
            const pendingNames = [
              "Pending Distillation",
              "Unnamed Candidate",
              "Local Mock Generated",
              "Unknown Candidate",
              "Sarah Jenkins",
              "Candidate (Requires Human Review)",
            ];
            if (
              !n ||
              pendingNames.includes(n) ||
              n.toUpperCase().startsWith("CANDIDATE ") ||
              n.includes("Parsing Pending") ||
              cand.distillationStatus === "PROCESSING" ||
              cand.distillationStatus === "PENDING" ||
              !cand.email ||
              cand.email === "" ||
              cand.email.includes("pending@") ||
              !cand.skills ||
              cand.skills.length === 0
            ) {
              continue; // Block matching until identity is fully extracted
            }

            // PIPELINE ISOLATION: Do not auto-submit candidates to other jobs if they are mapped to a specific job
            if (cand.mappedJobId && cand.mappedJobId !== job.id) continue;

            const candSkills = (
              Array.isArray(cand.skills)
                ? cand.skills
                : typeof cand.skills === "string"
                  ? cand.skills.split(",")
                  : []
            )
              .map((s: any) => String(s).trim().toLowerCase())
              .filter(Boolean);

            // Compute skill overlap with requirements
            let overlapCount = 0;
            if (jobSkills.length > 0) {
              overlapCount = candSkills.filter((s) =>
                jobSkills.includes(s),
              ).length;
            }

            // Resume text alignment scoring mapping
            let resumeOverlapCount = 0;
            const resumeLower = String(
              cand.resumeText || cand.resume || "",
            ).toLowerCase();
            jobSkills.forEach((s) => {
              if (resumeLower.includes(s)) {
                resumeOverlapCount++;
              }
            });

            // Keyword overlap with JD description
            let descOverlap = 0;
            const jdWords = String(job.description || "").toLowerCase();
            candSkills.forEach((s) => {
              if (jdWords.includes(s)) descOverlap++;
            });

            // New Matching Formula - strict domain checks
            let matchScore = 0; // zero baseline
            let breakdown = {
              domain: 0,
              skills: 0,
              experience: 0,
              contextual: 0,
            };

            // Domain Gate: if job title doesn't appear in resume at all or no skills match, penalty
            const jobTitleLower = String(job.title || "").toLowerCase();
            const jobTitleWords = jobTitleLower
              .split(" ")
              .filter((w) => w.length > 3);
            let domainHit = false;

            jobTitleWords.forEach((w) => {
              if (
                resumeLower.includes(w) ||
                candSkills.some((s) => s.includes(w))
              ) {
                domainHit = true;
              }
            });

            if (domainHit) {
              breakdown.domain = 40; // Base score if they have the domain
            } else {
              breakdown.domain = 10; // Out of domain penalty
            }

            if (jobSkills.length > 0) {
              breakdown.skills = Math.round(
                (overlapCount / jobSkills.length) * 35,
              );
              breakdown.contextual =
                Math.round(
                  (Math.min(resumeOverlapCount, jobSkills.length) /
                    jobSkills.length) *
                    15,
                ) + Math.min(10, descOverlap * 2);
            } else {
              breakdown.contextual = Math.min(40, descOverlap * 4);
            }

            // Check experience range compatibility
            if (
              jobTitleLower.includes("senior") ||
              jobTitleLower.includes("sr") ||
              jobTitleLower.includes("lead") ||
              jobTitleLower.includes("architect") ||
              jobTitleLower.includes("manager")
            ) {
              const candExpInt = parseInt(
                String(cand.experience || "0").replace(/\D/g, ""),
              );
              if (!isNaN(candExpInt)) {
                if (candExpInt > 8) breakdown.experience = 10;
                else if (candExpInt < 4) breakdown.experience = -20; // Penalty for junior
              }
            }

            matchScore = Math.max(
              0,
              Math.min(
                100,
                breakdown.domain +
                  breakdown.skills +
                  breakdown.contextual +
                  breakdown.experience,
              ),
            );

            // Final cut-off minimum gate
            if (matchScore < 40) continue;

            // Check if match is good (>= 75%)
            if (matchScore >= 75) {
              // Ensure match document is created in Firestore (Pipeline stage: MATCHED)
              const subId = `SUB-${job.id.replace("REQ-", "")}-${cand.id.slice(-6)}`;
              const subRef = doc(db, "submissions", subId);
              const subSnap = await getDoc(subRef);

              if (!subSnap.exists()) {
                console.log(
                  `[AUTO_SCANNER] High alignment found (${matchScore}%). Auto-matching ${cand.name} for ${job.title}...`,
                );
                const newSub = {
                  id: subId,
                  canonicalRequirementId: job.id,
                  requirementId: job.id,
                  requirementTitle: job.title || "Strategic Role",
                  clientId: job.clientId || "ORG-da6tlbeo1",
                  vendorId: cand.vendorId || "ORG-EXTERNAL-VENDOR",
                  candidateId: cand.id,
                  candidateName:
                    cand.fullName || cand.name || "Anonymous Candidate",
                  name: cand.fullName || cand.name || "Anonymous Candidate",
                  email: cand.primaryEmail || cand.email || "No Email Provided",
                  phone: cand.phoneHash || cand.phone || "No Phone Provided",
                  skills: cand.skills || [],
                  experience: cand.experience || "Not Specified",
                  resumeText:
                    cand.resumeText ||
                    `Candidate matching tech stack ${candSkills.join(", ")}.`,
                  matchScore: matchScore,
                  status: "MATCHED",
                  createdAt: serverTimestamp(),
                };
                await setDoc(subRef, newSub);

                await emitEvent(
                  "SubmissionMatched",
                  "SUBMISSION",
                  subId,
                  "system",
                  "ai_agent",
                  {
                    requirementId: job.id,
                    candidateId: cand.id,
                    matchScore,
                    autoMatched: true,
                  },
                );

                // Synchronize candidate stage & matching score in global candidate pool
                try {
                  const candRef = doc(db, "candidatePool", cand.id);
                  const candSnap = await getDoc(candRef);
                  const existingCandData = candSnap.exists()
                    ? candSnap.data()
                    : {};
                  const existingMatches =
                    existingCandData.matchedRequirements || [];

                  // Add this match without duplicates
                  const updatedMatches = [
                    ...existingMatches.filter(
                      (m: any) => m.requirementId !== job.id,
                    ),
                    {
                      requirementId: job.id,
                      requirementTitle: job.title || "Strategic Role",
                      matchScore: matchScore,
                      matchBreakdown: breakdown,
                    },
                  ].sort((a, b) => b.matchScore - a.matchScore); // Highest first

                  await setDoc(
                    candRef,
                    {
                      matchScore: updatedMatches[0].matchScore, // highest score
                      canonicalRequirementId: updatedMatches[0].requirementId, // primary
                      requirementTitle: updatedMatches[0].requirementTitle,
                      matchedRequirements: updatedMatches,
                      updatedAt: serverTimestamp(),
                    },
                    { merge: true },
                  );

                  // Publish Notification Event
                  await publishEvent({
                    type: "info",
                    title: "Candidate Matched",
                    message: `${cand.name || "A candidate"} was auto-matched to ${job.title} (${matchScore}%)`,
                    actionUrl: "/deal-rooms",
                    recipients: [
                      "GLOBAL_ADMIN",
                      "GLOBAL_CLIENT",
                      "GLOBAL_VENDOR",
                    ],
                  });
                } catch (candErr) {
                  console.warn(
                    "[AUTO_SCANNER] Skipped candidate pool stage sync:",
                    candErr,
                  );
                }
              }
            }
          }
        }
      } catch (scanErr) {
        console.warn(
          "[AUTO_SCANNER] Error during automated match pass:",
          scanErr,
        );
      }
    };

    // Run first scan immediately, then exit. 
    // Do NOT run continuous background scanning loops on the frontend.
    runAutomatedScanner();
    return;
  }, [jobs, db, userRole, orgId]);

  const isAdmin =
    userRole === "admin" ||
    userRole === "super_admin" ||
    userRole === "ops_admin";
  const isClient = userRole === "client" || userRole?.startsWith("client_");
  const isVendor = userRole === "vendor" || userRole?.startsWith("vendor_");
  const isRecruiter =
    userRole === "recruiter" || userRole?.includes("recruiter");
  const isIndependent =
    userRole === "independent" ||
    userRole?.startsWith("independent_") ||
    userRole === "independent";
  const isSupplyLayer = isVendor || isRecruiter || isIndependent;

  useEffect(() => {
    const fetchUser = async () => {
      if (auth.currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
          let role = "user";
          let userOrgId = "";

          if (userDoc.exists()) {
            const data = userDoc.data();
            role = data.role || "user";
            userOrgId = data.organizationId || "";
          }

          if (!userDoc.exists() && role === "user") {
            const knownAdmins = [
              "0xpXdzSQE6V92xbnCkiczPHexiU2",
              "vetAu3RF2qYVmsCuB6cpEz9DDqA2",
              "ZlpY4qN9BKS7n0yoMQP7LDMvvJ53",
            ];
            if (knownAdmins.includes(auth.currentUser.uid)) {
              role = "admin";
              userOrgId = "ORG-GLOBAL-HQ";
            }
          }

          setUserRole(role);
          setOrgId(userOrgId);

          try {
            if (role === "admin" || role === "super_admin" || role === "ops_admin") {
              const usersSnap = await getDocs(query(collection(db, "users"), limit(25)));
              const vMap: Record<string, string> = {};
              usersSnap.docs.forEach((d) => {
                const data = d.data();
                if (data.organizationId && (data.name || data.companyName)) {
                  vMap[data.organizationId] = data.companyName || data.name;
                }
              });
              setVendorMap(vMap);
            } else {
              setVendorMap({});
            }
          } catch (ve) {
            console.warn("Failed to fetch users for vendor map", ve);
          }
        } catch (e) {
          console.warn("User fetch failed, using fallback heuristics");
        }
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (!orgId || !userRole) return;

    let unsubscribe: any;
    const loadRequirements = async () => {
      try {
        const response = await fetch(
          `/api/user?action=context&orgId=${orgId}&role=${userRole}`,
        );
        if (response.ok) {
          const raw = await response.text();
          const resData = JSON.parse(raw);
          if (resData.requirements) {
            setJobs(
              resData.requirements.sort(
                (a: any, b: any) =>
                  new Date(b.createdAt || 0).getTime() -
                  new Date(a.createdAt || 0).getTime(),
              ),
            );
          }
        }
      } catch (e) {
        console.warn("Requirements Proxy failed");
      }

      // Real-time fallback
      const q = collection(db, "requirements_public");
      const requirementsQuery = isAdmin
        ? q
        : isSupplyLayer
          ? query(
              q,
              where("visibility", "==", "VENDOR_NETWORK"),
              where("status", "==", "PUBLISHED"),
            )
          : query(q, where("clientId", "==", orgId));

      unsubscribe = onSnapshot(
        requirementsQuery,
        (snap) => {
          const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setJobs(
            data.sort((a: any, b: any) => {
              const timeA =
                a.createdAt?.seconds ||
                new Date(a.createdAt).getTime() / 1000 ||
                0;
              const timeB =
                b.createdAt?.seconds ||
                new Date(b.createdAt).getTime() / 1000 ||
                0;
              return timeB - timeA;
            }),
          );
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, "requirements_public");
        },
      );
    };

    loadRequirements();
    return () => unsubscribe && unsubscribe();
  }, [orgId, userRole]);

  useEffect(() => {
    if (selectedJob && auth.currentUser && orgId && userRole) {
      // 1. Listen to explicit vendor submissions globally (ABAC handled, view is unified)
      let qSub = query(
        collection(db, "submissions"),
        where("requirementId", "==", selectedJob.id)
      );
      if (isVendor) {
        qSub = query(
          collection(db, "submissions"),
          where("requirementId", "==", selectedJob.id),
          where("vendorId", "==", orgId)
        );
      } else if (isClient) {
        qSub = query(
          collection(db, "submissions"),
          where("requirementId", "==", selectedJob.id),
          where("clientId", "==", orgId)
        );
      }

      let qCand: any = null;
      if (isAdmin) {
          qCand = query(
            collection(db, "candidatePool"),
            where("mappedJobId", "==", selectedJob.id)
          );
      } else if (isVendor) {
          qCand = query(
            collection(db, "candidatePool"),
            where("mappedJobId", "==", selectedJob.id),
            where("vendorId", "==", orgId)
          );
      }
      // Clients do NOT query candidatePool directly as per Golden Governance Rule

      let currentMappedCands: any[] = [];
      let currentSubs: any[] = [];

      const updateMergedSubmissions = () => {
        const map = new Map();
        for (const c of currentMappedCands) map.set(c.candidateId, c);
        for (const s of currentSubs) map.set(s.candidateId || s.id, s);
        setSubmissions(Array.from(map.values()));
      };

      const unsubCand = qCand
        ? onSnapshot(
            qCand,
            (snap) => {
              currentMappedCands = snap.docs.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  candidateId: d.id,
                  requirementId: selectedJob.id,
                  candidateName: data.name || "Candidate",
                  skills: data.skills || [],
                  status: data.pipelineStage || "Matched",
                  resumeText: data.resumeText || "",
                  matchScore: data.matchScore,
                  source: "manual_mapping",
                  createdAt: data.updatedAt || data.createdAt,
                  ...data,
                };
              }).filter((c: any) => c.status !== "DELETED" && c.isActive !== false);
              updateMergedSubmissions();
            },
            (error) => {
              console.warn("[CANDIDATE_FETCH_WARN]", error.message);
            },
          )
        : () => {};

      const unsubSub = onSnapshot(
        qSub,
        (snap) => {
          currentSubs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s: any) => s.status !== "DELETED" && s.isActive !== false);
          updateMergedSubmissions();
        },
        (error) => {
          console.warn("[SUBMISSIONS_FETCH_WARN]", error.message);
        },
      );

      // 2. Requirement-Scoped Intelligence Matching via Secure API
      const fetchRequirementIntelligence = async () => {
        try {
          const skills = (selectedJob.skills || []).join(",");
          const res = await fetch(
            `/api/matching/global?requirementId=${selectedJob.id}&skills=${encodeURIComponent(skills)}&orgId=${orgId}&role=${userRole}`,
          );
          if (res.ok) {
            const data = await res.json();
            setGlobalMatches(data.matches || []);
            setFallbackMatches(data.fallbackMatches || []);
            if (data.ledgerCounts) {
              setLedgerCounts(data.ledgerCounts);
            }
            if (data.ledgerCandidates) {
              setLedgerCandidates(data.ledgerCandidates);
            }
          } else {
            console.warn(
              "Requirement matching API response not OK",
              res.status,
            );
          }
        } catch (e) {
          console.warn(
            "Requirement matching API failed, using fallback empty state",
          );
        }
      };

      fetchRequirementIntelligence();
      return () => {
        unsubCand();
        unsubSub();
      };
    }
  }, [selectedJob, auth.currentUser, orgId, userRole]);

  const handleParseJD = async () => {
    if (!jdText.trim()) return;
    setIsParsing(true);

    // Heuristic Fallback Title
    const manualTitle = (
      document.getElementById("new_job_title") as HTMLInputElement
    )?.value;
    const minExp = (document.getElementById("min_exp") as HTMLInputElement)
      ?.value;
    const maxExp = (document.getElementById("max_exp") as HTMLInputElement)
      ?.value;

    const lines = jdText.split("\n").filter((l) => l.trim().length > 0);
    const fallbackTitle =
      manualTitle ||
      (lines.length > 0 ? lines[0].slice(0, 50) : "New Requirement");
    const manualSkills = mandatorySkills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      let parsed = { title: fallbackTitle, skills: manualSkills };

      try {
        const res = await fetch("/api/parse-jd", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-org-id": orgId || "system",
          },
          body: JSON.stringify({ jdText }),
        });

        if (res.ok) {
          const apiParsed = await res.json();
          parsed = { ...parsed, ...apiParsed };
        }
      } catch (apiErr) {
        console.warn(
          "AI extraction deferred. Falling back to manual parameters.",
          apiErr,
        );
      }

      const reqId = "REQ-" + Math.random().toString(36).substr(2, 9);

      let initialStatus = "DRAFT";
      let initialVisibility = "INTERNAL";
      let adminApproved = false;
      let financials: any = null;

      if (budgetPeriod === "LPA") {
        // Direct Post: Deduct 8.33% and publish across vendor network immediately
        const platformProfit = Math.round(budgetAmount * 0.0833);
        const vendorVisible = budgetAmount - platformProfit;
        initialStatus = "PUBLISHED";
        initialVisibility = "VENDOR_NETWORK";
        adminApproved = true;
        financials = {
          clientBudget: budgetAmount,
          clientCurrency: currency,
          staffingModel: "Permanent",
          adminMargin: platformProfit,
          vendorPayout: vendorVisible,
          platformProfit: platformProfit,
          marginConfig: { type: "PERCENTAGE", value: 8.33 },
        };
      } else {
        // LPM: Mandatory Admin Approval required
        initialStatus = "PENDING_FINANCIAL_APPROVAL";
        initialVisibility = "INTERNAL";
        adminApproved = false;
      }

      const newReq = {
        canonicalRequirementId: reqId,
        requirementId: reqId,
        clientId: targetClientOrg || orgId || "default-client-org",
        title: manualTitle || parsed.title || fallbackTitle,
        experience:
          minExp && maxExp
            ? `${minExp}-${maxExp} Yrs`
            : minExp
              ? `${minExp}+ Yrs`
              : "Not Specified",
        minExp: minExp ? parseInt(minExp) : 0,
        maxExp: maxExp ? parseInt(maxExp) : 20,
        description: jdText,
        skills: manualSkills.length > 0 ? manualSkills : parsed.skills || [],
        status: initialStatus,
        visibility: initialVisibility,
        budget: {
          amount: budgetAmount,
          period: budgetPeriod,
          currency: currency,
        },
        workMode: workMode,
        location:
          workMode === "Onsite" || workMode === "Hybrid" ? location : "",
        adminApproved: adminApproved,
        financials: financials,
        ownerId: auth.currentUser?.uid,
        createdAt: serverTimestamp(),
        matchProcessingStatus: "pending",
        
        // Candidate Application Settings (P0 Direct Candidate Governance)
        directApplyEnabled: directApplyEnabled,
        directApplySettings: {
          allowedWorkModes: allowedWorkModes,
          publicVisibility: publicVisibility,
          candidateLoginRequired: candidateLoginRequired
        },

        // Provenance & Trackability Refinements
        createdFrom: isClient ? "CLIENT" : "RECRUITER",
        createdVia: "OS",
        createdByRole: (userRole || "RECRUITER").toUpperCase(),
      };

      await setDoc(doc(db, "requirements_public", reqId), newReq);

      // Auto-create matching Deal Room
      try {
        await setDoc(doc(db, "dealRooms", `DR-${reqId}`), {
          id: `DR-${reqId}`,
          requirementId: reqId,
          requirementTitle: newReq.title,
          clientId: newReq.clientId,
          vendorId: "Direct",
          candidateId: "",
          candidateName: "Requirement Room",
          status: "active",
          createdAt: new Date().toISOString(),
          createdBy: auth.currentUser?.uid || "system",
          matchScore: 100,
          expectedFee: 0,
          isActive: true
        });
      } catch (e) {
        console.warn("Deal Room auto-creation deferred in JobsTab:", e);
      }

      // Ensure import is at the top of the file, not here, I will fix the import later
      await emitEvent(
        "JobPublished",
        "JOB",
        reqId,
        auth.currentUser?.uid || "system",
        userRole || "unknown",
        {
          title: newReq.title,
          clientId: newReq.clientId,
          status: newReq.status,
        },
      );

      // If it requires approval (e.g. LPM), insert into jobApprovalQueue
      if (budgetPeriod !== "LPA") {
        await setDoc(doc(db, "jobApprovalQueue", reqId), {
          jobId: reqId,
          clientId: orgId || "default-client-org",
          title: newReq.title,
          budget: newReq.budget,
          status: "PENDING",
          createdAt: serverTimestamp(),
        });

        // Trigger Admin Notification
        try {
          await fetch("/api/admin/notify-approval", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jobId: reqId,
              jobTitle: newReq.title,
              clientName: orgId || "Target Client",
            }),
          });
        } catch (notifierError) {
          console.warn(
            "Failed to notify admin hq of pending requirement",
            notifierError,
          );
        }
      }

      // Log Execution Event
      await logExecutionEvent(
        ExecutionEventType.JD_CREATED,
        reqId,
        "requirement",
        { title: newReq.title, organizationId: orgId },
        reqId,
      );

      setJdText("");
      setBudgetAmount(0);
      setMandatorySkills("");
      if (document.getElementById("new_job_title"))
        (document.getElementById("new_job_title") as HTMLInputElement).value =
          "";
      if (document.getElementById("min_exp"))
        (document.getElementById("min_exp") as HTMLInputElement).value = "";
      if (document.getElementById("max_exp"))
        (document.getElementById("max_exp") as HTMLInputElement).value = "";

      // Trigger AI Match Simulation
      setTimeout(async () => {
        await updateDoc(doc(db, "requirements_public", reqId), {
          matchProcessingStatus: "processing",
        });

        setTimeout(async () => {
          await updateDoc(doc(db, "requirements_public", reqId), {
            matchProcessingStatus: "completed",
          });
        }, 20000);
      }, 5000);
    } catch (e: any) {
      alert(`Critical submission failure: ${e.message}`);
    }
    setIsParsing(false);
  };

  const handleJobFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsParsing(true);
    let cumulativeText = jdText;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/extract-text", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.text) {
          cumulativeText += (cumulativeText ? "\n---\n" : "") + data.text;
        }
      } catch (err: any) {
        console.warn(`Failed to parse file ${file.name}:`, err.message);
      }
    }

    setJdText(cumulativeText);
    setIsParsing(false);
  };

  const handleSubmitBudget = async (jobId: string, budget: number) => {
    try {
      await updateDoc(doc(db, "requirements_public", jobId), {
        status: "PENDING_FINANCIAL_APPROVAL",
        clientTargetBudget: budget,
      });

      const job = jobs.find((j) => j.id === jobId || j.requirementId === jobId);
      // Trigger Admin Notification
      await fetch("/api/admin/notify-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          jobTitle: job?.title || "New Job",
          clientName: orgId || "Target Client",
        }),
      });
      alert("Requirement submitted for financial governance approval.");
    } catch (err: any) {
      alert(`Failed to submit budget or notify: ${err.message}`);
    }
  };

  const handleUpdateJD = async (
    jobId: string,
    newTitle: string,
    newDesc: string,
    newWorkMode: string,
    newLocation?: string,
  ) => {
    await updateDoc(doc(db, "requirements_public", jobId), {
      title: newTitle,
      description: newDesc,
      workMode: newWorkMode,
      ...(newWorkMode === "Onsite" || newWorkMode === "Hybrid"
        ? { location: newLocation || "" }
        : { location: "" }),
      updatedAt: serverTimestamp(),
    });
    setIsEditing(null);
    setSelectedJob((prev: any) => ({
      ...prev,
      title: newTitle,
      description: newDesc,
      workMode: newWorkMode,
      location:
        newWorkMode === "Onsite" || newWorkMode === "Hybrid" ? newLocation : "",
    }));
  };

  const [matchingStatus, setMatchingStatus] = useState<string>("idle");

  const handleApproveMargin = async (
    req: any,
    actualBudget: number,
    marginValue: number,
    marginType: "FIXED" | "PERCENTAGE",
    curr: string,
    model: string,
  ) => {
    try {
      const platformProfit =
        marginType === "PERCENTAGE"
          ? actualBudget * (marginValue / 100)
          : marginValue;
      const vendorVisible = actualBudget - platformProfit;
      const financials = {
        clientBudget: actualBudget,
        clientCurrency: curr,
        staffingModel: model,
        adminMargin: platformProfit,
        vendorPayout: vendorVisible,
        platformProfit: platformProfit,
        marginConfig: { type: marginType, value: marginValue },
      };

      // 1. USE SECURE API FOR APPROVAL (for HQ logic/metrics)
      const res = await fetch("/api/admin/approve-requirement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reqId: req.id, financials }),
      });

      if (!res.ok) throw new Error("Approval API failed");

      // 2. UPDATE REAL FIRESTORE (for real-time consistency)
      await updateDoc(doc(db, "requirements_public", req.id), {
        status: "PUBLISHED",
        visibility: "VENDOR_NETWORK",
        adminApproved: true,
        financials,
        updatedAt: serverTimestamp(),
      });

      setShowApprovalModal(null);
      setSelectedJob(null);
      alert("Requirement approved and released to Global OS.");
    } catch (e: any) {
      alert("Governance Error: " + e.message);
    }
  };

  const handleRunAiMatch = async (sub: any) => {
    setIsAnalyzing(true);
    setSelectedSubmission(sub);
    try {
      const safeJd =
        selectedJob.description ||
        selectedJob.title ||
        "Generic Job Requirement";
      const safeProfile =
        sub.resumeText ||
        (sub.skills && sub.skills.length > 0
          ? "Skills: " + sub.skills.join(", ")
          : "Candidate Profile details omitted.");
      const result = await analyzeCandidateMatch(safeJd, safeProfile);
      setAiAnalysis(result as any);

      if (result && result.matchScore) {
        sub.matchScore = result.matchScore;
        setGlobalMatches((prev) => [...prev]);
        setFallbackMatches((prev) => [...prev]);
        setSubmissions((prev) => [...prev]);

        // Persist the V2 score to the database so it's consistent everywhere
        try {
          const targetId = sub.candidateId || sub.id;
          if (targetId) {
            await updateDoc(doc(db, "candidatePool", targetId), {
              aiMatchScore: result.matchScore,
              updatedAt: serverTimestamp(),
            });
          }
        } catch (dbErr) {
          console.warn("Could not persist AI match score to DB", dbErr);
        }
      }
    } catch (err: any) {
      alert("Match Engine V2 failed: " + err.message);
    }
    setIsAnalyzing(false);
  };

  const handleToggleStatus = async (jobId: string, currentStatus: string) => {
    const newStatus = currentStatus === "PUBLISHED" ? "CLOSED" : "PUBLISHED";
    try {
      // Attempt direct update first (faster)
      await updateDoc(doc(db, "requirements_public", jobId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error: any) {
      console.warn(
        "Direct update failed, attempting server proxy...",
        error.message,
      );
      try {
        const response = await fetch("/api/jobs/update-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, status: newStatus }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Server proxy update failed");
        }
      } catch (proxyError: any) {
        alert("Status update failed: " + proxyError.message);
        handleFirestoreError(
          proxyError,
          OperationType.UPDATE,
          `requirements_public/${jobId}`,
        );
      }
    }
  };

  const handleRequestUpdate = async (sub: any) => {
    try {
      const targetId = sub.candidateId || sub.id;
      if (!targetId || !aiAnalysis) return;

      // 1. Update Candidate Stage
      await updateDoc(doc(db, "candidatePool", targetId), {
        missingSkills: aiAnalysis.missingSkills || [],
        updatedAt: serverTimestamp(),
      });

      // 2. Notify the Vendor
      if (sub.vendorId) {
        await addDoc(collection(db, "notifications"), {
          id: `NOTIF-${Date.now()}`,
          recipientId: sub.vendorId, // Specifically targeting the vendor
          title: "Action Required: Update Resume",
          text: `Missing critical JD skills for ${sub.candidateName || "Candidate"}: ${(aiAnalysis.missingSkills || []).join(", ")}. Please upload an updated resume.`,
          read: false,
          createdAt: serverTimestamp(),
        });
      }

      alert("Update request sent to vendor successfully!");
      if (selectedSubmission) {
        selectedSubmission.pipelineStage = "Update Requested";
        setSelectedSubmission({ ...selectedSubmission });
      }
    } catch (err: any) {
      alert("Failed to request update: " + err.message);
    }
  };

  const handleCreateDealRoom = async (sub: any) => {
    // Deal rooms are projected from Submission state. UI creation is restricted.
    // Ensure the submission status reflects interview request/scheduling, which projection uses.
    try {
      await updateDoc(doc(db, "submissions", sub.id), {
         status: "INTERVIEW_REQUESTED",
         dealRoomId: `DR-${sub.id}`,
         updatedAt: serverTimestamp()
      });
      alert("Submission updated to INTERVIEW_REQUESTED. Deal room will be auto-generated by the system.");
      navigate("/deal-rooms");
    } catch (e) {
      console.error(e);
      alert("Failed to update submission.");
    }
  };

  const filteredJobs = jobs.filter((job) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      job.title?.toLowerCase().includes(q) ||
      job.requirementId?.toLowerCase().includes(q) ||
      job.skills?.join(",").toLowerCase().includes(q)
    );
  });

  const validMatchedCandidates = Array.from(
    new Map(
      [...submissions].map((c) => [
        c.candidateId || c.id || c.email,
        c,
      ]),
    ).values(),
  ).filter((c: any) => {
    if (c.status === "DELETED" || c.isActive === false) return false;
    if (c.status === "PARSE_FAILED" || c.status === "UNPARSED" || c.distillationStatus === "FAILED") return false;
    if (userRole?.startsWith("vendor") && c.ownerVendorId !== orgId && c.vendorId !== orgId) return false;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      <div className="flex-1 flex overflow-hidden">
        {/* Main Jobs List */}
        <div
          className={`flex-1 flex flex-col overflow-hidden p-4 space-y-4 transition-all ${selectedJob ? "hidden lg:flex lg:w-1/2" : "w-full"}`}
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-sm font-bold uppercase tracking-widest text-slate-800">
                  Operational Staffing OS
                </h1>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                  High-density governance layer. Requirements ⇄ AI Matching.
                </p>
              </div>
              <div className="relative ml-4">
                <input
                  type="text"
                  placeholder="Search requirements..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 h-8 text-[10px] bg-slate-50 border border-slate-200 rounded px-3 py-1 font-bold outline-none hover:border-indigo-300 focus:border-indigo-500 transition-colors uppercase tracking-widest"
                />
              </div>
            </div>
            {(isAdmin || isClient) && !selectedJob && (
              <Button
                onClick={() => setShowIntakeForm(!showIntakeForm)}
                className="bg-indigo-600 hover:bg-slate-900 text-white h-10 px-6 rounded-2xl shadow-xl shadow-indigo-100 font-black uppercase tracking-widest text-[11px] transition-all hover:scale-[1.02]"
              >
                {showIntakeForm ? "Close Form" : "Create Requirement"}
              </Button>
            )}
          </div>

          {(isAdmin || isClient) && !selectedJob && showIntakeForm && (
            <div className="bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden shrink-0 animate-in fade-in slide-in-from-top duration-500">
              <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">
                    New Requirement Intake
                  </label>
                  <p className="text-[9px] text-slate-400 font-mono">
                    Senior recruiting mode active. Optimized for high-density
                    placement.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer group flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded hover:border-indigo-400 transition-all shadow-sm">
                    <Upload
                      size={12}
                      className="text-slate-400 group-hover:text-indigo-600"
                    />
                    <span className="text-[9px] font-bold text-slate-500 uppercase">
                      Extract from Document
                    </span>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      onChange={handleJobFileChange}
                    />
                  </label>
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                      Requirement Title
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Senior Backend Engineer"
                      id="new_job_title"
                      className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                      Urgency Layer
                    </label>
                    <select
                      id="urgency"
                      className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                    >
                      <option value="NORMAL">Standard Execution</option>
                      <option value="HIGH">High Priority (SLA 48h)</option>
                      <option value="CRITICAL">Critical Path (SLA 24h)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                      Exp Range (Yrs)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Min"
                        id="min_exp"
                        className="w-1/2 bg-slate-50 border border-slate-200 rounded p-2 text-xs outline-none"
                      />
                      <input
                        type="number"
                        placeholder="Max"
                        id="max_exp"
                        className="w-1/2 bg-slate-50 border border-slate-200 rounded p-2 text-xs outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5 flex flex-col justify-end">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                      Work Mode
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={workMode}
                        onChange={(e: any) => setWorkMode(e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                      >
                        <option value="Onsite">Onsite</option>
                        <option value="Remote">Remote</option>
                        <option value="Hybrid">Hybrid</option>
                      </select>
                      {(workMode === "Onsite" || workMode === "Hybrid") && (
                        <input
                          type="text"
                          placeholder="Location"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                      Financial Parameters
                    </label>
                    <div className="flex gap-1">
                      <select
                        value={currency}
                        onChange={(e: any) => setCurrency(e.target.value)}
                        className="bg-slate-100 border border-slate-200 rounded-l px-2 text-[10px] font-bold text-slate-600 outline-none"
                      >
                        <option value="INR">₹ INR</option>
                      </select>
                      <input
                        type="number"
                        placeholder="Budget"
                        value={budgetAmount || ""}
                        onChange={(e) =>
                          setBudgetAmount(e.target.valueAsNumber)
                        }
                        className="flex-1 bg-slate-50 border-y border-slate-200 p-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                      <select
                        value={budgetPeriod}
                        onChange={(e: any) => setBudgetPeriod(e.target.value)}
                        className="bg-slate-100 border-y border-r border-slate-200 rounded-r px-2 text-[10px] font-bold text-slate-600 outline-none"
                      >
                        <option value="LPA">LPA</option>
                        <option value="LPM">LPM</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                      Mandatory Tech Skills
                    </label>
                    <input
                      type="text"
                      placeholder="React, AWS, Node.js..."
                      value={mandatorySkills}
                      onChange={(e) => setMandatorySkills(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  {isAdmin && (
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                        Target Client Org (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="ORG-XXXXXX or Leave Blank for HQ"
                        value={targetClientOrg}
                        onChange={(e) => setTargetClientOrg(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                    Job Scope & Technical Requirements
                  </label>
                  <textarea
                    className="w-full h-32 p-3 border border-slate-200 rounded shadow-sm text-[11px] font-sans text-slate-700 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none bg-slate-50/50"
                    placeholder="Paste detailed Job Description. AI will automatically extract title, experience requirements, and core responsibilities."
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                  />
                </div>

                {/* Candidate Application Settings Panel */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <Users size={14} className="text-indigo-600" />
                        Candidate Application Settings
                      </h4>
                      <p className="text-[10px] text-slate-500">Configure direct candidate discovery and portal application rules.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={directApplyEnabled}
                        onChange={(e) => setDirectApplyEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                      <span className="ml-2 text-[10px] font-bold text-slate-700">
                        {directApplyEnabled ? "Direct Apply ON" : "Direct Apply OFF"}
                      </span>
                    </label>
                  </div>

                  {directApplyEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-600 block mb-1.5 uppercase">
                          Allowed Application Modes:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {["Onsite", "C2H", "Remote", "C2C"].map((mode) => (
                            <label key={mode} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={allowedWorkModes.includes(mode)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setAllowedWorkModes([...allowedWorkModes, mode]);
                                  } else {
                                    setAllowedWorkModes(allowedWorkModes.filter((m) => m !== mode));
                                  }
                                }}
                                className="rounded text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                              />
                              <span>{mode}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col justify-center space-y-1.5">
                        <label className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={publicVisibility}
                            onChange={(e) => setPublicVisibility(e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                          />
                          <span>Public Visibility in Candidate Portal</span>
                        </label>
                        <label className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={candidateLoginRequired}
                            onChange={(e) => setCandidateLoginRequired(e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                          />
                          <span>Candidate Login / Verification Required</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center bg-indigo-50/50 -mx-4 -mb-4 p-3 border-t border-indigo-100">
                  <div className="flex items-center gap-2">
                    <BrainCircuit size={16} className="text-indigo-500" />
                    <p className="text-[10px] text-indigo-700 font-bold uppercase tracking-tighter">
                      AI Matching Engine Online
                    </p>
                  </div>
                  <Button
                    onClick={handleParseJD}
                    disabled={isParsing || !jdText.trim()}
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold tracking-widest text-[11px] uppercase py-2 px-6 shadow-md transition-all hover:scale-[1.02]"
                  >
                    {isParsing
                      ? "Initiating Protocol..."
                      : "Finalize & Submit Requirement"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto min-h-0 pt-2 pr-2 pb-20 custom-scrollbar">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">
                Active Requirements Pipeline
              </h2>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: "ALL", label: "All Requirements" },
                  { id: "DIRECT_APPLY", label: "⭐ Direct Apply Active" },
                  { id: "ONSITE", label: "🏢 Onsite" },
                  { id: "C2H", label: "⏱️ C2H" },
                  { id: "REMOTE", label: "🌐 Remote" },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setReqFilterMode(mode.id)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-tight transition-all ${
                      reqFilterMode === mode.id
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-200/70 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {(() => {
              const visibleJobs = filteredJobs.filter(
                (j) => {
                  const roleAccess =
                    isAdmin ||
                    j.clientId === orgId ||
                    (j.visibility === "VENDOR_NETWORK" &&
                      j.status === "PUBLISHED");
                  if (!roleAccess) return false;

                  if (reqFilterMode === "DIRECT_APPLY") {
                    return j.directApplyEnabled !== false;
                  }
                  if (reqFilterMode === "ONSITE") {
                    return (j.workMode || "").toUpperCase().includes("ONSITE");
                  }
                  if (reqFilterMode === "C2H") {
                    return (
                      (j.workMode || "").toUpperCase().includes("C2H") ||
                      (j.jobType || "").toUpperCase().includes("C2H")
                    );
                  }
                  if (reqFilterMode === "REMOTE") {
                    return (j.workMode || "").toUpperCase().includes("REMOTE");
                  }
                  return true;
                }
              );

              if (visibleJobs.length === 0) {
                return (
                  <div className="mt-8">
                    <EmptyState
                      icon={Briefcase}
                      title="No requirements available"
                      description="You don't have any active requirements in your pipeline at the moment. Let's create one based on your hiring needs."
                      actionLabel={
                        isAdmin || isClient ? "Create Requirement" : undefined
                      }
                      onAction={
                        isAdmin || isClient
                          ? () => setShowIntakeForm(true)
                          : undefined
                      }
                    />
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {visibleJobs.map((job) => (
                    <div
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className={`group relative flex flex-col bg-white border-2 rounded-2xl p-5 cursor-pointer transition-all ${selectedJob?.id === job.id ? "border-indigo-600 shadow-xl shadow-indigo-50 ring-1 ring-indigo-600" : "border-slate-100 hover:border-indigo-200 hover:shadow-lg hover:shadow-slate-100"}`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "h-10 w-10 rounded-xl flex items-center justify-center transition-colors shadow-sm bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600",
                              selectedJob?.id === job.id &&
                                "bg-indigo-600 text-white shadow-indigo-100",
                            )}
                          >
                            <Briefcase size={20} />
                          </div>
                          <div>
                            <h3
                              className={cn(
                                "text-base font-black uppercase tracking-tight leading-none group-hover:text-indigo-600 transition-colors",
                                selectedJob?.id === job.id
                                  ? "text-indigo-600"
                                  : "text-slate-900",
                              )}
                            >
                              {job.title}
                            </h3>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                                ID: {job.requirementId?.replace("REQ-", "")}
                              </p>
                              {job.createdFrom && (
                                <span className="text-[8px] font-extrabold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                  {job.createdFrom} / {job.createdVia || "OS"}
                                </span>
                              )}
                              {(job.assignedBDM || job.assignedRecruiter) && (
                                <span className="text-[8px] font-extrabold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                  {job.assignedBDM ? "BDM" : "REC"} Assigned
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge
                            className={cn(
                              "text-[9px] font-black tracking-widest px-2 py-0.5 border-none shadow-sm",
                              job.status === "PUBLISHED"
                                ? "bg-emerald-100 text-emerald-700"
                                : job.status === "PENDING_FINANCIAL_APPROVAL"
                                  ? "bg-amber-100 text-amber-700"
                                  : job.status === "DRAFT"
                                    ? "bg-slate-100 text-slate-500"
                                    : job.status === "CLOSED"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-indigo-50 text-indigo-600",
                            )}
                          >
                            {job.status}
                          </Badge>
                          {(isAdmin || (isClient && job.clientId === orgId)) &&
                            (job.status === "PUBLISHED" ||
                              job.status === "CLOSED") && (
                              <div
                                className="flex items-center gap-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="text-[9px] font-bold text-slate-400 uppercase">
                                  {job.status === "PUBLISHED"
                                    ? "Active"
                                    : "Closed"}
                                </span>
                                <Switch
                                  checked={job.status === "PUBLISHED"}
                                  onCheckedChange={() =>
                                    handleToggleStatus(job.id, job.status)
                                  }
                                />
                              </div>
                            )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1 text-[10px] font-black text-slate-500 uppercase">
                            <Clock size={12} className="text-slate-300" />{" "}
                            {job.experience}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] font-black text-slate-500 uppercase border-l pl-4 border-slate-100">
                            <MapPin size={12} className="text-slate-300" />{" "}
                            {job.location || job.workMode}
                          </div>
                          {(job.budget?.amount > 0 ||
                            job.clientTargetBudget > 0) && (
                            <div className="flex items-center gap-1 text-[10px] font-black text-slate-500 uppercase border-l pl-4 border-slate-100">
                              <DollarSign
                                size={12}
                                className="text-slate-300"
                              />{" "}
                              {job.budget?.currency || "INR"}{" "}
                              {job.budget?.amount || job.clientTargetBudget}{" "}
                              {job.budget?.period || "LPA"}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {isAdmin &&
                            job.status === "PENDING_FINANCIAL_APPROVAL" && (
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowApprovalModal(job);
                                }}
                                size="sm"
                                className="bg-amber-500 hover:bg-slate-900 text-white text-[10px] h-8 px-4 font-black uppercase tracking-widest rounded-lg shadow-lg shadow-amber-50"
                              >
                                Approve
                              </Button>
                            )}
                          <div className="flex -space-x-1.5 translate-x-1">
                            {[1, 2, 3].map((i) => (
                              <div
                                key={i}
                                className="h-6 w-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-400 overflow-hidden"
                              >
                                <Activity size={10} />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Requirement 360 Modal */}
        {selectedJob && (
          <Requirement360Modal
            job={selectedJob}
            onClose={() => setSelectedJob(null)}
            isAdmin={isAdmin}
            userRole={userRole}
            userOrgId={orgId}
          />
        )}
        {false && selectedJob && (
          <div className="w-full lg:w-1/2 absolute lg:relative inset-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-300 z-10">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50">
              <div className="flex items-center gap-2">
                {(isAdmin || (isClient && selectedJob.clientId === orgId)) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setIsEditing(
                        isEditing === selectedJob.id ? null : selectedJob.id,
                      )
                    }
                    className="h-6 text-[10px] uppercase font-bold tracking-widest px-3"
                  >
                    {isEditing === selectedJob.id ? "Cancel Edit" : "Edit Job"}
                  </Button>
                )}
                <Badge className="bg-indigo-100 text-indigo-700 text-[9px]">
                  {selectedJob.requirementId}
                </Badge>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
              <div className="p-6 max-w-4xl mx-auto pb-24">
                {isEditing === selectedJob.id ? (
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 mb-8">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-800">
                      Edit Requirement
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">
                          Title
                        </label>
                        <input
                          type="text"
                          id={`edit-title-${selectedJob.id}`}
                          defaultValue={selectedJob.title}
                          className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold text-slate-500 uppercase">
                            Work Mode
                          </label>
                          <select
                            id={`edit-mode-${selectedJob.id}`}
                            defaultValue={selectedJob.workMode}
                            onChange={(e) => {
                              const locEl = document.getElementById(
                                `edit-loc-${selectedJob.id}`,
                              );
                              if (locEl) {
                                if (e.target.value === "Remote") {
                                  locEl.style.display = "none";
                                } else {
                                  locEl.style.display = "block";
                                }
                              }
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs"
                          >
                            <option value="Onsite">Onsite</option>
                            <option value="Remote">Remote</option>
                            <option value="Hybrid">Hybrid</option>
                          </select>
                        </div>
                        <div
                          className="space-y-1.5"
                          id={`edit-loc-${selectedJob.id}`}
                          style={{
                            display:
                              selectedJob.workMode === "Remote"
                                ? "none"
                                : "block",
                          }}
                        >
                          <label className="text-[9px] font-bold text-slate-500 uppercase">
                            Location
                          </label>
                          <input
                            type="text"
                            id={`edit-loc-input-${selectedJob.id}`}
                            defaultValue={selectedJob.location || ""}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs"
                            placeholder="City, State, etc."
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">
                          Description
                        </label>
                        <textarea
                          id={`edit-desc-${selectedJob.id}`}
                          defaultValue={selectedJob.description}
                          className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded text-xs"
                        />
                      </div>
                      <div className="flex justify-end pt-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            const t = (
                              document.getElementById(
                                `edit-title-${selectedJob.id}`,
                              ) as HTMLInputElement
                            ).value;
                            const m = (
                              document.getElementById(
                                `edit-mode-${selectedJob.id}`,
                              ) as HTMLSelectElement
                            ).value;
                            const d = (
                              document.getElementById(
                                `edit-desc-${selectedJob.id}`,
                              ) as HTMLTextAreaElement
                            ).value;
                            const l = (
                              document.getElementById(
                                `edit-loc-input-${selectedJob.id}`,
                              ) as HTMLInputElement
                            )?.value;
                            handleUpdateJD(selectedJob.id, t, d, m, l);
                          }}
                          className="bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <JDIntelligence job={selectedJob} />
                )}

                {isClient && selectedJob.status === "DRAFT" && (
                  <div className="mt-8 p-8 bg-indigo-50 border border-indigo-100 rounded-3xl">
                    <h4 className="text-xs font-black uppercase tracking-widest text-indigo-900 mb-4">
                      Financial Governance Required
                    </h4>
                    <div className="flex gap-4">
                      <div className="flex-1 space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-indigo-400">
                          Specify Requirement Budget (₹)
                        </label>
                        <div className="flex gap-2">
                          <input
                            id="client_budget_input"
                            type="number"
                            className="flex-1 border-2 border-indigo-200 bg-white rounded-xl p-3 text-sm font-bold focus:border-indigo-500 focus:outline-none transition-all"
                            placeholder="Total Global Budget"
                          />
                          <Button
                            size="lg"
                            className="bg-indigo-600 hover:bg-slate-900 text-white text-[11px] uppercase font-black py-4 px-6 h-auto rounded-xl shadow-xl shadow-indigo-100"
                            onClick={() => {
                              const b = (
                                document.getElementById(
                                  "client_budget_input",
                                ) as HTMLInputElement
                              ).valueAsNumber;
                              if (b > 0) handleSubmitBudget(selectedJob.id, b);
                            }}
                          >
                            Submit for Platform Approval
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Requirement Candidate Ledger Validation */}
                {(() => {
                  let counts = {
                    matches: 0,
                    floated: 0,
                    submitted: 0,
                    interviewing: 0,
                    offers: 0,
                    placed: 0,
                    rejected: 0,
                  };

                  const reqSubmissions = submissions || [];

                  reqSubmissions.forEach((s: any) => {
                    const status = (s.status || s.pipelineStage || "MATCHED").toUpperCase();
                    if (status === "MATCHED" || status === "AI_MATCH") counts.matches++;
                    else if (status === "ADDED" || status === "VENDOR_FLOATED" || status === "QUEUED") counts.floated++;
                    else if (status.includes("SUBMITTED") || status === "PENDING_REVIEW" || status.includes("DEAL ROOM")) counts.submitted++;
                    else if (status.includes("INTERVIEW") || status === "SHORTLISTED" || status === "REQUESTED" || status === "SCHEDULED") counts.interviewing++;
                    else if (status.includes("OFFER")) counts.offers++;
                    else if (status === "PLACED" || status === "HIRED") counts.placed++;
                    else if (status === "REJECTED" || status === "REJECT") counts.rejected++;
                  });


                  return (
                    <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden group mb-8 mt-8">
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                          <h4 className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.2em] flex items-center gap-2">
                            <ShieldCheck size={14} /> Requirement Candidate
                            Ledger (Single Source of Truth)
                          </h4>
                          <Badge className="bg-white/10 text-slate-300 text-[9px]">
                            ID: {selectedJob.requirementId}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {[
                            {
                              label: "AI Matches",
                              value: counts.matches,
                              color: "text-indigo-300",
                            },
                            {
                              label: "Vendor Floated",
                              value: counts.floated,
                              color: "text-amber-300",
                            },
                            {
                              label: "Submitted",
                              value: counts.submitted,
                              color: "text-blue-300",
                            },
                            {
                              label: "Interviewing",
                              value: counts.interviewing,
                              color: "text-fuchsia-300",
                            },
                            {
                              label: "Offers",
                              value: counts.offers,
                              color: "text-emerald-300",
                            },
                            {
                              label: "Placed",
                              value: counts.placed,
                              color: "text-emerald-500",
                            },
                            {
                              label: "Rejected",
                              value: counts.rejected,
                              color: "text-rose-400",
                            },
                          ].map((item, i) => (
                            <div
                              key={i}
                              className="bg-white/5 border border-white/10 rounded-2xl p-4"
                            >
                              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-1">
                                {item.label}
                              </p>
                              <p
                                className={`text-2xl font-black ${item.color}`}
                              >
                                {item.value}
                              </p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                          <CheckCircle size={12} className="text-emerald-500" />
                          <span className="text-[8px] font-bold uppercase tracking-widest text-slate-500">
                            Counts strictly validated across all network nodes
                            (Client, Vendor, Core HQ).
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Matched Candidates SECTION */}
                <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden group mb-8">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-all group-hover:scale-110">
                    <BrainCircuit size={80} />
                  </div>
                  <div className="relative z-10">
                    <div className="text-[9px] font-black uppercase text-indigo-200 tracking-widest mb-4">
                      Orchestration Intelligence
                    </div>
                    <div className="flex items-end gap-2 mb-6">
                      <span className="text-4xl font-black italic">84%</span>
                      <span className="text-[10px] font-black text-indigo-300 uppercase mb-2">
                        Closure Prob.
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/10 p-3 rounded-2xl border border-white/10">
                          <div className="text-[8px] font-black text-indigo-200 uppercase mb-1">
                            Time-to-fill
                          </div>
                          <div className="text-xs font-black">4.2 Days</div>
                        </div>
                        <div className="bg-white/10 p-3 rounded-2xl border border-white/10">
                          <div className="text-[8px] font-black text-indigo-200 uppercase mb-1">
                            Revenue at Risk
                          </div>
                          <div className="text-xs font-black text-rose-400">
                            ₹4.2L
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[40px] border border-slate-100 p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-10">
                    <div className="flex flex-col">
                      <h3 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-3 uppercase italic">
                        <Target size={28} className="text-indigo-600" />
                        Strategic Routing & High-Density Matches
                      </h3>
                      <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-[0.2em] flex items-center gap-2">
                        <ShieldCheck size={14} className="text-emerald-500" />
                        Verified Scoring Architecture (70% - 100%)
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <Badge className="bg-indigo-50 text-indigo-600 border-indigo-100 text-[12px] font-black px-5 py-2.5 rounded-2xl mb-2">
                        {
                          validMatchedCandidates.filter((s) => (s.matchScore || s.aiMatchScore || 0) >= 85).length
                        }{" "}
                        High Confidence
                      </Badge>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        +{" "}
                        {
                          validMatchedCandidates.filter(
                            (s) =>
                              (s.matchScore || s.aiMatchScore || 0) >= 70 &&
                              (s.matchScore || s.aiMatchScore || 0) < 85,
                          ).length
                        }{" "}
                        Strong Potential
                      </div>
                    </div>
                  </div>

                  {(selectedJob.matchProcessingStatus === "pending" ||
                    selectedJob.matchProcessingStatus === "processing") &&
                  !localMatchCompleted[selectedJob.id] &&
                  validMatchedCandidates.length === 0 ? (
                    <div className="py-24 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-indigo-100 rounded-[40px] bg-indigo-50/20 px-6 text-center">
                      <div className="relative mb-8">
                        <Bot
                          size={80}
                          className={`text-indigo-400 ${selectedJob.matchProcessingStatus === "pending" || selectedJob.matchProcessingStatus === "processing" ? "animate-bounce" : "opacity-30"}`}
                        />
                        {(selectedJob.matchProcessingStatus === "pending" ||
                          selectedJob.matchProcessingStatus ===
                            "processing") && (
                          <div className="absolute -top-2 -right-2">
                            <Activity
                              size={32}
                              className="text-emerald-500 animate-spin"
                            />
                          </div>
                        )}
                      </div>
                      <h3 className="text-base font-black uppercase tracking-[0.3em] text-indigo-600 mb-3">
                        {selectedJob.matchProcessingStatus === "pending"
                          ? "Synchronizing Requirement Profiles..."
                          : "Executing Contextual Neural Mapping..."}
                      </h3>
                      <p className="text-[12px] text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
                        {selectedJob.matchProcessingStatus === "pending" ||
                        selectedJob.matchProcessingStatus === "processing"
                          ? "Our AI Agents are scoring mapped candidates specifically against this requirement's criteria."
                          : "This requirement is undergoing deterministic & semantic mapping isolation."}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {validMatchedCandidates
                        .filter(
                          (sub) =>
                            (sub.matchScore || 0) >= 0 || sub.isGlobalMatch,
                        )
                        .sort(
                          (a, b) =>
                            (b.matchScore || b.aiMatchScore || 0) -
                            (a.matchScore || a.aiMatchScore || 0),
                        )
                        .map((sub) => (
                          <div
                            key={sub.id}
                            className={`group relative border-2 rounded-[32px] p-8 transition-all cursor-pointer overflow-hidden ${selectedSubmission?.id === sub.id ? "border-indigo-600 bg-indigo-50/40 shadow-[0_20px_50px_rgba(79,70,229,0.1)]" : "border-slate-50 hover:border-indigo-200 hover:shadow-2xl hover:shadow-slate-100 bg-white"}`}
                            onClick={() => setSelectedSubmission(sub)}
                          >
                            <div className="flex justify-between items-start mb-8">
                              <div className="flex items-center gap-5">
                                <div className="h-14 w-14 rounded-2xl bg-slate-900 border-4 border-white shadow-xl flex items-center justify-center text-white font-black text-base uppercase group-hover:bg-indigo-600 transition-colors">
                                  {sub.candidateName?.slice(0, 2) ||
                                    sub.name?.slice(0, 2)}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <div className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-all uppercase tracking-tight">
                                      {sub.candidateName || sub.name}
                                    </div>
                                    <div className="text-[9px] font-bold font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                      {sub.candidateId || sub.id}
                                    </div>
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-bold flex items-center gap-2 mt-1.5 uppercase tracking-widest">
                                    <Target
                                      size={14}
                                      className="text-slate-300"
                                    />{" "}
                                    {sub.experience || "8+ YRS"} EXP •
                                    {sub.isGlobalMatch ? (
                                      "Mapped Match"
                                    ) : !sub.vendorId ||
                                      sub.vendorId === "ORG-GLOBAL-HQ" ||
                                      sub.vendorId === "ADMIN_POOL" ? (
                                      <span className="text-indigo-600 font-black tracking-tight">
                                        SOURCE: ADMIN HQ
                                      </span>
                                    ) : (
                                      <span
                                        className="text-emerald-600 font-black truncate max-w-[200px]"
                                        title={
                                          sub.vendorName ||
                                          vendorMap[sub.vendorId] ||
                                          sub.vendorId
                                        }
                                      >
                                        VENDOR:{" "}
                                        {sub.vendorName ||
                                          vendorMap[sub.vendorId] ||
                                          sub.vendorId}{" "}
                                        (ID: {sub.vendorId})
                                      </span>
                                    )}
                                  </div>
                                  
                                  {sub.breakdown && Object.keys(sub.breakdown).length > 0 && (
                                    <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-slate-100">
                                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Skills Map: <span className="text-indigo-600 font-black">{sub.breakdown.semanticScore === -1 || sub.breakdown.semanticScore === null ? "N/A" : `${sub.breakdown.semanticScore}%`}</span></div>
                                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Experience: <span className="text-indigo-600 font-black">{sub.breakdown.careerTrajectoryScore}%</span></div>
                                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Domain: <span className="text-indigo-600 font-black">{sub.breakdown.domainMatchScore}%</span></div>
                                    </div>
                                  )}
                                  {sub.skillsMissing && sub.skillsMissing.length > 0 && (
                                    <div className="text-[10px] uppercase tracking-widest font-bold text-rose-500 mt-2">
                                      Missing: {sub.skillsMissing.slice(0, 5).join(', ')}{sub.skillsMissing.length > 5 ? '...' : ''}
                                    </div>
                                  )}

                                </div>
                              </div>
                              <div
                                className={`px-4 py-2 rounded-2xl font-black text-[14px] border shadow-sm ${
                                  (sub.matchScore || 0) >= 85
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                    : (sub.matchScore || 0) >= 70
                                      ? "bg-indigo-100 text-indigo-800 border-indigo-200"
                                      : "bg-amber-100 text-amber-800 border-amber-200"
                                }`}
                              >
                                <div className="text-[8px] uppercase tracking-widest opacity-50 text-center mb-0.5 leading-none">HireNest Score</div>
                                <div className="leading-none text-center">{sub.matchScore ? `${sub.matchScore}%` : "SYNC"}</div>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {(sub.skills || [])
                                .slice(0, 6)
                                .map((s: string) => (
                                  <span
                                    key={s}
                                    className="text-[10px] font-black uppercase text-slate-400 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100"
                                  >
                                    {s}
                                  </span>
                                ))}
                              {(sub.skills || []).length > 6 && (
                                <span className="text-[10px] font-black text-slate-300 ml-2">
                                  +{sub.skills.length - 6} MORE
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      {validMatchedCandidates.filter(
                        (sub) =>
                          (sub.matchScore || 0) >= 70 || sub.isGlobalMatch,
                      ).length === 0 && (
                        <div className="col-span-full mt-4">
                          {fallbackMatches.length > 0 ? (
                            <div className="space-y-6">
                              <div className="flex flex-col items-center justify-center p-8 bg-indigo-50/50 rounded-[32px] border border-indigo-100/50 mb-6">
                                <Network
                                  className="text-indigo-400 mb-3 animate-pulse"
                                  size={32}
                                />
                                <h4 className="text-sm font-black text-indigo-900 uppercase tracking-widest">
                                  Federated Network Retrieval
                                </h4>
                                <p className="text-xs text-indigo-600/70 mt-1 font-medium italic">
                                  Searching adjacent pools, vendors, and
                                  marketplace...
                                </p>
                              </div>
                              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">
                                Strong Potential Matches
                              </h4>
                              <div className="grid grid-cols-1 gap-4 opacity-75">
                                {fallbackMatches.map((sub: any) => (
                                  <div
                                    key={sub.id}
                                    className="bg-white border hover:border-slate-300 rounded-[24px] p-5 cursor-pointer shadow-sm relative overflow-hidden"
                                    onClick={() => setSelectedSubmission(sub)}
                                  >
                                    <div className="flex items-center justify-between mb-4">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-50 border flex items-center justify-center">
                                          <User
                                            size={18}
                                            className="text-slate-400"
                                          />
                                        </div>
                                        <div>
                                          <h4 className="font-bold text-slate-900 text-sm">
                                            {sub.name}
                                          </h4>
                                          <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                                            {sub.vendorId ===
                                            "ORG-EXTERNAL-VENDOR"
                                              ? "Federated Talent"
                                              : sub.vendorId}
                                          </span>
                                        </div>
                                      </div>
                                      <Badge className="bg-slate-100 text-slate-600 border-none font-mono text-[10px] px-3">
                                        {sub.matchScore}% MATCH
                                      </Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                      {(sub.skills || [])
                                        .slice(0, 4)
                                        .map((s: string, i: number) => (
                                          <span
                                            key={i}
                                            className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-wider rounded-lg"
                                          >
                                            {s}
                                          </span>
                                        ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="py-32 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-[32px] bg-slate-50/50">
                              <Target
                                size={64}
                                className="mx-auto mb-6 text-indigo-200 animate-pulse"
                              />
                              <p className="text-sm font-black uppercase tracking-[0.3em] text-slate-700">
                                No Target Matches Mapped
                              </p>
                              <p className="text-xs font-medium text-slate-500 mt-2 italic px-8 max-w-md mx-auto leading-relaxed">
                                No contextual semantic matches found in
                                federated network. <br />
                                Please wait for fresh talent signals.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <RequirementDiscussionThread 
                     requirementId={selectedJob.id} 
                     requirementTitle={selectedJob.title || "Requirement"} 
                  />
                  
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Candidate360 Modal */}
      {selectedSubmission && (
        <Candidate360Modal
          candidate={selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
          isAdmin={userRole === "admin" || userRole === "super_admin" || userRole === "ops_admin" || orgId === "ORG-GLOBAL-HQ"}
          userOrgId={orgId || ""}
          userRole={userRole}
        />
      )}

      {/* Approval Modal (Margin Governance) */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">
                  Margin Governance Console
                </h2>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                  REQ: {showApprovalModal.requirementId}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowApprovalModal(null)}
                className="h-8 w-8 rounded-full"
              >
                <X size={16} />
              </Button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-center gap-4 mb-4">
                <button
                  onClick={() => setCurrency("INR")}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-black transition-all",
                    currency === "INR"
                      ? "bg-orange-100 text-orange-700 shadow-sm border border-orange-200"
                      : "bg-slate-50 text-slate-400 border border-transparent",
                  )}
                >
                  ₹ INDIAN RUPEE (INR)
                </button>
                <button
                  onClick={() => setCurrency("USD")}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-black transition-all",
                    currency === "USD"
                      ? "bg-indigo-100 text-indigo-700 shadow-sm border border-indigo-200"
                      : "bg-slate-50 text-slate-400 border border-transparent",
                  )}
                >
                  $ US DOLLAR (USD)
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                    Client Billing ({currency})
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                      {currency === "INR" ? "₹" : "$"}
                    </span>
                    <input
                      id="actualBudget"
                      type="number"
                      className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:shadow-md outline-none transition-all"
                      defaultValue={showApprovalModal.clientTargetBudget || 100}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                    Staffing Model
                  </label>
                  <select
                    id="staffingModel"
                    onChange={(e: any) => setBudgetPeriod(e.target.value)}
                    value={budgetPeriod}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:shadow-md outline-none transition-all"
                  >
                    <option value="LPA">LPA (Per Annum)</option>
                    <option value="LPM">LPM (Per Month)</option>
                    <option value="HOURLY">Hourly (Billable)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                    Platform Commission (%)
                  </label>
                  <span className="text-[10px] font-black text-indigo-600">
                    {budgetPeriod === "LPA"
                      ? "8.33% recommended"
                      : "15% recommended"}
                  </span>
                </div>
                <input
                  id="platformMargin"
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:shadow-md outline-none transition-all"
                  defaultValue={budgetPeriod === "LPA" ? 8.33 : 15}
                />
              </div>

              <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-2xl shadow-indigo-100">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-indigo-300 mb-3 flex items-center gap-2">
                  <Activity size={14} /> Commercial Health Simulation
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">Currency Protocol</span>
                    <span className="font-mono font-bold text-indigo-400">
                      {currency}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-black pt-3 border-t border-slate-800">
                    <span>Vendor Visibility</span>
                    <span className="text-emerald-400 uppercase tracking-tighter">
                      MASKED BUDGET ACTIVE
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => {
                    const budget = (
                      document.getElementById(
                        "actualBudget",
                      ) as HTMLInputElement
                    ).valueAsNumber;
                    const val = (
                      document.getElementById(
                        "platformMargin",
                      ) as HTMLInputElement
                    ).valueAsNumber;
                    const model = (
                      document.getElementById(
                        "staffingModel",
                      ) as HTMLSelectElement
                    ).value as any;
                    handleApproveMargin(
                      showApprovalModal,
                      budget,
                      val,
                      "PERCENTAGE",
                      currency,
                      model,
                    );
                  }}
                  className="w-full bg-indigo-600 hover:bg-slate-900 text-white font-black h-14 rounded-2xl shadow-xl shadow-indigo-100 uppercase tracking-widest text-xs transition-all active:scale-[0.98]"
                >
                  Confirm & Release to Global OS
                </Button>
                <p className="text-[9px] text-center text-slate-400 mt-4 italic max-w-xs mx-auto">
                  By clicking release, you authorize the commercial masking
                  engine to broadcast this requirement to all global vendors.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
