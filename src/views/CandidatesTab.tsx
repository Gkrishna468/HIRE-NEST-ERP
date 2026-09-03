import React, { useEffect, useState, ChangeEvent } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { BulkUploadProcess } from "../components/BulkUploadProcess";
import { Badge } from "../lib/Badge";
import {
  Activity,
  ShieldCheck,
  CheckCircle,
  Sparkles,
  AlertTriangle,
  Briefcase,
  Bot,
  Shield,
  Send,
  X,
  Plus,
  Upload,
  MapPin,
  ShieldAlert,
  Fingerprint,
  Users,
  Pencil,
  Check,
} from "lucide-react";
import { Button } from "../lib/Button";
import { cn } from "../lib/utils";
import { generateIdentityHash, checkAndClaimOwnership } from "../lib/ownershipVault";
import {
  db,
  auth,
  storage,
  handleFirestoreError,
  OperationType,
} from "../lib/firebase";
import {
  collection,
  query,
  onSnapshot,
  doc,
  setDoc as firebaseSetDoc,
  addDoc,
  getDoc,
  getDocs,
  serverTimestamp,
  where,
  updateDoc as firebaseUpdateDoc,
  deleteDoc as firebaseDeleteDoc,
  limit,
  arrayUnion,
  orderBy,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { parseBulkResumes } from "../services/aiService";
import { publishEvent } from "../lib/eventEngine";
import { emitEvent } from "../services/eventBus";

const setDoc = async (ref: any, data: any, options?: any) => {
  const result = await firebaseSetDoc(ref, data, options);
  try {
    const path = ref.path || "";
    if (path.startsWith("candidatePool/")) {
      const candidateId = path.split("/")[1];
      fetch("/api/events/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "CANDIDATE_CREATED",
          payload: { candidateId, id: candidateId, ...data },
          source: "UI",
          orgId: data.orgId || data.vendorId || "SYSTEM"
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
    if (path.startsWith("candidatePool/")) {
      const candidateId = path.split("/")[1];
      const isWithdrawn = data.status === "WITHDRAWN" || data.status === "ARCHIVED";
      const eventType = isWithdrawn ? "CANDIDATE_WITHDRAWN" : "CANDIDATE_UPDATED";
      fetch("/api/events/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: eventType,
          payload: { candidateId, id: candidateId, ...data },
          source: "UI",
          orgId: data.orgId || data.vendorId || "SYSTEM"
        })
      }).catch((e) => console.warn("Failed event publish on updateDoc", e));
    }
  } catch (e) {
    console.warn("Event publishing failed on updateDoc wrapper", e);
  }
  return result;
};

const deleteDoc = async (ref: any) => {
  try {
    const path = ref.path || "";
    if (path.startsWith("candidatePool/")) {
      const candidateId = path.split("/")[1];
      fetch("/api/events/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "CANDIDATE_WITHDRAWN",
          payload: { candidateId, id: candidateId },
          source: "UI"
        })
      }).catch((e) => console.warn("Failed event publish on deleteDoc", e));
    }
  } catch (e) {
    console.warn("Event publishing failed on deleteDoc wrapper", e);
  }
  return firebaseDeleteDoc(ref);
};

import CandidateSubmissionModal from "../components/CandidateSubmissionModal";
import { EmptyState } from "../components/EmptyState";
import Candidate360Modal from "../components/modals/Candidate360Modal";

const getSkillsArray = (skills: any): string[] => {
  if (Array.isArray(skills)) return skills;
  if (typeof skills === "string") {
    return skills
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
  }
  return [];
};



const STAGES = [
  "Processing",
  "Added",
  "Matched",
  "Submitted",
  "Interviewing",
  "Offer",
  "Placed",
];

