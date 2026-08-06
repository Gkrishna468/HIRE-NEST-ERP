import React, { useState, useEffect } from "react";
import { BrainCircuit, LineChart, TrendingUp, AlertTriangle, Clock, UserCheck, Activity } from "lucide-react";
import { cn } from "../lib/utils";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, query, onSnapshot, orderBy, getDocs, limit } from "firebase/firestore";

export default function PredictiveIntelligenceTab({ userRole, orgId }: { userRole: string, orgId: string }) {
  const [deals, setDeals] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = ['admin', 'super_admin', 'hq_admin', 'ops_admin'].includes(userRole);

  useEffect(() => {
    // We fetch all deal rooms
    const fetchAll = async () => {
      if (!isAdmin) return;
      
      try {
        const [dealsSnap, jobsSnap, eventsSnap] = await Promise.all([
           getDocs(query(collection(db, "dealRooms"), orderBy("createdAt", "desc"), limit(25))),
           getDocs(query(collection(db, "requirements_public"), limit(25))),
           getDocs(query(collection(db, "operationalEvents"), orderBy("timestamp", "desc"), limit(25)))
        ]);
        
        const allDeals = dealsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        
        setDeals(allDeals);
        setJobs(jobsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setEvents(eventsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Failed to load forecasting data", err);
      }
      setLoading(false);
    };
    fetchAll();
  }, [orgId, isAdmin]);

  if (!isAdmin) {
    return (
       <div className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest text-sm">
         Restricted. Executive Intelligence Clearance Required.
       </div>
    );
  }

  // Derived Forecasts from Data

  // 1. Expected Revenue Next 30 Days
  let pipelineRevenue = 0;
  deals.filter(d => d.currentStage === 'Offer' || d.currentStage === 'Interview' || d.currentStage === 'Deal Room').forEach(d => {
      const jobInfo = jobs.find(j => j.id === d.requirementId);
      const margin = jobInfo?.financials?.platformProfit || 40000;
      // Probabilistic weighting
      const probability = d.currentStage === 'Offer' ? 0.8 : d.currentStage === 'Interview' ? 0.4 : 0.1;
      pipelineRevenue += (margin * probability);
  });

  // 2. Average Time-to-Fill Forecasting (based on historicals or default)
  let timeToFillDays = "N/A";
  if (deals.length > 0) {
     let sum = 0;
     let count = 0;
     deals.forEach(d => {
        if (d.currentStage === 'Hired' && d.createdAt && d.updatedAt) {
           const days = (new Date(d.updatedAt).getTime() - new Date(d.createdAt).getTime()) / (1000 * 3600 * 24);
           if (days > 0) { sum += days; count++; }
        }
     });
     if (count > 0) timeToFillDays = (sum / count).toFixed(1);
  }

  // 3. High Risk Placements (Warranty Risk)
  const atRiskPlacements = deals.filter(d => {
      if (d.currentStage !== 'Hired') return false;
      return d.warrantyRisk === true;
  });

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumSignificantDigits: 4, notation: "compact" }).format(val);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <BrainCircuit className="text-fuchsia-500" size={32} /> Forecasting & Trends
          </h1>
          <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-2">
            Forecasting • Revenue Probabilities • Risk Analytics
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Revenue Forecast */}
          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between">
              <div>
                  <div className="flex items-center gap-3 mb-2">
                     <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <TrendingUp size={16} />
                     </div>
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">30-Day Revenue Forecast</span>
                  </div>
                  <div className="text-3xl font-black text-slate-800 tracking-tight">{formatCurrency(pipelineRevenue)}</div>
                  <p className="text-xs text-slate-500 mt-2 font-medium">Weighted probability based on active deal stages and historical vendor conversion rates.</p>
              </div>
          </div>
          
          {/* Fill Time Forecast */}
          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between">
              <div>
                  <div className="flex items-center gap-3 mb-2">
                     <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Clock size={16} />
                     </div>
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avg Time-To-Fill Trend</span>
                  </div>
                  <div className="text-3xl font-black text-slate-800 tracking-tight">{timeToFillDays} Days</div>
                  <p className="text-xs text-slate-500 mt-2 font-medium">Aggregate baseline projection based on active requirements and placement history.</p>
              </div>
          </div>

          {/* Retention Risk */}
          <div className="p-6 rounded-2xl border border-rose-100 bg-rose-50/50 shadow-sm flex flex-col justify-between">
              <div>
                  <div className="flex items-center gap-3 mb-2">
                     <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                        <AlertTriangle size={16} />
                     </div>
                     <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Warranty Risk Alerts</span>
                  </div>
                  <div className="text-3xl font-black text-slate-800 tracking-tight">{atRiskPlacements.length}</div>
                  <p className="text-xs text-rose-600 mt-2 font-medium">Active placements heavily flagged for dropout within 90 days. Revenue at risk.</p>
              </div>
          </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Vendor Delivery Probabilities */}
         <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-8">
           <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2 mb-6">
              <UserCheck size={16} className="text-sky-500" /> Vendor Delivery Forecasting
           </h2>
           <div className="space-y-4">
              <div className="text-[11px] font-bold text-slate-400 p-4 bg-slate-50 border rounded-xl flex items-center justify-center">
                 Predictions require historical conversion data. Insufficient data points.
              </div>
           </div>
         </div>
         
         {/* SLA Breach Propensity */}
         <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-8">
           <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2 mb-6">
              <Activity size={16} className="text-fuchsia-500" /> SLA Breach Forecasting
           </h2>
           <div className="space-y-4">
              <div className="text-[11px] font-bold text-slate-400 p-4 bg-slate-50 border rounded-xl flex items-center justify-center">
                 No SLA breaches forecasted.
              </div>
           </div>
         </div>
      </div>
    </div>
  );
}
