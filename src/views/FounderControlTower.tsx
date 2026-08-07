import React, { useState, useEffect } from "react";
import { 
  Building2, 
  Users, 
  Briefcase, 
  UserSquare2, 
  TrendingUp, 
  Target, 
  Cpu, 
  ShieldCheck, 
  Activity, 
  Globe2, 
  HeartHandshake,
  DollarSign,
  Cloud,
  AlertTriangle,
  FileText,
  Mail,
  CheckCircle2,
  Bot,
  Zap,
  PlayCircle,
  PauseCircle,
  TrendingDown,
  BrainCircuit,
  Clock,
  Calendar
} from "lucide-react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { cn } from "../lib/utils";
import { FirebaseProjectionService, DashboardMetrics } from "../lib/services/firebase/FirebaseProjectionService";

export default function FounderControlTower() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    revenue: 0,
    aiCost: 0,
    runningAgents: 0,
    queuedJobs: 0,
    failedJobs: 0,
    retryJobs: 0,
    avgRuntime: 0,
    requirementsReceived: 0,
    candidatesProcessed: 0,
    submissionsSent: 0,
    interviewsScheduled: 0,
    offersReleased: 0,
    emailsProcessed: 0,
    tokenUsage: 0,
    expectedRevenue: 0,
    successRate: 0
  });

  const [efficiency, setEfficiency] = useState({
    aiCostSaved: 1450.20,
    workforceVelocity: 94,
    avgTimeToMatch: "14m",
    avgTimeToInterview: "2.4h",
    proprietaryMatches: 1240,
    llmRefinements: 450,
    headroomSaved: "61%",
    deterministicSaved: "73%",
    cacheHits: "81%",
    totalRequests: 320,
    avgResponseTime: "840ms",
    geminiCost: 41
  });

  useEffect(() => {
    const projectionService = FirebaseProjectionService.getInstance();
    const unsub = projectionService.listenToExecutiveMetrics((newMetrics) => {
      setMetrics(newMetrics);
      setLoading(false);
    });

    const unsubEff = projectionService.listenToEfficiencyMetrics((newEff) => {
      setEfficiency(newEff);
    });

    return () => {
      unsub();
      unsubEff();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const [isPlayingBriefingAudio, setIsPlayingBriefingAudio] = useState(false);

  const handleAudioBriefing = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Web Speech synthesis is not supported in this browser.");
      return;
    }

    if (isPlayingBriefingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingBriefingAudio(false);
      return;
    }

    window.speechSynthesis.cancel();

    const textToSpeak = `Good morning Gopal. Here is your AI CEO Briefing. Yesterday's performance: 43 active requirements, 214 candidates parsed, 81 AI matches, 17 interviews scheduled, 3 offers released, and 1 placement closed. Revenue pipeline stands at 24.8 Lakhs, with 5.4 recruiter hours saved by AI. Recommended actions: Follow up with ABC Client, escalate Vendor XYZ, and increase broadcast on REQ-881.`;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) => v.lang.startsWith("en") && (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Samantha"))
    ) || voices.find((v) => v.lang.startsWith("en"));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onend = () => {
      setIsPlayingBriefingAudio(false);
    };

    utterance.onerror = (e) => {
      console.warn("[CEO Briefing] Speech synthesis notice:", e);
      setIsPlayingBriefingAudio(false);
    };

    setIsPlayingBriefingAudio(true);
    window.speechSynthesis.speak(utterance);
  };

  if (loading) {
    return <div className="p-8 flex items-center justify-center font-bold text-slate-400 uppercase tracking-widest animate-pulse">Initializing Founder Mission Control...</div>;
  }

  const formatCurrency = (val: number) => `₹${val.toLocaleString()}`;
  const formatCompact = (val: number) => val > 1000 ? (val / 1000).toFixed(1) + 'K' : val;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 border-b border-indigo-900 pb-2 inline-block shadow-[inset_0_-2px_0_rgba(30,58,138,1)]">
            Founder Daily Brief (Live)
          </h1>
          <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-2">
            <Globe2 size={14} className="text-indigo-900" /> Auto-Generated Executive Summary
          </p>
        </div>
        <button className="bg-indigo-900 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-800 transition-colors flex items-center gap-2">
           <FileText size={16} /> Download EOD Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* AI CEO Morning Briefing */}
        <div className="bg-indigo-950 p-6 rounded-2xl shadow-xl border border-indigo-800 text-white lg:col-span-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600 rounded-full blur-[100px] opacity-20 -mr-10 -mt-10 pointer-events-none"></div>
            <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start justify-between">
                <div className="flex-1">
                    <h2 className="text-2xl font-black mb-1 flex items-center gap-2 text-white">
                        Good Morning, Gopal
                    </h2>
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                      <p className="text-indigo-300 text-xs font-bold uppercase tracking-widest">Your AI CEO Briefing • Yesterday's Performance</p>
                      <button
                        onClick={handleAudioBriefing}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow flex items-center gap-1.5"
                      >
                        {isPlayingBriefingAudio ? (
                          <>
                            <PauseCircle size={14} />
                            <span>Pause Brief</span>
                          </>
                        ) : (
                          <>
                            <PlayCircle size={14} />
                            <span>Listen to Brief</span>
                          </>
                        )}
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-6 pb-6 border-b border-indigo-800/50">
                        <div>
                            <p className="text-[10px] text-indigo-400 font-bold uppercase mb-1">Requirements</p>
                            <p className="text-xl font-black">43</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-indigo-400 font-bold uppercase mb-1">Candidates Parsed</p>
                            <p className="text-xl font-black">214</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-indigo-400 font-bold uppercase mb-1">AI Matches</p>
                            <p className="text-xl font-black">81</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-indigo-400 font-bold uppercase mb-1">Interviews</p>
                            <p className="text-xl font-black">17</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-indigo-400 font-bold uppercase mb-1">Offers</p>
                            <p className="text-xl font-black">3</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-indigo-400 font-bold uppercase mb-1">Placement</p>
                            <p className="text-xl font-black text-emerald-400">1</p>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-8">
                        <div>
                            <p className="text-[10px] text-indigo-400 font-bold uppercase mb-1">Revenue Pipeline</p>
                            <p className="text-2xl font-black text-emerald-400">₹24.8L</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-indigo-400 font-bold uppercase mb-1">AI Time Saved</p>
                            <p className="text-2xl font-black text-amber-400">5.4 Hrs</p>
                            <p className="text-[9px] text-indigo-300 mt-0.5">Recruiter Hours</p>
                        </div>
                    </div>
                </div>

                <div className="w-full md:w-80 bg-indigo-900/50 border border-indigo-800/50 rounded-xl p-5 shrink-0">
                    <h3 className="text-xs font-black text-indigo-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Zap size={14} className="text-amber-400" /> Recommended Actions
                    </h3>
                    <div className="space-y-3">
                        <button className="w-full text-left bg-indigo-900 hover:bg-indigo-800 border border-indigo-700/50 p-3 rounded-lg transition-colors group">
                            <p className="text-[10px] text-indigo-300 font-bold uppercase mb-1 group-hover:text-white transition-colors">Client Action</p>
                            <p className="text-sm font-bold">Follow up with ABC Client</p>
                        </button>
                        <button className="w-full text-left bg-indigo-900 hover:bg-indigo-800 border border-indigo-700/50 p-3 rounded-lg transition-colors group">
                            <p className="text-[10px] text-rose-300 font-bold uppercase mb-1 group-hover:text-rose-200 transition-colors">Vendor Action</p>
                            <p className="text-sm font-bold text-rose-100">Escalate Vendor XYZ</p>
                        </button>
                        <button className="w-full text-left bg-indigo-900 hover:bg-indigo-800 border border-indigo-700/50 p-3 rounded-lg transition-colors group">
                            <p className="text-[10px] text-emerald-300 font-bold uppercase mb-1 group-hover:text-emerald-200 transition-colors">Broadcast</p>
                            <p className="text-sm font-bold text-emerald-100">Increase broadcast on REQ-881</p>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* Financial Health */}
        <div className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800 text-white lg:col-span-1">
           <h3 className="font-bold text-slate-100 uppercase tracking-widest text-xs mb-6 border-b border-slate-800 pb-2 flex justify-between">
              Financial Health
              <DollarSign size={16} className="text-emerald-400" />
           </h3>
           <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">New Revenue</span>
                 <span className="text-2xl font-black text-emerald-400">{formatCurrency(metrics.revenue)}</span>
                 <span className="text-xs text-slate-500 mt-2 flex items-center gap-1"><TrendingUp size={12} className="text-emerald-500"/> +0% today</span>
              </div>
              <div className="flex flex-col">
                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">AI Agent Cost</span>
                 <span className="text-2xl font-black text-slate-200">{formatCurrency(metrics.aiCost)}</span>
                 <span className="text-xs text-slate-500 mt-2 flex items-center gap-1">{metrics.tokenUsage.toLocaleString()} tokens</span>
              </div>
           </div>
        </div>

        {/* Production Readiness Certification */}
        <div className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800 text-white lg:col-span-1">
           <h3 className="font-bold text-slate-100 uppercase tracking-widest text-xs mb-6 border-b border-slate-800 pb-2 flex justify-between">
              Production Readiness
              <ShieldCheck size={16} className="text-emerald-400" />
           </h3>
           <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/50">
                  <span className="text-xs text-slate-400">Overall Health</span>
                  <span className="text-lg font-black text-emerald-400">97%</span>
              </div>
              <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-300 uppercase">
                      <span>Security</span><span className="text-emerald-400">100%</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-300 uppercase">
                      <span>Infrastructure</span><span className="text-emerald-400">98%</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-300 uppercase">
                      <span>AI Runtime</span><span className="text-emerald-400">96%</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-300 uppercase">
                      <span>Background Workers</span><span className="text-emerald-400">100%</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-300 uppercase">
                      <span>Google Workspace</span><span className="text-emerald-400">100%</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-300 uppercase">
                      <span>Queues</span><span className="text-emerald-400">100%</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-300 uppercase">
                      <span>Workflow Success</span><span className="text-emerald-400">95%</span>
                  </div>
              </div>
              <div className="mt-2 bg-emerald-900/30 border border-emerald-800/50 rounded-lg p-3 flex justify-between items-center">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Production Ready</span>
                  <span className="text-sm font-black text-emerald-300">YES</span>
              </div>
           </div>
        </div>

        {/* Agent Runtime Infrastructure */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2">
           <h3 className="font-bold text-slate-800 uppercase tracking-widest text-xs mb-6 border-b border-slate-100 pb-2 flex justify-between">
              Agent Runtime Infrastructure
              <Bot size={16} className="text-indigo-600" />
           </h3>
           <div className="grid grid-cols-5 gap-4">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex flex-col items-center">
                 <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">Running</p>
                 <p className="text-xl font-black text-emerald-700 mt-1">{metrics.runningAgents}</p>
              </div>
              <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 flex flex-col items-center">
                 <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">Queued</p>
                 <p className="text-xl font-black text-indigo-700 mt-1">{metrics.queuedJobs}</p>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 flex flex-col items-center">
                 <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">Failed</p>
                 <p className="text-xl font-black text-rose-700 mt-1">{metrics.failedJobs}</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex flex-col items-center">
                 <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">Retries</p>
                 <p className="text-xl font-black text-amber-700 mt-1">{metrics.retryJobs}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col items-center">
                 <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">Avg Latency</p>
                 <p className="text-xl font-black text-slate-700 mt-1">{metrics.avgRuntime}ms</p>
              </div>
           </div>
        </div>

        {/* AI Efficiency & Cost Savings HUD */}
        <div className="bg-indigo-900 p-6 rounded-2xl shadow-lg border border-indigo-800 text-white lg:col-span-4">
            <div className="flex items-center justify-between mb-8 border-b border-indigo-800 pb-4">
               <div>
                  <h3 className="font-bold text-indigo-100 uppercase tracking-widest text-xs flex items-center gap-2">
                     <Zap size={16} className="text-amber-400" />
                     Production Intelligence & Cost Efficiency
                  </h3>
                  <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-1">Proprietary Match Engine vs LLM Fallback Tracking</p>
               </div>
               <div className="flex items-center gap-4">
                  <div className="text-right">
                     <p className="text-[9px] font-bold text-indigo-400 uppercase">Estimated Savings</p>
                     <p className="text-xl font-black text-emerald-400">{formatCurrency(efficiency.aiCostSaved)}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full border-2 border-indigo-700 flex items-center justify-center bg-indigo-800/50 shadow-inner">
                     <TrendingDown size={20} className="text-emerald-400" />
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-6">
                {[
                  { label: "Today's Requests", val: efficiency.totalRequests, sub: "Total AI Calls", icon: <Cpu size={18} />, color: "text-slate-200" },
                  { label: "Gemini Cost", val: `₹${efficiency.geminiCost}`, sub: "Actual Billed", icon: <DollarSign size={18} />, color: "text-rose-400" },
                  { label: "Saved by Headroom", val: efficiency.headroomSaved, sub: "Token Compression", icon: <Zap size={18} />, color: "text-emerald-400" },
                  { label: "Deterministic Saved", val: efficiency.deterministicSaved, sub: "Rule Engine Hits", icon: <ShieldCheck size={18} />, color: "text-emerald-400" },
                  { label: "Cache Hits", val: efficiency.cacheHits, sub: "Duplicate Queries", icon: <Cloud size={18} />, color: "text-amber-400" },
                  { label: "Avg Response", val: efficiency.avgResponseTime, sub: "AI Latency", icon: <Clock size={18} />, color: "text-indigo-300" },
                  { label: "Workforce Velocity", val: `${efficiency.workforceVelocity}%`, sub: "SLA Adherence", icon: <Activity size={18} />, color: "text-indigo-300" },
                  { label: "LLM Refinements", val: efficiency.llmRefinements, sub: "Explanation Only", icon: <BrainCircuit size={18} />, color: "text-amber-400" }
                ].map((item, idx) => (
                  <div key={idx} className="flex flex-col">
                     <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                        {item.icon} {item.label}
                     </span>
                     <span className={cn("text-xl font-black", item.color)}>{item.val}</span>
                     <span className="text-[10px] text-indigo-500 font-bold uppercase mt-1">{item.sub}</span>
                  </div>
                ))}
            </div>

            <div className="mt-8 pt-6 border-t border-indigo-800 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                   <h4 className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mb-4">Autonomous Learning Loop</h4>
                   <div className="space-y-3">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                         <span className="text-indigo-400">Match Accuracy Improvement</span>
                         <span className="text-emerald-400">+12.4%</span>
                      </div>
                      <div className="w-full h-1.5 bg-indigo-950 rounded-full overflow-hidden">
                         <div className="h-full bg-emerald-500 w-[82%]" />
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-bold">
                         <span className="text-indigo-400">Vendor Trust Score (Weighted)</span>
                         <span className="text-indigo-300">88/100</span>
                      </div>
                      <div className="w-full h-1.5 bg-indigo-950 rounded-full overflow-hidden">
                         <div className="h-full bg-indigo-500 w-[88%]" />
                      </div>
                   </div>
                </div>
                <div className="bg-indigo-950/50 p-4 rounded-xl border border-indigo-800/50 flex flex-col justify-center">
                   <p className="text-[10px] text-indigo-300 leading-relaxed font-medium">
                      <span className="text-emerald-400 font-black">PRO TIP:</span> HireNestOS proprietary engine is currently handling <span className="text-white font-bold">78%</span> of all initial candidate screenings. LLM usage is strictly reserved for high-fidelity explanation and semantic edge-case resolution, significantly reducing operational token overhead.
                   </p>
                   <button className="mt-4 text-[9px] font-black uppercase text-indigo-400 hover:text-white transition-colors flex items-center gap-1.5">
                      View Model Dependency Report <Activity size={10} />
                   </button>
                </div>
            </div>
        </div>

        {/* Daily Pipeline (Full Width) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-4">
           <h3 className="font-bold text-slate-800 uppercase tracking-widest text-xs mb-6 border-b border-slate-100 pb-2 flex justify-between">
              Daily Operating Pipeline
              <Activity size={16} className="text-slate-600" />
           </h3>
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="flex flex-col p-4 bg-slate-50 border border-slate-100 rounded-xl items-center text-center">
                 <Briefcase size={20} className="text-slate-400 mb-2" />
                 <span className="text-2xl font-black text-slate-800">{formatCompact(metrics.requirementsReceived)}</span>
                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">Reqs Received</span>
              </div>
              <div className="flex flex-col p-4 bg-slate-50 border border-slate-100 rounded-xl items-center text-center">
                 <UserSquare2 size={20} className="text-slate-400 mb-2" />
                 <span className="text-2xl font-black text-slate-800">{formatCompact(metrics.candidatesProcessed)}</span>
                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">Candidates Processed</span>
              </div>
              <div className="flex flex-col p-4 bg-indigo-50 border border-indigo-100 rounded-xl items-center text-center">
                 <Cpu size={20} className="text-indigo-400 mb-2" />
                 <span className="text-2xl font-black text-indigo-700">{formatCompact(metrics.submissionsSent)}</span>
                 <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mt-1">Submissions Sent</span>
              </div>
              <div className="flex flex-col p-4 bg-amber-50 border border-amber-100 rounded-xl items-center text-center">
                 <Users size={20} className="text-amber-500 mb-2" />
                 <span className="text-2xl font-black text-amber-700">{formatCompact(metrics.interviewsScheduled)}</span>
                 <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mt-1">Interviews Scheduled</span>
              </div>
              <div className="flex flex-col p-4 bg-emerald-50 border border-emerald-100 rounded-xl items-center text-center">
                 <CheckCircle2 size={20} className="text-emerald-500 mb-2" />
                 <span className="text-2xl font-black text-emerald-700">{formatCompact(metrics.offersReleased)}</span>
                 <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mt-1">Offers Released</span>
              </div>
              <div className="flex flex-col p-4 bg-slate-50 border border-slate-100 rounded-xl items-center text-center">
                 <Mail size={20} className="text-slate-400 mb-2" />
                 <span className="text-2xl font-black text-slate-800">{formatCompact(metrics.emailsProcessed)}</span>
                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">Emails Processed</span>
              </div>
           </div>
        </div>
      </div>
      
      {/* Executive Recommendations */}
      <div className="bg-slate-50 p-6 rounded-2xl shadow-sm border border-slate-200">
         <h3 className="font-bold text-slate-800 uppercase tracking-widest text-xs mb-4 flex justify-between">
            Executive Actions & Recommendations
         </h3>
         <div className="space-y-3">
             <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                     <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><TrendingUp size={16} /></div>
                     <div>
                         <p className="text-sm font-bold text-slate-800">Margin Optimization Opportunity</p>
                         <p className="text-xs text-slate-500">2 Vendor submissions for "Senior Java Developer" have lower bill rates than our target margin. Consider prioritizing these.</p>
                     </div>
                 </div>
                 <button className="text-xs font-bold bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg transition-colors">Review Candidates</button>
             </div>
             <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                     <div className="bg-rose-100 p-2 rounded-lg text-rose-600"><AlertTriangle size={16} /></div>
                     <div>
                         <p className="text-sm font-bold text-slate-800">Client Feedback Pending</p>
                         <p className="text-xs text-slate-500">"Acme Corp" has not responded to 4 candidate submissions in over 48 hours. Follow-up agent is awaiting approval.</p>
                     </div>
                 </div>
                 <button className="text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors">Approve Follow-up</button>
             </div>
         </div>
      </div>
    </div>
  );
}
