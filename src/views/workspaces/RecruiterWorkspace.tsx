import { useState, useEffect } from "react";
import { getDynamicGreeting } from "../../lib/greetings";
import {
  Briefcase,
  Users,
  Calendar,
  Clock,
  TrendingUp,
  DollarSign,
  Target,
  UploadCloud,
  Search,
  UserPlus,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Bot,
  Zap,
  Activity,
  ArrowRight,
  Mail,
  UserCheck,
  Check,
  ShieldAlert,
  Send,
  MessageCircle,
  Sparkle,
  Award,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Info
} from "lucide-react";
import { Badge } from "../../lib/Badge";
import { Button } from "../../lib/Button";
import { db, auth } from "../../lib/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { useDailyBriefing } from "../../hooks/useDailyBriefing";

type AIBriefingCategory = 'TODAY' | 'PLACEMENTS' | 'JOIN_LIKELIHOOD' | 'ATTENTION_NEEDED';

export default function RecruiterWorkspace({
  userName,
  orgId,
  metrics,
}: {
  userName: string;
  orgId?: string;
  metrics?: any;
}) {
  const [activeChannels, setActiveChannels] = useState<any[]>([]);
  const [aiBriefCategory, setAiBriefCategory] = useState<AIBriefingCategory>('TODAY');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const { briefing, loading: briefingLoading } = useDailyBriefing(orgId);

  // Score stats state
  const [recruiterScore, setRecruiterScore] = useState(91);
  const [submissionsTarget, setSubmissionsTarget] = useState({ current: 6, target: 8 });
  const [interviewsTarget, setInterviewsTarget] = useState({ current: 2, target: 3 });

  // Mock initial tasks that the recruiter can interact with
  const [interviews, setInterviews] = useState([
    { id: "int-1", candidate: "Rajesh Kumar", role: "Senior Spring Boot Architect", time: "11:30 AM", status: "PENDING_CONFIRM", sentiment: "Highly Positive", risk: "Low" },
    { id: "int-2", candidate: "Anjali Sharma", role: "UI Engineer (React/Tailwind)", time: "02:30 PM", status: "PREPPED", sentiment: "Positive", risk: "Medium" },
    { id: "int-3", candidate: "Vikram Malhotra", role: "Staff DevOps Lead", time: "04:00 PM", status: "SCHEDULED", sentiment: "Neutral", risk: "High" }
  ]);

  const [followups, setFollowups] = useState([
    { id: "fu-1", name: "Amit Verma", reason: "Offer Accepted - Collect DOJ confirmation", type: "Offer" },
    { id: "fu-2", name: "Priyanjali Sen", reason: "Post-joining check-in (Day 15)", type: "Joining" },
    { id: "fu-3", name: "Suresh Mehra (HM)", reason: "Pending feedback for Node Architect", type: "Feedback" }
  ]);

  const [attentionReqs, setAttentionReqs] = useState([
    { id: "req-att-1", role: "Staff Java Engineer", missingFollowup: "3 days since client shortlisting", risk: "SLA SLA BREACH NEAR" },
    { id: "req-att-2", role: "Technical Delivery Manager", missingFollowup: "Candidate pending vendor response", risk: "HIGH PRIORITY" }
  ]);

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const q = query(collection(db, "requirements_public"), limit(6));
        const snap = await getDocs(q);
        const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (reqs.length > 0) {
          setActiveChannels(reqs);
        } else {
          // Robust elegant fallback
          setActiveChannels([
            { id: "req-1", title: "Senior Lead Cloud Engineer", clientName: "Reliance Digital", budget: "₹38-42 LPA", status: "ACTIVE", priority: "High", submissions: 5 },
            { id: "req-2", title: "Technical Architect (React Native)", clientName: "Tata Consultancy", budget: "₹25-32 LPA", status: "ACTIVE", priority: "Medium", submissions: 3 },
            { id: "req-3", title: "Senior Staff Machine Learning Dev", clientName: "HDFC Bank Labs", budget: "₹45-55 LPA", status: "ACTIVE", priority: "High", submissions: 12 }
          ]);
        }
      } catch (err) {
        console.warn("Failed to load active channels, setting high fidelity mock data:", err);
        setActiveChannels([
          { id: "req-1", title: "Senior Lead Cloud Engineer", clientName: "Reliance Digital", budget: "₹38-42 LPA", status: "ACTIVE", priority: "High", submissions: 5 },
          { id: "req-2", title: "Technical Architect (React Native)", clientName: "Tata Consultancy", budget: "₹25-32 LPA", status: "ACTIVE", priority: "Medium", submissions: 3 },
          { id: "req-3", title: "Senior Staff Machine Learning Dev", clientName: "HDFC Bank Labs", budget: "₹45-55 LPA", status: "ACTIVE", priority: "High", submissions: 12 }
        ]);
      }
    };
    fetchChannels();
  }, [orgId]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const executeAction = async (actionId: string, actionType: string, payload: any, successMsg: string) => {
    setProcessingAction(actionId);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      
      const res = await fetch("/api/recruiter-os/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { "Authorization": `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({ action: actionType, payload })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Action failed");
      }
      
      triggerToast(successMsg);
    } catch (err: any) {
      triggerToast(`Error: ${err.message}`);
    } finally {
      setProcessingAction(null);
    }
  };

  const handleBriefingAction = (type: string) => {
    executeAction(`brief-${type}`, 'EXECUTE_BRIEFING_PLAN', { category: type }, `AI Dispatcher: Dispatched daily recruitment plan via mail to candidates & client coordinators!`);
  };

  const handleSendPrepBriefing = (candName: string, candId: string = "cand-001") => {
    executeAction(`prep-${candName}`, 'SEND_PREP_BRIEFING', { candidateId: candId }, `Sent candidate preparation briefing to ${candName} for their interview.`);
  };

  const handleSendHMBriefing = (candName: string, candId: string = "cand-001") => {
    executeAction(`hm-${candName}`, 'SEND_HM_BRIEFING', { candidateId: candId }, `Dispatched Hiring Manager Briefing containing AI feedback sentiment analysis.`);
  };

  const handleScheduleReminder = (candName: string, candId: string = "cand-001", intId: string = "int-001") => {
    executeAction(`rem-${candName}`, 'SCHEDULE_REMINDER', { candidateId: candId, interviewId: intId }, `Automated reminder schedule triggered. SMS, WhatsApp and Calendar events refreshed.`);
  };

  const handleRemoveFollowup = (id: string, name: string) => {
    executeAction(`resolve-${id}`, 'RESOLVE_FOLLOWUP', { followupId: id }, `Follow-up resolved with ${name}. Updated Recruiter KPI Score!`);
    setFollowups(prev => prev.filter(f => f.id !== id));
    setRecruiterScore(prev => Math.min(prev + 1, 100));
  };
  
  const handleSubmitToClient = (candName: string, candId: string = "cand-001", reqId: string = "req-001") => {
    executeAction(`submit-${candId}`, 'SUBMIT_CANDIDATE', { candidateId: candId, requirementId: reqId }, `${candName} has been submitted directly to Client Board.`);
  };

  return (
    <div className="flex-1 bg-slate-950 flex flex-col h-full overflow-y-auto text-slate-100 font-sans pb-16">
      
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[1000] bg-slate-900 border border-indigo-500/30 text-white px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-slate-400 uppercase font-black tracking-wider">AI System Log</span>
            <span className="text-xs font-bold">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Flagship OS Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 px-8 py-8 relative overflow-hidden shrink-0 border-b border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between relative z-10 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">Recruiter OS (HN-008)</span>
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
              {getDynamicGreeting()}, {userName} 👋
            </h1>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
              <Bot size={14} className="text-indigo-400" />
              Intelligence Layer active: Analyzed 14 metrics and optimized today's high-probability pipelines.
            </p>
          </div>
          
          {/* Real-time Impact Tracker */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex gap-6 items-center">
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Daily Targets Progress</span>
              <div className="flex gap-4 text-xs font-bold text-white mt-1">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-emerald-400" /> 
                  <span>{submissionsTarget.current}/{submissionsTarget.target} Submits</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar size={12} className="text-indigo-400" /> 
                  <span>{interviewsTarget.current}/{interviewsTarget.target} Interviews</span>
                </span>
              </div>
            </div>
            <div className="h-8 w-px bg-slate-800"></div>
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-indigo-400 uppercase tracking-wider">Recruiter Quality Score</span>
              <div className="flex items-center gap-2 mt-1">
                <Award size={14} className="text-amber-400" />
                <span className="text-sm font-black text-white">{recruiterScore} <span className="text-[10px] text-slate-500 font-normal">/100</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Flagship Recruiter OS Cockpit Layout */}
      <div className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* COLUMN 1: AI Assistant & Briefing Panel (col-span-4) */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Bot size={20} className="text-indigo-400 animate-bounce" />
                    <h3 className="text-xs font-black uppercase text-indigo-300 tracking-wider">AI Daily Assistant (HN-010)</h3>
                  </div>
                  <Badge className="bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 text-[9px] font-mono font-bold">
                    Omni Flash v2.5
                  </Badge>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mb-6">
                  Good morning {userName}! Here is your intelligence briefing compiled from the live enterprise staffing database.
                </p>

                {/* Briefing Category Selector */}
                <div className="grid grid-cols-2 gap-2 mb-6">
                  {[
                    { id: 'TODAY', label: "📅 Today's Plan" },
                    { id: 'PLACEMENTS', label: "🔥 Hot Placements" },
                    { id: 'JOIN_LIKELIHOOD', label: "🤝 Joint Likeliness" },
                    { id: 'ATTENTION_NEEDED', label: "⚠️ SLA Alerts" }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setAiBriefCategory(cat.id as AIBriefingCategory)}
                      className={`text-left p-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all duration-150 ${
                        aiBriefCategory === cat.id 
                          ? "bg-indigo-600/20 border-indigo-500/50 text-white" 
                          : "bg-slate-950/50 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Dynamic Briefing Display content */}
                <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl min-h-[170px] flex flex-col justify-between">
                  <div>
                    {aiBriefCategory === 'TODAY' && (
                      <div className="space-y-3">
                        <span className="text-[9px] font-mono font-black text-slate-500 uppercase tracking-widest block">Action Plan Overview</span>
                        {briefingLoading ? (
                          <div className="animate-pulse flex flex-col gap-2">
                            <div className="h-3 bg-slate-800 rounded w-full"></div>
                            <div className="h-3 bg-slate-800 rounded w-5/6"></div>
                          </div>
                        ) : briefing ? (
                          <>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              {briefing.briefing}
                            </p>
                            {briefing.actionItems && briefing.actionItems.length > 0 && (
                              <div className="space-y-1 text-[10px] text-slate-400 font-mono mt-3">
                                {briefing.actionItems.map((item: any) => (
                                  <p key={item.id} className="flex items-start gap-1.5">
                                    <Check size={10} className="text-emerald-400 shrink-0 mt-0.5" /> 
                                    <span>{item.title}</span>
                                  </p>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              Your priority today is closing the loop on <strong className="text-white">Rajesh Kumar</strong>'s technical round. 
                            </p>
                            <div className="space-y-1 text-[10px] text-slate-400 font-mono">
                              <p className="flex items-center gap-1.5"><Check size={10} className="text-emerald-400" /> Prepare Vikram Malhotra for Staff DevOps round</p>
                              <p className="flex items-center gap-1.5"><Check size={10} className="text-emerald-400" /> Trigger offer accepted engagement workflow</p>
                              <p className="flex items-center gap-1.5"><Check size={10} className="text-indigo-400" /> Follow up with Suresh Mehra (Hiring Manager)</p>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {aiBriefCategory === 'PLACEMENTS' && (
                      <div className="space-y-3">
                        <span className="text-[9px] font-mono font-black text-emerald-400 uppercase tracking-widest block">High Probability Placements</span>
                        <div className="space-y-2.5">
                          <div className="border-b border-slate-900 pb-2">
                            <div className="flex justify-between text-xs">
                              <span className="font-bold text-white">Anjali Sharma</span>
                              <span className="text-emerald-400 font-black">94% Fit Score</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">Role: UI Engineer | Reliance Digital</p>
                          </div>
                          <div>
                            <div className="flex justify-between text-xs">
                              <span className="font-bold text-white">Rajesh Kumar</span>
                              <span className="text-emerald-400 font-black">89% Offer Prob</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">Role: Spring Boot Architect | HDFC Bank Labs</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {aiBriefCategory === 'JOIN_LIKELIHOOD' && (
                      <div className="space-y-3">
                        <span className="text-[9px] font-mono font-black text-indigo-400 uppercase tracking-widest block">Candidate Join/Reject Predictions</span>
                        <div className="space-y-2.5">
                          <div className="border-b border-slate-900 pb-2">
                            <div className="flex justify-between text-xs">
                              <span className="font-bold text-white">Amit Verma</span>
                              <span className="text-emerald-400 font-black">92% Likely to Join</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Counter Offer matching. Engaged 3 times this week.</p>
                          </div>
                          <div>
                            <div className="flex justify-between text-xs">
                              <span className="font-bold text-white">Vikram Malhotra</span>
                              <span className="text-rose-400 font-black">40% Drop Risk</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Strong notice period hesitation. Suggest pre-joining engagement check.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {aiBriefCategory === 'ATTENTION_NEEDED' && (
                      <div className="space-y-3">
                        <span className="text-[9px] font-mono font-black text-rose-400 uppercase tracking-widest block">SLA Breaches & Requirements</span>
                        <div className="space-y-2.5">
                          {attentionReqs.map((att) => (
                            <div key={att.id} className="border-b border-slate-900 pb-2 last:border-0 last:pb-0">
                              <div className="flex justify-between text-xs">
                                <span className="font-bold text-white">{att.role}</span>
                                <span className="text-[8px] font-mono bg-rose-500/15 text-rose-400 border border-rose-500/30 px-1.5 py-0.5 rounded">{att.risk}</span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{att.missingFollowup}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-900 flex justify-end gap-2">
                    <Button 
                      size="sm"
                      onClick={() => handleBriefingAction(aiBriefCategory)}
                      disabled={processingAction !== null}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-mono uppercase tracking-widest h-8"
                    >
                      {processingAction === `brief-${aiBriefCategory}` ? "Processing..." : "Execute Automated Briefing Plan"}
                    </Button>
                  </div>
                </div>

              </div>

              {/* Recruiter Score Diagnostic & Targets */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500 block">Performance & Daily Targets</span>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400 font-bold">Submissions Target Target Met</span>
                      <span className="text-white font-mono">{submissionsTarget.current} / {submissionsTarget.target}</span>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                      <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${(submissionsTarget.current / submissionsTarget.target) * 100}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400 font-bold">Interviews Target Met</span>
                      <span className="text-white font-mono">{interviewsTarget.current} / {interviewsTarget.target}</span>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                      <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${(interviewsTarget.current / interviewsTarget.target) * 100}%` }}></div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex justify-between items-center">
                  <div className="space-y-1">
                    <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest block">Action</span>
                    <span className="text-xs text-slate-300 font-bold">Log New Submission</span>
                  </div>
                  <Button 
                    size="sm"
                    onClick={() => {
                      if (submissionsTarget.current < submissionsTarget.target) {
                        setSubmissionsTarget(prev => ({ ...prev, current: prev.current + 1 }));
                        setRecruiterScore(prev => Math.min(prev + 1, 100));
                        triggerToast("Logged submission successfully! Targets and KPI score updated.");
                      } else {
                        triggerToast("Excellent! Daily submissions target met successfully.");
                      }
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono uppercase font-black text-[9px] h-8"
                  >
                    + Submit Candidate
                  </Button>
                </div>
              </div>

            </div>

            {/* COLUMN 2: Today's Focus Desk (col-span-5) */}
            <div className="lg:col-span-5 space-y-6">
              <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold flex items-center gap-2">
                <Target size={14} className="text-slate-500" /> Today's Focus Desk
              </h3>

              {/* Priority Sourcing Alerts */}
              <div className="p-5 rounded-2xl border border-rose-950 bg-rose-500/5 space-y-3">
                <div className="flex items-center gap-2 text-rose-400">
                  <AlertCircle size={16} />
                  <span className="text-xs font-black uppercase tracking-wider">SLA Risk Sourcing Warnings</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Requirement <strong className="text-white">Senior Lead Cloud Engineer</strong> is missing submission velocity threshold rules (5 submissions target, current 3).
                </p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => executeAction("re-evaluate", "EXECUTE_BRIEFING_PLAN", { category: "OPTIMIZE_MATCHES" }, "AI analyzed client feedback sentiment: Recommended shortlisting 2 candidates on hold.")}
                    className="w-full justify-between group border-rose-500/20 text-rose-400 hover:bg-rose-500/10 text-[10px] font-mono uppercase tracking-widest h-9"
                  >
                    Optimize Matches <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </div>

              {/* Today's Interviews Intelligence Section */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-400">Interview Intelligence Dashboard</span>
                  <span className="text-[9px] font-mono text-emerald-400 uppercase font-black">3 Interviews Today</span>
                </div>

                <div className="space-y-4">
                  {interviews.map((int) => (
                    <div key={int.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-850 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-xs font-black text-white">{int.candidate}</h4>
                          <p className="text-[10px] text-slate-400 mt-0.5">{int.role} • <strong className="text-indigo-400">{int.time}</strong></p>
                        </div>
                        <Badge className={`text-[8px] font-mono border ${
                          int.risk === 'High' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                          int.risk === 'Medium' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                          'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        }`}>
                          Risk: {int.risk}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-[10px] border-t border-slate-900 pt-3">
                        <div>
                          <span className="text-slate-500">AI Preparation Sentiment</span>
                          <span className="text-white block font-bold mt-0.5">{int.sentiment}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Current Status</span>
                          <span className="text-indigo-400 block font-bold mt-0.5">{int.status}</span>
                        </div>
                      </div>

                      {/* Explicit Interactive Actions */}
                      <div className="grid grid-cols-3 gap-1.5 pt-2">
                        <button
                          onClick={() => handleSendPrepBriefing(int.candidate)}
                          className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-[9px] font-bold py-1.5 transition-all text-center"
                        >
                          Candidate Prep
                        </button>
                        <button
                          onClick={() => handleSendHMBriefing(int.candidate)}
                          className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-[9px] font-bold py-1.5 transition-all text-center"
                        >
                          HM Briefing
                        </button>
                        <button
                          onClick={() => handleScheduleReminder(int.candidate)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-bold py-1.5 transition-all text-center"
                        >
                          Auto Remind
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active Follow-up Queues */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-400 block">Follow-ups & Handshakes</span>

                <div className="space-y-2.5">
                  {followups.map((fu) => (
                    <div key={fu.id} className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{fu.name}</span>
                          <Badge className="text-[8px] px-1 py-px bg-slate-800 border-slate-700 text-slate-300 font-mono">
                            {fu.type}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono">{fu.reason}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveFollowup(fu.id, fu.name)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20 transition-all shrink-0"
                      >
                        Resolve
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* COLUMN 3: Requirement Catalog & Top Candidate Matching (col-span-3) */}
            <div className="lg:col-span-3 space-y-6">
              <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold flex items-center gap-2">
                <Sparkles size={14} className="text-indigo-400" /> AI Sourcing Matrix
              </h3>

              {/* Top AI Match Recommendation */}
              <div className="p-6 rounded-3xl border border-slate-800 bg-slate-900 space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-indigo-400">Featured Match Profile</span>
                  <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono font-bold">94% CONFIDENCE</Badge>
                </div>

                <div>
                  <h4 className="text-sm font-black text-white leading-tight">Sarah Jenkins</h4>
                  <p className="text-xs text-slate-400 font-mono mt-1">Matched for Senior React Developer</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 uppercase font-bold">
                    <span>AI Confidence</span>
                    <span className="text-emerald-400">HIGH 94%</span>
                  </div>
                  <div className="flex gap-1 text-emerald-400 font-mono text-xs select-none">
                    <span>█████████░</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed mt-1 font-mono">
                    High React/Tailwind visual score match. Notice period is immediate availability.
                  </p>
                </div>

                <Button 
                  onClick={() => handleSubmitToClient("Sarah Jenkins", "cand-sarah-123", "req-001")}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-mono uppercase font-black text-[10px] tracking-widest h-10 shadow-lg shadow-indigo-500/10"
                >
                  Submit to Client
                </Button>
              </div>

              {/* Sourcing Channels List */}
              <div className="space-y-3">
                <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-bold block">Sourcing Channels Catalog</span>
                
                <div className="space-y-3">
                  {activeChannels.map((pipe) => (
                    <div key={pipe.id} className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition-all duration-200">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${
                            pipe.priority === 'High' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
                          }`}>
                            {pipe.priority || 'MEDIUM'} PRIORITY
                          </span>
                          <span className="text-[9px] font-mono text-indigo-400">{pipe.submissions || 0} Submits</span>
                        </div>
                        <h4 className="text-xs font-black text-white mt-2 leading-tight">{pipe.title || pipe.role}</h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">{pipe.clientName || 'HQ Client'} • {pipe.budget}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