const VendorCandidatePipeline = ({ candidates, onCandidateClick }: { candidates: any[], onCandidateClick: (c: any) => void }) => {
const PIPELINE_STAGES = [
    "Candidate Added",
    "Matched",
    "Submitted",
    "Shortlisted",
    "Interview",
    "Offer",
    "Placement"
  ];
  
  const handleDrop = async (e: React.DragEvent, newStage: string) => {
    e.preventDefault();
    try {
      const cardData = JSON.parse(e.dataTransfer.getData("application/json"));
      if (cardData && cardData.id) {
         const { updateDoc, doc } = await import("firebase/firestore");
         
         if (cardData.isSubmission && cardData.submissionId) {
             let status = newStage.toUpperCase();
             if (newStage === "Candidate Added") status = "ADDED";
             else if (newStage === "Matched") status = "MATCHED";
             else if (newStage === "Submitted") status = "SUBMITTED";
             else if (newStage === "Shortlisted") status = "SHORTLISTED";
             else if (newStage === "Interview") status = "INTERVIEW_REQUESTED";
             else if (newStage === "Offer") status = "OFFER_DRAFTED";
             else if (newStage === "Placement") status = "PLACED";

             await updateDoc(doc(db, "submissions", cardData.submissionId), {
                status: status,
                updatedAt: new Date().toISOString()
             });
         } else {
             await updateDoc(doc(db, "candidatePool", cardData.id), {
                pipelineStage: newStage,
                updatedAt: new Date().toISOString()
             });
         }
      }
    } catch(err) {
      console.error(err);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const mappedStages = PIPELINE_STAGES.map(stage => {
      return {
          title: stage,
          items: candidates.filter(c => {
               const st = (c.highestStage || c.pipelineStage || c.status || "Candidate Added").toUpperCase();
               
               const isMatch = st.includes("MATCH");
               const isSubmit = st.includes("SUBMIT") || st.includes("PENDING_REVIEW");
               const isShortlist = st.includes("SHORTLIST");
               const isInterview = st.includes("INTERVIEW");
               const isOffer = st.includes("OFFER");
               const isPlacement = st.includes("PLACE") || st.includes("ONBOARD");

               if(stage === "Matched") return isMatch;
               if(stage === "Submitted") return isSubmit;
               if(stage === "Shortlisted") return isShortlist;
               if(stage === "Interview") return isInterview;
               if(stage === "Offer") return isOffer;
               if(stage === "Placement") return isPlacement;
               
               // Candidate Added: Only if it doesn't match any of the advanced stages
               if(stage === "Candidate Added") {
                   return !isMatch && !isSubmit && !isShortlist && !isInterview && !isOffer && !isPlacement;
               }
               return false;
          })
      }
  });

  return (
    <div className="flex overflow-x-auto gap-6 pb-8 h-full min-h-[600px] items-start snap-x">
      {mappedStages.map((stage) => (
        <div key={stage.title} className="flex-shrink-0 w-80 bg-slate-100 rounded-xl p-4 flex flex-col snap-start border border-slate-200/60 max-h-full"
           onDragOver={handleDragOver}
           onDrop={(e) => handleDrop(e, stage.title)}
        >
          <div className="flex justify-between items-center mb-4 px-1">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">{stage.title}</h3>
            <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">
              {stage.items.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
             {stage.items.map((candidate) => (
                <div
                  key={candidate.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("application/json", JSON.stringify(candidate))}
                  onClick={() => onCandidateClick(candidate)}
                  className="bg-white rounded-lg p-4 shadow-sm border border-slate-200 cursor-grab hover:border-indigo-300 hover:shadow-md transition-all group flex flex-col space-y-2"
                >
                  <div>
                    <p className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center justify-between gap-1">
                      <span className="truncate">{candidate.fullName || candidate.name || "Unknown"}</span>
                      {candidate.matchScore > 0 && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">
                          {candidate.matchScore}%
                        </span>
                      )}
                    </p>
                    <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                      {candidate.candidateId || candidate.id || "HN-CAN-PENDING"}
                    </span>
                  </div>

                  {/* Parsed Status Badge */}
                  {(candidate.distillationStatus === "FAILED" || candidate.status === "FAILED") ? (
                    <div className="flex items-center gap-1 text-rose-600 text-[10px] font-bold uppercase tracking-wider bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded w-max">
                       <ShieldAlert className="w-3 h-3 text-rose-500" />
                       Parse Failed
                    </div>
                  ) : (candidate.distillationStatus === "COMPLETED" || candidate.status === "COMPLETED") ? (
                    <div className="flex items-center gap-1 text-emerald-600 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded w-max">
                       <CheckCircle className="w-3 h-3 text-emerald-500" />
                       Parsed ✓
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-indigo-600 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded w-max">
                       <Activity className="w-3 h-3 text-indigo-500 animate-pulse" />
                       Processing
                    </div>
                  )}

                  <p className="text-xs text-slate-500 truncate">{candidate.primaryEmail || candidate.email || "No Email Provided"}</p>

                  {/* Skills preview */}
                  {candidate.skills && getSkillsArray(candidate.skills).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {getSkillsArray(candidate.skills).slice(0, 2).map((skill: string, idx: number) => (
                        <span key={idx} className="text-[9px] font-medium bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                          {skill}
                        </span>
                      ))}
                      {getSkillsArray(candidate.skills).length > 2 && (
                        <span className="text-[9px] text-slate-400 px-1.5 py-0.5">
                          +{getSkillsArray(candidate.skills).length - 2}
                         </span>
                      )}
                    </div>
                  )}

                  {candidate.createdAt && (
                    <div className="text-[9px] text-slate-400 font-medium pt-1 border-t border-slate-100 mt-1">
                      Parsed: {(() => {
                         const dateVal = candidate.resumeLastParsedAt || candidate.createdAt;
                         if (!dateVal) return "";
                         try {
                           const d = dateVal.seconds ? new Date(dateVal.seconds * 1000) : new Date(dateVal);
                           return d.toLocaleDateString(undefined, {
                             month: "short",
                             day: "numeric",
                             year: "numeric"
                           });
                         } catch (e) {
                           return "";
                         }
                      })()}
                    </div>
                  )}
                </div>
             ))}
          </div>
        </div>
      ))}
    </div>
  );
};

import ClientCandidateWorkspace from "./workspaces/ClientCandidateWorkspace";
import DirectCandidatesWorkspace from "./DirectCandidatesWorkspace";

export default function CandidatesTab() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [candidateCategory, setCandidateCategory] = useState<"ALL" | "VENDOR" | "DIRECT">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"GRID"|"PIPELINE">("GRID");
  const [selectedCandidatesIds, setSelectedCandidatesIds] = useState<string[]>(
    [],
  );
  const [candidateSubmissions, setCandidateSubmissions] = useState<any[]>([]);
  const [globalSubmissions, setGlobalSubmissions] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    linkedin: "",
    skills: "",
    resumeText: "",
    experience: "",
  });
  const [bulkText, setBulkText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [userOrgId, setUserOrgId] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [mappingResult, setMappingResult] = useState<any | null>(null);
  const [isMapping, setIsMapping] = useState(false);
  const [editingName, setEditingName] = useState<{ id: string; name: string } | null>(null);
  const [isSavingName, setIsSavingName] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");
  const [vendorMap, setVendorMap] = useState<Record<string, string>>({});
  const [candidateEvents, setCandidateEvents] = useState<any[]>([]);
  const [processingStats, setProcessingStats] = useState<{
    show: boolean;
    total: number;
    processing: number;
    parsed: number;
    failed: number;
    matched: number;
  } | null>(null);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiSearchResults, setAiSearchResults] = useState<any[] | null>(null);

  const isAdmin =
    userRole === "admin" ||
    userRole === "super_admin" ||
    userRole === "ops_admin" ||
    userRole === "hq_admin" ||
    userRole === "hq";

  // Direct (Candidate Portal) candidates are Admin-only. Bounce non-admins
  // back to the default view if they somehow land on the DIRECT category
  // (e.g. stale state) so vendors never see it.
  useEffect(() => {
    if (candidateCategory === "DIRECT" && !isAdmin) {
      setCandidateCategory("ALL");
    }
  }, [candidateCategory, isAdmin]);

  const handleCleanupSyntheticCandidates = async () => {
    if (!window.confirm("Are you sure you want to clean up all synthetic 'CAND_P6D_FAIL...' and failed parsing candidate records? This will delete them permanently from Firestore.")) {
      return;
    }
    
    setIsBulkProcessing(true);
    let deletedCount = 0;
    try {
      const { collection, getDocs, deleteDoc, doc } = await import("firebase/firestore");
      const snap = await getDocs(collection(db, "candidatePool"));
      
      const deletePromises = snap.docs.map(async (d) => {
        const data = d.data();
        const docId = d.id;
        const name = (data.fullName || data.name || "").toUpperCase();
        
        const isSynthetic = 
          docId.startsWith("CAND_P6D_FAIL") ||
          name.startsWith("CAND_P6D_FAIL") ||
          name.includes("MISSING SKILL") ||
          name.includes("NEEDS MANUAL REVIEW") ||
          name.includes("PARSING PENDING") ||
          name.includes("LOCAL MOCK GENERATED");
          
        if (isSynthetic) {
          try {
            await deleteDoc(doc(db, "candidatePool", docId));
            deletedCount++;
          } catch (err) {
            console.error(`Failed to delete legacy doc ${docId}:`, err);
          }
        }
      });
      
      await Promise.all(deletePromises);
      alert(`Success! Permanently deleted ${deletedCount} synthetic / failed candidate records.`);
    } catch (e: any) {
      console.error("Cleanup error:", e);
      alert("Error cleaning up synthetic candidates: " + e.message);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleNameSave = async (candId: string) => {
    if (!editingName || !editingName.name.trim()) return;
    try {
      setIsSavingName(true);
      const newName = editingName.name.trim();
      const candRef = doc(db, "candidatePool", candId);
      const candSnap = await getDoc(candRef);
      
      await updateDoc(candRef, {
        name: newName,
        fullName: newName,
        status: "UPLOADED", // Optionally advance status if needed
        isNameManuallyEdited: true,
        updatedAt: serverTimestamp(),
      });

      if (candSnap.exists()) {
         const data = candSnap.data();
         const candHash = await generateIdentityHash(
            data.email || "", 
            data.phone !== "No Phone Provided" ? data.phone || "" : "",
            data.name || data.fullName || "",
            data.linkedin || "",
            data.experience || ""
         );
         if (candHash) {
             try {
                await updateDoc(doc(db, "candidate_identity", candHash), {
                    candidateName: newName
                });
             } catch(e) { }
             try {
                const octq = query(collection(db, "ownership_claims"), where("candidateHash", "==", candHash));
                const octsnap = await getDocs(octq);
                await Promise.all(octsnap.docs.map(octDoc => updateDoc(doc(db, "ownership_claims", octDoc.id), {
                   candidateName: newName
                })));
             } catch(e) { }
         }
      }

      // Update submissions as well so it populates across workspaces
      const subQuery = query(
        collection(db, "submissions"),
        where("candidateId", "==", candId)
      );
      const subSnap = await getDocs(subQuery);
      const updatePromises = subSnap.docs.map((subDoc) =>
        updateDoc(doc(db, "submissions", subDoc.id), {
          name: newName,
          candidateName: newName,
          updatedAt: serverTimestamp(),
        })
      );
      await Promise.all(updatePromises);

      const oldName = candSnap.exists() ? candSnap.data().name : "Unknown Name";

      // Create Immutable Candidate Change Log (especially for ABAC and Ownership Ledger reconciliation)
      try {
        const changeLogId = `LOG-${Math.random().toString(36).substr(2, 9)}`;
        await setDoc(doc(db, "candidate_change_log", changeLogId), {
          logId: changeLogId,
          candidateId: candId,
          field: "fullName",
          oldValue: oldName,
          newValue: newName,
          editedBy: userRole,
          editedAt: serverTimestamp(),
        });
      } catch (logErr) {
        console.warn("Failed to write to candidate_change_log:", logErr);
      }

      await publishEvent({
        type: "info",
        title: "Candidate Name Corrected",
        message: `Candidate name changed from ${oldName} to ${newName} by ${userRole}`,
        recipients: ["GLOBAL_ADMIN", userRole.includes("vendor") ? userOrgId || "GLOBAL_VENDOR" : "GLOBAL_VENDOR"],
      });
      setEditingName(null);
    } catch (err) {
      console.error("Failed to update candidate name:", err);
      handleFirestoreError(err, OperationType.UPDATE, "candidatePool");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleDeleteCandidate = async (candId: string) => {
    if (!isAdmin) {
      // Inline notification handled via UI typically, but just return to prevent execution
      return;
    }

    try {
      const realCandidateId = selectedCandidate?.candidateId || selectedCandidate?.originalId || candId;
      
      // Delete the candidate itself
      await deleteDoc(doc(db, "candidatePool", realCandidateId));
      
      // Delete any associated submissions securely
      const q = query(collection(db, "submissions"), where("candidateId", "==", realCandidateId));
      const qSnap = await getDocs(q);
      for (const d of qSnap.docs) {
         await deleteDoc(doc(db, "submissions", d.id));
      }
      
      // If the passed in ID was actually just a loose submission ID due to missing parent data, delete it too
      if (candId !== realCandidateId) {
         await deleteDoc(doc(db, "submissions", candId));
      }

      setSelectedCandidate(null);
    } catch (e: any) {
      console.error("Failed to delete candidate: " + e.message);
    }
  };

  const consecutiveErrorsRef = React.useRef(0);
  const retryTimeoutRef = React.useRef<any>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let isCancelled = false;

    const init = async () => {
      if (!auth.currentUser) return;

      try {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        let orgId = "ORG-GLOBAL-HQ";
        let role = "admin";

        if (userDoc.exists()) {
          const userData = userDoc.data();
          orgId = userData.organizationId || "";
          role = userData.role || "guest";
        }

        setUserOrgId(orgId);
        setUserRole(role);

        // Load active jobs for mapping (limited to prevent real-time explosion)
        const jobsQuery = query(
          collection(db, "requirements_public"),
          where("status", "==", "PUBLISHED"),
          limit(50),
        );
        onSnapshot(
          jobsQuery,
          (snap) => {
            setJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          },
          (error) => {
            handleFirestoreError(
              error,
              OperationType.GET,
              "requirements_public_mapping",
            );
          },
        );

        // Initial load from API
        try {
          const res = await fetch(
            `/api/candidates?orgId=${orgId}&role=${role}`,
          );
          if (res.ok) {
            const data = await res.json();
            setCandidates(data.candidates || []);
          }
        } catch (e) {
          console.warn("Initial API load failed");
        }

        // Real-time listener WITH STRICT LIMITS
        if (orgId) {
          const isAdminUser =
            role === "admin" ||
            role === "super_admin" ||
            role === "ops_admin" ||
            role === "hq_admin";
          const isClientUser = role.includes("client");

          const q = isAdminUser
            ? query(collection(db, "candidatePool"), limit(50))
            : isClientUser
              ? query(
                  collection(db, "candidatePool"),
                  where("clientId", "==", orgId),
                  limit(50),
                )
              : query(
                  collection(db, "candidatePool"),
                  where("vendorId", "==", orgId),
                  limit(50),
                );

          if (!q) {
            setCandidates([]);
          } else {
            const startListening = () => {
              if (isCancelled) return;
              if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);

              unsubscribe = onSnapshot(
                q,
                (snap) => {
                  consecutiveErrorsRef.current = 0; // reset on success!
                  setCandidates(
                    snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c: any) => {
                       if (
                         c.status === "DELETED" || 
                         c.isActive === false || 
                         c.name === "Parsing Pending" || 
                         c.status === "PARSING_PENDING"
                       ) {
                         return false;
                       }
                       const isDirect = c.sourceType === "DIRECT_CANDIDATE" || c.source === "direct registration" || c.isDirect === true;
                       if (isDirect && !isAdminUser) {
                         return false;
                       }
                       return true;
                    }),
                  );
                },
                (error: any) => {
                  console.error("[onSnapshot error in candidatePool]:", error);
                  handleFirestoreError(error, OperationType.GET, "candidatePool");
                  
                  // Increment error count and backoff
                  consecutiveErrorsRef.current += 1;
                  const delay = Math.min(1000 * Math.pow(2, consecutiveErrorsRef.current), 30000);
                  console.warn(`[onSnapshot Backoff] Pausing listener. Retrying in ${delay}ms (Attempt #${consecutiveErrorsRef.current})`);
                  
                  if (unsubscribe) {
                    unsubscribe();
                    unsubscribe = undefined;
                  }

                  // Only retry if we haven't hit too many consecutive errors
                  if (consecutiveErrorsRef.current <= 5 && !isCancelled) {
                    retryTimeoutRef.current = setTimeout(() => {
                      startListening();
                    }, delay);
                  } else {
                    console.error("[onSnapshot Fatal] Exceeded max retries or listener cancelled for candidatePool.");
                  }
                },
              );
            };

            startListening();
          }

          let qSub = null;
          if (isAdmin) {
             qSub = query(collection(db, "submissions"), limit(50));
          } else if (isClientUser) {
             qSub = query(collection(db, "submissions"), where("clientId", "==", orgId), limit(50));
          } else {
             qSub = query(collection(db, "submissions"), where("vendorId", "==", orgId), limit(50));
          }

          if (qSub) {
             onSnapshot(qSub, snap => {
                setGlobalSubmissions(snap.docs.map(d => ({id: d.id, ...d.data()})));
             });
          }

          try {
            const vMap: Record<string, string> = {};
            if (isAdmin) {
              const orgsSnap = await getDocs(query(collection(db, "organizations"), limit(25)));
              orgsSnap.docs.forEach((d) => {
                const data = d.data();
                if (data.name) {
                  vMap[d.id] = data.name;
                }
              });
              const usersSnap = await getDocs(query(collection(db, "users"), limit(25)));
              usersSnap.docs.forEach((d) => {
                const data = d.data();
                if (data.organizationId && data.name && !vMap[data.organizationId]) {
                  vMap[data.organizationId] = data.name;
                }
              });
            } else if (orgId) {
               const orgDoc = await getDoc(doc(db, "organizations", orgId));
               if(orgDoc.exists()) {
                 vMap[orgDoc.id] = orgDoc.data()?.name;
               }
            }
            setVendorMap(vMap);
          } catch (e) {
            console.warn("Failed to fetch organizations for vendor map");
          }
        }
      } catch (err: any) {
        console.warn("Auth initialization logic failed:", err.message);
      }
    };

    init();
    return () => {
      isCancelled = true;
      if (unsubscribe) unsubscribe();
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!selectedCandidate) {
      setCandidateSubmissions([]);
      return;
    }

    const unsubs: any[] = [];
    const loadSubmissions = async () => {
      try {
        const id = selectedCandidate.originalId || selectedCandidate.id || selectedCandidate.candidateId;
        let qId = query(
          collection(db, "submissions"),
          where("candidateId", "==", id),
        );

        const isClientUser = userRole.includes("client");
        const isVendorUser =
          userRole.includes("vendor") ||
          userRole.includes("recruiter") ||
          userRole.includes("independent");

        if (isClientUser) {
          qId = query(
            collection(db, "submissions"),
            where("candidateId", "==", id),
            where("clientId", "==", userOrgId),
          );
        } else if (isVendorUser && !isAdmin) {
          qId = query(
            collection(db, "submissions"),
            where("candidateId", "==", id),
            where("vendorId", "==", userOrgId),
          );
        }

        // Listen to submissions via candidateId
        const unsub = onSnapshot(qId, (snap) => {
          setCandidateSubmissions(
            snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s:any) => s.status !== "DELETED" && s.isActive !== false),
          );
        });
        unsubs.push(unsub);
        
        // Listen to operational events associated with this candidate for timeline
        let qEvents = null;
        if (isAdmin) {
            qEvents = query(
              collection(db, "operationalEvents"),
              where("entityId", "==", id)
            );
        } else if (userOrgId) {
            qEvents = query(
              collection(db, "operationalEvents"),
              where("entityId", "==", id),
              where("metadata.vendorId", "==", userOrgId)
            );
        }
        
        if (qEvents) {
          const unsubEvents = onSnapshot(qEvents, (snap) => {
             const evs = snap.docs.map(d => ({id: d.id, ...d.data()}));
             evs.sort((a: any, b: any) => {
               const ta = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp || 0).getTime();
               const tb = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp || 0).getTime();
               return tb - ta;
             });
             setCandidateEvents(evs);
          }, (err) => {
             // Gracefully ignore index/permission errors for now during dev
             console.warn("Event timeline error:", err.message);
          });
          unsubs.push(unsubEvents);
        }
        
      } catch (err) {
        console.warn("Error subscribing to candidate submissions", err);
      }
    };
    loadSubmissions();

    return () => unsubs.forEach((u) => u());
  }, [selectedCandidate]);

  const checkDuplicate = (email: string, phone: string, currentId?: string) => {
    if (!email && !phone) return null;
    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedPhone = phone?.replace(/\D/g, "");

    for (const c of candidates) {
      if (c.id === currentId || c.candidateId === currentId) continue;

      const cEmail = c.primaryEmail || c.email;
      const cPhone = c.phoneHash || c.phone;

      if (
        normalizedEmail &&
        cEmail &&
        cEmail.trim().toLowerCase() === normalizedEmail
      ) {
        return { candidate: c, type: "email", value: cEmail };
      }

      if (
        normalizedPhone &&
        cPhone &&
        cPhone.replace(/\D/g, "") === normalizedPhone
      ) {
        return { candidate: c, type: "phone", value: cPhone };
      }
    }
    return null;
  };

  const handleMergeDuplicate = async (dupCand: any) => {
    if (!dupCand.duplicateOf) {
      console.warn("Missing reference to the original candidate.");
      return;
    }

    // Automatically confirmed
    try {
      const origRef = doc(db, "candidatePool", dupCand.duplicateOf);
      const origSnap = await getDoc(origRef);

      if (origSnap.exists()) {
        const origData = origSnap.data();

        // Merge skills
        const origSkills = getSkillsArray(origData.skills);
        const dupSkills = getSkillsArray(dupCand.skills);
        const mergedSkills = Array.from(new Set([...origSkills, ...dupSkills]));

        // Update original document with merged details
        const mergedData: any = {
          skills: mergedSkills,
          updatedAt: serverTimestamp(),
        };

        // Fill in empty fields in original candidate if duplicate has them
        if (!origData.phone && dupCand.phone) mergedData.phone = dupCand.phone;
        if (!origData.linkedin && dupCand.linkedin)
          mergedData.linkedin = dupCand.linkedin;
        if (!origData.experience && dupCand.experience)
          mergedData.experience = dupCand.experience;
        if (!origData.location && dupCand.location)
          mergedData.location = dupCand.location;

        // Append resume text if both exist
        if (dupCand.resumeText && dupCand.resumeText !== origData.resumeText) {
          mergedData.resumeText =
            (origData.resumeText || "") +
            "\n\n=== Merged Context ===\n" +
            dupCand.resumeText;



        }

        await updateDoc(origRef, mergedData);
      }

      // Delete the duplicate candidate document
      const candRef = doc(
        db,
        "candidatePool",
        dupCand.id || dupCand.candidateId,
      );
      await deleteDoc(candRef);

      setSelectedCandidate(null);
    } catch (e: any) {
      console.error("Error merging duplicate: " + e.message);
    }
  };

  const handleVerifyAsSeparate = async (dupCand: any) => {
    try {
      const candRef = doc(
        db,
        "candidatePool",
        dupCand.id || dupCand.candidateId,
      );
      await updateDoc(candRef, {
        pipelineStage: "Candidate Added",
        isDuplicate: false,
        duplicateOf: "",
        duplicateOfName: "",
        duplicateReason: "",
        updatedAt: serverTimestamp(),
      });
      setSelectedCandidate(null);
    } catch (e: any) {
      console.error("Error verifying candidate: " + e.message);
    }
  };

  const handleIgnoreDuplicate = async (dupCand: any) => {
    // Automatically confirmed
    try {
      const candRef = doc(
        db,
        "candidatePool",
        dupCand.id || dupCand.candidateId,
      );
      await deleteDoc(candRef);
      setSelectedCandidate(null);
    } catch (e: any) {
      console.error("Error discarding candidate: " + e.message);
    }
  };

  const handleAddCandidate = async () => {
    if (!formData.name || !formData.email) {
      alert("Name and Email are required.");
      return;
    }
    if (!userOrgId) {
      alert("Organization session sync pending. Please try again in a moment.");
      return;
    }

    setIsSubmitting(true);
    try {
      let finalCandId = "CAND-" + Math.random().toString(36).substr(2, 9);
      let isDupe = false;
      const dMatch = checkDuplicate(formData.email, formData.phone);

      // Candidate Ownership Vault Logic
      let candHash = null;
      if (formData.email || formData.phone) {
        candHash = await generateIdentityHash(
          formData.email, 
          formData.phone,
          formData.name,
          formData.linkedin,
          formData.experience
        );
      }

      if (dMatch) {
         isDupe = true;
         finalCandId = dMatch.candidate.candidateId || dMatch.candidate.id;
         // Merging logic instead of creating new duplicate doc
         await updateDoc(doc(db, "candidatePool", finalCandId), {
           updatedAt: serverTimestamp(),
           resumeText: formData.resumeText ? 
              ((dMatch.candidate.resumeText || "") + "\n\n=== Merged Context ===\n" + formData.resumeText) : dMatch.candidate.resumeText,




         });
         
         if (candHash) {
           const vaultResult = await checkAndClaimOwnership(candHash, userOrgId, formData.name, "Manual Form Onboarding", formData.email, formData.phone);
           if (!vaultResult.success) {
             alert(`Ownership Vault: Active claim held by another vendor. Dispute ${vaultResult.disputeId} generated.`);
           } else {
             alert("Merged candidate into existing profile successfully.");
           }
         }
      } else {
         const initialCandidate = {
           ...formData,
           fullName: formData.name,
           primaryEmail: formData.email,
           phoneHash: formData.phone,
           skills: getSkillsArray(formData.skills),
           candidateId: finalCandId,
           createdFrom: userRole === "vendor" ? "VENDOR" : "RECRUITER",
           createdVia: "OS",
           createdByRole: (userRole || "vendor").toUpperCase() as any,
           ownerType: userRole === "vendor" ? "VENDOR" : "RECRUITER",
           ownerId: userOrgId || auth.currentUser?.uid || "system",
           ownerName: userRole === "vendor" ? "Vendor Partner" : "Internal Recruiter",
           acquiredAt: new Date().toISOString(),
           acquisitionMethod: "MANUAL" as any,
           vendorId: userOrgId,
           pipelineStage: "Candidate Added",
           isDuplicate: false,
           createdAt: serverTimestamp(),
           updatedAt: serverTimestamp(),
         };
         await setDoc(doc(db, "candidatePool", finalCandId), initialCandidate);
         
         await emitEvent(
           "CandidateUploaded",
           "CANDIDATE",
           finalCandId,
           auth.currentUser?.uid || "system",
           userRole || "vendor",
           {
             name: formData.name,
             source: "Manual Form",
             vendorId: userOrgId,
           }
         );

         if (candHash) {
           await checkAndClaimOwnership(candHash, userOrgId, formData.name, "Manual Form Onboarding", formData.email, formData.phone);
         }
         alert("Candidate successfully onboarded. Intelligence processing in background.");
      }

      setIsSubmitting(false);
      setShowAddForm(false);

      // AI ENRICHMENT: Trigger background processing if intelligence is available via resume text
      if (formData.resumeText) {
        enrichCandidate(finalCandId, formData.resumeText);
      }

      setFormData({
        name: "",
        email: "",
        phone: "",
        linkedin: "",
        skills: "",
        resumeText: "",
        experience: "",
      });

    } catch (e: any) {
      alert("Manual onboarding failed: " + e.message);
      setIsSubmitting(false);
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkText.trim() || !userOrgId) return;
    setIsBulkProcessing(true);
    try {
      const splitResumes = bulkText
        .split("---")
        .map((r) => r.trim())
        .filter((r) => r.length > 10);

      let count = 0;
      for (const text of splitResumes) {
        const candId = "CAND-" + Math.random().toString(36).substr(2, 9);

        await setDoc(doc(db, "candidatePool", candId), {
          name: "Pending Distillation",
          email: `pending@${candId}.local`,
          candidateId: candId,
          vendorId: userOrgId,
          pipelineStage: "Candidate Added",
          distillationStatus: "PROCESSING",
          source: "Bulk Text Paste",
          resumeText: text,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdFrom: userRole === "vendor" ? "VENDOR" : "RECRUITER",
          createdVia: "IMPORT",
          createdByRole: (userRole || "vendor").toUpperCase() as any,
          ownerType: userRole === "vendor" ? "VENDOR" : "RECRUITER",
          ownerId: userOrgId || auth.currentUser?.uid || "system",
          ownerName: userRole === "vendor" ? "Vendor Partner" : "Internal Recruiter",
          acquiredAt: new Date().toISOString(),
          acquisitionMethod: "IMPORT" as any,
        });

        await emitEvent(
          "CandidateUploaded",
          "CANDIDATE",
          candId,
          auth.currentUser?.uid || "system",
          userRole || "vendor",
          {
            name: "Pending Distillation",
            source: "Bulk Upload",
            vendorId: userOrgId,
          }
        );

        // Process inline using the AI proxy
        enrichCandidate(candId, text);
        count++;
      }

      setBulkText("");
      setShowBulkUpload(false);

      setProcessingStats({
        show: true,
        total: count,
        processing: count,
        parsed: 0,
        failed: 0,
        matched: 0,
      });
    } catch (e: any) {
      alert("Bulk upload failed: " + (e.message || "Unknown error"));
    }
    setIsBulkProcessing(false);
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsBulkProcessing(true);
    let successCount = 0;
    let failCount = 0;

    let combinedExtractedText = bulkText;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        const candId = "HN-CAN-" + Math.random().toString(36).substr(2, 9);
        const tempName = file.name
          .replace(/\.[^/.]+$/, "")
          .replace(/[-_]/g, " ");

        let storagePath = "";
        let resumeUrl = "";
        try {
            const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
            const { storage } = await import("../lib/firebase");
            const fileRef = ref(storage, `resumes/${userOrgId}/${candId}/${file.name}`);
            await uploadBytes(fileRef, file);
            storagePath = fileRef.fullPath;
            try {
              resumeUrl = await getDownloadURL(fileRef);
            } catch (urlErr) {
              console.warn("getDownloadURL failed", urlErr);
            }
        } catch (storageErr) {
            console.warn("Storage upload failed, continuing without storage:", storageErr);
        }

        // Call our robust backend extraction and deterministic parsing pipeline
        const formData = new FormData();
        formData.append("file", file);
        formData.append("candidateId", candId);
        formData.append("resumeUrl", resumeUrl);
        formData.append("resumeFileName", file.name);
        formData.append("orgId", userOrgId);
        formData.append("userId", auth.currentUser?.uid || "system");
        formData.append("userRole", userRole || "recruiter");

        const res = await fetch("/api/extract-text", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          throw new Error(`Extraction failed with status ${res.status}`);
        }

        const data = await res.json();
        const extText = data.text || "";

        if (combinedExtractedText) {
          combinedExtractedText += `\n\n---\n\n${extText}`;
        } else {
          combinedExtractedText = extText;
        }

        await emitEvent(
          "CandidateUploaded",
          "CANDIDATE",
          candId,
          auth.currentUser?.uid || "system",
          userRole || "vendor",
          {
            name: data.candidateName || tempName,
            source: "File Upload",
            fileName: file.name,
            vendorId: userOrgId,
          }
        );

        successCount++;
        
        // Update stats to show parsing completion
        setProcessingStats((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            processing: Math.max(0, prev.processing - 1),
            parsed: (prev.parsed || 0) + 1,
          };
        });

      } catch (err: any) {
        console.error("File upload/extraction failed:", err);
        failCount++;
      }
    }

    setBulkText("");
    setIsBulkProcessing(false);
    setShowBulkUpload(false);

    if (failCount > 0) {
      setProcessingStats((prev) =>
        prev
          ? {
              ...prev,
              show: true,
              total: successCount,
              processing: successCount,
              parsed: 0,
              failed: 0,
              matched: 0,
            }
          : null,
      );
      if (successCount === 0) setProcessingStats(null);
    } else {
      setProcessingStats({
        show: true,
        total: successCount,
        processing: successCount,
        parsed: 0,
        failed: 0,
        matched: 0,
      });
    }
  };

   const enrichCandidate = async (candId: string, text: string) => {
    try {
      console.log(`[OS INTELLIGENCE] Queueing profile for ${candId}...`);

      const textIsEmpty = !text || text.trim() === "" || text.includes("[Parse Failure Fallback]") || text.includes("PARSING_PENDING") || text.trim().length < 5;

      if (textIsEmpty) {
        console.warn(`[OS INTELLIGENCE] Text extraction failed or is sparse for ${candId}. Skipping AI parser and marking as failed.`);
        await updateDoc(doc(db, "candidatePool", candId), {
          distillationStatus: "FAILED",
          status: "FAILED",
          requiresManualReview: true,
          pipelineStage: "Added",
          updatedAt: serverTimestamp(),
        });
        await emitEvent(
          "CandidateEnriched",
          "CANDIDATE",
          candId,
          "system",
          "system",
          { error: "Text extraction failed - original document contains no extractable text." }
        );
        setProcessingStats((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            processing: Math.max(0, prev.processing - 1),
            failed: (prev.failed || 0) + 1,
          };
        });
        return;
      }

      await updateDoc(doc(db, "candidatePool", candId), {
        distillationStatus: "PROCESSING",
      });

      // Use the existing proxy method to call the API
      const parsedResults = await parseBulkResumes([text]);
      const result =
        parsedResults && parsedResults.length > 0 ? parsedResults[0] : null;

      if (result && result.name && result.name !== "Pending Distillation" && result.name !== "Parsing Pending") {
        delete result.pipelineStage;
        delete result.candidateId;
        delete result.id;
        
        let updatePayload: any = {
          ...result,
          fullName: result.name, // Map to new schema
          name: result.name, // Legacy
          primaryEmail: result.email, // Map to new schema
          phoneHash: result.phone, // Map to new schema
          distillationStatus: result.status === "PARSE_FAILED" ? "FAILED" : "COMPLETED",
          updatedAt: serverTimestamp(),
          resumeLastParsedAt: new Date().toISOString(),
          resumeParserVersion: "v1_gemini_pro",
          resumeSource: "initial_parse"
        };
        // Do not override email if it's the pending mock
        if (result.email === "pending@hirenest.os" || result.email === "mock@example.com") {
          delete updatePayload.email;
          delete updatePayload.primaryEmail;
        }
        
        // Do not override phone if it's unparsed
        if (result.phone === "N/A" || result.phone === "Unparsed") {
          delete updatePayload.phone;
          delete updatePayload.phoneHash;
        }
        
        // Read current candidate
        const candSnap = await getDoc(doc(db, "candidatePool", candId));
        if (candSnap.exists()) {
           const candData = candSnap.data();
           if (candData.manualName || candData.isNameManuallyEdited || candData.source === "Manual Add" || candData.source === "Manual Form") {
              delete updatePayload.name;
              delete updatePayload.fullName;
           }
        }

        if (
          result.name === "Unnamed Candidate" ||
          result.name === "Parsing Pending" ||
          result.name === "Candidate (Requires Human Review)"
        ) {
          delete updatePayload.name;
          delete updatePayload.fullName;
        }

        // Update basic payload
        let resolvedCandId = candId;

        // IDENTITY RESOLUTION ENGINE & OWNERSHIP VAULT
        try {
          if (
            result.email &&
            result.email !== "No Email Provided" &&
            result.email !== "" &&
            !result.email.includes("pending@") &&
            !result.email.includes("mock@") &&
            !result.email.includes("example.com")
          ) {
            const { query, collection, where, getDocs, deleteDoc, getDoc } =
              await import("firebase/firestore");
              
            const candSnap = await getDoc(doc(db, "candidatePool", candId));
            const submissionVendorId = candSnap.exists() ? candSnap.data().vendorId : "UNKNOWN_VENDOR";

            const candHash = await generateIdentityHash(
              result.email, 
              result.phone !== "No Phone Provided" ? result.phone : "",
              result.name || "",
              result.linkedin || "",
              result.experience || ""
            );
            
            if (candHash) {
                const vaultResult = await checkAndClaimOwnership(candHash, submissionVendorId, result.name, "Bulk Upload AI Parse", result.email, result.phone !== "No Phone Provided" ? result.phone : "");
                
                if (!vaultResult.success) {
                   // This vendor doesn't own the candidate, flag as dispute!
                   updatePayload.pipelineStage = "Added";
                   updatePayload.isDuplicate = true;
                   updatePayload.status = "DISPUTED";
                   updatePayload.duplicateReason = `Ownership Vault: Active claim held by another vendor. Dispute ${vaultResult.disputeId} generated.`;
                   // Skip legacy merge so we don't pollute the actual owner's candidate pool record
                } else {
                   // Legacy Identity resolution for UI consolidation
                   let q = query(
                     collection(db, "candidatePool"),
                     where("email", "==", result.email)
                   );
                   const snap = await getDocs(q);
                   
                   const incomingPhone = result.phone ? result.phone.replace(/\D/g, "") : "";
                   
                   const duplicates = snap.docs.filter((d) => {
                     if (d.id === candId) return false;
                     const targetData = d.data();
                     // Require exact vendor match
                     if (targetData.vendorId !== submissionVendorId && targetData.ownerVendorId !== submissionVendorId) return false;
                     
                     // Condition 1: Hash Match
                     if (updatePayload.resumeHash && updatePayload.resumeHash === targetData.resumeHash) return true;
                     
                     // Condition 2: Email & Phone match
                     const existingPhone = targetData.phone ? targetData.phone.replace(/\D/g, "") : "";
                     if (existingPhone && incomingPhone && existingPhone === incomingPhone) return true;
                     
                     return false;
                   });
       
                   if (duplicates.length > 0) {
                     const primary = duplicates[0];
                     resolvedCandId = primary.id;
                     console.log(
                       `[IDENTITY RESOLUTION] Merging duplicate upload for ${result.email} into existing primary ID: ${resolvedCandId}`,
                     );
                     // Update the primary instead
                     const primaryData = primary.data() as any;
                     await updateDoc(doc(db, "candidatePool", resolvedCandId), {
                       resumeText:
                         updatePayload.resumeText || primaryData.resumeText,
                       updatedAt: serverTimestamp(),
                     });
                     // Delete the ghost duplicate
                     await deleteDoc(doc(db, "candidatePool", candId));
                     updatePayload = null; // Prevent update of the deleted document
                   }
                }
            }
          }
        } catch (idErr) {
          console.warn("Identity Resolution Error:", idErr);
        }

        if (updatePayload) {
          await updateDoc(
            doc(db, "candidatePool", resolvedCandId),
            updatePayload,
          );

          await publishEvent({
            type: "success",
            title: "Candidate Parsed",
            message: `Intelligence extraction complete for ${result.name}`,
            recipients: ["GLOBAL_ADMIN", "GLOBAL_CLIENT", "GLOBAL_VENDOR"],
          });

          await emitEvent(
            "CandidateEnriched",
            "CANDIDATE",
            resolvedCandId,
            auth.currentUser?.uid || "system",
            userRole || "system",
            {
              name: result.name,
              score: result.overallFitScore || 0,
              vendorId: updatePayload.vendorId || "unknown",
            }
          );
        }

        const isFailed = result.status === "PARSE_FAILED";
        // Update stats
        setProcessingStats((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            processing: Math.max(0, prev.processing - 1),
            parsed: isFailed ? prev.parsed : prev.parsed + 1,
            failed: isFailed ? (prev.failed || 0) + 1 : (prev.failed || 0),
          };
        });

        // Phase 4 - Historical Submission Repair
        try {
          const { query, collection, where, getDocs } =
            await import("firebase/firestore");
          const subsRef = collection(db, "submissions");
          const q = query(subsRef, where("candidateId", "==", resolvedCandId));
          const snap = await getDocs(q);
          for (const sDoc of snap.docs) {
            await updateDoc(doc(db, "submissions", sDoc.id), {
              candidateName: result.name,
              name: result.name,
              skills: result.skills || sDoc.data().skills,
              email: result.email || sDoc.data().email,
              phone: result.phone || sDoc.data().phone,
            });
          }
        } catch (e) {
          console.error("Failed to repair history", e);
        }
      } else {
        await updateDoc(doc(db, "candidatePool", candId), {
          distillationStatus: "FAILED",
        });
        await emitEvent(
          "CandidateEnriched",
          "CANDIDATE",
          candId,
          "system",
          "system",
          { error: "Distillation Failed" }
        );
        // Ensure stats are updated on failure
        setProcessingStats((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            processing: Math.max(0, prev.processing - 1),
            failed: (prev.failed || 0) + 1,
          };
        });
      }
    } catch (err: any) {
      console.error("Failed to queue enrichment:", err);

      await updateDoc(doc(db, "candidatePool", candId), {
        distillationStatus: "FAILED",
      });
      await emitEvent(
        "CandidateEnriched",
        "CANDIDATE",
        candId,
        "system",
        "system",
        { error: err.message || "Extraction crashed" }
      );
      // Ensure stats are updated on exception
      setProcessingStats((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          processing: Math.max(0, prev.processing - 1),
          failed: (prev.failed || 0) + 1,
        };
      });
    }
  };

  const isClient = userRole === "client" || userRole?.startsWith("client_");

  const handleMapToJob = async (jobId: string) => {
    if (!selectedCandidate || !jobId) return;
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;

    if (
      !selectedCandidate.resumeText &&
      (!selectedCandidate.skills || selectedCandidate.skills.length === 0)
    ) {
      alert(
        "INTELLIGENCE GAP ERROR: AI mapping requires resume text or detailed skills. Please update the candidate profile first.",
      );
      setSelectedJobId("");
      return;
    }

    setIsMapping(true);
    setMappingResult(null);
    setSelectedJobId(jobId);

    try {
      const resumeToUse =
        selectedCandidate.resumeText ||
        `Skills: ${getSkillsArray(selectedCandidate.skills).join(", ")}`;
      const res = await fetch("/api/match-candidates-detailed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jd: job.description,
          candidateProfile: resumeToUse,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMappingResult(data);
        
        // 1. Create submission via Orchestrator
        const { SubmissionOrchestrator } = await import("../lib/workflows/SubmissionOrchestrator");
        const dbId = selectedCandidate.originalId || selectedCandidate.id;
        await SubmissionOrchestrator.submitCandidate({
          candidateData: {
            id: dbId,
            name: selectedCandidate.fullName || selectedCandidate.name || undefined,
            email: selectedCandidate.primaryEmail || selectedCandidate.email,
          },
          requirementId: jobId,
          clientId: job.clientId || "HQ",
          vendorId: userOrgId || "HQ",
          submitterId: userRole || "vendor",
          initialStatus: "MATCHED",
          matchScore: data.matchScore || 0,
          aiAnalysis: data
        });

        // 2. Update Candidate Pool
        const { updateDoc, doc, serverTimestamp, arrayUnion } = await import("firebase/firestore");
        await updateDoc(doc(db, "candidatePool", dbId), {
          canonicalRequirementId: jobId,
          mappedJobId: jobId,
          clientId: job.clientId,
          matchScore: data.matchScore,
          matchData: data,
          activePipelines: arrayUnion(jobId),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err: any) {
      alert("Mapping error: " + err.message);
    } finally {
      setIsMapping(false);
    }
  };

  const processSubmission = async () => {
    if (!selectedCandidate || !selectedJobId || !mappingResult) return;
    const job = jobs.find((j) => j.id === selectedJobId);
    if (!job) return;

    const candidateDbId = selectedCandidate.originalId || selectedCandidate.id;

    try {
      // Submission Orchestrator handles Identity, Ownership, Submission, Ledger
      const { SubmissionOrchestrator } = await import("../lib/workflows/SubmissionOrchestrator");
      const resp = await SubmissionOrchestrator.submitCandidate({
        candidateData: {
          id: candidateDbId,
          name: selectedCandidate.fullName || selectedCandidate.name || undefined,
          email: selectedCandidate.primaryEmail || selectedCandidate.email,
        },
        requirementId: selectedJobId,
        clientId: job.clientId,
        vendorId: userOrgId || "HQ",
        submitterId: "HQ_System",
        initialStatus: "SUBMITTED",
        matchScore: mappingResult?.matchScore || 0,
        aiAnalysis: mappingResult
      });
      
      if (!resp.success) {
        alert("Submission failed: " + resp.message);
        return;
      }
      
      const { updateDoc, doc, serverTimestamp, collection, addDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "candidatePool", candidateDbId), {
        updatedAt: serverTimestamp(),
      });
      
      await addDoc(collection(db, "notifications"), {
        id: `NOTIF-${Date.now()}`,
        recipientId: job.clientId,
        title: "New Candidate Submission",
        text: `A candidate has been submitted for ${job.title}.`,
        read: false,
        type: "SUBMISSION",
        createdAt: serverTimestamp(),
      });
      
      alert(`Candidate successfully submitted for ${job.title}!`);
      setMappingResult(null);
      setSelectedJobId("");
      setSelectedCandidate(null);
    } catch (e: any) {
      console.error(e);
      alert("Error processing submission: " + e.message);
    }
  };

  const handleAiSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsAiSearching(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/search/candidates", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ query: searchQuery })
      });
      if (res.ok) {
        const data = await res.json();
        setAiSearchResults(data.candidates || []);
      } else {
        const error = await res.json();
        alert("AI Search failed: " + (error.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("AI Search error: " + err.message);
    } finally {
      setIsAiSearching(false);
    }
  };

  const clearAiSearch = () => {
    setAiSearchResults(null);
    setSearchQuery("");
  };

  const isClientUser = userRole.includes("client") || userRole === "client_hiring_manager";

  if (isClientUser) {
    return <ClientCandidateWorkspace userOrgId={userOrgId || ""} userRole={userRole} />;
  }

  return (
    <div className="flex bg-slate-50 relative min-h-screen">
      <div className="p-8 pb-32 flex-1 max-w-7xl mx-auto w-full overflow-y-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Candidates</h1>
            <p className="text-slate-500 mt-1">Manage, enrich, and map your candidate bench securely.</p>
          </div>
          
          {!isClient && (
            <div className="flex items-center gap-3">
              {candidateCategory !== "DIRECT" && (
                <div className="flex bg-slate-200 border border-slate-200 rounded-md p-1">
                   <button onClick={() => setViewMode("GRID")} className={cn("px-3 py-1.5 text-xs font-semibold rounded transition-colors", viewMode === "GRID" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700")}>Grid</button>
                   <button onClick={() => setViewMode("PIPELINE")} className={cn("px-3 py-1.5 text-xs font-semibold rounded transition-colors", viewMode === "PIPELINE" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700")}>Pipeline</button>
                </div>
              )}
              {viewMode === "GRID" && candidateCategory !== "DIRECT" && (
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    placeholder={aiSearchResults ? "AI Results Active..." : "Search candidates..."} 
                    className={cn(
                      "border rounded-md px-3 py-2 text-sm w-64 outline-none focus:ring-2 transition-all",
                      aiSearchResults ? "border-emerald-500 bg-emerald-50 ring-emerald-500/20" : "border-slate-200 focus:ring-indigo-500"
                    )}
                    value={searchQuery} 
                    onChange={e => setSearchQuery(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleAiSearch()}
                  />
                  {aiSearchResults ? (
                    <Button variant="ghost" size="sm" onClick={clearAiSearch} className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 px-2">
                      <X className="w-4 h-4 mr-1" /> Clear
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleAiSearch} 
                      disabled={isAiSearching || !searchQuery.trim()}
                      className="bg-white border-slate-200 hover:bg-slate-50 text-indigo-600 font-bold border-2"
                    >
                      {isAiSearching ? (
                        <Activity className="w-4 h-4 mr-2 animate-pulse" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2 text-indigo-500" />
                      )}
                      AI Search
                    </Button>
                  )}
                </div>
              )}
              {isAdmin && candidateCategory !== "DIRECT" && (
                <Button 
                  variant="outline" 
                  onClick={handleCleanupSyntheticCandidates}
                  disabled={isBulkProcessing}
                  className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-bold"
                >
                  <AlertTriangle className="w-4 h-4 mr-2 text-rose-500" /> Cleanup Synthetic
                </Button>
              )}
              {candidateCategory !== "DIRECT" && (
                <>
                  <Button variant="outline" onClick={() => setShowBulkUpload(true)}>
                    <Upload className="w-4 h-4 mr-2" /> Bulk Upload
                  </Button>
                  <Button onClick={() => setShowAddForm(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Add Candidate
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Candidate Category Subtabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-slate-200 pb-3">
          {[
            { id: "ALL", label: "All Candidates Pool" },
            { id: "VENDOR", label: "🏢 Vendor Bench Candidates" },
            // Direct (Candidate Portal) candidates are an Admin-only concept —
            // vendors submit their own bench candidates and should never see
            // or navigate into the direct-applicant pool.
            ...(isAdmin ? [{ id: "DIRECT", label: "⭐ Direct Candidates (Candidate Portal)" }] : []),
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCandidateCategory(cat.id as any)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-black tracking-tight transition-all",
                candidateCategory === cat.id
                  ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {candidateCategory === "DIRECT" ? (
          <DirectCandidatesWorkspace isAdmin={isAdmin} userRole={userRole} />
        ) : viewMode === "PIPELINE" ? (
          <VendorCandidatePipeline 
            candidates={(aiSearchResults || (candidateCategory === "VENDOR" ? candidates.filter(c => c.sourceType !== "DIRECT_CANDIDATE") : candidates).map(c => {
               const candSubs = globalSubmissions.filter(s => s.candidateId === (c.originalId || c.id) && s.status !== "REJECTED");
               let highestStage = c.pipelineStage || "Candidate Added";
               
               if (candSubs.length > 0) {
                   const getRank = (st: string) => {
                       const s = (st || "").toUpperCase();
                       if(s.includes("PLACE") || s.includes("ONBOARD")) return 6;
                       if(s.includes("OFFER")) return 5;
                       if(s.includes("INTERVIEW")) return 4;
                       if(s.includes("SHORTLIST")) return 3;
                       if(s.includes("SUBMIT") || s.includes("PENDING_REVIEW") || s === "NEW") return 2;
                       if(s.includes("MATCH")) return 1;
                       return 0;
                   };
                   
                   let maxRank = getRank(highestStage);
                   
                   candSubs.forEach(s => {
                       const subRank = getRank(s.status);
                       if (subRank > maxRank) {
                           maxRank = subRank;
                           highestStage = s.status;
                       }
                   });
               }
               
               return { ...c, highestStage };
            })).filter(
                (c) =>
                  aiSearchResults ||
                  (!searchQuery ||
                  c.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  c.name?.toLowerCase().includes(searchQuery.toLowerCase()))
              )} 
            onCandidateClick={setSelectedCandidate} 
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {(aiSearchResults || candidates.filter(
                (c) =>
                  !searchQuery ||
                  c.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (c.skills && c.skills.join(" ").toLowerCase().includes(searchQuery.toLowerCase()))
              ))
              .map((candidate) => (
                <div
                  key={candidate.id}
                  className="bg-white rounded-xl shadow-[0_2px_8px_-4px_rgba(0,0,0,0.1)] border border-slate-200 p-5 flex flex-col hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
                  onClick={() => setSelectedCandidate(candidate)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-700 shadow-inner">
                      {(candidate.fullName || candidate.name || "U")[0]}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                       <Badge variant={candidate.status === "ACTIVE" ? "success" : "default"}>
                         {candidate.status || "NEW"}
                       </Badge>
                       {(candidate.vendorId || candidate.vendorName) && (
                          <span className="text-[10px] text-slate-400 font-medium truncate max-w-[100px]">
                            {vendorMap[candidate.vendorId] || candidate.vendorName || (candidate.vendorId === 'ORG-GLOBAL-HQ' ? 'WorkNexa Infotech' : candidate.vendorId) || "Direct"}
                          </span>
                       )}
                    </div>
                  </div>
                  
                  <h3 className="font-semibold text-lg text-slate-900 flex flex-col gap-1">
                    <span className="flex items-center gap-2">
                       {candidate.fullName || candidate.name || "Unknown"}
                       {candidate.email && <CheckCircle className="w-4 h-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </span>
                    {(candidate.distillationStatus === "FAILED" || candidate.status === "PARSE_FAILED" || candidate.status === "FAILED") ? (
                       <span className="flex items-center gap-1 text-rose-600 text-[10px] font-bold uppercase tracking-wider mt-1 border border-rose-200 bg-rose-50 px-2 py-0.5 rounded w-max">
                          <ShieldAlert className="w-3 h-3 text-rose-500" />
                          Parse Failed
                       </span>
                    ) : (candidate.distillationStatus === "COMPLETED" || candidate.status === "COMPLETED" || candidate.status === "ACTIVE") ? (
                       <span className="flex items-center gap-1 text-emerald-600 text-[10px] font-bold uppercase tracking-wider mt-1 border border-emerald-200 bg-emerald-50 px-2 py-0.5 rounded w-max">
                          <CheckCircle className="w-3 h-3 text-emerald-500" />
                          Parsed ✓
                       </span>
                    ) : (
                       <span className="flex items-center gap-1 text-indigo-600 text-[10px] font-bold uppercase tracking-wider mt-1 border border-indigo-200 bg-indigo-50 px-2 py-0.5 rounded w-max">
                          <Activity className="w-3 h-3 text-indigo-500 animate-pulse" />
                          Processing
                       </span>
                    )}
                    <span className="text-xs font-mono text-slate-400 font-normal">
                       {candidate.candidateId || candidate.id || "HN-CAN-PENDING"}
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {candidate.createdFrom && (
                        <span className="text-[8px] font-black text-indigo-700 bg-indigo-50/70 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          {candidate.createdFrom} / {candidate.createdVia || "OS"}
                        </span>
                      )}
                      {candidate.ownerName && (
                        <span className="text-[8px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          Owner: {candidate.ownerName}
                        </span>
                      )}
                      {candidate.createdAt && (
                        <span className="text-[8px] font-bold text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          Parsed: {(() => {
                             const dateVal = candidate.resumeLastParsedAt || candidate.createdAt;
                             if (!dateVal) return "";
                             try {
                               const d = dateVal.seconds ? new Date(dateVal.seconds * 1000) : new Date(dateVal);
                               return d.toLocaleDateString(undefined, {
                                 month: "short",
                                 day: "numeric",
                                 year: "numeric"
                               });
                             } catch (e) {
                               return "";
                             }
                          })()}
                        </span>
                      )}
                    </div>
                  </h3>
                  
                  <p className="text-sm text-slate-500 truncate mb-4">
                    {candidate.email || "No email provided"}
                  </p>

                  {candidate.aiSearchReason && (
                    <div className="mb-4 bg-indigo-50 border border-indigo-100 p-2 rounded text-[10px] text-indigo-700 font-medium">
                      <Sparkles className="w-3 h-3 inline mr-1" />
                      {candidate.aiSearchReason}
                    </div>
                  )}

                  <div className="mt-auto pt-4 border-t border-slate-100">
                    <div className="flex flex-wrap gap-1.5">
                      {getSkillsArray(candidate.skills)
                        .slice(0, 3)
                        .map((skill: string, idx: number) => (
                          <span key={idx}>
                            <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 border-slate-200">
                              {skill}
                            </Badge>
                          </span>
                        ))}
                      {getSkillsArray(candidate.skills).length > 3 && (
                        <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500">
                          +{getSkillsArray(candidate.skills).length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            {candidates.length === 0 && (
              <div className="col-span-full py-12">
                <EmptyState
                  icon={Users} title="No Candidates Found"
                  description="Your bench is currently empty or no candidates match your search."
                />
              </div>
            )}
          </div>
        )}

        {/* Selected Candidate Modal */}
        {selectedCandidate && (
          <Candidate360Modal 
             candidate={selectedCandidate}
             onClose={() => setSelectedCandidate(null)}
             isAdmin={isAdmin}
             userRole={userRole}
             userOrgId={userOrgId || "HQ"}
             jobs={jobs}
             vendorMap={vendorMap}
          />
        )}

        {/* Add Modal */}
        {showAddForm && (
          <CandidateSubmissionModal
            onClose={() => setShowAddForm(false)}
            reqId="GENERAL"
            reqTitle="General Pool"
          />
        )}
        
        {/* Bulk Upload logic */}
        {showBulkUpload && (
          <BulkUploadProcess
             onClose={() => setShowBulkUpload(false)}
             userOrgId={userOrgId || "HQ"}
             onImport={async (imported) => {
                 setShowBulkUpload(false);
                 setProcessingStats({ show: true, processing: imported.length, total: imported.length, parsed: 0, failed: 0, matched: 0 });
                 
                 try {
                     const { doc, setDoc, updateDoc, serverTimestamp, getDocs, query, collection, where } = await import("firebase/firestore");
                     
                     let count = 0;
                     for(const c of imported) {
                        let candId = "HN-CAN-" + Math.random().toString(36).substr(2, 9);
                        const file = c.originalFile;
                        
                        // Compute resume text hash for deduplication
                        let resumeHash = "";
                        try {
                          const encoder = new TextEncoder();
                          const hashBuffer = await crypto.subtle.digest(
                            "SHA-256",
                            encoder.encode(c.extractedText || ""),
                          );
                          const hashArray = Array.from(new Uint8Array(hashBuffer));
                          resumeHash = hashArray
                            .map((b) => b.toString(16).padStart(2, "0"))
                            .join("");
                        } catch (hashErr) {
                          console.warn("Hashing failed", hashErr);
                        }

                        // Deduplication check
                        if (resumeHash) {
                          try {
                            let existingUserQ;
                            if (userRole === "admin" || userRole === "super_admin" || userRole === "ops_admin" || userRole === "hq_admin") {
                              existingUserQ = query(
                                collection(db, "candidatePool"),
                                where("resumeHash", "==", resumeHash),
                              );
                            } else {
                              existingUserQ = query(
                                collection(db, "candidatePool"),
                                where("resumeHash", "==", resumeHash),
                                where("vendorId", "==", userOrgId),
                              );
                            }
                            
                            const existingDocs = await getDocs(existingUserQ);
                            if (!existingDocs.empty) {
                              console.warn(`File ${c.fileName} is a duplicate submission (resume matched exactly). Skipping.`);
                              setProcessingStats((prev) => {
                                if (!prev) return null;
                                return {
                                  ...prev,
                                  processing: Math.max(0, prev.processing - 1),
                                  parsed: (prev.parsed || 0) + 1,
                                };
                              });
                              continue;
                            }
                          } catch (dupErr) {
                            console.warn("Duplicate check failed in bulk import:", dupErr);
                          }
                        }

                        // Storage Upload
                        let storagePath = "";
                        if (file) {
                          try {
                              const { ref, uploadBytes } = await import("firebase/storage");
                              const { storage } = await import("../lib/firebase");
                              const fileRef = ref(storage, `resumes/${userOrgId || "HQ"}/${candId}/${c.fileName}`);
                              await uploadBytes(fileRef, file);
                              storagePath = fileRef.fullPath;
                          } catch (storageErr) {
                              console.warn("Storage upload failed in bulk import:", storageErr);
                          }
                        }

                        let isDuplicate = false;
                        let duplicateReason = "";
                        let status = "COMPLETED";
                        let distillationStatus = "COMPLETED";
                        let pipelineStage = "Candidate Added";
                        let resolvedCandId = candId;

                        const email = c.parsedProfile?.email || "";
                        const phone = c.parsedProfile?.phone || "";
                        const name = c.name || c.parsedProfile?.name || "";

                        if (email && email !== "No Email Provided" && !email.includes("pending@") && !email.includes("mock@")) {
                          try {
                            const candHash = await generateIdentityHash(
                              email,
                              phone !== "No Phone Provided" ? phone : "",
                              name,
                              c.parsedProfile?.linkedin || "",
                              c.parsedProfile?.experience || ""
                            );

                            if (candHash) {
                              const vaultResult = await checkAndClaimOwnership(
                                candHash,
                                userOrgId || "HQ",
                                name,
                                "Bulk Upload AI Parse",
                                email,
                                phone !== "No Phone Provided" ? phone : ""
                              );

                              if (!vaultResult.success) {
                                isDuplicate = true;
                                status = "DISPUTED";
                                duplicateReason = `Ownership Vault: Active claim held by another vendor. Dispute ${vaultResult.disputeId} generated.`;
                              } else {
                                // check for local duplicates
                                const q = query(
                                  collection(db, "candidatePool"),
                                  where("email", "==", email)
                                );
                                const snap = await getDocs(q);
                                const incomingPhone = phone ? phone.replace(/\D/g, "") : "";
                                const duplicates = snap.docs.filter((d) => {
                                  const targetData = d.data();
                                  if (targetData.vendorId !== (userOrgId || "HQ") && targetData.ownerVendorId !== (userOrgId || "HQ")) return false;
                                  if (resumeHash && resumeHash === targetData.resumeHash) return true;
                                  const existingPhone = targetData.phone ? targetData.phone.replace(/\D/g, "") : "";
                                  if (existingPhone && incomingPhone && existingPhone === incomingPhone) return true;
                                  return false;
                                });

                                if (duplicates.length > 0) {
                                  const primary = duplicates[0];
                                  resolvedCandId = primary.id;
                                  console.log(`[IDENTITY RESOLUTION] Merging duplicate upload into existing primary ID: ${resolvedCandId}`);
                                  await updateDoc(doc(db, "candidatePool", resolvedCandId), {
                                    resumeText: c.extractedText || primary.data().resumeText,
                                    updatedAt: serverTimestamp(),
                                  });
                                  // Skip creating new document since it is a duplicate
                                  setProcessingStats((prev) => {
                                    if (!prev) return null;
                                    return {
                                      ...prev,
                                      processing: Math.max(0, prev.processing - 1),
                                      parsed: (prev.parsed || 0) + 1,
                                    };
                                  });
                                  continue;
                                }
                              }
                            }
                          } catch (vaultErr) {
                            console.warn("Vault check failed in bulk import:", vaultErr);
                          }
                        }

                        const isSyntheticName = !name || 
                          name === "Candidate Missing Skill" || 
                          name === "Needs Manual Review" || 
                          name === "Parsing Pending" || 
                          name === "Unknown Candidate" || 
                          name === "Unnamed Candidate" || 
                          name === "Candidate Unknown" || 
                          name.startsWith("CAND_P6D_FAIL") ||
                          name.includes("Needs Manual Review");

                        const isFailed = c.status === "FAILED" || c.status === "MANUAL_REVIEW";

                        if (isFailed || isSyntheticName) {
                          console.warn(`Skipping candidate enrichment for failed/synthetic candidate: ${name || c.fileName}`);
                          setProcessingStats((prev) => {
                            if (!prev) return null;
                            return {
                              ...prev,
                              processing: Math.max(0, prev.processing - 1),
                              failed: (prev.failed || 0) + 1,
                            };
                          });
                          continue;
                        }
                        
                        resolvedCandId = c.candidateId || resolvedCandId;

                        // Only update the document since backend already created it
                        try {
                          await updateDoc(doc(db, "candidatePool", resolvedCandId), {
                            storagePath: storagePath,
                            updatedAt: serverTimestamp(),
                          });
                        } catch (e) {
                          console.warn("Failed to update existing candidate document with storage path.", e);
                        }

                        // Trigger notifications & events
                        try {
                          await publishEvent({
                            type: "success",
                            title: "Candidate Parsed",
                            message: `Intelligence extraction complete for ${name}`,
                            recipients: ["GLOBAL_ADMIN", "GLOBAL_CLIENT", "GLOBAL_VENDOR"],
                          });

                          await emitEvent(
                            "CandidateEnriched",
                            "CANDIDATE",
                            resolvedCandId,
                            auth.currentUser?.uid || "system",
                            userRole || "system",
                            {
                              name: name,
                              score: 0,
                              vendorId: userOrgId || "HQ",
                            }
                          );
                        } catch (eventErr) {
                          console.warn("Failed to publish event during bulk import:", eventErr);
                        }
                          
                        count++;
                     }

                     // Trigger background matchmaking scan after successful batch parsing
                     try {
                       const idToken = await auth.currentUser?.getIdToken();
                       fetch("/api/rescan-matches", {
                         method: "POST",
                         headers: {
                           "Content-Type": "application/json",
                           "Authorization": `Bearer ${idToken}`
                         },
                         body: JSON.stringify({ orgId: userOrgId || "HQ" })
                       }).then(res => res.json())
                         .then(data => {
                           console.log("[MATCH_ENGINE_AUTO] Successful match scan:", data);
                           setProcessingStats((prev) => {
                             if (!prev) return null;
                             return {
                               ...prev,
                               processing: 0,
                               parsed: count,
                               matched: data.matchUpdatesCount || 0
                             };
                           });
                         })
                         .catch(err => {
                           console.error("[MATCH_ENGINE_AUTO] Match scan failed:", err);
                           setProcessingStats((prev) => {
                             if (!prev) return null;
                             return {
                               ...prev,
                               processing: 0,
                               parsed: count
                             };
                           });
                         });
                     } catch (matchErr) {
                       console.error("[MATCH_ENGINE_AUTO] Auth Token error:", matchErr);
                       setProcessingStats((prev) => {
                         if (!prev) return null;
                         return {
                           ...prev,
                           processing: 0,
                           parsed: count
                         };
                       });
                     }

                 } catch (e) {
                     console.error("Import error", e);
                 }
             }}
          />
        )}

        {/* Stats Overlay */}
        {processingStats && processingStats.show && (
          <div className="fixed bottom-8 right-8 bg-slate-900 shadow-2xl rounded-2xl p-6 border border-slate-800 w-80 z-50 text-white flex flex-col gap-4 animate-in slide-in-from-bottom-5">
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-2">
                <Activity size={16} className={processingStats.processing > 0 ? "text-indigo-400 animate-spin" : "text-emerald-400"} />
                <h3 className="font-black text-sm uppercase tracking-wider">{processingStats.total} Resumes Uploaded</h3>
              </div>
              <button onClick={() => setProcessingStats(null)} className="text-slate-500 hover:text-white"><X size={16}/></button>
            </div>
            {/* progress bars... */}
            <div className="text-xs text-slate-400 mt-2 flex flex-col gap-1.5">
              <div className="flex justify-between">
                <span>Total Uploaded:</span>
                <span className="font-semibold text-slate-200">{processingStats.total}</span>
              </div>
              <div className="flex justify-between">
                <span>Extracted:</span>
                <span className="font-semibold text-slate-200">{processingStats.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-400">Successfully Parsed:</span>
                <span className="font-semibold text-emerald-400">{processingStats.parsed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-rose-400">Failed:</span>
                <span className="font-semibold text-rose-400">{processingStats.failed}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Pending Processing:</span>
                <span>{processingStats.processing}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
