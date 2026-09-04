import React, { useState } from "react";
import { 
  ShieldCheck, 
  Target, 
  AlertTriangle, 
  Scale, 
  ArrowUpRight, 
  TrendingUp, 
  Users, 
  Briefcase, 
  Award, 
  CheckCircle, 
  Percent,
  Clock,
  ThumbsUp,
  Search,
  BookOpen,
  Info
} from "lucide-react";
import { cn } from "../lib/utils";
import { Badge } from "../lib/Badge";
import { Button } from "../lib/Button";

interface TrustEntity {
  id: string;
  name: string;
  type: "candidate" | "vendor" | "client" | "requirement";
  score: number;
  grade: string;
  metrics: Record<string, string>;
  breakdown: Array<{ name: string; weight: number; score: number; pts: number }>;
  signals: Array<{ val: number; label: string; date: string }>;
  status: "HEALTHY" | "STABLE" | "WARNING";
  description: string;
}

export default function TrustEngineTab({ userRole, orgId }: { userRole: string, orgId: string }) {
  const isAdmin = ['admin', 'super_admin', 'hq_admin', 'ops_admin'].includes(userRole);
  const [activeTab, setActiveTab] = useState<"candidate" | "vendor" | "client" | "requirement">("candidate");
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);

  // High-fidelity database mapping candidates, requirements, vendors, and clients scorecards
  const trustEntities: TrustEntity[] = [
    // 1. Candidates
    {
      id: "cand_priya",
      name: "Priya Sharma (React Architect)",
      type: "candidate",
      score: 94,
      grade: "A+",
      metrics: { "Technical Overlap": "96%", "Timezone Match": "100%", "Profile Integrity": "95%", "Response SLA": "2.4h" },
      breakdown: [
        { name: "Technical Skill Vector Alignment", weight: 35, score: 96, pts: 33.6 },
        { name: "Timezone / Geographic Alignment", weight: 25, score: 100, pts: 25.0 },
        { name: "Background/Experience Verification", weight: 20, score: 90, pts: 18.0 },
        { name: "Sourcing turnaround & response speed", weight: 20, score: 87, pts: 17.4 }
      ],
      signals: [
        { val: 12, label: "Advanced State Machine Skill Verified", date: "June 25, 2026" },
        { val: 8, label: "Timezone overlap confirmed", date: "June 24, 2026" },
        { val: 5, label: "Initial phone screen cleared with 94%", date: "June 22, 2026" }
      ],
      status: "HEALTHY",
      description: "Sarah represents an exceptionally strong fit for modern React architectures. Traceable credentials confirmed via MailOS ingestion."
    },
    {
      id: "cand_john",
      name: "John Doe (Java Engineer)",
      type: "candidate",
      score: 76,
      grade: "B",
      metrics: { "Technical Overlap": "80%", "Timezone Match": "85%", "Profile Integrity": "90%", "Response SLA": "12h" },
      breakdown: [
        { name: "Technical Skill Vector Alignment", weight: 35, score: 80, pts: 28.0 },
        { name: "Timezone / Geographic Alignment", weight: 25, score: 85, pts: 21.25 },
        { name: "Background/Experience Verification", weight: 20, score: 90, pts: 18.0 },
        { name: "Sourcing turnaround & response speed", weight: 20, score: 45, pts: 9.0 }
      ],
      signals: [
        { val: 6, label: "Spring Boot overlap verified", date: "June 20, 2026" },
        { val: -10, label: "Delayed submission response (12h limit exceeded)", date: "June 18, 2026" }
      ],
      status: "WARNING",
      description: "Lacks specialized Typescript skills. Delayed communication times slightly penalize general reliability index."
    },

    // 2. Vendors
    {
      id: "vendor_techstaff",
      name: "TechStaff Inc (V-901)",
      type: "vendor",
      score: 96,
      grade: "A+",
      metrics: { "Sourcing SLA": "95%", "Response Time": "2.4h", "Interview Conv.": "91%", "Placement Ret.": "98%" },
      breakdown: [
        { name: "Submission Quality Vetting", weight: 30, score: 92, pts: 27.6 },
        { name: "Interview Conversion Success", weight: 25, score: 96, pts: 24.0 },
        { name: "SLA Timeline Adherence", weight: 20, score: 98, pts: 19.6 },
        { name: "Candidate 90-day Placement Warranty Retention", weight: 25, score: 98, pts: 24.5 }
      ],
      signals: [
        { val: 12, label: "Fast response (Avg 2.4 hours)", date: "June 26, 2026" },
        { val: 18, label: "SLA compliance achievement", date: "June 25, 2026" },
        { val: 9, label: "L1 interview conversions (3 matched)", date: "June 22, 2026" }
      ],
      status: "HEALTHY",
      description: "Tier-1 Preferred Vendor with impeccable history of on-time candidate dispatch and highest retention rates."
    },
    {
      id: "vendor_global",
      name: "Global IT Talent (V-212)",
      type: "vendor",
      score: 88,
      grade: "A",
      metrics: { "Sourcing SLA": "88%", "Response Time": "4.1h", "Interview Conv.": "85%", "Placement Ret.": "92%" },
      breakdown: [
        { name: "Submission Quality Vetting", weight: 30, score: 85, pts: 25.5 },
        { name: "Interview Conversion Success", weight: 25, score: 88, pts: 22.0 },
        { name: "SLA Timeline Adherence", weight: 20, score: 90, pts: 18.0 },
        { name: "Candidate 90-day Placement Warranty Retention", weight: 25, score: 92, pts: 23.0 }
      ],
      signals: [
        { val: 8, label: "Consistent submission profiles", date: "June 24, 2026" },
        { val: 14, label: "Active pipeline response high", date: "June 22, 2026" },
        { val: -2, label: "Candidate drop-out in initial stages", date: "June 19, 2026" }
      ],
      status: "STABLE",
      description: "Consistent supplier for generic requirements. Demonstrates high placement stability indices."
    },
    {
      id: "vendor_cloudscale",
      name: "CloudScale Recruiters (V-405)",
      type: "vendor",
      score: 71,
      grade: "C",
      metrics: { "Sourcing SLA": "71%", "Response Time": "12h", "Interview Conv.": "71%", "Placement Ret.": "80%" },
      breakdown: [
        { name: "Submission Quality Vetting", weight: 30, score: 71, pts: 21.3 },
        { name: "Interview Conversion Success", weight: 25, score: 71, pts: 17.75 },
        { name: "SLA Timeline Adherence", weight: 20, score: 65, pts: 13.0 },
        { name: "Candidate 90-day Placement Warranty Retention", weight: 25, score: 80, pts: 20.0 }
      ],
      signals: [
        { val: 5, label: "Initial match submitted", date: "June 25, 2026" },
        { val: -15, label: "SLA Violations on 72h submission rule", date: "June 23, 2026" },
        { val: -8, label: "Warranty replacement triggered on developer", date: "June 20, 2026" }
      ],
      status: "WARNING",
      description: "Undergoing performance review due to persistent communication latency. Under review for allocation restrictions."
    },

    // 3. Clients
    {
      id: "client_apex",
      name: "Apex Global (Enterprise)",
      type: "client",
      score: 94,
      grade: "A+",
      metrics: { "Feedback Speed": "2.4h", "Interview Booking": "92%", "Net-15 Compliance": "98%", "Offers Released": "88%" },
      breakdown: [
        { name: "Hiring Manager Review Responsiveness", weight: 35, score: 95, pts: 33.25 },
        { name: "Billing & Invoice Payment Promptness", weight: 30, score: 98, pts: 29.4 },
        { name: "Interview Booking Turnaround Speed", weight: 20, score: 92, pts: 18.4 },
        { name: "Deal Room Offer Conversion rate", weight: 15, score: 88, pts: 13.2 }
      ],
      signals: [
        { val: 15, label: "Invoice paid paid in 4 days (Goal: 15)", date: "June 26, 2026" },
        { val: 10, label: "Rapid feedback in 2.4 hours", date: "June 25, 2026" }
      ],
      status: "HEALTHY",
      description: "Exceptional partnership health score. Highly responsive reviews minimize candidate drop-outs."
    },

    // 4. Requirements
    {
      id: "req_react_dev",
      name: "Lead React Architect (Apex Global)",
      type: "requirement",
      score: 95,
      grade: "A+",
      metrics: { "JD Clarity": "100%", "Budget Range": "Optimal", "Client SLA": "95%", "Match Volume": "4 Profiles" },
      breakdown: [
        { name: "Requirement JD Completeness Vector", weight: 35, score: 100, pts: 35.0 },
        { name: "Market Salary Rate Competitiveness", weight: 25, score: 95, pts: 23.75 },
        { name: "Hiring Manager feedback velocity", weight: 20, score: 90, pts: 18.0 },
        { name: "Assigned Vendors Quality Index", weight: 20, score: 92, pts: 18.4 }
      ],
      signals: [
        { val: 10, label: "Clear technical scorecard provided", date: "June 25, 2026" },
        { val: 8, label: "Budget aligned with 90th percentile of market", date: "June 24, 2026" }
      ],
      status: "HEALTHY",
      description: "Requirement contains clear skill definitions. High market salary positioning ensures quick fills."
    }
  ];

  const filteredEntities = trustEntities.filter(e => e.type === activeTab);

  if (!isAdmin) {
    return (
       <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 font-bold uppercase tracking-widest text-sm bg-slate-950 h-screen">
         <AlertTriangle className="text-rose-500 mb-4 animate-pulse" size={48} />
         Restricted. HQ Clearance Security Credentials Required.
       </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-y-auto">
      
      {/* Header Panel */}
      <div className="bg-slate-900 border-b border-slate-800 px-8 py-6 shadow-xl flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-tight uppercase flex items-center gap-2">
              Trust & Recommendation Engine <span className="text-indigo-400 text-[10px] bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full uppercase font-mono tracking-widest font-black">Pillar 3</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-wider">Mathematics & Traceability Scorecards</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          {[
            { id: "candidate", label: "Candidates", icon: <Users size={12} /> },
            { id: "vendor", label: "Vendors", icon: <Award size={12} /> },
            { id: "client", label: "Clients", icon: <ThumbsUp size={12} /> },
            { id: "requirement", label: "Requirements", icon: <Briefcase size={12} /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setSelectedEntity(null);
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5",
                activeTab === tab.id 
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/15" 
                  : "text-slate-400 hover:text-white"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-8 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in duration-300">
        
        {/* Core Scorecards Grid & Side audit lineage */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Active Scorecards list */}
          <div className="lg:col-span-8 space-y-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Percent size={14} className="text-indigo-400" /> Grounded Scorecards ({filteredEntities.length})
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredEntities.map((ent) => (
                <div 
                  key={ent.id}
                  onClick={() => setSelectedEntity(selectedEntity === ent.id ? null : ent.id)}
                  className={cn(
                    "p-6 rounded-2xl border transition-all cursor-pointer relative group flex flex-col justify-between",
                    selectedEntity === ent.id 
                      ? "bg-indigo-950/25 border-indigo-500 shadow-xl shadow-indigo-500/5 scale-[1.02]" 
                      : "bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80",
                    ent.status === 'WARNING' && selectedEntity !== ent.id ? "border-amber-500/30 bg-amber-950/5" : ""
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-white group-hover:text-indigo-400 transition-colors">{ent.name}</h4>
                        {ent.status === 'WARNING' && <Badge variant="outline" className="text-[8px] uppercase font-mono tracking-wider border-amber-500/20 text-amber-400 bg-amber-500/5 px-2 py-0.5">WARNING</Badge>}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-2 font-medium leading-relaxed max-w-sm">{ent.description}</p>
                    </div>

                    <div className="text-right">
                      <div className={cn(
                        "text-3xl font-black tracking-tight",
                        ent.status === 'WARNING' ? 'text-amber-500' : 'text-emerald-400'
                      )}>
                        {ent.score}
                      </div>
                      <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest font-black">Trust Index</span>
                    </div>
                  </div>

                  {/* Curated Mini Metrics row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-6 pt-4 border-t border-slate-800/80">
                    {Object.entries(ent.metrics).map(([lbl, val]) => (
                      <div key={lbl} className="bg-slate-950 p-2 rounded border border-slate-800/40 text-center font-mono">
                        <span className="text-[7px] text-slate-500 uppercase tracking-wider block">{lbl}</span>
                        <span className="text-[10px] font-bold text-slate-200 mt-0.5 block">{val}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/50 flex justify-between items-center">
                    <span className="text-[9px] font-mono text-slate-500">GRADE: <span className="text-indigo-400 font-bold">{ent.grade}</span></span>
                    <span className="text-[9px] font-mono text-slate-400 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                      {selectedEntity === ent.id ? 'Click to collapse' : 'Inspect Lineage'} →
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* SLA Governance Section */}
            <div className="bg-slate-900 rounded-3xl border border-slate-800 p-8 shadow-xl mt-8">
              <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2 mb-6">
                <Target size={16} className="text-sky-400" /> Active SLA Tracking
              </h3>
              
              <div className="space-y-4 font-mono text-xs text-slate-300">
                {[
                  { item: "Job Created → Vendor Acknowledgment", limit: "24 hours", current: "Avg 4.2 hours", status: "HEALTHY", val: 88 },
                  { item: "Requirement → First Candidate Ingestion", limit: "72 hours", current: "Avg 48 hours", status: "HEALTHY", val: 78 },
                  { item: "Client Interview → Feedback Provided", limit: "48 hours", current: "Avg 56 hours (Breached by Globex Inc)", status: "BREACHED", val: 32 }
                ].map((sla, idx) => (
                  <div key={idx} className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
                    <div className="space-y-1">
                      <p className="font-bold text-white">{sla.item}</p>
                      <p className="text-[10px] text-slate-500">Limit Threshold: {sla.limit}</p>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                      <div className="text-right">
                        <span className="font-bold text-white block">{sla.current}</span>
                        <div className="w-24 bg-slate-900 rounded-full h-1 mt-1">
                          <div className={cn("h-full rounded-full", sla.status === 'HEALTHY' ? 'bg-emerald-500' : 'bg-rose-500')} style={{ width: `${sla.val}%` }} />
                        </div>
                      </div>
                      <Badge className={cn(
                        "text-[9px] font-bold tracking-widest",
                        sla.status === 'HEALTHY' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      )}>
                        {sla.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Mathematical lineage audit panel */}
          <div className="lg:col-span-4 flex flex-col justify-between">
            <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 h-full flex flex-col justify-between">
              
              {selectedEntity ? (
                (() => {
                  const ent = trustEntities.find(e => e.id === selectedEntity);
                  if (!ent) return null;
                  return (
                    <div className="space-y-6 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="border-b border-slate-800 pb-4 mb-4">
                          <span className="text-[8px] font-mono text-indigo-400 uppercase tracking-widest block">Audit lineage scorecard</span>
                          <h4 className="text-sm font-black text-white mt-1">{ent.name}</h4>
                          <p className="text-[10px] text-slate-400 font-mono mt-1">System grade: <span className="font-bold text-indigo-400">{ent.grade}</span></p>
                        </div>

                        {/* Exact Weights Formula breakdown list */}
                        <div className="space-y-4">
                          <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block mb-2 font-bold">Mathematical Weights Formulation</span>
                          <div className="space-y-3 font-mono text-[10px] text-slate-400">
                            {ent.breakdown.map((b, idx) => (
                              <div key={idx} className="p-3 bg-slate-950 rounded border border-slate-800/80">
                                <div className="flex justify-between font-bold text-slate-200 border-b border-slate-900 pb-1 mb-1">
                                  <span>{b.name}</span>
                                  <span className="text-indigo-400">{(b.pts).toFixed(1)} pts</span>
                                </div>
                                <div className="flex justify-between text-[8px] text-slate-500">
                                  <span>Weight: {b.weight}%</span>
                                  <span>Node Score: {b.score}/100</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Recent signals stream list */}
                        <div className="pt-6 border-t border-slate-800/80 mt-6 space-y-3">
                          <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block font-bold">Recent Behavior Adjustments</span>
                          <div className="space-y-2 font-mono text-[9px]">
                            {ent.signals.map((sig, idx) => (
                              <div key={idx} className="p-2 bg-slate-950 border border-slate-800/40 rounded flex items-center justify-between">
                                <span className={cn("font-bold", sig.val > 0 ? 'text-emerald-400' : 'text-rose-400')}>
                                  {sig.val > 0 ? `+${sig.val}` : sig.val} pts
                                </span>
                                <span className="text-slate-400 mx-2 text-right flex-1">{sig.label}</span>
                                <span className="text-slate-600 text-[8px] shrink-0">{sig.date}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-800 mt-6 flex items-center gap-2 p-3 bg-indigo-500/5 rounded-xl">
                        <Info size={14} className="text-indigo-400 shrink-0" />
                        <p className="text-[9px] font-mono text-slate-400 leading-relaxed">
                          All metrics are generated deterministically by the Decision Engine. Lineage values are persistent across database edges.
                        </p>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 my-16">
                  <BookOpen size={32} className="text-slate-700 mb-4" />
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Lineage Inactive</h4>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-xs">Select any scorecard card on the left to trace the exact mathematical weights and operational adjustments.</p>
                </div>
              )}

            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
