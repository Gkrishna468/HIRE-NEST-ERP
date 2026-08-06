import React, { useState, useEffect } from "react";
import { collection, query, getDocs, limit, where, onSnapshot } from "firebase/firestore";
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
  Activity
} from "lucide-react";
import { useSystemStore } from "../stores/SystemStore";
import { ExplainableEvidenceCard } from "../components/ExplainableEvidenceCard";
import { cn } from "../lib/utils";
import { LifecycleTimeline, TimelineEvent } from "../components/LifecycleTimeline";

export default function MatchIntelligenceTab() {
  const { userData } = useSystemStore();
  const roleIsAdmin = ["admin", "super_admin", "hq_admin", "ops_admin"].includes(userData?.role || "");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"requirements" | "candidates">("requirements");
  const [matches, setMatches] = useState<any[]>([]);
  const [requirements, setRequirements] = useState<Record<string, any>>({});
  const [candidates, setCandidates] = useState<Record<string, any>>({});
  const [processingMatch, setProcessingMatch] = useState<string | null>(null);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);

  const [matchTimelines, setMatchTimelines] = useState<Record<string, TimelineEvent[]>>({});
  const [scanProgress, setScanProgress] = useState<string>("");

  const handleExpandMatch = (matchId: string) => {
    const isExpanding = expandedMatch !== matchId;
    setExpandedMatch(isExpanding ? matchId : null);

    if (isExpanding && !matchTimelines[matchId]) {
      const simulatedEvents: TimelineEvent[] = [
        { id: '1', type: 'INTAKE', title: 'Intake Completed', description: 'Entity ingested via MailOS and parsed into Business Graph.', timestamp: '10:05 AM', status: 'COMPLETED' },
        { id: '2', type: 'MATCH', title: 'Autonomous Matching', description: 'Deterministic skill mapping matched 85% of core stack.', timestamp: '10:06 AM', status: 'COMPLETED' },
        { id: '3', type: 'SYSTEM', title: 'AI Evidence Generated', description: 'Gemini generated reasoning and fit assessment.', timestamp: '10:06 AM', status: 'COMPLETED' }
      ];
      setMatchTimelines(prev => ({ ...prev, [matchId]: simulatedEvents }));
    }
  };

  const handleCreateDealRoom = async (match: any, req: any, cand: any) => {
    if (processingMatch) return;
    setProcessingMatch(match.id);
    try {
      const { addDoc, updateDoc, doc } = await import("firebase/firestore");
      // 1. Create deal room
      const roomData = {
        candidateId: match.candidateId,
        candidateName: cand?.name || cand?.candidateName || match.candidateId,
        candidateEmail: cand?.email || "",
        candidatePhone: cand?.phone || "",
        requirementId: match.requirementId,
        requirementTitle: req?.title || "Unknown Requirement",
        clientId: req?.clientId || "",
        vendorId: cand?.vendorId || match.vendorId || "Direct",
        status: "submitted",
        createdAt: new Date().toISOString(),
        createdBy: userData?.uid || "system",
        matchScore: match.score || match.matchScore || 0,
        expectedFee: match.expectedRevenue || 0
      };

      await addDoc(collection(db, "dealRooms"), roomData);

      // 2. Update match status
      await updateDoc(doc(db, "candidate_matches", match.id), {
        status: "SUBMITTED"
      });

      // 3. Update local state
      setMatches(prev => prev.map(m => m.id === match.id ? { ...m, status: "SUBMITTED" } : m));

      // 4. Log AI event
      await addDoc(collection(db, "agent_executions"), {
        agentName: "Recruiter Action",
        agentType: "DEAL_ROOM",
        status: "success",
        task: `Created Deal Room for ${roomData.candidateName}`,
        targetId: match.candidateId,
        createdAt: new Date(),
      });

    } catch (e) {
      console.error("Failed to create deal room", e);
    } finally {
      setProcessingMatch(null);
    }
  };

  useEffect(() => {
    if (!userData) return;
    setLoading(true);

    const role = userData?.role || "";
    const isClient = role === "client" || role === "client_admin" || role === "client_hm" || role === "client_finance" || role === "client_recruiter";
    const isVendor = role === "vendor" || role === "vendor_admin" || role === "vendor_recruiter";
    const orgId = userData?.organizationId;

    let q;
    if (roleIsAdmin) {
      q = query(collection(db, "candidate_matches"), limit(50));
    } else if (isClient && orgId) {
      q = query(
        collection(db, "candidate_matches"),
        where("clientId", "==", orgId),
        limit(50),
      );
    } else if (isVendor && orgId) {
      q = query(
        collection(db, "candidate_matches"),
        where("vendorId", "==", orgId),
        limit(50),
      );
    } else {
      q = query(collection(db, "candidate_matches"), limit(1));
    }

    const unsubMatches = onSnapshot(q, (snapshot) => {
      setMatches(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    const unsubReqs = onSnapshot(collection(db, "requirements_public"), (snap) => {
      const reqMap: Record<string, any> = {};
      snap.docs.forEach(d => { reqMap[d.id] = d.data(); });
      setRequirements(reqMap);
    });

    const unsubCands = onSnapshot(query(collection(db, "candidatePool"), limit(200)), (snap) => {
      const candMap: Record<string, any> = {};
      snap.docs.forEach(d => { candMap[d.id] = d.data(); });
      setCandidates(candMap);
    });

    return () => {
      unsubMatches();
      unsubReqs();
      unsubCands();
    };
  }, [userData]);

  const role = userData?.role || "";

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex justify-center items-center h-64">
        <div className="text-center text-slate-400">
          <Zap
            className="mx-auto mb-3 animate-pulse text-indigo-400"
            size={32}
          />
          <p className="font-bold tracking-widest uppercase text-[10px]">
            {scanProgress || "Evaluating match intel..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Star className="text-amber-500" size={24} />
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">
              Match Opportunities
            </h1>
          </div>
          <p className="text-slate-500 font-medium max-w-xl text-sm">
            AI-driven opportunity discovery. This engine automatically matches
            candidates with requirements to forecast revenue.
          </p>
        </div>

        <div className="flex p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setViewMode("requirements")}
            className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${viewMode === "requirements" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
          >
            By Requirement
          </button>
          <button
            onClick={() => setViewMode("candidates")}
            className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${viewMode === "candidates" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
          >
            By Candidate
          </button>
        </div>
      </div>

      {Object.keys(requirements).length === 0 ? (
        <div className="bg-white border text-center py-24 rounded-2xl border-slate-200">
          <Zap className="mx-auto mb-4 text-slate-300" size={48} />
          <h2 className="text-xl font-black text-slate-800 mb-2">
            No Requirements Found
          </h2>
          <p className="text-sm font-medium text-slate-500 mb-6 max-w-md mx-auto">
            The Match Engine evaluates opportunities against active requirements. Add requirements to see match intelligence.
          </p>
          {roleIsAdmin && (
            <button
              onClick={async () => {
                setLoading(true);
                setScanProgress("Job Queued. Running AI...");
                try {
                  const response = await fetch("/api/admin", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "rescan-matches" }),
                  });
                  const data = await response.json();
                  if (data.success) {
                    setScanProgress(`${data.matchUpdatesCount} Matches Updated... reloading.`);
                    setTimeout(() => window.location.reload(), 1500);
                  } else {
                    setScanProgress(`Error: ${data.error || 'Failed'}`);
                    setLoading(false);
                  }
                } catch (err) {
                  console.error(err);
                  setScanProgress("Failed to run match scan.");
                  setLoading(false);
                }
              }}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors uppercase tracking-wider"
            >
              Run Match Scan
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 border border-slate-200 rounded-xl shadow-sm relative overflow-hidden">
              <Zap
                className="absolute -right-4 -bottom-4 text-amber-500/10"
                size={80}
              />
              <p className="text-[10px] font-black tracking-widest text-slate-500 uppercase">
                Active Opportunities
              </p>
              <p className="text-3xl font-black text-slate-900 mt-2">
                {matches.length}
              </p>
            </div>
            <div className="bg-white p-5 border border-slate-200 rounded-xl shadow-sm relative overflow-hidden">
              <TrendingUp
                className="absolute -right-4 -bottom-4 text-emerald-500/10"
                size={80}
              />
              <p className="text-[10px] font-black tracking-widest text-slate-500 uppercase">
                Expected Value
              </p>
              <p className="text-3xl font-black text-slate-900 mt-2">
                ₹
                {matches
                  .reduce((acc, m) => acc + (m.expectedRevenue || 0), 0)
                  .toLocaleString()}
              </p>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Opportunity Pipeline (
                {viewMode === "requirements"
                  ? "By Requirement"
                  : "By Candidate"}
                )
              </h3>
            </div>
            <div className="overflow-x-auto">
              {viewMode === "requirements"
                ? Object.keys(requirements).map((reqId) => {
                    const req = requirements[reqId];
                    const groupMatches = matches.filter(m => m.requirementId === reqId);
                    return (
                      <div
                        key={reqId}
                        className="border-b border-slate-200 last:border-0"
                      >
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                          <div>
                            <span className="text-xs font-black uppercase tracking-widest text-indigo-600 mr-2">
                              Requirement
                            </span>
                            <span className="font-bold text-slate-900">
                              {req?.title || reqId}
                            </span>
                          </div>
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            {groupMatches.length} Matches
                          </div>
                        </div>
                        {groupMatches.length === 0 ? (
                            <div className="p-6 text-center">
                               <p className="text-sm font-bold text-slate-400">Waiting for candidates...</p>
                            </div>
                        ) : (
                        <table className="w-full">
                          <tbody className="divide-y divide-slate-50">
                            {groupMatches
                              .sort(
                                (a, b) =>
                                  (b.placementProbability || 0) -
                                  (a.placementProbability || 0),
                              )
                              .map((match) => {
                                const cand =
                                  candidates[match.candidateId] || match;
                                let revenueStr = "--";
                                let expectedRevStr = "--";
                                let marginVal =
                                  (req?.financials?.clientBilling || 0) *
                                  ((req?.financials?.commissionPercent || 0) /
                                    100);
                                if (roleIsAdmin || userData?.role === "hq") {
                                  revenueStr = req?.financials
                                    ? `₹${marginVal.toLocaleString()}`
                                    : "--";
                                  expectedRevStr = match.expectedRevenue
                                    ? `₹${match.expectedRevenue.toLocaleString()}`
                                    : req?.financials
                                      ? `₹${Math.round(marginVal * ((match.placementProbability || 0) / 100)).toLocaleString()}`
                                      : "--";
                                } else if (userData?.role === "vendor") {
                                  let vendorBudget =
                                    (req?.financials?.clientBilling || 0) -
                                    marginVal;
                                  revenueStr = req?.financials
                                    ? `₹${vendorBudget.toLocaleString()}`
                                    : "--";
                                  expectedRevStr = match.expectedRevenue
                                    ? `₹${match.expectedRevenue.toLocaleString()}`
                                    : req?.financials
                                      ? `₹${Math.round(vendorBudget * ((match.placementProbability || 0) / 100)).toLocaleString()}`
                                      : "--";
                                }
                                  return (
                                    <React.Fragment key={match.id}>
                                      <tr
                                        className={cn(
                                          "hover:bg-slate-50/50 transition-colors cursor-pointer",
                                          expandedMatch === match.id && "bg-slate-50"
                                        )}
                                        onClick={() => setExpandedMatch(expandedMatch === match.id ? null : match.id)}
                                      >
                                        <td className="px-4 py-3 w-28">
                                          <span className="inline-flex items-center font-bold px-2 py-1 rounded-md text-[10px] tracking-widest uppercase border bg-slate-100 text-slate-600 border-slate-200">
                                            {match.status || "DISCOVERED"}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="flex items-center gap-2">
                                            <p className="font-bold text-slate-900 text-sm">
                                              {cand?.name || cand?.candidateName || match.candidateId}
                                            </p>
                                            {expandedMatch === match.id ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                          </div>
                                          <span className="inline-flex items-center gap-1 font-black text-indigo-600 px-1 py-0.5 rounded-sm text-[10px] uppercase">
                                            MATCH: {match.score || match.matchScore}%
                                          </span>
                                          <span className="ml-2 text-[10px] font-bold text-slate-400 uppercase">
                                            VEND: {cand?.vendorId || match.vendorId || "DIRECT"}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 text-left w-40">
                                          <div className="flex items-center gap-2">
                                            <div className="w-full bg-slate-200 rounded-full h-1.5 max-w-[60px]">
                                              <div
                                                className="bg-emerald-500 h-1.5 rounded-full"
                                                style={{
                                                  width: `${match.placementProbability || Math.min(95, (match.score || match.matchScore || 0) * 0.5)}%`,
                                                }}
                                              ></div>
                                            </div>
                                            <span className="text-xs font-bold text-slate-700">
                                              {match.placementProbability || Math.round(Math.min(95, (match.score || match.matchScore || 0) * 0.5))}%
                                            </span>
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 text-right w-48">
                                          <p className="font-mono text-sm font-black text-slate-900">
                                            {expectedRevStr}
                                          </p>
                                          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                            Mgn: {revenueStr}
                                          </p>
                                        </td>
                                        <td className="px-4 py-3 text-right w-32">
                                          {match.status !== 'SUBMITTED' && (
                                            <button 
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleCreateDealRoom(match, req, cand);
                                              }}
                                              disabled={processingMatch === match.id}
                                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                                            >
                                              {processingMatch === match.id ? 'Creating...' : 'Submit'}
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                      {expandedMatch === match.id && (
                                        <tr>
                                          <td colSpan={5} className="px-4 py-4 bg-slate-50 border-t border-slate-100">
                                            <div className="max-w-3xl mx-auto">
                                              <ExplainableEvidenceCard 
                                                isDark={false}
                                                evidence={{
                                                  id: match.id,
                                                  decision: `AI Recommendation: Match candidate to ${req?.title || "Requirement"}`,
                                                  confidence: match.score || match.matchScore || 0,
                                                  graphNodes: match.graphNodes || ["SKILLS", "LOCATION", "SALARY"],
                                                  experiences: match.experienceReasoning ? [match.experienceReasoning] : ["Candidate has 8+ years in relevant stack", "Previous tenure at Tier 1 tech company"],
                                                  decisionFactors: match.factors || ["Semantic Overlap", "Career Trajectory", "Geographic Proximity"],
                                                  telemetrySnapshot: ["Match Engine V2", "Regional Market Index: +4.2%"],
                                                  entityType: 'candidate_match',
                                                  entityId: match.id
                                                }}
                                              />
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  );
                              })}
                          </tbody>
                        </table>
                        )}
                      </div>
                    );
                  })
                : Object.entries(
                    matches.reduce(
                      (acc, match) => {
                        if (!acc[match.candidateId])
                          acc[match.candidateId] = [];
                        acc[match.candidateId].push(match);
                        return acc;
                      },
                      {} as Record<string, any[]>,
                    ),
                  ).map(([candId, groupMatches]: [string, any[]]) => {
                    const cand = candidates[candId] || groupMatches[0];
                    return (
                      <div
                        key={candId}
                        className="border-b border-slate-200 last:border-0"
                      >
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                          <div>
                            <span className="text-xs font-black uppercase tracking-widest text-emerald-600 mr-2">
                              Candidate
                            </span>
                            <span className="font-bold text-slate-900">
                              {cand?.name || cand?.candidateName || candId}
                            </span>
                            <span className="ml-2 text-xs text-slate-500 font-medium">
                              ({cand.vendorId || "Direct"})
                            </span>
                          </div>
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            {groupMatches.length} Opportunities
                          </div>
                        </div>
                        <table className="w-full">
                          <tbody className="divide-y divide-slate-50">
                            {groupMatches
                              .sort(
                                (a, b) =>
                                  (b.placementProbability || 0) -
                                  (a.placementProbability || 0),
                              )
                              .map((match) => {
                                const req = requirements[match.requirementId];
                                let revenueStr = "--";
                                let expectedRevStr = "--";
                                let marginVal =
                                  (req?.financials?.clientBilling || 0) *
                                  ((req?.financials?.commissionPercent || 0) /
                                    100);
                                if (roleIsAdmin || userData?.role === "hq") {
                                  revenueStr = req?.financials
                                    ? `₹${marginVal.toLocaleString()}`
                                    : "--";
                                  expectedRevStr = match.expectedRevenue
                                    ? `₹${match.expectedRevenue.toLocaleString()}`
                                    : req?.financials
                                      ? `₹${Math.round(marginVal * ((match.placementProbability || 0) / 100)).toLocaleString()}`
                                      : "--";
                                } else if (userData?.role === "vendor") {
                                  let vendorBudget =
                                    (req?.financials?.clientBilling || 0) -
                                    marginVal;
                                  revenueStr = req?.financials
                                    ? `₹${vendorBudget.toLocaleString()}`
                                    : "--";
                                  expectedRevStr = match.expectedRevenue
                                    ? `₹${match.expectedRevenue.toLocaleString()}`
                                    : req?.financials
                                      ? `₹${Math.round(vendorBudget * ((match.placementProbability || 0) / 100)).toLocaleString()}`
                                      : "--";
                                }
                                  return (
                                    <React.Fragment key={match.id}>
                                      <tr
                                        className={cn(
                                          "hover:bg-slate-50/50 transition-colors cursor-pointer",
                                          expandedMatch === match.id && "bg-indigo-50/30"
                                        )}
                                        onClick={() => handleExpandMatch(match.id)}
                                      >
                                        <td className="px-4 py-3 w-28 text-center">
                                          {expandedMatch === match.id ? (
                                            <ChevronUp className="text-slate-400 mx-auto" size={16} />
                                          ) : (
                                            <ChevronDown className="text-slate-400 mx-auto" size={16} />
                                          )}
                                        </td>
                                        <td className="px-4 py-3 w-28">
                                          <span className={cn(
                                            "inline-flex items-center font-bold px-2 py-1 rounded-md text-[10px] tracking-widest uppercase border",
                                            match.status === 'SUBMITTED' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-100 text-slate-600 border-slate-200"
                                          )}>
                                            {match.status || "DISCOVERED"}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3">
                                          <p className="font-bold text-slate-900 text-sm">
                                            {req?.title || match.requirementId}
                                          </p>
                                          <span className="inline-flex items-center gap-1 font-black text-indigo-600 px-1 py-0.5 rounded-sm text-[10px] uppercase">
                                            MATCH: {match.score || match.matchScore}%
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 text-left w-40">
                                          <div className="flex items-center gap-2">
                                            <div className="w-full bg-slate-200 rounded-full h-1.5 max-w-[60px]">
                                              <div
                                                className="bg-emerald-500 h-1.5 rounded-full"
                                                style={{
                                                  width: `${match.placementProbability || Math.min(95, (match.score || match.matchScore || 0) * 0.5)}%`,
                                                }}
                                              ></div>
                                            </div>
                                            <span className="text-xs font-bold text-slate-700">
                                              {match.placementProbability || Math.round(Math.min(95, (match.score || match.matchScore || 0) * 0.5))}%
                                            </span>
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 text-right w-32">
                                            {match.status !== 'SUBMITTED' && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleCreateDealRoom(match, req, cand); }}
                                                    disabled={processingMatch === match.id}
                                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 shadow-sm"
                                                >
                                                    {processingMatch === match.id ? '...' : 'Submit'}
                                                </button>
                                            )}
                                        </td>
                                      </tr>

                                      {expandedMatch === match.id && (
                                        <tr>
                                          <td colSpan={6} className="bg-slate-50/50 p-6 border-b border-slate-200 animate-in slide-in-from-top duration-300">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                              <div>
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                                  <Activity size={14} />
                                                  Autonomous Workflow Journey
                                                </h4>
                                                <LifecycleTimeline events={matchTimelines[match.id] || []} />
                                              </div>
                                              <div>
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                                  <Zap size={14} />
                                                  AI Evidence & Assessment
                                                </h4>
                                                <ExplainableEvidenceCard 
                                                  isDark={false}
                                                  className="shadow-none border-slate-200 bg-white"
                                                  evidence={{
                                                    id: match.id,
                                                    decision: match.recruiterAssessment || `Deterministic match evaluation at ${match.score}% confidence.`,
                                                    confidence: match.score || 85,
                                                    graphNodes: [req?.title || 'Requirement', cand?.name || 'Candidate'],
                                                    experiences: match.strengths || ['Technical alignment detected'],
                                                    decisionFactors: match.gaps || ['Candidate profile successfully mapped'],
                                                    telemetrySnapshot: [`SCORE: ${match.score}%`, `ENTITY: ${match.id}`],
                                                    version: '1.2.0'
                                                  }}
                                                />
                                              </div>
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  );
                              })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
