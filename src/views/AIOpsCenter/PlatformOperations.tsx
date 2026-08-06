// src/views/AIOpsCenter/PlatformOperations.tsx
import React, { useState, useMemo } from "react";
import { 
  Wifi, 
  Workflow, 
  Clock, 
  Lock, 
  ChevronRight, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  History, 
  Bot, 
  User, 
  DollarSign, 
  TrendingUp, 
  Cpu,
  ShieldAlert,
  Server,
  Zap,
  RefreshCw,
  Play,
  Sliders,
  Activity
} from "lucide-react";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { BusinessEvent, PlatformActivity } from "./AIOpsTypes";
import HIEOperationalDashboard from "../ops/HIEOperationalDashboard";

interface PlatformOperationsProps {
  activeSubTab: string;
  setActiveSubTab: (tab: string) => void;
  eventsFeed: BusinessEvent[];
  selectedEvent: BusinessEvent | null;
  setSelectedEvent: (evt: BusinessEvent | null) => void;
  eventFilter: string;
  setEventFilter: (filter: string) => void;
  filteredEvents: BusinessEvent[];
}

export default function PlatformOperations({
  activeSubTab,
  setActiveSubTab,
  eventsFeed,
  selectedEvent,
  setSelectedEvent,
  eventFilter,
  setEventFilter,
  filteredEvents
}: PlatformOperationsProps) {
  
  const [timelineFilter, setTimelineFilter] = useState<'ALL' | 'AI' | 'HUMAN' | 'SLA' | 'FINANCE'>('ALL');
  const [selectedTimelineItem, setSelectedTimelineItem] = useState<PlatformActivity | null>(null);

  const integrationsStatus = useMemo(() => [
    { name: "CRM Workspace", status: "Nominal", latency: 42, uptime: "99.98%", lastFailure: "June 28, 14:22" },
    { name: "OS Workspace", status: "Nominal", latency: 21, uptime: "99.99%", lastFailure: "Never" },
    { name: "Vendor Portal", status: "Nominal", latency: 64, uptime: "99.85%", lastFailure: "July 01, 09:12" },
    { name: "Client Portal", status: "Nominal", latency: 48, uptime: "99.92%", lastFailure: "June 30, 18:44" },
    { name: "Firestore (SSOT)", status: "Nominal", latency: 12, uptime: "100.00%", lastFailure: "Never" },
    { name: "Event Bus Broker", status: "Nominal", latency: 4, uptime: "99.99%", lastFailure: "Never" },
    { name: "AI Gateway Proxy", status: "Nominal", latency: 180, uptime: "99.95%", lastFailure: "July 03, 11:04" },
    { name: "Gemini Model API", status: "Nominal", latency: 420, uptime: "99.91%", lastFailure: "June 25, 08:31" },
    { name: "Email Gateway", status: "Nominal", latency: 152, uptime: "99.70%", lastFailure: "June 22, 10:00" },
    { name: "WhatsApp Hub API", status: "Nominal", latency: 95, uptime: "99.80%", lastFailure: "June 19, 15:52" },
    { name: "Google Calendar Sync", status: "Nominal", latency: 130, uptime: "99.90%", lastFailure: "Never" },
    { name: "Cloud Storage Bucket", status: "Nominal", latency: 32, uptime: "100.00%", lastFailure: "Never" },
  ], []);

  // Pristine chronological platform timeline feed
  const timelineData = useMemo<PlatformActivity[]>(() => [
    {
      id: "act-01",
      timestamp: new Date(Date.now() - 3 * 60000).toISOString(),
      actor: "Conrad Conductor (AI)",
      action: "Executed conduction pipeline and parsed 14 resume PDFs. Score index updated.",
      type: "AI",
      status: "success",
      payload: { processed: 14, files: ["resume_jdoe.pdf", "resume_smit.pdf"], matchIndex: "idx-2291" }
    },
    {
      id: "act-02",
      timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
      actor: "Bruce Wayne (Human)",
      action: "Transferred requirement ownership of 'Lead Cloud Platform Architect' to Peter Parker.",
      type: "HUMAN",
      status: "info",
      payload: { reqId: "req-091", prevOwner: "Bruce Wayne", newOwner: "Peter Parker" }
    },
    {
      id: "act-03",
      timestamp: new Date(Date.now() - 32 * 60000).toISOString(),
      actor: "Cleo CS Officer (AI)",
      action: "SLA Alert triggered: Staff Go/Kubernetes developer response latency exceeded 20 hours.",
      type: "SLA",
      status: "warning",
      payload: { reqId: "req-092", elapsedHours: 20, limitHours: 12, escalatedTo: "Bruce Wayne" }
    },
    {
      id: "act-04",
      timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
      actor: "Max Optimizer (AI)",
      action: "Completed ecosystem semantic bench matching scan. Dispatched 3 candidate match invites.",
      type: "AI",
      status: "success",
      payload: { scannedBenches: 14, matchesFound: 3, invitationsSent: ["apex-staffing", "tech-allies"] }
    },
    {
      id: "act-05",
      timestamp: new Date(Date.now() - 120 * 60000).toISOString(),
      actor: "Finance OS (System)",
      action: "Successfully raised placement fee invoice for $22,500. Sent to Initech billing.",
      type: "FINANCE",
      status: "success",
      payload: { invoiceId: "inv-98122", amount: 22500, feeRate: "15%", status: "PAID" }
    },
    {
      id: "act-06",
      timestamp: new Date(Date.now() - 180 * 60000).toISOString(),
      actor: "Diana Prince (Human)",
      action: "SLA Override applied: Manually approved candidate submittal on GlobalFinance requirement.",
      type: "HUMAN",
      status: "info",
      payload: { reqId: "req-094", candidateId: "cand-112", approvedAt: "2026-07-06 10:45 AM" }
    },
    {
      id: "act-07",
      timestamp: new Date(Date.now() - 240 * 60000).toISOString(),
      actor: "UOP Gateway (System)",
      action: "SLA Violation escalates: VP Strategic Search breached submittal deadline. Direct CEO intervention triggered.",
      type: "SLA",
      status: "critical",
      payload: { reqId: "req-094", breachType: "ZERO_SUBMITTALS", limitDays: 3, escalationLevel: 3 }
    }
  ], []);

  const filteredTimeline = useMemo(() => {
    if (timelineFilter === 'ALL') return timelineData;
    return timelineData.filter(item => item.type === timelineFilter);
  }, [timelineFilter, timelineData]);

  return (
    <div className="flex flex-col flex-1 gap-6">
      {/* Platform connectivity view */}
      {activeSubTab === 'connectivity' && (
        <div className="space-y-6 flex-1 flex flex-col">
          <div className="flex justify-between items-center border-b border-slate-900 pb-4">
            <div>
              <h2 className="text-lg font-black text-white">Platform Connectivity Dashboard</h2>
              <p className="text-xs text-slate-400">Live operational monitor of HireNest integration handshakes and infrastructure channels.</p>
            </div>
            <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full font-bold">
              Heartbeats: Operational
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto max-h-[480px] pr-2">
            {integrationsStatus.map((item, index) => (
              <div 
                key={index} 
                className="p-4 rounded-2xl bg-[#070A13] border border-slate-900/80 hover:border-slate-800 transition-all flex flex-col justify-between"
              >
                <div className="flex justify-between items-start">
                  <span className="text-xs font-black text-white leading-tight">{item.name}</span>
                  <span className="text-[9px] font-black uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {item.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-900/60">
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block font-bold">Latency</span>
                    <span className="text-xs font-mono font-bold text-slate-300">{item.latency} ms</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block font-bold">Uptime Ratio</span>
                    <span className="text-xs font-mono font-bold text-slate-300">{item.uptime || "99.9%"}</span>
                  </div>
                </div>
                <div className="mt-2 text-[9px] text-slate-500">
                  <span className="font-bold">Last failure:</span> {item.lastFailure}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Event stream view */}
      {activeSubTab === 'events' && (
        <div className="space-y-6 flex-1 flex flex-col">
          <div className="flex flex-col md:flex-row justify-between md:items-center border-b border-slate-900 pb-4 gap-4">
            <div>
              <h2 className="text-lg font-black text-white">Ecosystem Event Bus Monitor</h2>
              <p className="text-xs text-slate-400">Live feed of global business operations events triggering recruitment automation loops.</p>
            </div>
            
            {/* Event Type Filters */}
            <div className="flex flex-wrap gap-1.5">
              {["ALL", "REQUIREMENT_CREATED", "CANDIDATE_MATCHED", "SUBMISSION_SENT", "INTERVIEW_SCHEDULED"].map((type) => (
                <button
                  key={type}
                  onClick={() => setEventFilter(type)}
                  className={cn("px-2.5 py-1 rounded-xl text-[9px] font-bold uppercase transition-all border", 
                    eventFilter === type 
                      ? "bg-indigo-600 border-indigo-500 text-white shadow" 
                      : "bg-[#070A13] text-slate-400 border-slate-900 hover:text-white hover:bg-slate-900/60"
                  )}
                >
                  {type.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col xl:flex-row gap-6">
            {/* Event Stream list */}
            <div className="flex-1 overflow-y-auto max-h-[420px] border border-slate-900/80 rounded-2xl bg-[#070A13] divide-y divide-slate-900/60">
              {filteredEvents.map((evt) => (
                <div 
                  key={evt.id}
                  onClick={() => setSelectedEvent(evt)}
                  className={cn("p-4 flex items-center justify-between cursor-pointer transition-colors", 
                    selectedEvent?.id === evt.id ? "bg-indigo-600/10 border-l-4 border-l-indigo-500" : "hover:bg-slate-900/40"
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-white">{evt.type}</span>
                      <span className="text-[9px] font-mono text-slate-500">#{evt.id}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">Triggered by: {evt.origin}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1 justify-end">
                      <Clock size={10} /> {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-[9px] font-bold uppercase text-emerald-400 mt-0.5 block">NOMINAL</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Active Event Payload Details */}
            <div className="w-full xl:w-96 bg-[#070A13] border border-slate-900 rounded-2xl p-5 flex flex-col justify-between min-h-[350px]">
              {selectedEvent ? (
                <div className="space-y-4 flex-1 flex flex-col">
                  <div className="border-b border-slate-900 pb-3 flex justify-between items-start">
                    <div>
                      <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider block">Real-time Payload Auditor</span>
                      <h4 className="text-xs font-black text-white">{selectedEvent.type}</h4>
                    </div>
                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded">
                      NOMINAL
                    </span>
                  </div>
                  <div className="space-y-2 flex-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Raw Payload JSON</span>
                    <pre className="text-[10px] font-mono bg-slate-950 p-4 rounded-xl text-slate-300 overflow-x-auto max-h-[220px]">
                      {JSON.stringify(selectedEvent.payload, null, 2)}
                    </pre>
                  </div>
                  <div className="text-[10px] text-slate-500 border-t border-slate-900 pt-3 flex items-center gap-2">
                    <Lock size={12} className="text-indigo-400" /> Authorized & synced with Firestore SSOT.
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-center items-center text-center p-6 text-slate-500 space-y-2">
                  <Workflow size={32} className="text-slate-600" />
                  <p className="text-xs font-bold uppercase tracking-wider">Select event record to audit</p>
                  <p className="text-[10px] text-slate-500 max-w-[200px]">Audits direct input trigger metrics across client interfaces.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HIE Health & Service Registry */}
      {(activeSubTab === 'hie_health' || activeSubTab === 'services') && (
        <div className="space-y-6 flex-1 flex flex-col">
          <HIEOperationalDashboard />
        </div>
      )}

      {/* Platform Activity Timeline */}
      {activeSubTab === 'activity_timeline' && (
        <div className="space-y-6 flex-1 flex flex-col">
          <div className="flex flex-col md:flex-row justify-between md:items-center border-b border-slate-900 pb-4 gap-4">
            <div>
              <h2 className="text-lg font-black text-white">Platform Activity Timeline</h2>
              <p className="text-xs text-slate-400">Unified, chronological ledger of all platform-wide operational changes and events.</p>
            </div>

            {/* Timeline filters */}
            <div className="flex flex-wrap gap-1.5">
              {(["ALL", "AI", "HUMAN", "SLA", "FINANCE"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setTimelineFilter(type)}
                  className={cn("px-3 py-1 rounded-xl text-[9px] font-bold uppercase border transition-all",
                    timelineFilter === type
                      ? "bg-indigo-600 border-indigo-500 text-white shadow"
                      : "bg-[#070A13] text-slate-400 border-slate-900 hover:text-white hover:bg-slate-900/60"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col xl:flex-row gap-6">
            {/* Scrollable chronological Timeline list */}
            <div className="flex-1 overflow-y-auto max-h-[440px] pr-2 space-y-4 relative before:absolute before:left-6 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-900/80">
              {filteredTimeline.map((item) => {
                const isAi = item.type === 'AI';
                const isHuman = item.type === 'HUMAN';
                const isSla = item.type === 'SLA';
                const isFinance = item.type === 'FINANCE';

                return (
                  <div 
                    key={item.id}
                    onClick={() => setSelectedTimelineItem(item)}
                    className={cn("pl-12 relative cursor-pointer group transition-all")}
                  >
                    {/* Floating circular icon marker */}
                    <div className={cn("absolute left-3 top-1 p-1.5 rounded-full border z-10 transition-colors shadow-md",
                      item.status === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500" :
                      item.status === 'warning' ? "bg-amber-500/10 border-amber-500/20 text-amber-400 group-hover:bg-amber-500 animate-pulse" :
                      item.status === 'critical' ? "bg-rose-500/10 border-rose-500/20 text-rose-400 group-hover:bg-rose-500" :
                      "bg-indigo-500/10 border-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500",
                      "group-hover:text-white"
                    )}>
                      {isAi && <Bot size={11} />}
                      {isHuman && <User size={11} />}
                      {isSla && <AlertTriangle size={11} />}
                      {isFinance && <DollarSign size={11} />}
                      {!isAi && !isHuman && !isSla && !isFinance && <History size={11} />}
                    </div>

                    <div className={cn("p-4 rounded-2xl bg-[#070A13] border border-slate-900/80 hover:border-slate-800 transition-all space-y-2",
                      selectedTimelineItem?.id === item.id ? "border-indigo-500/40 bg-indigo-500/5" : ""
                    )}>
                      <div className="flex justify-between items-start gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-white">{item.actor}</span>
                            <span className={cn("text-[8px] font-black uppercase px-1.5 py-0.5 rounded border",
                              isAi ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" :
                              isHuman ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                              isSla ? "bg-rose-500/10 border-rose-500/20 text-rose-400" :
                              isFinance ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                              "bg-slate-500/10 border-slate-500/20 text-slate-400"
                            )}>
                              {item.type}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 leading-snug">{item.action}</p>
                        </div>
                        <span className="text-[9px] font-mono text-slate-500 whitespace-nowrap">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Timeline Detail Payload Panel */}
            <div className="w-full xl:w-96 bg-[#070A13] border border-slate-900 rounded-2xl p-5 flex flex-col justify-between min-h-[350px]">
              {selectedTimelineItem ? (
                <div className="space-y-4 flex-1 flex flex-col">
                  <div className="border-b border-slate-900 pb-3 flex justify-between items-start">
                    <div>
                      <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider block">Unified Audit Log details</span>
                      <h4 className="text-xs font-black text-white">{selectedTimelineItem.actor}</h4>
                    </div>
                    <span className={cn("text-[9px] font-bold uppercase px-2 py-0.5 rounded",
                      selectedTimelineItem.status === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                      selectedTimelineItem.status === 'warning' ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                      selectedTimelineItem.status === 'critical' ? "bg-rose-500/10 border-rose-500/20 text-rose-400" :
                      "bg-slate-500/10 border-slate-500/20 text-slate-400"
                    )}>
                      {selectedTimelineItem.status}
                    </span>
                  </div>
                  <div className="space-y-2 flex-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Context / payload parameters</span>
                    <pre className="text-[10px] font-mono bg-slate-950 p-4 rounded-xl text-slate-300 overflow-x-auto max-h-[220px]">
                      {JSON.stringify(selectedTimelineItem.payload, null, 2)}
                    </pre>
                  </div>
                  <div className="text-[10px] text-slate-500 border-t border-slate-900 pt-3 flex items-center gap-2">
                    <Lock size={12} className="text-indigo-400" /> Grounded operational telemetry record.
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-center items-center text-center p-6 text-slate-500 space-y-2">
                  <History size={32} className="text-slate-600" />
                  <p className="text-xs font-bold uppercase tracking-wider">Select record to inspect details</p>
                  <p className="text-[10px] text-slate-500 max-w-[200px]">Audits direct input parameters and state records of selected activity.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enterprise Service Registry & SLO Management */}
      {activeSubTab === 'services' && (
        <ServiceRegistryView />
      )}

      {/* AI Incident Center & Automatic Recovery */}
      {activeSubTab === 'incidents' && (
        <IncidentCenterView />
      )}
    </div>
  );
}

// ============================================================================
// Service Registry & SLO Management Implementation
// ============================================================================

interface EnterpriseService {
  id: string;
  name: string;
  tool: string;
  skill: string;
  assignedAgent: string;
  sloAvailability: number; // e.g. 99.9
  currentAvailability: number;
  sloLatencyMs: number;
  currentLatencyMs: number;
  errorBudget: number; // % remaining
  status: "HEALTHY" | "WARNING" | "BREACHED";
  recommendedAction: string;
}

const INITIAL_SERVICES: EnterpriseService[] = [
  {
    id: "srv-001",
    name: "Candidate Matching Service",
    tool: "candidate_matches",
    skill: "gemini-api",
    assignedAgent: "Emma (Senior Recruiter AI)",
    sloAvailability: 99.9,
    currentAvailability: 99.98,
    sloLatencyMs: 2000,
    currentLatencyMs: 1420,
    errorBudget: 85,
    status: "HEALTHY",
    recommendedAction: "No action required. Performance is tracking within normal error bounds."
  },
  {
    id: "srv-002",
    name: "Requirement Parser & Intel",
    tool: "extract-text API",
    skill: "firebase-integration",
    assignedAgent: "Bruce (Talent Director AI)",
    sloAvailability: 99.9,
    currentAvailability: 99.64,
    sloLatencyMs: 1500,
    currentLatencyMs: 1250,
    errorBudget: 62,
    status: "HEALTHY",
    recommendedAction: "Slight queue pressure. Pre-allocate extraction tasks to hot server thread if budget drops further."
  },
  {
    id: "srv-003",
    name: "Strategic BDM Router",
    tool: "strategic_routing_index",
    skill: "oauth-integration",
    assignedAgent: "Diana (Business Development AI)",
    sloAvailability: 99.5,
    currentAvailability: 99.12,
    sloLatencyMs: 1000,
    currentLatencyMs: 1210,
    errorBudget: -22,
    status: "WARNING",
    recommendedAction: "Latency breached target bounds. Apply circuit breaker override and delegate active routes to manual queue."
  },
  {
    id: "srv-004",
    name: "Submission Ledger Audit",
    tool: "ledger_verification",
    skill: "firebase-integration",
    assignedAgent: "Cleo (CS AI)",
    sloAvailability: 99.95,
    currentAvailability: 100.00,
    sloLatencyMs: 800,
    currentLatencyMs: 340,
    errorBudget: 100,
    status: "HEALTHY",
    recommendedAction: "Outstanding performance. Error budget is 100% intact."
  },
  {
    id: "srv-005",
    name: "Vendor Synchronization Engine",
    tool: "vendor_bench_index",
    skill: "google-maps-platform",
    assignedAgent: "Max (GTM Marketer AI)",
    sloAvailability: 99.0,
    currentAvailability: 98.45,
    sloLatencyMs: 3000,
    currentLatencyMs: 3450,
    errorBudget: -45,
    status: "BREACHED",
    recommendedAction: "CRITICAL: Uptime and latency targets both breached. Triggering automatic fallback routine with local caches."
  }
];

function ServiceRegistryView() {
  const [services, setServices] = useState<EnterpriseService[]>(INITIAL_SERVICES);
  const [selectedSrvId, setSelectedSrvId] = useState<string>("srv-001");
  const [isTuning, setIsTuning] = useState(false);
  const [selectedServiceForTuning, setSelectedServiceForTuning] = useState<EnterpriseService | null>(null);

  const activeService = useMemo(() => {
    return services.find(s => s.id === selectedSrvId) || services[0];
  }, [services, selectedSrvId]);

  const stats = useMemo(() => {
    const totalSrvs = services.length;
    const warningCount = services.filter(s => s.status === "WARNING").length;
    const breachedCount = services.filter(s => s.status === "BREACHED").length;
    return {
      totalSrvs,
      warningCount,
      breachedCount,
      healthyCount: totalSrvs - warningCount - breachedCount
    };
  }, [services]);

  const handleTuneService = (srv: EnterpriseService) => {
    setSelectedServiceForTuning(srv);
    setIsTuning(true);
  };

  const handleSaveTunedSLO = (newAvailability: number, newLatency: number) => {
    if (!selectedServiceForTuning) return;
    setServices(prev => prev.map(s => {
      if (s.id === selectedServiceForTuning.id) {
        return {
          ...s,
          sloAvailability: newAvailability,
          sloLatencyMs: newLatency,
          // Recalculate status based on new targets
          status: s.currentAvailability < newAvailability ? "WARNING" : s.currentLatencyMs > newLatency ? "WARNING" : "HEALTHY"
        };
      }
      return s;
    }));
    setIsTuning(false);
    setSelectedServiceForTuning(null);
  };

  return (
    <div className="space-y-6 flex-1 flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-900 pb-4 gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Enterprise Service Registry & SLOs</h2>
          <p className="text-xs text-slate-400">Governance of core microservices, live Service Level Objectives (SLOs), and automated compliance enforcement.</p>
        </div>
        <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full font-bold">
          SLO Governance Active
        </span>
      </div>

      {/* SLO Counters row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#070A13] border border-slate-900 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Total Active Services</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-black font-mono text-white">{stats.totalSrvs} Registered</span>
          </div>
        </div>
        <div className="bg-[#070A13] border border-slate-900 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">SLOs Healthy</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-black font-mono text-emerald-400">{stats.healthyCount} Nominal</span>
          </div>
        </div>
        <div className="bg-[#070A13] border border-slate-900 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Warning Alerts</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className={`text-xl font-black font-mono ${stats.warningCount > 0 ? "text-amber-400 animate-pulse" : "text-slate-400"}`}>
              {stats.warningCount} Services
            </span>
          </div>
        </div>
        <div className="bg-[#070A13] border border-slate-900 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">SLA Breaches</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className={`text-xl font-black font-mono ${stats.breachedCount > 0 ? "text-rose-400 animate-pulse" : "text-slate-400"}`}>
              {stats.breachedCount} Critical
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col xl:flex-row gap-6">
        {/* Service Registry Table */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left text-xs bg-[#070A13] border border-slate-900 rounded-2xl overflow-hidden">
            <thead>
              <tr className="bg-[#0c111f] border-b border-slate-900 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                <th className="p-4">Service Details</th>
                <th className="p-4">Assigned Agent</th>
                <th className="p-4 font-mono">Uptime SLO</th>
                <th className="p-4 font-mono">Latency SLO</th>
                <th className="p-4 font-mono">Err Budget</th>
                <th className="p-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/60">
              {services.map((srv) => (
                <tr
                  key={srv.id}
                  onClick={() => setSelectedSrvId(srv.id)}
                  className={cn("hover:bg-[#0d1222] transition-colors cursor-pointer",
                    selectedSrvId === srv.id ? "bg-indigo-600/5" : ""
                  )}
                >
                  <td className="p-4">
                    <span className="font-bold text-white block">{srv.name}</span>
                    <span className="text-[10px] text-slate-500">{srv.tool} • {srv.id}</span>
                  </td>
                  <td className="p-4 text-slate-300 font-medium">{srv.assignedAgent}</td>
                  <td className="p-4 font-mono text-slate-300">
                    <span className="text-[10px] text-slate-500 block">Target: {srv.sloAvailability}%</span>
                    <span className={`font-bold ${srv.currentAvailability >= srv.sloAvailability ? "text-emerald-400" : "text-rose-400"}`}>
                      {srv.currentAvailability}%
                    </span>
                  </td>
                  <td className="p-4 font-mono text-slate-300">
                    <span className="text-[10px] text-slate-500 block">Target: {srv.sloLatencyMs}ms</span>
                    <span className={`font-bold ${srv.currentLatencyMs <= srv.sloLatencyMs ? "text-emerald-400" : "text-rose-400"}`}>
                      {srv.currentLatencyMs}ms
                    </span>
                  </td>
                  <td className="p-4 font-mono">
                    <span className={cn("font-bold", srv.errorBudget >= 0 ? "text-indigo-400" : "text-rose-400 animate-pulse")}>
                      {srv.errorBudget}%
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <span className={cn("text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border",
                      srv.status === 'HEALTHY' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      srv.status === 'WARNING' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                      "bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse"
                    )}>
                      {srv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detailed Service SLO Audit Drawer */}
        <div className="w-full xl:w-[450px] bg-[#070A13] border border-slate-900 rounded-2xl p-5 flex flex-col justify-between min-h-[500px]">
          <div className="space-y-6">
            <div className="border-b border-slate-900 pb-3">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Enterprise Service Auditor</span>
              <h4 className="text-sm font-black text-white">{activeService.name}</h4>
              <p className="text-[10px] text-slate-500">Service Identifier: {activeService.id}</p>
            </div>

            {/* Associated capabilities */}
            <div className="bg-[#0b101d] border border-slate-900/80 p-4 rounded-xl space-y-3 text-xs">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Operational Mappings</span>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Associated Platform Tool:</span>
                <span className="font-mono font-bold text-white bg-slate-950 px-2 py-1 rounded text-[10px]">{activeService.tool}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Capability Skill Alignment:</span>
                <span className="font-mono font-bold text-indigo-400">{activeService.skill}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Orchestrator Cognition Agent:</span>
                <span className="font-bold text-slate-300">{activeService.assignedAgent}</span>
              </div>
            </div>

            {/* SLO status gauges */}
            <div className="space-y-3">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Grounded Compliance Metrics</span>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-950 border border-slate-900 rounded-xl space-y-1">
                  <span className="text-[8px] font-bold text-slate-500 uppercase block">Availability SLO Status</span>
                  <div className="flex justify-between items-baseline font-mono">
                    <span className="text-xs text-slate-400">Target: {activeService.sloAvailability}%</span>
                    <span className="text-sm font-black text-white">{activeService.currentAvailability}%</span>
                  </div>
                  <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden mt-1">
                    <div 
                      className={cn("h-full", activeService.currentAvailability >= activeService.sloAvailability ? "bg-emerald-500" : "bg-rose-500")}
                      style={{ width: `${activeService.currentAvailability}%` }}
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-900 rounded-xl space-y-1">
                  <span className="text-[8px] font-bold text-slate-500 uppercase block">Latency SLO Status</span>
                  <div className="flex justify-between items-baseline font-mono">
                    <span className="text-xs text-slate-400">Target: {activeService.sloLatencyMs}ms</span>
                    <span className="text-sm font-black text-white">{activeService.currentLatencyMs}ms</span>
                  </div>
                  <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden mt-1">
                    <div 
                      className={cn("h-full", activeService.currentLatencyMs <= activeService.sloLatencyMs ? "bg-emerald-500" : "bg-rose-500")}
                      style={{ width: `${Math.min(100, (activeService.currentLatencyMs / activeService.sloLatencyMs) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Recommended recovery action */}
            <div className="space-y-2">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Strategic Recovery Advice</span>
              <div className="p-3.5 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-xs flex items-start gap-2.5">
                <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-300 leading-normal">
                  <span className="font-bold text-indigo-400">Audit Insight:</span> {activeService.recommendedAction}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-900/60">
            <button
              onClick={() => handleTuneService(activeService)}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center justify-center gap-1.5 shadow"
            >
              <Sliders size={13} /> Tune Service SLO Limits
            </button>
          </div>
        </div>
      </div>

      {/* SLA Limits Tuning Modal */}
      <AnimatePresence>
        {isTuning && selectedServiceForTuning && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#070A13] border border-slate-900 rounded-3xl p-6 max-w-md w-full space-y-4"
            >
              <div className="border-b border-slate-900 pb-3">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Service Governance Panel</span>
                <h4 className="text-sm font-black text-white">Tune Service Level Objectives</h4>
                <p className="text-[10px] text-slate-500">{selectedServiceForTuning.name}</p>
              </div>

              <div className="space-y-4 text-xs">
                {/* Tuning Availability */}
                <div className="space-y-1">
                  <label className="text-slate-400">Target Availability SLO (%)</label>
                  <input 
                    type="number"
                    step="0.01"
                    min="90"
                    max="100"
                    defaultValue={selectedServiceForTuning.sloAvailability}
                    id="availability-input"
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl p-2.5 text-white focus:border-indigo-500/40 outline-none font-mono"
                  />
                </div>

                {/* Tuning Latency */}
                <div className="space-y-1">
                  <label className="text-slate-400">Target Max Latency SLO (ms)</label>
                  <input 
                    type="number"
                    min="100"
                    max="10000"
                    defaultValue={selectedServiceForTuning.sloLatencyMs}
                    id="latency-input"
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl p-2.5 text-white focus:border-indigo-500/40 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    const avVal = Number((document.getElementById("availability-input") as HTMLInputElement)?.value || selectedServiceForTuning.sloAvailability);
                    const latVal = Number((document.getElementById("latency-input") as HTMLInputElement)?.value || selectedServiceForTuning.sloLatencyMs);
                    handleSaveTunedSLO(avVal, latVal);
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all"
                >
                  Save SLO Parameters
                </button>
                <button
                  onClick={() => setIsTuning(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-950 border border-slate-900 text-slate-400 hover:text-white transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// AI Incident Center & Automatic Recovery Implementation
// ============================================================================

interface PlatformIncident {
  id: string;
  name: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "ACTIVE" | "MITIGATED" | "RECOVERED";
  affectedAgent: string;
  rootCause: string;
  recoveryTimeline: string;
  steps: string[];
}

const FALLBACK_INCIDENTS: PlatformIncident[] = [
  {
    id: "inc-101",
    name: "Gemini Model Token Rate Limit Breached",
    severity: "CRITICAL",
    status: "RECOVERED",
    affectedAgent: "Emma (Senior Recruiter AI)",
    rootCause: "Submittal request spikes on Initech requirements exceeded Gemini 1.5 Flash limits.",
    recoveryTimeline: "Automatically mitigated in 12 seconds via circuit breaker failover.",
    steps: [
      "Gemini Model rate limit 429 received.",
      "Circuit breaker tripped on model gateway service.",
      "Automatically routed secondary match request to backup Claude-3-5-Sonnet.",
      "Initiated rate-limit back-off queue for primary engine.",
      "Primary Gemini engine recovered. Breaker reset to NOMINAL."
    ]
  },
  {
    id: "inc-102",
    name: "Stripe Payment webhook latency",
    severity: "MEDIUM",
    status: "MITIGATED",
    affectedAgent: "Cleo (CS AI)",
    rootCause: "Third-party Stripe API experienced localized routing delays.",
    recoveryTimeline: "Polled successfully and synced via Event Bus retry system in 45 seconds.",
    steps: [
      "Stripe payment notification webhook timeout.",
      "Event Bus placed webhook task in DLQ (Dead Letter Queue).",
      "Triggered automatic exponential-retry protocol (Attempt #1).",
      "Webhook acknowledged. Status synced with Firestore SSOT."
    ]
  },
  {
    id: "inc-103",
    name: "Slack notification dispatch failure",
    severity: "LOW",
    status: "RECOVERED",
    affectedAgent: "Diana (Business Development AI)",
    rootCause: "Invalid OAuth secret reference in Slack developer integrations configuration.",
    recoveryTimeline: "Self-corrected via hot-fallback system config rotation in 4 seconds.",
    steps: [
      "Slack dispatch exception returned. Auth failure.",
      "System rotated OAuth client secret key to secondary backup.",
      "Retried Slack channel message dispatch.",
      "Successfully sent notification payload."
    ]
  }
];

interface CircuitBreaker {
  name: string;
  failureRate: number;
  threshold: number;
  status: "NOMINAL" | "TRIPPED" | "HEALING";
}

function IncidentCenterView() {
  const [incidents, setIncidents] = useState<PlatformIncident[]>(FALLBACK_INCIDENTS);
  const [selectedIncId, setSelectedIncId] = useState<string>("inc-101");
  const [breakers, setBreakers] = useState<CircuitBreaker[]>([
    { name: "Model Gateway Breaker", failureRate: 1.2, threshold: 5.0, status: "NOMINAL" },
    { name: "Event Bus Broker", failureRate: 0.0, threshold: 1.0, status: "NOMINAL" },
    { name: "WhatsApp Hub API", failureRate: 12.5, threshold: 10.0, status: "TRIPPED" },
    { name: "Email Gateway Dispatch", failureRate: 4.8, threshold: 5.0, status: "HEALING" }
  ]);
  const [simulationStatus, setSimulationStatus] = useState<string | null>(null);

  const selectedIncident = useMemo(() => {
    return incidents.find(i => i.id === selectedIncId) || incidents[0];
  }, [incidents, selectedIncId]);

  const stats = useMemo(() => {
    const totalIncidents = incidents.length;
    const activeCount = incidents.filter(i => i.status === "ACTIVE").length;
    const resolvedCount = incidents.filter(i => i.status === "RECOVERED").length;
    return {
      totalIncidents,
      activeCount,
      resolvedCount
    };
  }, [incidents]);

  const handleSimulateFailover = () => {
    setSimulationStatus("Simulating failover: Tripping Stripe API breaker manually...");
    
    setTimeout(() => {
      setBreakers(prev => prev.map(b => {
        if (b.name === "Model Gateway Breaker") {
          return { ...b, status: "TRIPPED", failureRate: 7.2 };
        }
        return b;
      }));
      setSimulationStatus("Model Gateway Breaker TRIPPED. Automatic failover active: Rerouting match workflows to backup Model...");
    }, 2000);

    setTimeout(() => {
      // Add a simulated active incident
      const newInc: PlatformIncident = {
        id: `inc-${Date.now().toString().slice(-3)}`,
        name: "Manual Simulated Model Failover Incident",
        severity: "HIGH",
        status: "RECOVERED",
        affectedAgent: "Emma (Senior Recruiter AI)",
        rootCause: "Manual trigger of failover simulation from AIOps Incident Center.",
        recoveryTimeline: "Automatically mitigated in 1.2 seconds.",
        steps: [
          "Manual breaker trip command received.",
          "Tripped Model Gateway Breaker.",
          "Workflow Orchestrator successfully shifted model calls to Claude-3-5 Sonnet."
        ]
      };
      setIncidents(prev => [newInc, ...prev]);
      setSelectedIncId(newInc.id);
      
      // Auto heal breaker
      setBreakers(prev => prev.map(b => {
        if (b.name === "Model Gateway Breaker") {
          return { ...b, status: "HEALING", failureRate: 2.1 };
        }
        return b;
      }));
      setSimulationStatus("Ecosystem recovered. Failover completed successfully.");
    }, 4500);

    setTimeout(() => {
      setSimulationStatus(null);
    }, 8000);
  };

  const handleResetBreakers = () => {
    setBreakers(prev => prev.map(b => ({ ...b, status: "NOMINAL", failureRate: 0.1 })));
    setSimulationStatus("All circuit breakers successfully reset to NOMINAL status.");
    setTimeout(() => setSimulationStatus(null), 4000);
  };

  return (
    <div className="space-y-6 flex-1 flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-900 pb-4 gap-4">
        <div>
          <h2 className="text-lg font-black text-white">AI Incident Center & Circuit Breakers</h2>
          <p className="text-xs text-slate-400">Continuous self-healing infrastructure. Self-correction traces, active circuit breakers, and automatic failovers.</p>
        </div>
        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full font-bold">
          Self-Healing Active
        </span>
      </div>

      {/* Simulation status bar */}
      {simulationStatus && (
        <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs rounded-xl flex items-center justify-between font-mono animate-pulse">
          <span>⚙️ {simulationStatus}</span>
          <span className="text-[9px] uppercase font-bold text-indigo-400">Processing...</span>
        </div>
      )}

      {/* Circuit Breakers Board */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {breakers.map((b) => (
          <div key={b.name} className="bg-[#070A13] border border-slate-900 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden group">
            <div className="space-y-1 relative z-10">
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">{b.name}</span>
              <div className="flex justify-between items-baseline pt-1">
                <span className="text-xs font-bold text-slate-400">Fail Rate:</span>
                <span className="text-sm font-black font-mono text-white">{b.failureRate}%</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-500">Threshold:</span>
                <span className="text-xs font-mono text-slate-500">{b.threshold}%</span>
              </div>
              <span className={cn("text-[9px] font-bold block mt-1.5",
                b.status === "NOMINAL" ? "text-emerald-400" :
                b.status === "HEALING" ? "text-amber-400" : "text-rose-400 animate-pulse"
              )}>
                ● {b.status}
              </span>
            </div>
            <div className="absolute top-0 right-0 w-12 h-12 bg-white/1 rounded-full blur-lg pointer-events-none group-hover:bg-white/2 transition-colors"></div>
          </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col xl:flex-row gap-6">
        {/* Incident Logs Table */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left text-xs bg-[#070A13] border border-slate-900 rounded-2xl overflow-hidden">
            <thead>
              <tr className="bg-[#0c111f] border-b border-slate-900 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                <th className="p-4">Incident Name</th>
                <th className="p-4">Affected Agent</th>
                <th className="p-4">Severity</th>
                <th className="p-4">Recovery Time</th>
                <th className="p-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/60">
              {incidents.map((inc) => (
                <tr
                  key={inc.id}
                  onClick={() => setSelectedIncId(inc.id)}
                  className={cn("hover:bg-[#0d1222] transition-colors cursor-pointer",
                    selectedIncId === inc.id ? "bg-indigo-600/5" : ""
                  )}
                >
                  <td className="p-4">
                    <span className="font-bold text-white block">{inc.name}</span>
                    <span className="text-[10px] text-slate-500">ID: {inc.id} • Root: {inc.rootCause.slice(0, 42)}...</span>
                  </td>
                  <td className="p-4 text-slate-300 font-medium">{inc.affectedAgent}</td>
                  <td className="p-4">
                    <span className={cn("text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border",
                      inc.severity === 'CRITICAL' ? "bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse" :
                      inc.severity === 'HIGH' ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                      inc.severity === 'MEDIUM' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                      "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    )}>
                      {inc.severity}
                    </span>
                  </td>
                  <td className="p-4 text-slate-400 font-mono font-bold">{inc.recoveryTimeline.replace("Automatically mitigated in ", "")}</td>
                  <td className="p-4 text-right">
                    <span className={cn("text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border",
                      inc.status === 'RECOVERED' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      inc.status === 'MITIGATED' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                      "bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse"
                    )}>
                      {inc.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Self-Healing Recovery Steps visualizer drawer */}
        <div className="w-full xl:w-[450px] bg-[#070A13] border border-slate-900 rounded-2xl p-5 flex flex-col justify-between min-h-[500px]">
          <div className="space-y-5">
            <div className="border-b border-slate-900 pb-3">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Self-Correction Trace Auditor</span>
              <h4 className="text-sm font-black text-white">{selectedIncident.name}</h4>
              <p className="text-[10px] text-slate-500">Incident Identifier: {selectedIncident.id}</p>
            </div>

            {/* Root cause and affected agent */}
            <div className="bg-[#0b101d] border border-slate-900/80 p-4 rounded-xl space-y-2 text-xs">
              <div>
                <span className="text-[8px] font-bold text-slate-500 uppercase block">Triggering Root Cause</span>
                <span className="font-medium text-slate-300">{selectedIncident.rootCause}</span>
              </div>
              <div className="pt-2 border-t border-slate-900/60 flex justify-between items-center">
                <span className="text-slate-400">Affected Orchestrator Agent:</span>
                <span className="font-bold text-white">{selectedIncident.affectedAgent}</span>
              </div>
            </div>

            {/* Recovery Timeline Trace steps */}
            <div className="space-y-3">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Automatic Self-Healing Sequence Trace</span>
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {selectedIncident.steps.map((step, idx) => (
                  <div key={idx} className="flex gap-3 text-xs items-start">
                    <span className="w-4 h-4 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-[9px] shrink-0 font-mono mt-0.5">
                      {idx + 1}
                    </span>
                    <p className="text-slate-300 leading-normal">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recovery Summary */}
            <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-start gap-2.5">
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-300 leading-normal">
                <span className="font-bold text-emerald-400">Recovery Status:</span> {selectedIncident.recoveryTimeline}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-900/60 flex gap-2">
            <button
              onClick={handleSimulateFailover}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center justify-center gap-1.5 shadow"
            >
              <Play size={13} /> Trigger Failover Simulation
            </button>
            <button
              onClick={handleResetBreakers}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-950 border border-slate-900 text-slate-400 hover:text-white transition-all"
            >
              Reset Breakers
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
