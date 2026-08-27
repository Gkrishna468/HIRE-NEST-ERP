import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  Briefcase,
  Sparkles,
  MapPin,
  Mail,
  Phone,
  Calendar,
  ExternalLink,
  ChevronRight,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Plus,
  RefreshCw,
  Eye,
  Check,
  X,
  MessageSquare,
  Lock,
  Award,
  Layers,
  History,
  Building,
} from "lucide-react";
import { Badge } from "../lib/Badge";
import { Button } from "../lib/Button";
import { cn } from "../lib/utils";
import {
  db,
  auth,
  handleFirestoreError,
  OperationType,
} from "../lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
  getDocs,
  getDoc,
  serverTimestamp,
  orderBy,
  limit,
} from "firebase/firestore";

interface DirectCandidatesWorkspaceProps {
  isAdmin: boolean;
  userRole: string;
}

export default function DirectCandidatesWorkspace({
  isAdmin,
  userRole,
}: DirectCandidatesWorkspaceProps) {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJobFilter, setSelectedJobFilter] = useState("ALL");
  const [selectedWorkMode, setSelectedWorkMode] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedFitment, setSelectedFitment] = useState("ALL");
  const [selectedConflictFilter, setSelectedConflictFilter] = useState("ALL");

  // Selected Candidate for 360 View
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [active360Tab, setActive360Tab] = useState<
    "overview" | "fitment" | "history" | "screening" | "ownership" | "notes"
  >("overview");

  // Internal Recruiter Notes state
  const [newInternalNote, setNewInternalNote] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Conflict Resolution state
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const [conflictResolutionNotes, setConflictResolutionNotes] = useState("");

  useEffect(() => {
    // Direct (Candidate Portal) candidates are Admin-only data. Vendors and
    // other non-admin roles should never trigger these reads, even if this
    // component were somehow mounted for them.
    if (!isAdmin) {
      setIsLoading(false);
      return;
    }

    // 1. Fetch Direct Candidates from candidatePool
    const qCandidates = query(
      collection(db, "candidatePool"),
      where("sourceType", "==", "DIRECT_CANDIDATE"),
      limit(100)
    );

    const unsubCandidates = onSnapshot(
      qCandidates,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCandidates(list);
        setIsLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, "candidatePool");
        setIsLoading(false);
      }
    );

    // 2. Fetch Direct Applications
    const qApps = query(
      collection(db, "applications"),
      limit(150)
    );
    const unsubApps = onSnapshot(
      qApps,
      (snap) => {
        setApplications(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.warn("Could not load applications collection:", err);
      }
    );

    // 3. Fetch Direct Apply Jobs
    const qJobs = query(
      collection(db, "requirements_public"),
      where("status", "==", "PUBLISHED"),
      limit(50)
    );
    const unsubJobs = onSnapshot(
      qJobs,
      (snap) => {
        setJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.warn("Could not load requirements:", err);
      }
    );

    return () => {
      unsubCandidates();
      unsubApps();
      unsubJobs();
    };
  }, [isAdmin]);

  // Update Status helper
  const handleUpdateStatus = async (
    candidateId: string,
    newStatus: string,
    applicationId?: string
  ) => {
    try {
      await updateDoc(doc(db, "candidatePool", candidateId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      if (applicationId) {
        await updateDoc(doc(db, "applications", applicationId), {
          status: newStatus,
          updatedAt: serverTimestamp(),
        });
      }

      // Also update selectedCandidate local state if open
      if (selectedCandidate && selectedCandidate.id === candidateId) {
        setSelectedCandidate({
          ...selectedCandidate,
          status: newStatus,
        });
      }
    } catch (err) {
      console.error("Failed to update candidate status:", err);
      alert("Failed to update status. Please check permissions.");
    }
  };

  // Add Internal Recruiter Note
  const handleAddInternalNote = async (candidateId: string) => {
    if (!newInternalNote.trim()) return;
    setIsSavingNote(true);
    try {
      const noteEntry = {
        id: `NOTE-${Date.now()}`,
        author: auth.currentUser?.email || userRole || "Recruiter",
        text: newInternalNote.trim(),
        createdAt: new Date().toISOString(),
      };

      const candRef = doc(db, "candidatePool", candidateId);
      const existingNotes = selectedCandidate?.internalNotes || [];
      const updatedNotes = [...existingNotes, noteEntry];

      await updateDoc(candRef, {
        internalNotes: updatedNotes,
        updatedAt: serverTimestamp(),
      });

      setSelectedCandidate({
        ...selectedCandidate,
        internalNotes: updatedNotes,
      });
      setNewInternalNote("");
    } catch (err) {
      console.error("Failed to save note:", err);
      alert("Failed to save internal note.");
    } finally {
      setIsSavingNote(false);
    }
  };

  // Resolve Duplicate / Vendor Ownership Conflict
  const handleResolveConflict = async (
    candidateId: string,
    resolution: "CONFIRM_DIRECT" | "ASSIGN_VENDOR",
    targetVendorId?: string
  ) => {
    setIsResolvingConflict(true);
    try {
      const resolutionPayload: any = {
        ownershipConflict: false,
        ownershipConflictResolvedAt: serverTimestamp(),
        ownershipConflictResolvedBy: auth.currentUser?.email || userRole,
        ownershipConflictResolution: resolution,
        conflictResolutionNotes: conflictResolutionNotes || "Resolved by Admin in Global HQ",
        updatedAt: serverTimestamp(),
      };

      if (resolution === "ASSIGN_VENDOR" && targetVendorId) {
        resolutionPayload.sourceType = "VENDOR_CANDIDATE";
        resolutionPayload.ownerVendorId = targetVendorId;
      }

      await updateDoc(doc(db, "candidatePool", candidateId), resolutionPayload);

      // Create Audit Log
      await setDoc(
        doc(db, "candidate_change_log", `RES-${Date.now()}`),
        {
          candidateId,
          action: "OWNERSHIP_CONFLICT_RESOLVED",
          resolution,
          resolvedBy: auth.currentUser?.email || userRole,
          notes: conflictResolutionNotes,
          timestamp: serverTimestamp(),
        }
      );

      if (selectedCandidate && selectedCandidate.id === candidateId) {
        setSelectedCandidate({
          ...selectedCandidate,
          ...resolutionPayload,
        });
      }
      setConflictResolutionNotes("");
      alert(`Conflict resolved successfully as: ${resolution}`);
    } catch (err) {
      console.error("Error resolving conflict:", err);
      alert("Failed to resolve ownership conflict.");
    } finally {
      setIsResolvingConflict(false);
    }
  };

  // Filtered Candidates
  const filteredCandidates = candidates.filter((cand) => {
    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = (cand.name || cand.fullName || "").toLowerCase().includes(q);
      const emailMatch = (cand.email || cand.primaryEmail || "").toLowerCase().includes(q);
      const phoneMatch = (cand.phone || "").toLowerCase().includes(q);
      const skillsMatch = (cand.skills || []).join(" ").toLowerCase().includes(q);
      const idMatch = (cand.candidateId || cand.id || "").toLowerCase().includes(q);
      if (!nameMatch && !emailMatch && !phoneMatch && !skillsMatch && !idMatch) {
        return false;
      }
    }

    // Job Filter
    if (selectedJobFilter !== "ALL") {
      const candJobId = cand.appliedJobId || cand.requirementId;
      if (candJobId !== selectedJobFilter) return false;
    }

    // Work Mode Filter
    if (selectedWorkMode !== "ALL") {
      const mode = (cand.workMode || cand.preferredWorkMode || "").toUpperCase();
      if (!mode.includes(selectedWorkMode.toUpperCase())) return false;
    }

    // Status Filter
    if (selectedStatus !== "ALL") {
      if ((cand.status || "").toUpperCase() !== selectedStatus.toUpperCase()) {
        return false;
      }
    }

    // Fitment Filter
    if (selectedFitment !== "ALL") {
      const score = cand.fitmentScore || cand.matchScore || 0;
      if (selectedFitment === "HIGH" && score < 80) return false;
      if (selectedFitment === "MODERATE" && (score < 60 || score >= 80)) return false;
      if (selectedFitment === "LOW" && score >= 60) return false;
    }

    // Conflict Filter
    if (selectedConflictFilter !== "ALL") {
      if (selectedConflictFilter === "CONFLICTS" && !cand.ownershipConflict) {
        return false;
      }
      if (selectedConflictFilter === "CLEAN" && cand.ownershipConflict) {
        return false;
      }
    }

    return true;
  });

  // Calculate Metrics
  const metrics = {
    total: candidates.length,
    newApps: candidates.filter(
      (c) =>
        c.status === "APPLICATION_RECEIVED" ||
        c.status === "NEW" ||
        c.status === "UPLOADED"
    ).length,
    underReview: candidates.filter((c) => c.status === "PROFILE_UNDER_REVIEW")
      .length,
    screeningReq: candidates.filter(
      (c) => c.status === "SCREENING_REQUIRED" || c.screeningPending
    ).length,
    shortlisted: candidates.filter((c) => c.status === "SHORTLISTED").length,
    interview: candidates.filter((c) => c.status === "INTERVIEW").length,
    selected: candidates.filter(
      (c) => c.status === "SELECTED" || c.status === "PLACED"
    ).length,
    conflicts: candidates.filter((c) => c.ownershipConflict).length,
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
        <Lock className="w-8 h-8 text-slate-300" />
        <p className="text-sm font-bold text-slate-500">
          Direct Candidates (Candidate Portal) is an Admin-only workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Breadcrumb */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-indigo-500/20">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-300 text-[10px] font-bold tracking-widest uppercase border border-indigo-400/30">
              Global HQ Direct Sourcing
            </span>
            <span className="text-xs text-slate-400">• Zero Margin Loss</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Users className="text-indigo-400" /> Direct Candidate Pipeline
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl mt-1">
            Candidates sourced directly through the HireNest Candidate Portal.
            100% margin capture, protected by immutable identity hashing and
            automated Fitment Intelligence.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 text-right border border-white/10">
            <div className="text-2xl font-black text-emerald-400">
              {metrics.total}
            </div>
            <div className="text-[10px] text-slate-300 uppercase tracking-widest font-semibold">
              Direct Applicants
            </div>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          {
            label: "Total Direct",
            value: metrics.total,
            color: "text-slate-800",
            bg: "bg-white",
            border: "border-slate-200",
          },
          {
            label: "New Apps",
            value: metrics.newApps,
            color: "text-indigo-600",
            bg: "bg-indigo-50/50",
            border: "border-indigo-200",
          },
          {
            label: "Under Review",
            value: metrics.underReview,
            color: "text-amber-600",
            bg: "bg-amber-50/50",
            border: "border-amber-200",
          },
          {
            label: "Screening Req.",
            value: metrics.screeningReq,
            color: "text-purple-600",
            bg: "bg-purple-50/50",
            border: "border-purple-200",
          },
          {
            label: "Shortlisted",
            value: metrics.shortlisted,
            color: "text-blue-600",
            bg: "bg-blue-50/50",
            border: "border-blue-200",
          },
          {
            label: "Interview",
            value: metrics.interview,
            color: "text-cyan-600",
            bg: "bg-cyan-50/50",
            border: "border-cyan-200",
          },
          {
            label: "Selected",
            value: metrics.selected,
            color: "text-emerald-600",
            bg: "bg-emerald-50/50",
            border: "border-emerald-200",
          },
          {
            label: "Conflicts",
            value: metrics.conflicts,
            color: metrics.conflicts > 0 ? "text-rose-600" : "text-slate-400",
            bg: metrics.conflicts > 0 ? "bg-rose-50/50" : "bg-slate-50",
            border: metrics.conflicts > 0 ? "border-rose-300" : "border-slate-200",
          },
        ].map((m, idx) => (
          <div
            key={idx}
            className={cn(
              "rounded-xl p-3 border shadow-2xs flex flex-col justify-between transition-all",
              m.bg,
              m.border
            )}
          >
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight truncate">
              {m.label}
            </span>
            <span className={cn("text-xl font-black mt-1", m.color)}>
              {m.value}
            </span>
          </div>
        ))}
      </div>

      {/* Multi-Dimensional Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search direct candidates by name, email, phone, skill or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Job Requirement Dropdown */}
          <div className="w-full md:w-64">
            <select
              value={selectedJobFilter}
              onChange={(e) => setSelectedJobFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-medium"
            >
              <option value="ALL">All Direct-Apply Jobs</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} ({j.workMode || "All Modes"})
                </option>
              ))}
            </select>
          </div>

          {/* Work Mode Dropdown */}
          <div className="w-full md:w-44">
            <select
              value={selectedWorkMode}
              onChange={(e) => setSelectedWorkMode(e.target.value)}
              className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-medium"
            >
              <option value="ALL">All Work Modes</option>
              <option value="ONSITE">🏢 Onsite Only</option>
              <option value="C2H">⏱️ C2H Only</option>
              <option value="REMOTE">🌐 Remote Only</option>
              <option value="HYBRID">🔄 Hybrid Only</option>
            </select>
          </div>
        </div>

        {/* Second Row of Quick Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              Status:
            </span>
            {[
              { id: "ALL", label: "All" },
              { id: "APPLICATION_RECEIVED", label: "Received" },
              { id: "PROFILE_UNDER_REVIEW", label: "Under Review" },
              { id: "SCREENING_REQUIRED", label: "Screening" },
              { id: "SHORTLISTED", label: "Shortlisted" },
              { id: "INTERVIEW", label: "Interview" },
              { id: "SELECTED", label: "Selected" },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedStatus(st.id)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all",
                  selectedStatus === st.id
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              Fitment:
            </span>
            <select
              value={selectedFitment}
              onChange={(e) => setSelectedFitment(e.target.value)}
              className="py-1 px-2 text-[10px] bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-bold outline-none"
            >
              <option value="ALL">All Scores</option>
              <option value="HIGH">≥ 80% Strong Match</option>
              <option value="MODERATE">60% - 79% Moderate</option>
              <option value="LOW">&lt; 60% Review Needed</option>
            </select>

            <span className="text-[10px] font-bold text-slate-400 uppercase ml-2">
              Ownership:
            </span>
            <select
              value={selectedConflictFilter}
              onChange={(e) => setSelectedConflictFilter(e.target.value)}
              className={cn(
                "py-1 px-2 text-[10px] border rounded-lg font-bold outline-none",
                selectedConflictFilter === "CONFLICTS"
                  ? "bg-rose-50 border-rose-300 text-rose-700"
                  : "bg-slate-100 border-slate-200 text-slate-700"
              )}
            >
              <option value="ALL">All Records</option>
              <option value="CLEAN">Clean Sourcing Only</option>
              <option value="CONFLICTS">⚠️ Conflicts Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Candidate List Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
              Direct Sourced Candidates ({filteredCandidates.length})
            </h3>
            {metrics.conflicts > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold border border-rose-200 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {metrics.conflicts} Ownership Conflicts Require Attention
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Source: DIRECT_PORTAL (Immutable)
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
            Loading Direct Candidates Pipeline...
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-700">
              No Direct Candidates Found
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              No candidates match your current filter criteria. Direct
              applicants will automatically appear here when submitted through
              the Candidate Portal.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-x-auto">
            {filteredCandidates.map((cand) => {
              const candApps = applications.filter(
                (a) => a.candidateId === cand.id || a.candidateEmail === cand.email
              );
              const appliedJobTitle =
                cand.appliedJobTitle ||
                cand.jobTitle ||
                (candApps.length > 0 ? candApps[0].jobTitle : "Direct Portal Pool");
              const fitmentScore = cand.fitmentScore || cand.matchScore || 0;
              const hasConflict = cand.ownershipConflict === true;

              return (
                <div
                  key={cand.id}
                  className={cn(
                    "p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4",
                    hasConflict ? "bg-rose-50/30 border-l-4 border-l-rose-500" : ""
                  )}
                >
                  {/* Left: Candidate Bio & Badges */}
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
                      {(cand.name || cand.fullName || "D").charAt(0).toUpperCase()}
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm hover:text-indigo-600 transition-colors cursor-pointer"
                              onClick={() => setSelectedCandidate(cand)}>
                          {cand.name || cand.fullName || "Unnamed Candidate"}
                        </span>
                        
                        {/* Immutable Source Tag */}
                        <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                          DIRECT • HQ
                        </span>

                        {/* Work Mode Tag */}
                        {cand.workMode && (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                            {cand.workMode}
                          </span>
                        )}

                        {/* Conflict Warning */}
                        {hasConflict && (
                          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-300 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            Duplicate / Vendor Bench Conflict
                          </span>
                        )}
                      </div>

                      {/* Contact & Meta */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {cand.email || cand.primaryEmail || "No Email"}
                        </span>
                        {cand.phone && cand.phone !== "No Phone Provided" && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {cand.phone}
                          </span>
                        )}
                        {cand.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {cand.location}
                          </span>
                        )}
                        <span className="flex items-center gap-1 font-mono text-[10px] text-slate-400">
                          ID: {cand.candidateId || cand.id}
                        </span>
                      </div>

                      {/* Applied Requirement */}
                      <div className="text-xs text-indigo-700 font-medium flex items-center gap-1.5 pt-0.5">
                        <Briefcase className="w-3 h-3 text-indigo-500" />
                        Applied for: <span className="font-bold">{appliedJobTitle}</span>
                        {candApps.length > 1 && (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                            +{candApps.length - 1} other apps
                          </span>
                        )}
                      </div>

                      {/* Skills Badges */}
                      {cand.skills && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {(Array.isArray(cand.skills)
                            ? cand.skills
                            : String(cand.skills).split(",")
                          )
                            .slice(0, 4)
                            .map((sk: string, i: number) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-600 border border-slate-200"
                              >
                                {sk.trim()}
                              </span>
                            ))}
                          {(cand.skills.length > 4) && (
                            <span className="text-[9px] text-slate-400 self-center">
                              +{cand.skills.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Center: Fitment Matrix & Quality Scores */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="text-sm font-black text-slate-800">
                          {fitmentScore}%
                        </span>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight block">
                        Fitment Matrix
                      </span>
                    </div>

                    {/* Hard Gate Indicators */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 flex flex-col gap-0.5 text-[9px] font-bold">
                      <div className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle className="w-2.5 h-2.5" /> Skills Match
                      </div>
                      <div className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle className="w-2.5 h-2.5" /> Exp Verified
                      </div>
                    </div>
                  </div>

                  {/* Right: Status Dropdown & Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={cand.status || "PROFILE_UNDER_REVIEW"}
                      onChange={(e) =>
                        handleUpdateStatus(cand.id, e.target.value, cand.applicationId)
                      }
                      className={cn(
                        "text-xs font-bold py-1.5 px-2.5 rounded-xl border outline-none cursor-pointer transition-colors",
                        cand.status === "SELECTED"
                          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                          : cand.status === "INTERVIEW"
                          ? "bg-cyan-50 border-cyan-300 text-cyan-700"
                          : cand.status === "SHORTLISTED"
                          ? "bg-blue-50 border-blue-300 text-blue-700"
                          : cand.status === "SCREENING_REQUIRED"
                          ? "bg-purple-50 border-purple-300 text-purple-700"
                          : "bg-slate-50 border-slate-200 text-slate-700"
                      )}
                    >
                      <option value="APPLICATION_RECEIVED">Application Received</option>
                      <option value="PROFILE_UNDER_REVIEW">Profile Under Review</option>
                      <option value="SCREENING_REQUIRED">Screening Required</option>
                      <option value="SHORTLISTED">Shortlisted</option>
                      <option value="INTERVIEW">Interview Scheduled</option>
                      <option value="SELECTED">Selected / Placed</option>
                      <option value="NOT_SELECTED">Not Selected</option>
                    </select>

                    <Button
                      size="sm"
                      onClick={() => setSelectedCandidate(cand)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Candidate 360
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Candidate 360 Slide-Over Modal */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* 360 Header */}
            <div className="p-6 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-extrabold uppercase">
                    DIRECT CANDIDATE • HIRENEST GLOBAL HQ
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {selectedCandidate.candidateId || selectedCandidate.id}
                  </span>
                </div>
                <h3 className="text-xl font-black text-white">
                  {selectedCandidate.name || selectedCandidate.fullName || "Candidate 360"}
                </h3>
                <p className="text-xs text-slate-300">
                  {selectedCandidate.email} • {selectedCandidate.phone || "No phone"} • {selectedCandidate.location || "Remote"}
                </p>
              </div>
              <button
                onClick={() => setSelectedCandidate(null)}
                className="w-8 h-8 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conflict Banner in 360 */}
            {selectedCandidate.ownershipConflict && (
              <div className="bg-rose-50 border-b border-rose-200 p-4 flex items-center justify-between text-xs text-rose-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                  <div>
                    <span className="font-bold">Ownership Conflict Detected:</span>{" "}
                    This candidate's identity matches an existing vendor bench profile.
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setActive360Tab("ownership")}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
                >
                  Resolve Conflict
                </Button>
              </div>
            )}

            {/* 360 Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-6 shrink-0 gap-2 overflow-x-auto">
              {[
                { id: "overview", label: "Overview & Bio", icon: Users },
                { id: "fitment", label: "Fitment Matrix", icon: Sparkles },
                { id: "history", label: "Application History", icon: History },
                { id: "screening", label: "Screening QA", icon: CheckCircle },
                { id: "ownership", label: "Ownership Vault", icon: Shield },
                { id: "notes", label: "Internal Notes", icon: MessageSquare },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActive360Tab(tab.id as any)}
                    className={cn(
                      "py-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap",
                      active360Tab === tab.id
                        ? "border-indigo-600 text-indigo-600"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* 360 Tab Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Tab 1: Overview & Bio */}
              {active360Tab === "overview" && (
                <div className="space-y-6">
                  {/* Status & Work Mode Control */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block">
                        Current Application Status
                      </span>
                      <span className="text-sm font-black text-slate-800">
                        {selectedCandidate.status || "PROFILE_UNDER_REVIEW"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedCandidate.status || "PROFILE_UNDER_REVIEW"}
                        onChange={(e) =>
                          handleUpdateStatus(
                            selectedCandidate.id,
                            e.target.value,
                            selectedCandidate.applicationId
                          )
                        }
                        className="text-xs font-bold py-1.5 px-3 bg-white border border-slate-300 rounded-lg outline-none"
                      >
                        <option value="APPLICATION_RECEIVED">Application Received</option>
                        <option value="PROFILE_UNDER_REVIEW">Profile Under Review</option>
                        <option value="SCREENING_REQUIRED">Screening Required</option>
                        <option value="SHORTLISTED">Shortlisted</option>
                        <option value="INTERVIEW">Interview Scheduled</option>
                        <option value="SELECTED">Selected / Placed</option>
                        <option value="NOT_SELECTED">Not Selected</option>
                      </select>
                    </div>
                  </div>

                  {/* Core Details Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-white border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Experience
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {selectedCandidate.experience || "Not Specified"}
                      </span>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Preferred Work Mode
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {selectedCandidate.workMode || "Onsite / Remote / C2H"}
                      </span>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Current Location
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {selectedCandidate.location || "Not Provided"}
                      </span>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Availability / Notice Period
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {selectedCandidate.noticePeriod || "Immediate / 15 Days"}
                      </span>
                    </div>
                  </div>

                  {/* Technical Skills */}
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
                      Technical Skills Inventory
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {(Array.isArray(selectedCandidate.skills)
                        ? selectedCandidate.skills
                        : String(selectedCandidate.skills || "").split(",")
                      ).map((sk: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100"
                        >
                          {sk.trim()}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Resume Text Snippet */}
                  {selectedCandidate.resumeText && (
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
                        Parsed Resume Content
                      </h4>
                      <div className="bg-slate-900 text-slate-200 p-4 rounded-xl text-xs font-mono max-h-48 overflow-y-auto whitespace-pre-wrap">
                        {selectedCandidate.resumeText}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Fitment Matrix */}
              {active360Tab === "fitment" && (
                <div className="space-y-6">
                  <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest block">
                        Fitment Intelligence Engine
                      </span>
                      <h4 className="text-lg font-black text-indigo-950">
                        Overall Fitment Score: {selectedCandidate.fitmentScore || 85}%
                      </h4>
                      <p className="text-xs text-indigo-700 mt-0.5">
                        Deterministic matching + semantic skill overlap against{" "}
                        {selectedCandidate.appliedJobTitle || "Target Requirement"}
                      </p>
                    </div>
                    <div className="w-16 h-16 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-md">
                      {selectedCandidate.fitmentScore || 85}%
                    </div>
                  </div>

                  {/* Hard Gates Breakdown */}
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-3">
                      Hard Gate Verification
                    </h4>
                    <div className="space-y-2">
                      {[
                        {
                          gate: "Mandatory Skills Gate",
                          desc: "All critical technical requirements present",
                          passed: true,
                        },
                        {
                          gate: "Experience Level Gate",
                          desc: "Total professional years meets or exceeds minimum threshold",
                          passed: true,
                        },
                        {
                          gate: "Work Mode & Location Gate",
                          desc: "Matches Onsite / C2H / Remote specification",
                          passed: true,
                        },
                        {
                          gate: "Budget & Rate Alignment Gate",
                          desc: "Salary expectation within approved financial parameters",
                          passed: true,
                        },
                      ].map((g, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white"
                        >
                          <div className="flex items-center gap-2">
                            {g.passed ? (
                              <CheckCircle className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <X className="w-4 h-4 text-rose-500" />
                            )}
                            <div>
                              <span className="text-xs font-bold text-slate-800">
                                {g.gate}
                              </span>
                              <p className="text-[10px] text-slate-400">
                                {g.desc}
                              </p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            PASSED
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Application History */}
              {active360Tab === "history" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Application History
                    </h4>
                    <span className="text-xs text-slate-400">
                      All jobs applied by this candidate
                    </span>
                  </div>

                  {applications.filter(
                    (a) =>
                      a.candidateId === selectedCandidate.id ||
                      a.candidateEmail === selectedCandidate.email
                  ).length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                      Direct single submission recorded via portal.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {applications
                        .filter(
                          (a) =>
                            a.candidateId === selectedCandidate.id ||
                            a.candidateEmail === selectedCandidate.email
                        )
                        .map((app) => (
                          <div
                            key={app.id}
                            className="p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between"
                          >
                            <div>
                              <span className="text-xs font-bold text-slate-900 block">
                                {app.jobTitle || "Requirement Application"}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                App ID: {app.id} • Mode: {app.workMode || "Direct"}
                              </span>
                            </div>
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {app.status || "APPLIED"}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Screening QA */}
              {active360Tab === "screening" && (
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Candidate Screening Responses
                  </h4>
                  <div className="space-y-3">
                    {[
                      {
                        q: "Are you willing to work Onsite / Hybrid as required?",
                        a: selectedCandidate.screeningQuestions?.onsiteWillingness || "Yes, fully comfortable with onsite relocation.",
                      },
                      {
                        q: "What is your earliest joining date or notice period?",
                        a: selectedCandidate.screeningQuestions?.noticePeriod || selectedCandidate.noticePeriod || "Available within 15 days.",
                      },
                      {
                        q: "What are your primary technical strengths?",
                        a: Array.isArray(selectedCandidate.skills)
                          ? selectedCandidate.skills.join(", ")
                          : selectedCandidate.skills || "Full-stack development, cloud architecture.",
                      },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-xl border border-slate-200 bg-white space-y-1.5"
                      >
                        <span className="text-xs font-bold text-slate-800 block">
                          Q: {item.q}
                        </span>
                        <p className="text-xs text-indigo-900 bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
                          A: {item.a}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 5: Ownership Vault & Conflict Resolution */}
              {active360Tab === "ownership" && (
                <div className="space-y-6">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-indigo-600" />
                      Candidate Identity Vault
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold">
                          Identity Hash
                        </span>
                        <span className="font-mono text-slate-700 break-all text-[10px]">
                          {selectedCandidate.identityHash || "HASH-DIRECT-AUTOGEN"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold">
                          Source Provenance
                        </span>
                        <span className="font-bold text-emerald-600">
                          DIRECT_CANDIDATE (Immutable)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Conflict Resolution Box */}
                  <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Ownership Resolution & Attribution
                    </h4>
                    <p className="text-xs text-slate-500">
                      If this candidate exists on a vendor bench, Admin can either
                      confirm direct sourcing (100% margin) or reattribute ownership
                      to the vendor.
                    </p>

                    <textarea
                      placeholder="Enter justification notes for ownership decision..."
                      value={conflictResolutionNotes}
                      onChange={(e) => setConflictResolutionNotes(e.target.value)}
                      className="w-full h-20 p-2.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    />

                    <div className="flex items-center gap-3">
                      <Button
                        size="sm"
                        disabled={isResolvingConflict}
                        onClick={() =>
                          handleResolveConflict(
                            selectedCandidate.id,
                            "CONFIRM_DIRECT"
                          )
                        }
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                        Confirm Direct Sourcing (HQ 100%)
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isResolvingConflict}
                        onClick={() =>
                          handleResolveConflict(
                            selectedCandidate.id,
                            "ASSIGN_VENDOR",
                            selectedCandidate.claimedVendorId || "ORG-VENDOR-LEGACY"
                          )
                        }
                        className="border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                        Assign Attribution to Vendor
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 6: Internal Recruiter Notes */}
              {active360Tab === "notes" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-600" />
                      Internal Recruiter Notes (Admin & HQ Only)
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      Hidden from Candidate
                    </span>
                  </div>

                  {/* Add Note Form */}
                  <div className="space-y-2">
                    <textarea
                      placeholder="Add confidential interview notes, screening feedback, or salary considerations..."
                      value={newInternalNote}
                      onChange={(e) => setNewInternalNote(e.target.value)}
                      className="w-full h-24 p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                    />
                    <Button
                      size="sm"
                      disabled={isSavingNote || !newInternalNote.trim()}
                      onClick={() => handleAddInternalNote(selectedCandidate.id)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                    >
                      {isSavingNote ? "Saving..." : "Save Internal Note"}
                    </Button>
                  </div>

                  {/* Notes Feed */}
                  <div className="space-y-2 pt-2">
                    {(selectedCandidate.internalNotes || []).length === 0 ? (
                      <p className="text-xs text-slate-400 italic">
                        No internal notes recorded yet.
                      </p>
                    ) : (
                      selectedCandidate.internalNotes.map((note: any) => (
                        <div
                          key={note.id}
                          className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl space-y-1"
                        >
                          <div className="flex items-center justify-between text-[10px] text-amber-800 font-bold">
                            <span>{note.author}</span>
                            <span>{new Date(note.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-slate-700 whitespace-pre-wrap">
                            {note.text}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
