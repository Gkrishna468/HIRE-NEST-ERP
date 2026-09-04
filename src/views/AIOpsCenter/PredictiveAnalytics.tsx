// src/views/AIOpsCenter/PredictiveAnalytics.tsx
import React, { useState, useEffect, useMemo } from "react";
import { 
  TrendingUp, 
  BarChart2, 
  Clock, 
  Percent, 
  IndianRupee, 
  Users, 
  ShieldAlert, 
  RotateCcw, 
  Camera, 
  Save, 
  SlidersHorizontal, 
  ArrowUpRight, 
  ArrowDownRight, 
  PlusCircle,
  FileSpreadsheet,
  AlertTriangle,
  Play
} from "lucide-react";
import { formatINR } from "../../lib/currency";
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  setDoc,
  orderBy,
  limit
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../lib/firebase";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from "recharts";

// Predictive metric schema representation
export interface SavedSimulationSnapshot {
  id: string;
  timestamp: string;
  parameters: {
    recruiterCount: number;
    targetLatencyHours: number;
    activeRequirementsCount: number;
  };
  predictions: {
    revenueForecast: number;
    slaBreachRisk: number;
    avgFulfillmentDays: number;
  };
  confidence: number;
}

// Requirement Level Forecasts
interface RequirementForecast {
  reqId: string;
  title: string;
  client: string;
  predictedFillDate: string;
  placementProbability: number;
  slaBreachRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommendedAction: string;
}

// Recruiter Level Forecasts
interface RecruiterForecast {
  recruiterId: string;
  name: string;
  capacityScore: number; // 0-100
  deliveryProbability: number; // %
  productivityTrend: "UP" | "STABLE" | "DOWN";
}

const INITIAL_REQ_FORECASTS: RequirementForecast[] = [
  {
    reqId: "req-091",
    title: "Lead Cloud Platform Architect",
    client: "TechCorp Systems",
    predictedFillDate: "July 18, 2026",
    placementProbability: 92,
    slaBreachRisk: "LOW",
    recommendedAction: "Verify current matching indices and lock in candidate interviews."
  },
  {
    reqId: "req-092",
    title: "Staff Go / Kubernetes Developer",
    client: "Initech Corp",
    predictedFillDate: "July 24, 2026",
    placementProbability: 58,
    slaBreachRisk: "CRITICAL",
    recommendedAction: "Attach GTM Marketer agent to source candidate lists from external developer networks."
  },
  {
    reqId: "req-093",
    title: "Senior Machine Learning Engineer",
    client: "InnovateLabs Ltd",
    predictedFillDate: "July 15, 2026",
    placementProbability: 84,
    slaBreachRisk: "MEDIUM",
    recommendedAction: "Shortlist partner bench candidate profiles."
  },
  {
    reqId: "req-094",
    title: "VP of Engineering (Strategic Search)",
    client: "GlobalFinance Corp",
    predictedFillDate: "August 04, 2026",
    placementProbability: 35,
    slaBreachRisk: "HIGH",
    recommendedAction: "Escalate to BDM Diana Prince to renegotiate notice periods with candidates."
  }
];

const INITIAL_RECRUITER_FORECASTS: RecruiterForecast[] = [
  { recruiterId: "rec-01", name: "Peter Parker", capacityScore: 88, deliveryProbability: 91, productivityTrend: "UP" },
  { recruiterId: "rec-02", name: "Clark Kent", capacityScore: 45, deliveryProbability: 74, productivityTrend: "STABLE" },
  { recruiterId: "rec-03", name: "Steve Rogers", capacityScore: 92, deliveryProbability: 82, productivityTrend: "UP" },
  { recruiterId: "rec-04", name: "Diana Prince", capacityScore: 30, deliveryProbability: 96, productivityTrend: "UP" }
];

// Recharts mock historical datasets
const HISTORICAL_FORECAST_DATA = [
  { month: "Jan", baseline: 120000, optimized: 145000 },
  { month: "Feb", baseline: 135000, optimized: 165000 },
  { month: "Mar", baseline: 150000, optimized: 195000 },
  { month: "Apr", baseline: 142000, optimized: 210000 },
  { month: "May", baseline: 160000, optimized: 245000 },
  { month: "Jun", baseline: 185000, optimized: 285000 },
  { month: "Jul", baseline: 195000, optimized: 320000 }
];

