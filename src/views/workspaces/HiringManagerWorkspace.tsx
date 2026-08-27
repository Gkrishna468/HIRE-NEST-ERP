import { useState, useEffect } from "react";
import { getDynamicGreeting } from "../../lib/greetings";
import {
  Briefcase,
  Users,
  Calendar,
  Clock,
  CheckCircle,
  Target,
  Search,
  PlusCircle,
  CheckSquare,
  Sparkles,
  Zap,
  TrendingUp,
  AlertCircle,
  Activity,
  ArrowRight,
  Bot,
  UserCheck,
  CheckCircle2,
  Bookmark,
  ShieldCheck,
  MessagesSquare
} from "lucide-react";
import { Badge } from "../../lib/Badge";
import { Button } from "../../lib/Button";
import { ProgressTracker } from "../../components/ProgressTracker";
import { ActivityFeed } from "../../components/ActivityFeed";
import { auth, db } from "../../lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useDailyBriefing } from "../../hooks/useDailyBriefing";

export default function HiringManagerWorkspace({
  userName,
  orgId,
  metrics,
}: {
  userName: string;
  orgId?: string;
  metrics?: any;
}) {
  const [interviews, setInterviews] = useState<any[]>([]);
  const { briefing, loading: briefingLoading } = useDailyBriefing(orgId);

  useEffect(() => {
    let active = true;
    if (!auth.currentUser || !orgId) return;
    
    // We fetch interviews assigned to this client
    const qAll = query(
      collection(db, "interviews"),
      where("clientId", "==", orgId)
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
        console.warn("[HiringManagerWorkspace] interviews listener error:", err?.message || err);
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
  const decisionPending = interviews.filter(i => i.status === 'DECISION_PENDING').length;

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-y-auto text-slate-900 font-sans">
      
      {/* OS Command Header */}
      <div className="bg-slate-900 px-8 py-10 relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between relative z-10 gap-6">
          <div>
            <h1 className="text-3xl font-medium tracking-tight text-white mb-2 flex items-center gap-3">
              {getDynamicGreeting()}, {userName} 👋
            </h1>
            <p className="text-sm text-indigo-200 flex items-center gap-2">
              <Bot size={16} className="text-indigo-400" />
              Client OS is active. 3 placement pipelines are operating ahead of SLA.
            </p>
          </div>
          
          {/* Productivity Stats Summary */}
          <div className="flex gap-4">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex gap-6 items-center">
               <div className="flex flex-col gap-1">
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hiring Velocity Saving</span>
                 <div className="flex gap-3 text-xs font-medium text-white">
                    <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-400" /> {metrics?.timeToHireDays || 12} Days Avg</span>
                    <span className="flex items-center gap-1"><TrendingUp size={12} className="text-blue-400" /> 8.5 Hours Saved / Job</span>
                 </div>
               </div>
               <div className="h-8 w-px bg-slate-700"></div>
               <div className="flex flex-col gap-1">
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI Placement Probability</span>
                 <div className="flex gap-4 text-xs font-medium text-white">
                    <span className="flex items-center gap-1"><Zap size={12} className="text-amber-400" /> 92% SLA Match Target</span>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Tracker */}
      <div className="px-8 pt-8">
        <div className="max-w-7xl mx-auto">
          <ProgressTracker role="client" />
        </div>
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* Quick Actions */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
              Quick Actions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button className="bg-white hover:bg-slate-50 transition-colors border border-slate-200 p-4 rounded-xl flex items-center gap-4 group shadow-sm text-left">
                <div className="bg-indigo-50 text-indigo-600 p-3 rounded-lg group-hover:bg-indigo-100 transition-colors">
                  <PlusCircle size={20} />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">
                    Publish New Requirement
                  </h4>
                  <p className="text-xs text-slate-500">Launch a job to the vendor ecosystem</p>
                </div>
              </button>
              <button className="bg-white hover:bg-slate-50 transition-colors border border-slate-200 p-4 rounded-xl flex items-center gap-4 group shadow-sm text-left">
                <div className="bg-emerald-50 text-emerald-600 p-3 rounded-lg group-hover:bg-emerald-100 transition-colors">
                  <Users size={20} />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">
                    Review Pre-Screened Resumes
                  </h4>
                  <p className="text-xs text-slate-500">Browse verified matches waiting approval</p>
                </div>
              </button>
              <button className="bg-white hover:bg-slate-50 transition-colors border border-slate-200 p-4 rounded-xl flex items-center gap-4 group shadow-sm text-left">
                <div className="bg-amber-50 text-amber-600 p-3 rounded-lg group-hover:bg-amber-100 transition-colors">
                  <CheckSquare size={20} />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">
                    Log Interview Feedbacks
                  </h4>
                  <p className="text-xs text-slate-500">Add feedback ratings & ratings scores</p>
                </div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Client Work Queues */}
            <div className="lg:col-span-2 space-y-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Target size={14} className="text-slate-400" /> Operational Work Queues
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Priority Queue (Interviews, scheduling, pending feedback) */}
                <div className="bg-white border border-rose-100 rounded-2xl p-5 shadow-sm hover:border-rose-200 transition-colors flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="bg-rose-50 text-rose-600 p-2 rounded-lg">
                        <AlertCircle size={18} />
                      </div>
                      <span className="text-2xl font-light text-slate-900">
                        {feedbackPending + decisionPending}
                      </span>
                    </div>
                    <h4 className="font-semibold text-slate-900 text-sm">Priority Queue</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {feedbackPending} Feedbacks pending & {decisionPending} final decisions waiting
                    </p>
                  </div>
                  <Button variant="outline" className="w-full mt-4 justify-between group border-slate-200">
                    Take Action Now <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>

                {/* AI Prepared Queue */}
                <div className="bg-white border border-emerald-100 rounded-2xl p-5 shadow-sm hover:border-emerald-200 transition-colors flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg">
                        <Sparkles size={18} />
                      </div>
                      <span className="text-2xl font-light text-slate-900">
                        {metrics?.totalCandidates || 8}
                      </span>
                    </div>
                    <h4 className="font-semibold text-slate-900 text-sm">AI Prepared Queue</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Candidates pre-evaluated & ranked by Recruiter OS matching engine
                    </p>
                  </div>
                  <Button variant="outline" className="w-full mt-4 justify-between group border-slate-200">
                    Review Ranked List <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>

                {/* Active Pipelines */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition-colors flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="bg-indigo-50 text-indigo-600 p-2 rounded-lg">
                        <Briefcase size={18} />
                      </div>
                      <span className="text-2xl font-light text-slate-900">
                        {metrics?.totalJobs || 4}
                      </span>
                    </div>
                    <h4 className="font-semibold text-slate-900 text-sm">Active Requirements</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Open jobs actively sourced by vendor and partner agencies
                    </p>
                  </div>
                  <Button variant="outline" className="w-full mt-4 justify-between group border-slate-200">
                    View Requirements <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>

                {/* Collaboration Queue */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition-colors flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
                        <MessagesSquare size={18} />
                      </div>
                      <span className="text-2xl font-light text-slate-900">
                        3
                      </span>
                    </div>
                    <h4 className="font-semibold text-slate-900 text-sm">Collaboration Hub</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Direct connection logs and comments shared with recruitment coordinators
                    </p>
                  </div>
                  <Button variant="outline" className="w-full mt-4 justify-between group border-slate-200">
                    Open Messages <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </div>

              {/* Active Pipelines & Interviews */}
              <div className="pt-4">
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                  <Activity size={14} className="text-slate-400" /> Real-time Pipeline Progress
                </h3>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-0 overflow-hidden">
                   {interviews.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 text-sm">
                         No active pipelines are undergoing reviews right now. Start by opening a requirement!
                      </div>
                   ) : (
                     interviews.map((int) => (
                       <div key={int.id} className="p-4 border-b border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-4">
                             <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold">
                               {int.candidateName?.substring(0, 2).toUpperCase() || "HM"}
                             </div>
                             <div>
                                <h4 className="text-sm font-semibold text-slate-900">{int.candidateName || "Candidate"}</h4>
                                <p className="text-xs text-slate-500">{int.reqTitle || "Requirement"} • Status: {int.status}</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-4">
                             <Badge className={
                               int.status === 'DECISION_PENDING' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                               int.status === 'FEEDBACK_PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                               'bg-slate-100 text-slate-700 border-slate-200'
                             }>
                               {int.status}
                             </Badge>
                             <Button size="sm" variant="outline" className="text-xs px-4 border-slate-200">Review Match</Button>
                          </div>
                       </div>
                     ))
                   )}
                </div>
              </div>
            </div>

            {/* Right Column: AI Assistant & Briefing panel */}
            <div className="space-y-6">
              
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Sparkles size={14} className="text-indigo-500" /> AI Executive Recommendations
              </h3>

              <div className="space-y-4">
                 
                 {/* Top Candidate Matching Card */}
                 <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden flex flex-col relative group">
                    <div className="absolute top-0 right-0 p-3">
                       <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">94% Confidence</Badge>
                    </div>
                    <div className="p-5 pb-4">
                       <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-3 flex items-center gap-1">
                          <UserCheck size={12} /> Pre-Evaluated Match
                       </div>
                       <h4 className="text-sm font-semibold text-slate-900 mb-1">Ananya Iyer</h4>
                       <p className="text-xs text-slate-500 mb-4">React Developer - Acme Portfolio</p>
                       
                       <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 border border-slate-100">
                          <span className="font-semibold text-slate-700">Matching Proof:</span> 4+ Years Front-end. Strong in Tailwind CSS & React state management, matching exactly what you requested.
                       </div>
                    </div>
                    <div className="p-3 bg-slate-50 border-t border-slate-100 flex gap-2">
                       <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9">
                          Schedule Interview
                       </Button>
                       <Button variant="outline" className="text-xs h-9 border-slate-200">
                          Decline
                       </Button>
                    </div>
                 </div>

                 {/* Portfolio Analytics Risk Assessment */}
                 <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-5 pb-4">
                       <div className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-3 flex items-center gap-1">
                          <ShieldCheck size={12} /> Pipeline risk check
                       </div>
                       <h4 className="text-sm font-semibold text-slate-900 mb-1">Time-to-Hire Warning</h4>
                       <p className="text-xs text-slate-500 mb-4">Role: Node.js Backend Architect</p>
                       
                       <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 border border-slate-100">
                          <span className="font-semibold text-slate-700">AI Warning:</span> Sourcing SLA is approaching expiration in 4 days. Broaden vendor pool or adjust requirements.
                       </div>
                    </div>
                    <div className="p-3 bg-slate-50 border-t border-slate-100 flex gap-2">
                       <Button variant="outline" className="w-full text-xs h-9 border-slate-200 hover:bg-white text-rose-600 hover:text-rose-700">
                          Review Vendor Channels
                       </Button>
                    </div>
                 </div>
              </div>

              {/* Daily Briefing Card */}
              <div className="mt-8 pt-6 border-t border-slate-200">
                 <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 opacity-10">
                       <Bot size={120} className="-mr-6 -mt-6" />
                    </div>
                    <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2 mb-3 relative z-10">
                      <Zap size={14} /> AI Daily Briefing
                    </h3>
                    <div className="space-y-3 relative z-10 text-sm text-slate-200">
                       {briefingLoading ? (
                         <div className="animate-pulse flex flex-col gap-2">
                           <div className="h-4 bg-slate-700 rounded w-full"></div>
                           <div className="h-4 bg-slate-700 rounded w-5/6"></div>
                         </div>
                       ) : briefing ? (
                         <>
                           <p className="leading-relaxed">
                              {briefing.briefing}
                           </p>
                           {briefing.actionItems && briefing.actionItems.length > 0 && (
                             <div className="mt-4 pt-4 border-t border-slate-700/50">
                               <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mb-2 block">Action Items</span>
                               <ul className="space-y-2">
                                 {briefing.actionItems.map((item: any) => (
                                   <li key={item.id} className="flex items-start gap-2 text-xs">
                                     <ArrowRight size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                                     <span>{item.title}</span>
                                   </li>
                                 ))}
                               </ul>
                             </div>
                           )}
                         </>
                       ) : (
                         <p className="leading-relaxed">
                            Welcome! Today, we verified <strong className="text-white">12 new submissions</strong>. 
                         </p>
                       )}
                    </div>
                 </div>
              </div>

            </div>
          </div>
          
          {/* Recent Timeline */}
          <div className="pt-8">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-6">
                <Clock size={14} className="text-slate-400" /> Recent AI Timeline
              </h3>
              
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                 <div className="relative border-l border-slate-200 ml-3 space-y-6">
                    <div className="relative">
                       <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-white"></div>
                       <div className="pl-6">
                          <p className="text-xs text-slate-500 font-medium mb-1">09:00 AM • Automated Screening</p>
                          <h4 className="text-sm font-semibold text-slate-900">Ananya Iyer screened & matched</h4>
                          <p className="text-xs text-slate-600 mt-1">Recruiter OS evaluated her profile automatically. Sourced skill sets match your portfolio exactly.</p>
                       </div>
                    </div>
                    <div className="relative">
                       <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-white"></div>
                       <div className="pl-6">
                          <p className="text-xs text-slate-500 font-medium mb-1">Yesterday • Strategic Routing</p>
                          <h4 className="text-sm font-semibold text-slate-900">Broadcast sent to Vendor Partner Network</h4>
                          <p className="text-xs text-slate-600 mt-1">Sourcing request for "Backend Developer" broadcasted automatically via capability broker.</p>
                       </div>
                    </div>
                 </div>
              </div>
          </div>

        </div>
      </div>

      <ActivityFeed recipients={["GLOBAL_CLIENT", "GLOBAL_ADMIN"]} />
    </div>
  );
}
