// src/views/AIOpsCenter/ExecutiveHome.tsx
import React, { useState, useMemo, useEffect } from "react";
import { speakBriefing, stopBriefingSpeech } from "../../lib/services/speechService";
import { 
  Briefcase, 
  Users, 
  Globe, 
  Bot, 
  Calendar, 
  CheckCircle, 
  TrendingUp, 
  ShieldAlert, 
  Heart, 
  Sparkles, 
  PlayCircle, 
  PauseCircle, 
  Send,
  Volume2,
  VolumeX,
  FileText
} from "lucide-react";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface ExecutiveHomeProps {
  agentsCount: number;
  requirementsCount: number;
  onGenerateReport: (type: string) => void;
  reportResult: string | null;
  isGeneratingReport: boolean;
}

export default function ExecutiveHome({ 
  agentsCount, 
  requirementsCount,
  onGenerateReport,
  reportResult,
  isGeneratingReport
}: ExecutiveHomeProps) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [briefRead, setBriefRead] = useState(false);

  // Digital system health index
  const systemHealth = 98.4;

  const kpiData = useMemo(() => [
    { id: "reqs", title: "Active Requirements", value: requirementsCount || 14, trend: "+2 this week", trendColor: "text-emerald-400", icon: Briefcase, color: "text-indigo-400" },
    { id: "recs", title: "Active Recruiters", value: 5, trend: "All active", trendColor: "text-emerald-400", icon: Users, color: "text-indigo-400" },
    { id: "bdms", title: "Active BDMs", value: 3, trend: "3 pipelines", trendColor: "text-indigo-400", icon: Globe, color: "text-indigo-400" },
    { id: "vendors", title: "Active Vendors", value: 12, trend: "98.2% avg trust", trendColor: "text-emerald-400", icon: Users, color: "text-emerald-400" },
    { id: "agents", title: "Active AI Agents", value: agentsCount || 7, trend: "100% operational", trendColor: "text-emerald-400", icon: Bot, color: "text-indigo-400" },
    { id: "interviews", title: "Interviews Today", value: 4, trend: "3 completed", trendColor: "text-emerald-400", icon: Calendar, color: "text-amber-400" },
    { id: "placements", title: "Placements Week", value: 8, trend: "Avg cycle: 12d", trendColor: "text-indigo-400", icon: CheckCircle, color: "text-emerald-400" },
    { id: "revenue", title: "Revenue Pipeline", value: "$425,000", trend: "+15% vs target", trendColor: "text-emerald-400", icon: TrendingUp, color: "text-emerald-400" },
    { id: "slas", title: "SLA Alerts", value: 3, trend: "1 breached, 2 warn", trendColor: "text-rose-400", icon: ShieldAlert, color: "text-rose-400" }
  ], [agentsCount, requirementsCount]);

  const digitalTwinSystems = useMemo(() => [
    { name: "CRM Connectivity", uptime: "99.98%", latency: "42ms", status: "NOMINAL" },
    { name: "OS Workspace", uptime: "99.99%", latency: "21ms", status: "NOMINAL" },
    { name: "Firestore SSOT", uptime: "100.00%", latency: "12ms", status: "NOMINAL" },
    { name: "Event Bus Broker", uptime: "99.99%", latency: "4ms", status: "NOMINAL" },
    { name: "AI Gateway Proxy", uptime: "99.95%", latency: "180ms", status: "NOMINAL" },
    { name: "Gemini Model API", uptime: "99.91%", latency: "420ms", status: "NOMINAL" },
    { name: "Email Gateway", uptime: "99.70%", latency: "152ms", status: "NOMINAL" },
    { name: "Google Calendar Sync", uptime: "99.90%", latency: "130ms", status: "NOMINAL" },
    { name: "WhatsApp Hub API", uptime: "99.80%", latency: "95ms", status: "NOMINAL" }
  ], []);

  const simulatedBrief = useMemo(() => {
    return `HIRENEST OS MORNING EXECUTIVE BRIEFING
Date: ${new Date().toLocaleDateString()} | Authority Scope: CEO & Chief of Staff

SYSTEM TEMPERATURE: NOMINAL (Overall Health Score: 98.4%)
------------------------------------------------------------
• 14 active requirements are driving strategic recruitment loops.
• 7 specialized digital agents are fully aligned with BDM managers, completing 124 cognitive traces with a 98.7% success rate.
• Sourcing velocity is accelerated: average submittal latency has dropped from 48 hours to 15 seconds.
• Sourcing algorithms saved approximately 12.4 recruiter-hours over the last 24 hours.

CRITICAL DISCREPANCIES (Needs Attention):
------------------------------------------------------------
1. WARN: Initech Corp (Staff Go/Kubernetes Developer) response latency exceeded 20 hours. 
   Cleo (CS AI) has successfully escalated this to Bruce Wayne (Talent Director).
2. BREACH: GlobalFinance Corp (VP of Engineering) submittal rate limits breached. 
   SLA breach triggers escalated to manual recruiter override. Action required.

REVENUE PIPELINE FORECAST:
------------------------------------------------------------
Current Weekly Revenue Target: $150,000. Pipeline influence stands at $425,000, tracking 15% above forecast with 8 active placements nearing final sign-off.`;
  }, []);

  useEffect(() => {
    return () => {
      stopBriefingSpeech();
    };
  }, []);

  const handleAudioPlayback = () => {
    if (isPlayingAudio) {
      stopBriefingSpeech();
      setIsPlayingAudio(false);
      return;
    }

    setIsPlayingAudio(true);
    setBriefRead(true);

    speakBriefing(
      simulatedBrief,
      () => setIsPlayingAudio(false),
      () => setIsPlayingAudio(false)
    );
  };

  return (
    <div className="space-y-8 flex-1 flex flex-col">
      {/* Overview Intro */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-900/80 pb-4 gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Executive Command Dashboard</h2>
          <p className="text-xs text-slate-400">At-a-glance operational health, pipeline intelligence, and strategic SLA metrics.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-full font-bold">
            Ecosystem Core Live
          </span>
        </div>
      </div>

      {/* Grid of Bento KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiData.map((kpi) => {
          const IconComponent = kpi.icon;
          return (
            <div 
              key={kpi.id} 
              className="p-5 rounded-2xl bg-[#070A13] border border-slate-900/80 hover:border-slate-800 transition-all flex items-center justify-between group relative overflow-hidden"
            >
              <div className="space-y-1.5 relative z-10">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">{kpi.title}</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white tracking-tight">{kpi.value}</span>
                </div>
                <span className={cn("text-[10px] font-semibold block mt-0.5", kpi.trendColor)}>
                  {kpi.trend}
                </span>
              </div>
              <div className={cn("p-3 rounded-xl bg-slate-950/80 border border-slate-900", kpi.color)}>
                <IconComponent size={20} />
              </div>
              <div className="absolute top-0 right-0 w-16 h-16 bg-white/1 rounded-full blur-xl pointer-events-none group-hover:bg-white/2 transition-colors"></div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
        {/* Morning Briefing Card (Left 3 cols) */}
        <div className="xl:col-span-3 flex flex-col gap-4">
          <div className="bg-[#070A13] border border-slate-900 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between h-full group">
            {/* Ambient glows */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-indigo-500/10 transition-all duration-500"></div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-900/60 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-indigo-400" />
                  <h3 className="text-sm font-black text-white uppercase tracking-tight">The AI COO's Morning Briefing</h3>
                </div>
                <span className="text-[9px] font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                  Autonomous Intelligence
                </span>
              </div>

              {/* Text Output Block */}
              <div className="relative">
                <pre className="font-mono text-[10px] leading-relaxed bg-slate-950/80 border border-slate-900 rounded-xl p-4 text-slate-300 max-h-[280px] overflow-y-auto whitespace-pre-wrap select-text">
                  {simulatedBrief}
                </pre>
              </div>
            </div>

            {/* Simulated Audio play controls and distribution */}
            <div className="mt-5 pt-4 border-t border-slate-900/60 flex flex-wrap gap-3 items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAudioPlayback}
                  className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow"
                >
                  {isPlayingAudio ? (
                    <>
                      <PauseCircle size={14} />
                      Pause Audible Brief
                    </>
                  ) : (
                    <>
                      <PlayCircle size={14} />
                      Listen to Briefing
                    </>
                  )}
                </button>

                {/* Animated Audio visualizer bars when playing */}
                <AnimatePresence>
                  {isPlayingAudio && (
                    <motion.div 
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="flex items-end gap-0.5 h-4 px-2"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((bar) => (
                        <motion.div
                          key={bar}
                          animate={{ height: [4, 16, 4] }}
                          transition={{ 
                            duration: 0.6 + (bar * 0.1), 
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                          className="w-0.5 bg-indigo-400 rounded-full"
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => onGenerateReport("daily")}
                  className="px-3 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-900 text-[10px] font-bold text-slate-400 hover:text-white rounded-xl uppercase tracking-wider transition-all"
                >
                  Regenerate Brief
                </button>
                <button 
                  onClick={() => alert("Daily Briefing dispatched successfully to Stakeholder Slack & Emails!")}
                  className="px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/20 hover:border-emerald-500 text-[10px] font-bold text-emerald-400 hover:text-white rounded-xl uppercase tracking-wider transition-all flex items-center gap-1"
                >
                  <Send size={11} />
                  Approve & Dispatch
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Digital Twin Status (Right 2 cols) */}
        <div className="xl:col-span-2 flex flex-col gap-4">
          <div className="bg-[#070A13] border border-slate-900 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between h-full group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors"></div>

            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-900/60 pb-3">
                <div className="flex items-center gap-2">
                  <Heart size={14} className="text-emerald-400 animate-pulse" />
                  <h3 className="text-sm font-black text-white uppercase tracking-tight">Platform Digital Twin Status</h3>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                  Health Index: {systemHealth}%
                </div>
              </div>

              {/* Digital systems statuses */}
              <div className="grid grid-cols-1 gap-2.5 max-h-[280px] overflow-y-auto pr-1">
                {digitalTwinSystems.map((sys) => (
                  <div key={sys.name} className="p-2.5 rounded-xl bg-slate-950 border border-slate-900/80 flex items-center justify-between text-[11px] hover:border-slate-800 transition-colors">
                    <div>
                      <span className="font-bold text-white block leading-tight">{sys.name}</span>
                      <span className="text-[9px] text-slate-500">Latency: {sys.latency} • Uptime: {sys.uptime}</span>
                    </div>
                    <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md">
                      {sys.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-900/60 text-[10px] text-slate-500 text-center italic">
              All infrastructure channels linked, audited and synced with Firestore SSOT.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
