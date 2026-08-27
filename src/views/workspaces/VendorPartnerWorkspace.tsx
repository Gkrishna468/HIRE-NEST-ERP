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
  Award
} from "lucide-react";
import CandidateSubmissionModal from "../../components/CandidateSubmissionModal";
import { ProgressTracker } from "../../components/ProgressTracker";
import { ActivityFeed } from "../../components/ActivityFeed";
import { auth, db } from "../../lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Badge } from "../../lib/Badge";
import { Button } from "../../lib/Button";
import { useDailyBriefing } from "../../hooks/useDailyBriefing";

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
              Vendor OS is active. 14 bench candidates matched to hot requirements.
            </p>
          </div>
          
          {/* Real-time Revenue & Sourcing Impact */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex gap-6 items-center">
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Estimated pipeline</span>
              <div className="text-sm font-black text-white mt-1">₹{((metrics?.revenue || 480000) / 1000).toFixed(1)}K Est</div>
            </div>
            <div className="h-6 w-px bg-slate-800"></div>
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-wider">Sourcing Velocity</span>
              <div className="text-xs font-bold text-white mt-1 flex items-center gap-1">
                <Zap size={12} className="text-amber-400" /> 94% Filled Rate
              </div>
            </div>
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
                          <h4 className="text-sm font-bold text-white">Interview Scheduled for Sarah Jenkins</h4>
                          <p className="text-[11px] text-slate-400 font-mono mt-1">Sourcing office matched client requirements with candidate availability slots.</p>
                       </div>
                    </div>
                 </div>
              </div>
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
