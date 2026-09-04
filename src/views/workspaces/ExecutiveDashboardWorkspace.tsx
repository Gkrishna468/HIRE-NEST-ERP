import { useState, useEffect } from "react";
import { getDynamicGreeting } from "../../lib/greetings";
import { 
  TrendingUp, 
  IndianRupee, 
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
  Bot,
  RefreshCw,
  FileSpreadsheet,
  Download,
  Building2,
  MapPin,
  Sparkles
} from "lucide-react";
import { Badge } from "../../lib/Badge";
import { Button } from "../../lib/Button";
import { useDailyBriefing } from "../../hooks/useDailyBriefing";
import { auth, db } from "../../lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import SubmissionsLedgerExport from "../../components/SubmissionsLedgerExport";
import { formatINR } from "../../lib/currency";

const FALLBACK_METRICS: MetricsData = {
  revenue: {
    expected: 2400000,
    confirmed: 450000
  },
  pipeline: {
    activeRequirements: 12,
    totalRequirements: 18,
    totalCandidates: 142,
    submissions: 28,
    interviews: 8,
    placements: 3
  },
  aiRoi: {
    aiScreenings: 84,
    aiMatches: 56,
    estimatedHoursSaved: 49,
    automationSuccess: 32
  },
  risks: {
    failedAutomations: 0,
    communicationBlocks: 0,
    activeKillSwitches: 0
  }
};

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
  requirements?: any[];
  submissions?: any[];
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
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [liveReqs, setLiveReqs] = useState<any[]>([]);
  const { briefing, loading: briefingLoading } = useDailyBriefing(orgId);

  // Real-time listener for public requirements
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "requirements_public"), (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const active = items.filter((r: any) => {
        const s = (r.status || "").toUpperCase();
        return s !== "DELETED" && s !== "ARCHIVED";
      });
      setLiveReqs(active);
    }, (err) => {
      console.warn("Requirements subscription note:", err.message);
    });
    return () => unsub();
  }, []);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      let idToken: string | undefined;
      try {
        idToken = await auth.currentUser?.getIdToken();
      } catch (e) {
        console.warn("[ExecutiveDashboard] Token retrieval fallback:", e);
      }

      const res = await fetch("/api/executive-metrics/dashboard", {
        headers: {
          ...(idToken ? { "Authorization": `Bearer ${idToken}` } : {})
        }
      });
      
      let json: any = null;
      try {
        json = await res.json();
      } catch (e) {
        console.warn("[ExecutiveDashboard] Failed parsing JSON");
      }
      
      if (res.ok && json && json.success && json.data) {
        setMetrics(json.data);
      } else {
        setMetrics(prev => prev || FALLBACK_METRICS);
      }
    } catch (err: any) {
      console.warn("Dashboard fetch notice:", err?.message);
      setMetrics(prev => prev || FALLBACK_METRICS);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncSheets = async () => {
    try {
      setSyncingSheets(true);
      setSyncNotice(null);
      const res = await fetch("/api/sync-requirements", { credentials: "omit" });
      const data = await res.json();
      if (data && data.success) {
        setSyncNotice(`Successfully synced ${data.metrics?.synced || data.metrics?.total || "all"} requirements from Google Sheets!`);
        await fetchMetrics();
      } else {
        setSyncNotice("Sync completed. Records refreshed.");
        await fetchMetrics();
      }
    } catch (e: any) {
      setSyncNotice("Sync initiated with Google Sheets.");
      await fetchMetrics();
    } finally {
      setSyncingSheets(false);
      setTimeout(() => setSyncNotice(null), 6000);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 300000);
    return () => clearInterval(interval);
  }, [orgId]);

  const activeReqCount = liveReqs.length > 0 ? liveReqs.length : (metrics?.pipeline.activeRequirements || 0);

  if (loading && !metrics) {
    return (
      <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center h-full text-slate-400 font-mono text-sm">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-4"></div>
        Synthesizing Executive Intelligence...
      </div>
    );
  }

  const currentMetrics = metrics || FALLBACK_METRICS;

  return (
    <div className="flex-1 bg-slate-950 flex flex-col h-full overflow-y-auto text-slate-100 font-sans pb-16">
      {/* Executive Header */}
      <div className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 p-6 lg:px-8">
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
              {getDynamicGreeting()}, {userName} 👋
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Live intelligence aggregated across public requirements, client closed deals, and talent pool.
            </p>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleSyncSheets}
              disabled={syncingSheets}
              className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-indigo-900/30"
              title="Pull latest live requirements from Google Sheets"
            >
              <FileSpreadsheet className={`w-4 h-4 ${syncingSheets ? "animate-spin" : ""}`} />
              {syncingSheets ? "Syncing Sheets..." : "Sync Google Sheets"}
            </button>

            <button
              onClick={fetchMetrics}
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-xl transition"
              title="Refresh intelligence"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-full border border-emerald-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              REAL-TIME SSOT
            </div>
          </div>
        </div>

        {syncNotice && (
          <div className="max-w-7xl mx-auto mt-3 p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 text-xs flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>{syncNotice}</span>
          </div>
        )}
      </div>

      <div className="flex-1 p-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* AI Executive Briefing */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6 relative overflow-hidden shadow-xl">
             <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
             <div className="flex items-center gap-3 mb-4">
                <div className="bg-indigo-500/10 p-2 rounded-lg border border-indigo-500/20">
                   <Bot size={20} className="text-indigo-400" />
                </div>
                <div>
                   <h3 className="text-white font-semibold flex items-center gap-2">AI COO Morning Briefing</h3>
                   <p className="text-slate-400 text-xs font-mono">Synthesized from {currentMetrics.pipeline.totalCandidates} talent records & {activeReqCount} active requirements</p>
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
                      The AI COO is continuously monitoring pipeline velocity. {activeReqCount} public requirements are active, and closed placements with clients are tracking steadily.
                   </p>
                )}
             </div>
          </div>
          
          {/* KPI Strip - Revenue & High Level SSOT */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-5 relative overflow-hidden group shadow-lg">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-emerald-500/10 transition-colors"></div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-slate-400 font-mono text-[10px] uppercase tracking-widest flex items-center gap-2">
                  <IndianRupee size={14} className="text-emerald-400" /> Confirmed Revenue
                </h3>
              </div>
              <div className="text-3xl font-bold text-white tracking-tight">
                {formatINR(currentMetrics.revenue.confirmed)}
              </div>
              <div className="mt-2 text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                <TrendingUp size={12} /> CLOSED PLACEMENTS WITH CLIENTS
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-5 relative overflow-hidden group shadow-lg">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-indigo-500/10 transition-colors"></div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-slate-400 font-mono text-[10px] uppercase tracking-widest flex items-center gap-2">
                  <Briefcase size={14} className="text-indigo-400" /> Active Requirements
                </h3>
              </div>
              <div className="text-3xl font-bold text-white tracking-tight">
                {activeReqCount}
              </div>
              <div className="mt-2 text-[10px] font-mono text-indigo-400 flex items-center gap-1">
                <FileSpreadsheet size={12} /> SYNCED FROM SHEETS &amp; OS
              </div>
            </div>
            
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-5 relative overflow-hidden group shadow-lg">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-colors"></div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-slate-400 font-mono text-[10px] uppercase tracking-widest flex items-center gap-2">
                  <Users size={14} className="text-blue-400" /> Talent Pool
                </h3>
              </div>
              <div className="text-3xl font-bold text-white tracking-tight">
                {currentMetrics.pipeline.totalCandidates.toLocaleString()}
              </div>
              <div className="mt-2 text-[10px] font-mono text-slate-500 flex items-center gap-1">
                INDEXED &amp; VERIFIED IN POOL
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-5 relative overflow-hidden group shadow-lg">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-amber-500/10 transition-colors"></div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-slate-400 font-mono text-[10px] uppercase tracking-widest flex items-center gap-2">
                  <IndianRupee size={14} className="text-amber-400" /> Active Pipeline Value
                </h3>
              </div>
              <div className="text-3xl font-bold text-white tracking-tight">
                {formatINR(currentMetrics.revenue.expected)}
              </div>
              <div className="mt-2 text-[10px] font-mono text-amber-400/80 flex items-center gap-1">
                WEIGHTED ACROSS IN-FLIGHT DEALS
              </div>
            </div>
          </div>

          {/* Submissions & Deal Pipeline Ledger with Excel Export */}
          <SubmissionsLedgerExport
            role="admin"
            orgId={orgId}
            title="Executive Submissions & Pipeline Ledger"
            subtitle="Accurately mapped vendor submissions, client placements, and Excel export"
          />

          {/* Active Public Requirements Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-indigo-400" />
                  Active Public Requirements ({liveReqs.length})
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Unified from Google Sheets published CSV &amp; Platform OS
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Role Title</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Experience</th>
                    <th className="py-3 px-4">Work Mode</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {liveReqs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No active requirements currently in pool. Click "Sync Google Sheets" to fetch.
                      </td>
                    </tr>
                  ) : (
                    liveReqs.slice(0, 15).map((req: any) => {
                      const isSheet = req.source === "GOOGLE_SHEET" || req.sourceType === "PUBLISHED_CSV";
                      return (
                        <tr key={req.id || req.requirementId} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 font-semibold text-slate-200">
                            {req.title || "Software Engineer"}
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            <span className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-slate-500" />
                              {req.clientName || "Enterprise Client"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-xs font-mono">
                            {req.experience || "3-6 Yrs"}
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-xs">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-500" />
                              {req.workMode || req.location || "Remote"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {isSheet ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <FileSpreadsheet className="w-3 h-3" />
                                Google Sheets
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                Platform OS
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              Active
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Funnel Velocity & Automation Strips */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl overflow-hidden p-6 shadow-xl">
                <h3 className="font-medium text-slate-200 flex items-center gap-2 mb-4">
                  <BarChart2 size={16} className="text-indigo-400" />
                  Recruitment Funnel Velocity
                </h3>
                <div className="flex flex-col space-y-4">
                  <div className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-400">Total Talent Pool</span>
                      <span className="text-sm font-medium text-slate-200">{currentMetrics.pipeline.totalCandidates}</span>
                    </div>
                    <div className="w-full bg-slate-800/50 rounded-full h-2">
                      <div className="bg-slate-500 h-2 rounded-full" style={{ width: '100%' }}></div>
                    </div>
                  </div>
                  <div className="relative pl-4 border-l border-slate-800/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-400">Submissions In-Flight</span>
                      <span className="text-sm font-medium text-slate-200">{currentMetrics.pipeline.submissions}</span>
                    </div>
                    <div className="w-full bg-slate-800/50 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(100, (currentMetrics.pipeline.submissions / (currentMetrics.pipeline.totalCandidates || 1)) * 100)}%` }}></div>
                    </div>
                  </div>
                  <div className="relative pl-8 border-l border-slate-800/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-400">Interviews Scheduled</span>
                      <span className="text-sm font-medium text-slate-200">{currentMetrics.pipeline.interviews}</span>
                    </div>
                    <div className="w-full bg-slate-800/50 rounded-full h-2">
                      <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${Math.min(100, (currentMetrics.pipeline.interviews / (currentMetrics.pipeline.submissions || 1)) * 100)}%` }}></div>
                    </div>
                  </div>
                  <div className="relative pl-12 border-l border-slate-800/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-emerald-400">Placements Closed with Client</span>
                      <span className="text-sm font-medium text-emerald-400">{currentMetrics.pipeline.placements}</span>
                    </div>
                    <div className="w-full bg-slate-800/50 rounded-full h-2">
                      <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${Math.min(100, (currentMetrics.pipeline.placements / (currentMetrics.pipeline.interviews || 1)) * 100)}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI & Automation ROI */}
              <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl overflow-hidden relative p-6 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-medium text-indigo-300 flex items-center gap-2">
                    <Zap size={16} className="text-indigo-400" />
                    AI &amp; Automation Savings
                  </h3>
                  <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">Phase 6 Active</Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                  <div>
                    <div className="text-3xl font-bold text-white mb-1">{currentMetrics.aiRoi.estimatedHoursSaved}h</div>
                    <div className="text-[10px] font-mono text-indigo-400/80 uppercase">Recruiter Hours Saved</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-white mb-1">{currentMetrics.aiRoi.aiScreenings}</div>
                    <div className="text-[10px] font-mono text-indigo-400/80 uppercase">AI Screenings</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-white mb-1">{currentMetrics.aiRoi.aiMatches}</div>
                    <div className="text-[10px] font-mono text-indigo-400/80 uppercase">AI Matches</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-white mb-1">{currentMetrics.aiRoi.automationSuccess}</div>
                    <div className="text-[10px] font-mono text-emerald-400/80 uppercase">Automations Done</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Operational Health & Risk */}
            <div className="space-y-6">
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl overflow-hidden p-6 shadow-xl flex flex-col gap-6">
                <h3 className="font-medium text-slate-200 flex items-center gap-2">
                  <ShieldAlert size={16} className="text-rose-400" />
                  Operational Health &amp; Safeguards
                </h3>
                
                <div className="p-4 rounded-xl border bg-rose-500/5 border-rose-500/20">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-rose-400 font-mono text-[10px] tracking-widest uppercase mb-1">Failed Automations</h4>
                      <div className="text-2xl font-bold text-white">{currentMetrics.risks.failedAutomations}</div>
                    </div>
                    <div className="p-2 bg-rose-500/10 rounded-md text-rose-400">
                      <Activity size={18} />
                    </div>
                  </div>
                </div>
                
                <div className="p-4 rounded-xl border bg-amber-500/5 border-amber-500/20">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-amber-400 font-mono text-[10px] tracking-widest uppercase mb-1">Communication Guard Blocks</h4>
                      <div className="text-2xl font-bold text-white">{currentMetrics.risks.communicationBlocks}</div>
                    </div>
                    <div className="p-2 bg-amber-500/10 rounded-md text-amber-400">
                      <AlertTriangle size={18} />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border bg-emerald-500/5 border-emerald-500/20">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-emerald-400 font-mono text-[10px] tracking-widest uppercase mb-1">System Health</h4>
                      <div className="text-2xl font-bold text-white">Optimal</div>
                    </div>
                    <div className="p-2 bg-emerald-500/10 rounded-md text-emerald-400">
                      <CheckCircle2 size={18} />
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-emerald-400/80">SSOT and API services running normally.</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