export default function PredictiveAnalytics() {
  const [snapshots, setSnapshots] = useState<SavedSimulationSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  // Simulation Lab parameter inputs
  const [recruiterCount, setRecruiterCount] = useState<number>(6);
  const [targetLatencyHours, setTargetLatencyHours] = useState<number>(24);
  const [activeRequirementsCount, setActiveRequirementsCount] = useState<number>(14);

  // Subscribe to predictive_metrics collection in Firestore
  useEffect(() => {
    const q = query(collection(db, "predictive_metrics"), orderBy("timestamp", "desc"), limit(20));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setSnapshots(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavedSimulationSnapshot)));
      } else {
        setSnapshots([]);
      }
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "predictive_metrics");
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Compute live predictions on simulation slider changes
  const computedPredictions = useMemo(() => {
    // Basic scaling logic matching recruiters, latency target, and active requirements
    const efficiencyFactor = recruiterCount / activeRequirementsCount;
    const latencyFactor = 24 / targetLatencyHours; // lower latency is better

    // Monthly revenue simulation
    const baseRevenue = 15000 * activeRequirementsCount;
    const revenueModifier = efficiencyFactor * 0.4 + latencyFactor * 0.6;
    const revenueForecast = Math.round(baseRevenue * Math.min(1.8, Math.max(0.6, revenueModifier)));

    // SLA breach risk Simulation (%)
    const baseBreach = 40;
    const breachModifier = activeRequirementsCount * 4 - recruiterCount * 6 - targetLatencyHours * 0.5;
    const slaBreachRisk = Math.min(99, Math.max(4, Math.round(baseBreach + breachModifier)));

    // Fulfillment Latency Days
    const baseFulfillmentDays = 28;
    const daysModifier = (activeRequirementsCount / recruiterCount) * 4 - (24 / targetLatencyHours) * 3;
    const avgFulfillmentDays = Math.min(60, Math.max(6, Math.round(baseFulfillmentDays + daysModifier)));

    return {
      revenueForecast,
      slaBreachRisk,
      avgFulfillmentDays
    };
  }, [recruiterCount, targetLatencyHours, activeRequirementsCount]);

  // Handle saving snapshot
  const handleSaveSnapshot = async () => {
    const id = `snap_${Math.random().toString(36).substring(2, 11)}`;
    const snapshot: SavedSimulationSnapshot = {
      id,
      timestamp: new Date().toISOString(),
      parameters: {
        recruiterCount,
        targetLatencyHours,
        activeRequirementsCount
      },
      predictions: {
        revenueForecast: computedPredictions.revenueForecast,
        slaBreachRisk: computedPredictions.slaBreachRisk,
        avgFulfillmentDays: computedPredictions.avgFulfillmentDays
      },
      confidence: 0.92
    };

    try {
      await setDoc(doc(db, "predictive_metrics", id), snapshot);
      
      // Emit corresponding Business event
      await addDoc(collection(db, "platform_events"), {
        id: `evt-forecast-${Date.now()}`,
        type: "FORECAST_SNAPSHOT_SAVED",
        timestamp: new Date().toISOString(),
        origin: "Predictive Intelligence Engine",
        status: "nominal",
        payload: {
          snapshotId: id,
          revenueForecast: computedPredictions.revenueForecast,
          slaBreachRisk: computedPredictions.slaBreachRisk
        }
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `predictive_metrics/${id}`);
    }
  };

  return (
    <div className="flex flex-col flex-1 gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-900 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="text-indigo-400" size={20} />
            <h2 className="text-lg font-black text-white">Predictive Analytics Layer</h2>
          </div>
          <p className="text-xs text-slate-400">Advanced pipeline modeling, demand forecasts, recruiter velocity projections, and interactive SLA risk labs.</p>
        </div>
        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full font-bold">
          Analytics Engine Active
        </span>
      </div>

      {/* SLA Simulation Lab Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sliders Control Panel */}
        <div className="lg:col-span-1 bg-[#070A13] border border-slate-900 rounded-2xl p-5 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
            <SlidersHorizontal size={14} className="text-indigo-400" />
            <span className="text-xs font-black text-white uppercase tracking-wider">SLA Simulation Lab</span>
          </div>

          <div className="space-y-4">
            {/* Slide 1: Recruiter count */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-400">Recruiter Headcount</span>
                <span className="font-mono text-indigo-400 font-bold">{recruiterCount} active</span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                value={recruiterCount}
                onChange={(e) => setRecruiterCount(Number(e.target.value))}
                className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <span className="text-[9px] text-slate-500 block leading-tight">Total recruiters allocated across the active pipeline.</span>
            </div>

            {/* Slide 2: SLA latency Target */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-400">Target Response Latency</span>
                <span className="font-mono text-indigo-400 font-bold">{targetLatencyHours} hours</span>
              </div>
              <input
                type="range"
                min="6"
                max="120"
                value={targetLatencyHours}
                onChange={(e) => setTargetLatencyHours(Number(e.target.value))}
                className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <span className="text-[9px] text-slate-500 block leading-tight">Maximum target duration allocated for recruiter check and submission milestones.</span>
            </div>

            {/* Slide 3: Active requirements count */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-400">Active Requirements</span>
                <span className="font-mono text-indigo-400 font-bold">{activeRequirementsCount} reqs</span>
              </div>
              <input
                type="range"
                min="1"
                max="50"
                value={activeRequirementsCount}
                onChange={(e) => setActiveRequirementsCount(Number(e.target.value))}
                className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <span className="text-[9px] text-slate-500 block leading-tight">Count of concurrent active requirements being fulfilled by our staffing engine.</span>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleSaveSnapshot}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/10"
            >
              <Save size={13} /> Save Forecast Snapshot
            </button>
          </div>
        </div>

        {/* Live Simulation Outputs */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-[#070A13] border border-slate-900 flex flex-col justify-between relative overflow-hidden group min-h-[160px]">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
            <div>
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Simulated Monthly Revenue</span>
              <h4 className="text-2xl font-black text-white mt-1.5 font-mono">{formatINR(computedPredictions.revenueForecast)}</h4>
              <span className="text-[9px] text-slate-500 mt-1 block">Projected revenue pipeline output</span>
            </div>
            <div className="flex items-center gap-1 text-[9px] text-emerald-400 font-bold mt-2">
              <ArrowUpRight size={12} />
              <span>Optimized Sourcing Curve</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#070A13] border border-slate-900 flex flex-col justify-between relative overflow-hidden min-h-[160px]">
            <div>
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">SLA Breach Probability</span>
              <h4 className={cn("text-2xl font-black mt-1.5 font-mono",
                computedPredictions.slaBreachRisk > 60 ? "text-rose-400 animate-pulse" :
                computedPredictions.slaBreachRisk > 30 ? "text-amber-400" : "text-emerald-400"
              )}>
                {computedPredictions.slaBreachRisk}%
              </h4>
              <span className="text-[9px] text-slate-500 mt-1 block">Overall risk profile projection</span>
            </div>
            <div className="flex items-center gap-1 text-[9px] text-slate-400 mt-2">
              <ShieldAlert size={10} className="text-indigo-400" />
              <span>Active risk threshold monitoring</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#070A13] border border-slate-900 flex flex-col justify-between relative overflow-hidden min-h-[160px]">
            <div>
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Fulfillment Latency</span>
              <h4 className="text-2xl font-black text-indigo-400 mt-1.5 font-mono">{computedPredictions.avgFulfillmentDays} Days</h4>
              <span className="text-[9px] text-slate-500 mt-1 block">Projected average placement speed</span>
            </div>
            <div className="flex items-center gap-1 text-[9px] text-slate-400 mt-2">
              <Clock size={10} className="text-indigo-400" />
              <span>Cycle-time predictive forecasts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Three-Level Expositions Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Requirement-Level Projections */}
        <div className="bg-[#070A13] border border-slate-900 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
            <BarChart2 size={14} className="text-indigo-400" />
            <span className="text-xs font-black text-white uppercase tracking-wider">Requirement-Level Forecasts</span>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {INITIAL_REQ_FORECASTS.map((rf) => (
              <div key={rf.reqId} className="p-3 bg-slate-950/60 border border-slate-900/80 rounded-xl space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="text-xs font-bold text-slate-200">{rf.title}</h5>
                    <span className="text-[9px] text-slate-500">{rf.client} • #{rf.reqId}</span>
                  </div>
                  <div className="text-right">
                    <span className={cn(
                      "text-[8px] font-bold uppercase px-2 py-0.5 rounded-full border block",
                      rf.slaBreachRisk === "LOW" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      rf.slaBreachRisk === "MEDIUM" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                      "bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse"
                    )}>
                      {rf.slaBreachRisk} Risk
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                  <div>Est Fill: <span className="font-bold text-slate-200">{rf.predictedFillDate}</span></div>
                  <div className="text-right">Prob: <span className="font-bold text-indigo-400 font-mono">{rf.placementProbability}%</span></div>
                </div>

                <div className="text-[9px] text-slate-500 italic pt-1">
                  💡 Action: {rf.recommendedAction}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recruiter-Level Capacity Projections */}
        <div className="bg-[#070A13] border border-slate-900 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
            <Users size={14} className="text-indigo-400" />
            <span className="text-xs font-black text-white uppercase tracking-wider">Recruiter-Level Projections</span>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {INITIAL_RECRUITER_FORECASTS.map((rec) => (
              <div key={rec.recruiterId} className="p-3 bg-slate-950/60 border border-slate-900/80 rounded-xl flex justify-between items-center">
                <div>
                  <h5 className="text-xs font-bold text-slate-200">{rec.name}</h5>
                  <span className="text-[9px] text-slate-500">ID: {rec.recruiterId}</span>
                </div>

                <div className="flex gap-4 text-center">
                  <div className="px-2">
                    <span className="text-[8px] text-slate-500 uppercase font-bold block mb-0.5">Capacity</span>
                    <span className="text-xs font-black font-mono text-indigo-400">{rec.capacityScore}%</span>
                  </div>
                  <div className="px-2 border-l border-slate-900">
                    <span className="text-[8px] text-slate-500 uppercase font-bold block mb-0.5">Delivery</span>
                    <span className="text-xs font-black font-mono text-emerald-400">{rec.deliveryProbability}%</span>
                  </div>
                  <div className="px-2 border-l border-slate-900">
                    <span className="text-[8px] text-slate-500 uppercase font-bold block mb-0.5">Productivity</span>
                    <span className={cn("text-[9px] font-bold uppercase",
                      rec.productivityTrend === "UP" ? "text-emerald-400" : "text-amber-400"
                    )}>{rec.productivityTrend}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Business Level: Multi-Month Area Forecast */}
      <div className="bg-[#070A13] border border-slate-900 rounded-2xl p-6 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-900 pb-3">
          <div className="flex items-center gap-2">
            <BarChart2 size={14} className="text-indigo-400" />
            <span className="text-xs font-black text-white uppercase tracking-wider font-mono">Business Revenue & Sourcing Projections</span>
          </div>
          <span className="text-[9px] uppercase font-bold text-slate-400">Baseline vs AI-Optimized Pipelines</span>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={HISTORICAL_FORECAST_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="baseline_grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="optimized_grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#101524" />
              <XAxis dataKey="month" stroke="#334155" fontSize={10} tickLine={false} />
              <YAxis stroke="#334155" fontSize={10} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: "#070A13", borderColor: "#1e293b", borderRadius: "12px" }}
                labelStyle={{ color: "#94a3b8", fontSize: "10px", fontWeight: "bold" }}
                itemStyle={{ fontSize: "11px" }}
              />
              <Area type="monotone" dataKey="baseline" name="Baseline Pipeline" stroke="#4f46e5" fillOpacity={1} fill="url(#baseline_grad)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="optimized" name="AI Optimized Platform Pipeline" stroke="#10b981" fillOpacity={1} fill="url(#optimized_grad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Saved Scenario Snapshots */}
      <div className="bg-[#070A13] border border-slate-900 rounded-2xl p-6 space-y-4">
        <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider block flex items-center gap-1"><FileSpreadsheet size={11} className="text-indigo-400" /> Preserved Forecast Snapshots ({snapshots.length})</span>
        
        {snapshots.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {snapshots.map((snap) => (
              <div key={snap.id} className="p-4 border border-slate-900 rounded-xl bg-slate-950/40 relative overflow-hidden space-y-2">
                <div className="flex justify-between items-center text-[10px] text-slate-500">
                  <span className="font-mono">{snap.id}</span>
                  <span>{new Date(snap.timestamp).toLocaleString()}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-1.5 border-t border-slate-900 text-xs">
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Inputs</span>
                    <div className="text-[10px] text-slate-300">Recruiters: {snap.parameters.recruiterCount}</div>
                    <div className="text-[10px] text-slate-300">Target SLA: {snap.parameters.targetLatencyHours} hrs</div>
                    <div className="text-[10px] text-slate-300">Active Reqs: {snap.parameters.activeRequirementsCount}</div>
                  </div>
                  
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Simulated Projections</span>
                    <div className="text-[10px] text-indigo-400 font-bold">Rev: {formatINR(snap.predictions.revenueForecast)}</div>
                    <div className="text-[10px] text-rose-400">Breach: {snap.predictions.slaBreachRisk}%</div>
                    <div className="text-[10px] text-slate-300">Latency: {snap.predictions.avgFulfillmentDays} days</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-28 flex flex-col items-center justify-center border border-dashed border-slate-900 rounded-xl">
            <span className="text-slate-600 text-[10px] uppercase font-bold">No Scenario Snapshots Saved</span>
          </div>
        )}
      </div>
    </div>
  );
}
