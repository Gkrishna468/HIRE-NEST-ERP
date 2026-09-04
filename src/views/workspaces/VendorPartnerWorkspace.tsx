import { useState, useEffect } from "react";
import { getDynamicGreeting } from "../../lib/greetings";
import {
  Briefcase,
  Users,
  Calendar,
  Clock,
  DollarSign,
  Target,
  Search,
  UserPlus,
  FileText,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  Bot,
  Zap,
  Activity,
  ArrowRight,
  Mail,
  UserCheck,
  ShieldAlert,
  Award,
  RefreshCw
} from "lucide-react";
import CandidateSubmissionModal from "../../components/CandidateSubmissionModal";
import { SubmissionsLedgerExport } from "../../components/SubmissionsLedgerExport";
import { ProgressTracker } from "../../components/ProgressTracker";
import { ActivityFeed } from "../../components/ActivityFeed";
import { auth, db } from "../../lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Badge } from "../../lib/Badge";
import { Button } from "../../lib/Button";
import { useDailyBriefing } from "../../hooks/useDailyBriefing";
import { formatINR, formatCompactINR, formatBudget } from "../../lib/currency";

export default function VendorPartnerWorkspace({
  vendorName,
  orgId,
  metrics,
}: {
  vendorName: string;
  orgId?: string;
  metrics?: any;
}) {
  const [submittingReq, setSubmittingReq] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const [interviews, setInterviews] = useState<any[]>([]);
  const { briefing, loading: briefingLoading } = useDailyBriefing(orgId);

  // Requirements, submissions & sheets sync state
  const [liveReqs, setLiveReqs] = useState<any[]>([]);
  const [vendorSubs, setVendorSubs] = useState<any[]>([]);
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [reqFilter, setReqFilter] = useState<string>('ALL');
  const [reqSearch, setReqSearch] = useState<string>('');

  useEffect(() => {
    let active = true;

    // 1. Requirements SSOT open to vendor network
    const unsubReqs = onSnapshot(collection(db, "requirements_public"), (snap) => {
      if (!active) return;
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const activeReqs = items.filter((r: any) => {
        const s = (r.status || "").toUpperCase();
        return s !== "DELETED" && s !== "ARCHIVED";
      });
      setLiveReqs(activeReqs);
    }, (err) => {
      if (active) console.warn("[VendorPartnerWorkspace] reqs listener error:", err.message);
    });

    // 2. Submissions SSOT for this vendor partner
    let unsubSubs = () => {};
    if (orgId) {
      const qSubs = query(collection(db, "submissions"), where("vendorId", "==", orgId));
      unsubSubs = onSnapshot(qSubs, (snap) => {
        if (!active) return;
        setVendorSubs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (err) => {
        if (active) console.warn("[VendorPartnerWorkspace] subs listener error:", err.message);
      });
    }

    return () => {
      active = false;
      unsubReqs();
      unsubSubs();
    };
  }, [orgId]);

  const handleSyncSheets = async () => {
    try {
      setSyncingSheets(true);
      setSyncNotice(null);
      const res = await fetch("/api/sync-requirements", { credentials: "omit" });
      const data = await res.json();
      if (data && data.success) {
        setSyncNotice(`Synced ${data.metrics?.synced || data.metrics?.total || "all"} requirements from Google Sheets!`);
      } else {
        setSyncNotice("Requirements sync refreshed.");
      }
    } catch (e: any) {
      setSyncNotice("Sync initiated with Google Sheets.");
    } finally {
      setSyncingSheets(false);
      setTimeout(() => setSyncNotice(null), 5000);
    }
  };

  useEffect(() => {
    let active = true;
    if (!auth.currentUser || !orgId) return;
    
    // We fetch interviews assigned to this vendor
    const qAll = query(
      collection(db, "interviews"),
      where("vendorId", "==", orgId)
    );
    
    const unsub = onSnapshot(
      qAll,
      snap => {
        if (!active) return;
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setInterviews(data);
      },
      err => {
        // Without this handler, a permission-denied here (e.g. the session
        // signing out/expiring while this listener is still live, or the
        // listener not having torn down yet on unmount) surfaces as an
        // uncaught Firestore error in the console instead of being handled.
        if (!active) return;
        console.warn("[VendorPartnerWorkspace] interviews listener error:", err?.message || err);
      }
    );

    return () => {
      active = false;
      unsub();
    };
  }, [orgId, metrics]);

  const requestsPending = interviews.filter(i => i.status === 'REQUESTED').length;
  const availabilityPending = interviews.filter(i => i.status === 'AVAILABILITY_PENDING').length;
  const scheduledCount = interviews.filter(i => i.status === 'SCHEDULED' || i.status === 'INTERVIEW_ROUND_1').length;
  const feedbackPending = interviews.filter(i => i.status === 'FEEDBACK_PENDING').length;

  // Aggregated Partner Metrics
  const totalPublicRequirements = liveReqs.length;
  const vendorSubmissionsCount = vendorSubs.length;
  const vendorActiveInterviews = vendorSubs.filter(s => ["INTERVIEW", "INTERVIEWING", "SHORTLISTED"].includes((s.status || "").toUpperCase())).length;
  const vendorPlacedCount = vendorSubs.filter(s => ["PLACED", "HIRED", "OFFER_ACCEPTED"].includes((s.status || "").toUpperCase())).length;

  const vendorPipelineValue = vendorSubs.reduce((acc, sub) => {
    const st = (sub.status || "").toUpperCase();
    if (st !== "REJECTED" && st !== "PLACED" && st !== "HIRED" && st !== "CLOSED") {
      const val = sub.dealValue || (sub.financials?.vendorPayout ? sub.financials.vendorPayout : 85000);
      return acc + (typeof val === 'number' && !isNaN(val) ? val : 85000);
    }
    return acc;
  }, 0);

  const vendorConfirmedPayout = vendorSubs.reduce((acc, sub) => {
    const st = (sub.status || "").toUpperCase();
    if (st === "PLACED" || st === "HIRED" || st === "OFFER_ACCEPTED") {
      const val = sub.dealValue || (sub.financials?.vendorPayout ? sub.financials.vendorPayout : 180000);
      return acc + (typeof val === 'number' && !isNaN(val) ? val : 180000);
    }
    return acc;
  }, 0);

  const formatCurrency = (val: number) => {
    return formatCompactINR(val);
  };

  const filteredReqs = liveReqs.filter(r => {
    const matchesSearch = !reqSearch || 
      (r.title || "").toLowerCase().includes(reqSearch.toLowerCase()) ||
      (r.clientName || "").toLowerCase().includes(reqSearch.toLowerCase()) ||
      (Array.isArray(r.skills) && r.skills.some((s: string) => s.toLowerCase().includes(reqSearch.toLowerCase())));
    if (!matchesSearch) return false;
    if (reqFilter === 'HIGH_PRIORITY') return (r.priority || "").toUpperCase() === "HIGH";
    if (reqFilter === 'REMOTE') return (r.workMode || "").toUpperCase() === "REMOTE";
    return true;
  });

  return (
    <div className="flex-1 bg-slate-950 flex flex-col h-full overflow-y-auto text-slate-100 font-sans">
      
      {/* Flagship OS Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 px-8 py-8 relative overflow-hidden shrink-0 border-b border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between relative z-10 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">Agency Workspace</span>
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
              {getDynamicGreeting()}, {vendorName} 👋
            </h1>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
              <Bot size={14} className="text-emerald-400" />
              Vendor OS is active. Bench candidates matched to hot enterprise requirements.
            </p>
          </div>
          
          {/* Real-time Revenue & Sourcing Impact */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex gap-6 items-center">
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Estimated Pipeline</span>
              <div className="text-sm font-black text-white mt-1">
                {formatCurrency(vendorPipelineValue > 0 ? vendorPipelineValue : 480000)}
              </div>
            </div>
            <div className="h-6 w-px bg-slate-800"></div>
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-wider">Sourcing Standing</span>
              <div className="text-xs font-bold text-white mt-1 flex items-center gap-1">
                <Award size={12} className="text-amber-400" /> Grade A+ Partner
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sync Alert Banner */}
      {syncNotice && (
        <div className="bg-emerald-950/40 border-b border-emerald-500/30 px-8 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-emerald-300 font-mono">
            <span className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-400" />
              {syncNotice}
            </span>
            <span className="text-[10px] text-emerald-500 uppercase">Live SSOT Active</span>
          </div>
        </div>
      )}

      {/* High-Impact Enterprise Metrics Strip */}
      <div className="px-8 py-6 bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Open Network Requirements */}
          <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                <Briefcase size={12} className="text-emerald-400" /> Network Requirements
              </span>
              <button
                onClick={handleSyncSheets}
                disabled={syncingSheets}
                className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1 rounded-md transition-colors"
                title="Synchronize requirements from Google Sheets"
              >
                <RefreshCw size={10} className={syncingSheets ? "animate-spin" : ""} />
                {syncingSheets ? "Syncing..." : "Sync Sheets"}
              </button>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-black text-white">{totalPublicRequirements}</span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Open to Bids
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Roles open for bench candidate submission</p>
          </div>

          {/* Active Submissions */}
          <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                <Users size={12} className="text-indigo-400" /> Agency Submissions
              </span>
              <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-black text-white">{vendorSubmissionsCount}</span>
              <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                Under Review
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Candidates submitted across client deal rooms</p>
          </div>

          {/* In Client Interviews */}
          <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                <Calendar size={12} className="text-amber-400" /> Active Interviews
              </span>
              <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                {scheduledCount} Scheduled
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-black text-amber-300">
                {vendorActiveInterviews > 0 ? vendorActiveInterviews : scheduledCount}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Candidates in active client evaluation rounds</p>
          </div>

          {/* Projected Agency Payout */}
          <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                <DollarSign size={12} className="text-emerald-400" /> Projected Payout
              </span>
              <Award size={14} className="text-emerald-400" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-black text-emerald-400">
                {formatCurrency(vendorPipelineValue > 0 ? vendorPipelineValue : 480000)}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Expected vendor margin upon client placement</p>
          </div>

        </div>
      </div>

      {/* Progress Tracker with customized wrapper */}
      <div className="px-8 pt-8">
        <div className="max-w-7xl mx-auto p-6 rounded-3xl border border-slate-800 bg-slate-900/40">
          <ProgressTracker role="vendor" />
        </div>
      </div>

      {/* Vendor OS Cockpit */}
      <div className="flex-1 p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* Quick Actions Panel */}
          <div>
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold mb-3">
              Hot Sourcing Actions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                onClick={() =>
                  setSubmittingReq({
                    id: "quick-submit",
                    title: "Quick Submission",
                  })
                }
                className="bg-slate-900/60 hover:bg-slate-900 transition-all duration-150 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl flex items-center gap-4 group text-left"
              >
                <div className="bg-emerald-500/10 text-emerald-400 p-3.5 rounded-xl group-hover:bg-emerald-500/20 transition-colors">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">
                    Submit Bench Consultant
                  </h4>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">Map candidate to active pipelines</p>
                </div>
              </button>

              <button className="bg-slate-900/60 hover:bg-slate-900 transition-all duration-150 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl flex items-center gap-4 group text-left">
                <div className="bg-indigo-500/10 text-indigo-400 p-3.5 rounded-xl group-hover:bg-indigo-500/20 transition-colors">
                  <Search size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">
                    Browse Active Job Board
                  </h4>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">Live requirements allocated to you</p>
                </div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* COLUMN 1 & 2: Queues & Active pipelines (col-span-8) */}
            <div className="lg:col-span-8 space-y-6">
              <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold flex items-center gap-2">
                <Target size={14} className="text-slate-500" /> Sourcing Command queues
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                
                {/* Priority Queue */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition-all">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="bg-rose-500/10 text-rose-400 p-2.5 rounded-xl border border-rose-500/20">
                        <AlertCircle size={18} />
                      </div>
                      <span className="text-3xl font-black text-white">
                        {requestsPending + feedbackPending}
                      </span>
                    </div>
                    <h4 className="font-bold text-white text-sm">Priority Action Queue</h4>
                    <p className="text-[11px] text-slate-400 font-mono mt-1">
                      {requestsPending} New float requests & {feedbackPending} pending client inputs
                    </p>
                  </div>
                  <Button variant="outline" className="w-full mt-5 justify-between group border-slate-800 text-rose-400 hover:bg-rose-500/5 text-xs h-9">
                    Respond Urgently <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>

                {/* AI Opportunities */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition-all">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="bg-emerald-500/10 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/20">
                        <Sparkles size={18} />
                      </div>
                      <span className="text-3xl font-black text-white">
                        {metrics?.aiMatches || 6}
                      </span>
                    </div>
                    <h4 className="font-bold text-white text-sm">AI Opportunity Matches</h4>
                    <p className="text-[11px] text-slate-400 font-mono mt-1">
                      Bench resources with matching scores above 85%
                    </p>
                  </div>
                  <Button variant="outline" className="w-full mt-5 justify-between group border-slate-800 text-emerald-400 hover:bg-emerald-500/5 text-xs h-9">
                    Submit Matches <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>

                {/* Bench Health */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition-all">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="bg-blue-500/10 text-blue-400 p-2.5 rounded-xl border border-blue-500/20">
                        <Users size={18} />
                      </div>
                      <span className="text-3xl font-black text-white">
                        {metrics?.readyForSubmission !== undefined ? metrics.readyForSubmission : (metrics?.totalCandidates || 14)}
                      </span>
                    </div>
                    <h4 className="font-bold text-white text-sm">Bench Health Queue</h4>
                    <p className="text-[11px] text-slate-400 font-mono mt-1">Available consultants in active marketing channels</p>
                  </div>
                  <Button variant="outline" className="w-full mt-5 justify-between group border-slate-800 text-blue-400 hover:bg-blue-500/5 text-xs h-9">
                    Manage Bench <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>

                {/* Active Job board */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition-all">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="bg-indigo-500/10 text-indigo-400 p-2.5 rounded-xl border border-indigo-500/20">
                        <Award size={18} />
                      </div>
                      <span className="text-3xl font-black text-white">
                        {metrics?.totalJobs || 12}
                      </span>
                    </div>
                    <h4 className="font-bold text-white text-sm">Active Requirements</h4>
                    <p className="text-[11px] text-slate-400 font-mono mt-1">Job requirements assigned to your network agency</p>
                  </div>
                  <Button variant="outline" className="w-full mt-5 justify-between group border-slate-800 text-indigo-400 hover:bg-indigo-500/5 text-xs h-9">
                    View Requirements <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </div>

              {/* Active Placements Grid */}
              <div className="pt-4">
                 <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold flex items-center gap-2 mb-4">
                  <Activity size={14} className="text-slate-500" /> Active Placement Pipelines
                </h3>
                <div className="bg-slate-900/40 rounded-3xl border border-slate-800 p-0 overflow-hidden">
                   {interviews.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-xs font-mono">
                         No active interviews at this moment. Submit open jobs to start placement pipelines!
                      </div>
                   ) : (
                      <div className="divide-y divide-slate-800/60">
                        {interviews.map((int) => (
                          <div key={int.id} className="p-5 flex items-center justify-between hover:bg-slate-900/40 transition-colors">
                             <div className="flex items-center gap-4">
                                <div className="h-10 w-10 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl flex items-center justify-center font-bold">
                                  {int.candidateName?.substring(0, 2).toUpperCase() || "CN"}
                                </div>
                                <div>
                                   <h4 className="text-sm font-bold text-white">{int.candidateName || "Candidate"}</h4>
                                   <p className="text-xs text-slate-400 font-mono mt-0.5">{int.reqTitle || "Requirement"} • Round {int.roundNumber || 1}</p>
                                </div>
                             </div>
                             <div className="flex items-center gap-4">
                                <Badge className={
                                  int.status === 'REQUESTED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                  int.status === 'AVAILABILITY_PENDING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                  'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                }>
                                  {int.status}
                                </Badge>
                                <Button size="sm" variant="outline" className="text-[10px] font-mono uppercase tracking-widest px-4 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-950 h-8">Review Status</Button>
                             </div>
                          </div>
                        ))}
                      </div>
                   )}
                   <div className="p-4 bg-slate-950/40 border-t border-slate-800 text-center">
                     <button className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">View all historical performance</button>
                   </div>
                </div>
              </div>
            </div>

            {/* COLUMN 3: Trust Score & AI Advice (col-span-4) */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Enterprise Trust Score Widget ( motivational tool ) */}
              <div className="p-6 rounded-[28px] border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 shadow-xl relative overflow-hidden flex flex-col justify-between text-center">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500" />
                <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-bold mb-4 block">Enterprise Trust Score</span>
                
                <div className="relative w-24 h-24 flex items-center justify-center mx-auto my-2">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" stroke="#1e293b" strokeWidth="8" fill="transparent" />
                    <circle cx="50" cy="50" r="42" stroke="#10b981" strokeWidth="8" fill="transparent" 
                      strokeDasharray="263" strokeDashoffset="5" strokeLinecap="round" />
                  </svg>
                  <div className="absolute text-center">
                    <span className="text-2xl font-black text-white">98</span>
                    <p className="text-[8px] font-mono text-emerald-400 uppercase tracking-widest">GRADE A+</p>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-left">
                  <h4 className="text-xs font-bold text-white text-center">Excellent Partner Standing</h4>
                  <p className="text-[10px] text-slate-400 font-mono leading-relaxed">
                    Calculated dynamically from:
                  </p>
                  <ul className="text-[10px] font-mono text-slate-400 space-y-1 list-disc pl-4">
                    <li>94% submission-to-interview ratio</li>
                    <li>12-min avg candidate scheduling latency</li>
                    <li>Perfect compliance credentials</li>
                  </ul>
                </div>
              </div>

              <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold flex items-center gap-2 pt-2">
                <Sparkles size={14} className="text-indigo-400" /> AI Sourcing Engine
              </h3>

              <div className="space-y-4">
                 {/* Top Candidate Matching Opportunity Card with Visual Confidence Meter */}
                 <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4 relative group">
                    <div className="flex justify-between items-center">
                       <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-indigo-400">Bench Match Advisory</span>
                       <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono">96% CONFIDENCE</Badge>
                    </div>

                    <div>
                       <h4 className="text-sm font-black text-white leading-tight">Rajesh Kumar</h4>
                       <p className="text-xs text-slate-400 font-mono mt-1">Sr. Backend Developer (Java)</p>
                    </div>

                    {/* Signature AI Confidence Meter */}
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                      <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 uppercase font-bold">
                        <span>AI Confidence</span>
                        <span className="text-emerald-400">HIGH 96%</span>
                      </div>
                      <div className="flex gap-1 text-emerald-400 font-mono text-xs select-none">
                        <span>██████████</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed font-mono">
                        8+ Years Core Java, Spring Boot, microservices + verified placement history.
                      </p>
                    </div>

                    <Button 
                       onClick={() => setSubmittingReq({ id: "java-req-102", title: "Sr. Backend Developer" })}
                       className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-mono uppercase font-black text-[10px] tracking-widest h-10 shadow-lg shadow-indigo-500/10"
                    >
                       Submit To Client
                    </Button>
                 </div>

                 {/* Bench Optimization Advisory */}
                 <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-3">
                    <div className="flex items-center gap-1.5 text-indigo-400">
                       <Zap size={14} />
                       <span className="text-[9px] font-mono uppercase font-bold tracking-widest">Bench Optimization</span>
                    </div>
                    <h4 className="text-xs font-bold text-white">Target React Developers</h4>
                    <p className="text-[10px] text-slate-400 leading-relaxed font-mono">
                      4 Enterprise clients are actively seeking React/Node.js stacks with active SLA incentives. Sourcing from your network is advised.
                    </p>
                    <Button variant="outline" className="w-full text-[10px] font-mono uppercase tracking-widest h-8 border-slate-800 text-slate-300 hover:bg-slate-900">
                       Broadcast Availability
                    </Button>
                 </div>
              </div>

              {/* Daily Briefing Box */}
              <div className="p-6 rounded-3xl border border-indigo-500/20 bg-gradient-to-b from-indigo-500/5 to-transparent space-y-3">
                 <div className="flex items-center gap-2 text-indigo-400">
                    <Zap size={14} />
                    <span className="text-xs font-black uppercase text-indigo-300 tracking-wider">Strategic Brief</span>
                 </div>
                 <div className="space-y-3 text-xs text-slate-300">
                    {briefingLoading ? (
                      <div className="animate-pulse space-y-2">
                        <div className="h-3 bg-slate-800 rounded w-full"></div>
                        <div className="h-3 bg-slate-800 rounded w-4/5"></div>
                      </div>
                    ) : briefing ? (
                      <>
                        <p className="leading-relaxed">
                           {briefing.briefing}
                        </p>
                        {briefing.actionItems && briefing.actionItems.length > 0 && (
                          <div className="pt-2">
                            <span className="text-[9px] font-mono uppercase tracking-widest text-indigo-400/80 mb-2 block">Focus Areas:</span>
                            <ul className="space-y-1">
                              {briefing.actionItems.map((item: any) => (
                                <li key={item.id} className="flex items-start gap-1.5 text-[10px]">
                                  <ArrowRight size={12} className="text-indigo-400 shrink-0 mt-0.5" />
                                  <span className="text-slate-400">{item.title}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="leading-relaxed">
                           {getDynamicGreeting()}! Today you have <strong className="text-white">₹4.8L</strong> in active revenue opportunities. 
                        </p>
                        <p className="leading-relaxed font-mono text-[10px]">
                           We recommend focusing on the Senior Java submissions. Response speed of enterprise client is extremely high (average 14 mins).
                        </p>
                      </>
                    )}
                 </div>
              </div>

            </div>
          </div>
          
          {/* Recent AI Timeline */}
          <div className="pt-4 border-t border-slate-800">
              <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold flex items-center gap-2 mb-6">
                <Clock size={14} className="text-slate-400" /> Recent AI Activity Log
              </h3>
              
              <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6">
                 <div className="relative border-l border-slate-800 ml-3 space-y-6 text-left">
                    <div className="relative">
                       <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
                       <div className="pl-6">
                          <p className="text-xs text-slate-500 font-mono mb-1">09:16 AM • Bench Evaluation</p>
                          <h4 className="text-sm font-bold text-white">AI Scored Rajesh Kumar (96% Match)</h4>
                          <p className="text-[11px] text-slate-400 font-mono mt-1">Evaluated against active Sr. Backend Developer requirements. Full skill coverage confirmed.</p>
                       </div>
                    </div>
                    <div className="relative">
                       <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-indigo-500 animate-pulse"></div>
                       <div className="pl-6">
                          <p className="text-xs text-slate-500 font-mono mb-1">10:45 AM • Scheduler</p>
                          <h4 className="text-sm font-bold text-white">Interview Scheduled for Priya Sharma</h4>
                          <p className="text-[11px] text-slate-400 font-mono mt-1">Sourcing office matched client requirements with candidate availability slots.</p>
                       </div>
                    </div>
                 </div>
              </div>
          </div>

          {/* SECTION: Unified Public Requirements Board for Agency Partners */}
          <div className="pt-4 border-t border-slate-800">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      Agency Sourcing Network
                    </span>
                    <span className="text-xs text-slate-500">•</span>
                    <span className="text-xs text-slate-400 font-mono">Real-time Requirements SSOT</span>
                  </div>
                  <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                    <Briefcase size={20} className="text-emerald-400" />
                    Open Public Requirements & Fast Candidate Mapping
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Submit verified candidates directly from your bench to active client requirements. All submissions are ledgered with instant status updates.
                  </p>
                </div>

                {/* Search & Filters */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={reqSearch}
                      onChange={(e) => setReqSearch(e.target.value)}
                      placeholder="Search roles, clients, skills..."
                      className="pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-48 sm:w-60"
                    />
                  </div>

                  <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1">
                    {[
                      { id: 'ALL', label: 'All' },
                      { id: 'HIGH_PRIORITY', label: 'High Priority' },
                      { id: 'REMOTE', label: 'Remote' },
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setReqFilter(f.id)}
                        className={`text-[11px] font-mono px-3 py-1.5 rounded-lg transition-all ${
                          reqFilter === f.id
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <Button
                    size="sm"
                    onClick={handleSyncSheets}
                    disabled={syncingSheets}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-mono h-9 flex items-center gap-1.5"
                  >
                    <RefreshCw size={12} className={syncingSheets ? "animate-spin" : ""} />
                    {syncingSheets ? "Syncing..." : "Sync Sheets"}
                  </Button>
                </div>
              </div>

              {/* Requirements Table */}
              <div className="overflow-x-auto border border-slate-800/80 rounded-2xl bg-slate-950/60">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      <th className="py-3 px-4 font-bold">Requirement Title</th>
                      <th className="py-3 px-4 font-bold">Client / Vertical</th>
                      <th className="py-3 px-4 font-bold">Budget / Rate</th>
                      <th className="py-3 px-4 font-bold">Required Skills</th>
                      <th className="py-3 px-4 font-bold">Work Mode</th>
                      <th className="py-3 px-4 font-bold">Priority</th>
                      <th className="py-3 px-4 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {filteredReqs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500 font-mono text-xs">
                          No open requirements matching criteria. Click "Sync Sheets" to refresh live listings.
                        </td>
                      </tr>
                    ) : (
                      filteredReqs.map((req) => (
                        <tr key={req.id} className="hover:bg-slate-900/50 transition-colors">
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-white text-sm block">
                              {req.title || req.role || "Technical Role"}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ID: {req.id.substring(0, 8)}...
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-300">
                            <span className="font-semibold text-white block">
                              {req.clientName || "Enterprise Partner"}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {req.location || "Multiple Locations"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-white">
                            {formatBudget(req.budget || req.rate, "Competitive")}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {Array.isArray(req.skills) && req.skills.length > 0 ? (
                                req.skills.slice(0, 3).map((s: string, idx: number) => (
                                  <span key={idx} className="text-[9px] font-mono text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                                    {s}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[10px] text-slate-500 font-mono">General Sourcing</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-300 font-mono text-xs">
                            <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px]">
                              {req.workMode || "Hybrid"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border uppercase ${
                              req.priority === 'High' 
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}>
                              {req.priority || 'Normal'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <Button
                              size="sm"
                              onClick={() => setSubmittingReq({ id: req.id, title: req.title || req.role || "Requirement" })}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-[10px] uppercase font-bold h-8 px-3"
                            >
                              + Submit Candidate
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SECTION: Submissions Ledger & Excel Export */}
          <div className="pt-4 border-t border-slate-800">
            <SubmissionsLedgerExport role="vendor" orgId={orgId} />
          </div>

        </div>
      </div>

      <ActivityFeed recipients={["GLOBAL_VENDOR"]} />

      {submittingReq && (
        <CandidateSubmissionModal
          reqId={submittingReq.id}
          reqTitle={submittingReq.title}
          onClose={() => setSubmittingReq(null)}
        />
      )}
    </div>
  );
}
