import { useState, useEffect } from "react";
import { getDynamicGreeting } from "../../lib/greetings";
import { 
  TrendingUp, 
  DollarSign, 
  Target, 
  Users, 
  Briefcase, 
  Activity, 
  AlertTriangle,
  CheckCircle2,
  Zap,
  BarChart2,
  Clock,
  ShieldAlert,
  ArrowRight,
  Bot
} from "lucide-react";
import { Badge } from "../../lib/Badge";
import { Button } from "../../lib/Button";
import { useDailyBriefing } from "../../hooks/useDailyBriefing";

interface MetricsData {
  revenue: {
    expected: number;
    confirmed: number;
  };
  pipeline: {
    activeRequirements: number;
    totalRequirements: number;
    totalCandidates: number;
    submissions: number;
    interviews: number;
    placements: number;
  };
  aiRoi: {
    aiScreenings: number;
    aiMatches: number;
    estimatedHoursSaved: number;
    automationSuccess: number;
  };
  risks: {
    failedAutomations: number;
    communicationBlocks: number;
    activeKillSwitches: number;
  };
}

export default function ExecutiveDashboardWorkspace({
  userName,
  orgId
}: {
  userName: string;
  orgId?: string;
}) {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { briefing, loading: briefingLoading } = useDailyBriefing(orgId);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const idToken = await (window as any).firebase?.auth().currentUser?.getIdToken();
        const res = await fetch("/api/executive-metrics/dashboard", {
          headers: {
            ...(idToken ? { "Authorization": `Bearer ${idToken}` } : {})
          }
        });
        
        let json: any = null;
        try {
          json = await res.json();
        } catch (e) {
          throw new Error(`Invalid server response (${res.status})`);
        }
        
        if (!res.ok) throw new Error(json?.error || `Failed to load executive intelligence (${res.status})`);
        
        if (json && json.success && json.data) {
          setMetrics(json.data);
        } else {
          throw new Error(json?.error || "Invalid response format from metrics API");
        }
      } catch (err: any) {
        console.error("Dashboard fetch error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    // Refresh every 5 minutes to act as a near real-time read layer
    const interval = setInterval(fetchMetrics, 300000);
    return () => clearInterval(interval);
  }, [orgId]);

  if (loading && !metrics) {
    return (
      <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center h-full text-slate-400 font-mono text-sm">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-4"></div>
        Synthesizing Executive Intelligence...
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center h-full text-rose-400 font-mono text-sm">
        <AlertTriangle className="mb-4 h-8 w-8" />
        {error}
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="flex-1 bg-slate-950 flex flex-col h-full overflow-y-auto text-slate-100 font-sans pb-16">
      {/* Executive Header */}
      <div className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50 p-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono text-[10px] tracking-wider uppercase">
                Executive Command Center
              </Badge>
              {orgId && (
                <span className="text-slate-500 font-mono text-[10px] uppercase tracking-wider">
                  ORG: {orgId}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">
              {getDynamicGreeting(userName)}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Live intelligence aggregated from authoritative SSOT records.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              REAL-TIME SYNC
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* AI Executive Briefing */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
             <div className="flex items-center gap-3 mb-4">
                <div className="bg-indigo-500/10 p-2 rounded-lg border border-indigo-500/20">
                   <Bot size={20} className="text-indigo-400" />
                </div>
                <div>
                   <h3 className="text-white font-semibold flex items-center gap-2">AI COO Morning Briefing</h3>
                   <p className="text-slate-400 text-xs font-mono">Generated from {metrics.pipeline.totalCandidates} unified records</p>
                </div>
             </div>
             <div className="relative z-10 text-sm text-slate-300">
                {briefingLoading ? (
                   <div className="animate-pulse space-y-2">
                      <div className="h-4 bg-slate-800 rounded w-full"></div>
                      <div className="h-4 bg-slate-800 rounded w-2/3"></div>
                   </div>
                ) : briefing ? (
                   <>
                      <p className="leading-relaxed mb-4 text-[13px]">{briefing.briefing}</p>
                      {briefing.actionItems && briefing.actionItems.length > 0 && (
                         <div className="bg-slate-950/50 rounded-lg p-4 border border-slate-800/80">
                            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-3">Priority Action Items</span>
                            <div className="space-y-2">
                               {briefing.actionItems.map((item: any) => (
                                  <div key={item.id} className="flex items-start gap-2 text-xs">
                                     <ArrowRight size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                                     <span className="text-slate-300">{item.title}</span>
                                  </div>
                               ))}
                            </div>
                         </div>
                      )}
                   </>
                ) : (
                   <p className="leading-relaxed text-[13px]">
                      The AI COO is analyzing system-wide logs to generate your morning briefing. Operations are running normally.
                   </p>
                )}
             </div>
          </div>
          
          {/* KPI Strip - Revenue & High Level */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-emerald-500/10 transition-colors"></div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-400 font-mono text-[10px] uppercase tracking-widest flex items-center gap-2">
                  <DollarSign size={14} className="text-emerald-400" /> Confirmed Revenue
                </h3>
              </div>
              <div className="text-3xl font-light text-white tracking-tight">
                ${metrics.revenue.confirmed.toLocaleString()}
              </div>
              <div className="mt-2 text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                <TrendingUp size={12} /> YTD PLACEMENTS
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-indigo-500/10 transition-colors"></div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-400 font-mono text-[10px] uppercase tracking-widest flex items-center gap-2">
                  <Briefcase size={14} className="text-indigo-400" /> Active Requirements
                </h3>
              </div>
              <div className="text-3xl font-light text-white tracking-tight">
                {metrics.pipeline.activeRequirements}
              </div>
              <div className="mt-2 text-[10px] font-mono text-slate-500 flex items-center gap-1">
                OF {metrics.pipeline.totalRequirements} TOTAL
              </div>
            </div>
            
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-colors"></div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-400 font-mono text-[10px] uppercase tracking-widest flex items-center gap-2">
                  <Users size={14} className="text-blue-400" /> Talent Pool
                </h3>
              </div>
              <div className="text-3xl font-light text-white tracking-tight">
                {metrics.pipeline.totalCandidates.toLocaleString()}
              </div>
              <div className="mt-2 text-[10px] font-mono text-slate-500 flex items-center gap-1">
                CANDIDATES SOURCED
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-amber-500/10 transition-colors"></div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-400 font-mono text-[10px] uppercase tracking-widest flex items-center gap-2">
                  <Target size={14} className="text-amber-400" /> Expected Pipeline
                </h3>
              </div>
              <div className="text-3xl font-light text-white tracking-tight">
                ${metrics.revenue.expected.toLocaleString()}
              </div>
              <div className="mt-2 text-[10px] font-mono text-amber-400/80 flex items-center gap-1">
                BASED ON ACTIVE REQS
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Funnel & Delivery Intelligence */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                <div className="p-5 border-b border-slate-800/50 flex justify-between items-center bg-slate-900/80">
                  <h3 className="font-medium text-slate-200 flex items-center gap-2">
                    <BarChart2 size={16} className="text-indigo-400" />
                    Recruitment Funnel Velocity
                  </h3>
                </div>
                <div className="p-6">
                  <div className="flex flex-col space-y-4">
                    <div className="relative">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-400">Total Sourced (Pool)</span>
                        <span className="text-sm font-medium text-slate-200">{metrics.pipeline.totalCandidates}</span>
                      </div>
                      <div className="w-full bg-slate-800/50 rounded-full h-2">
                        <div className="bg-slate-500 h-2 rounded-full" style={{ width: '100%' }}></div>
                      </div>
                    </div>
                    <div className="relative pl-4 border-l border-slate-800/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-400">Submissions</span>
                        <span className="text-sm font-medium text-slate-200">{metrics.pipeline.submissions}</span>
                      </div>
                      <div className="w-full bg-slate-800/50 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(100, (metrics.pipeline.submissions / (metrics.pipeline.totalCandidates || 1)) * 100)}%` }}></div>
                      </div>
                    </div>
                    <div className="relative pl-8 border-l border-slate-800/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-400">Interviews</span>
                        <span className="text-sm font-medium text-slate-200">{metrics.pipeline.interviews}</span>
                      </div>
                      <div className="w-full bg-slate-800/50 rounded-full h-2">
                        <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${Math.min(100, (metrics.pipeline.interviews / (metrics.pipeline.submissions || 1)) * 100)}%` }}></div>
                      </div>
                    </div>
                    <div className="relative pl-12 border-l border-slate-800/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-emerald-400">Placements</span>
                        <span className="text-sm font-medium text-emerald-400">{metrics.pipeline.placements}</span>
                      </div>
                      <div className="w-full bg-slate-800/50 rounded-full h-2">
                        <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${Math.min(100, (metrics.pipeline.placements / (metrics.pipeline.interviews || 1)) * 100)}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI & Automation ROI */}
              <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-xl overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
                <div className="p-5 border-b border-indigo-500/20 flex justify-between items-center bg-indigo-950/40">
                  <h3 className="font-medium text-indigo-300 flex items-center gap-2">
                    <Zap size={16} className="text-indigo-400" />
                    AI & Automation ROI
                  </h3>
                  <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">Phase 6 Active</Badge>
                </div>
                <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-6">
                  <div>
                    <div className="text-3xl font-light text-white mb-1">{metrics.aiRoi.estimatedHoursSaved}h</div>
                    <div className="text-[10px] font-mono text-indigo-400/80 uppercase">Recruiter Hours Saved</div>
                  </div>
                  <div>
                    <div className="text-3xl font-light text-white mb-1">{metrics.aiRoi.aiScreenings}</div>
                    <div className="text-[10px] font-mono text-indigo-400/80 uppercase">AI Screenings</div>
                  </div>
                  <div>
                    <div className="text-3xl font-light text-white mb-1">{metrics.aiRoi.aiMatches}</div>
                    <div className="text-[10px] font-mono text-indigo-400/80 uppercase">AI Matches</div>
                  </div>
                  <div>
                    <div className="text-3xl font-light text-white mb-1">{metrics.aiRoi.automationSuccess}</div>
                    <div className="text-[10px] font-mono text-emerald-400/80 uppercase">Successful Automations</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Risk Command Center */}
            <div className="space-y-6">
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden flex flex-col h-full">
                <div className="p-5 border-b border-slate-800/50 bg-slate-900/80">
                  <h3 className="font-medium text-slate-200 flex items-center gap-2">
                    <ShieldAlert size={16} className="text-rose-400" />
                    Risk Command Center
                  </h3>
                </div>
                <div className="p-6 flex-1 flex flex-col gap-6">
                  <div className="p-4 rounded-lg border bg-rose-500/5 border-rose-500/20">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-rose-400 font-mono text-[10px] tracking-widest uppercase mb-1">Failed Automations</h4>
                        <div className="text-2xl font-light text-white">{metrics.risks.failedAutomations}</div>
                      </div>
                      <div className="p-2 bg-rose-500/10 rounded-md text-rose-400">
                        <Activity size={18} />
                      </div>
                    </div>
                    {metrics.risks.failedAutomations > 0 && (
                      <div className="mt-3 text-xs text-rose-400/80">Requires investigation in Orchestration logs.</div>
                    )}
                  </div>
                  
                  <div className="p-4 rounded-lg border bg-amber-500/5 border-amber-500/20">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-amber-400 font-mono text-[10px] tracking-widest uppercase mb-1">Communication Guard Blocks</h4>
                        <div className="text-2xl font-light text-white">{metrics.risks.communicationBlocks}</div>
                      </div>
                      <div className="p-2 bg-amber-500/10 rounded-md text-amber-400">
                        <AlertTriangle size={18} />
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-amber-400/80">Messages blocked by consent/rate-limit policies.</div>
                  </div>

                  <div className="p-4 rounded-lg border bg-emerald-500/5 border-emerald-500/20">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-emerald-400 font-mono text-[10px] tracking-widest uppercase mb-1">Kill Switches Active</h4>
                        <div className="text-2xl font-light text-white">{metrics.risks.activeKillSwitches}</div>
                      </div>
                      <div className="p-2 bg-emerald-500/10 rounded-md text-emerald-400">
                        <CheckCircle2 size={18} />
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-emerald-400/80">System operating safely.</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
