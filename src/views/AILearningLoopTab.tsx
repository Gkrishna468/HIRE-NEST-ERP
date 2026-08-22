import React, { useState, useEffect } from "react";
import { BrainCircuit, ThumbsUp, ThumbsDown, GitMerge, Sparkles, RefreshCcw, ArrowRight } from "lucide-react";
import { cn } from "../lib/utils";
import { collection, getDocs, query, limit } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function AILearningLoopTab() {
  const [loading, setLoading] = useState(true);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({ rejectionCount: 0 });

  useEffect(() => {
    const fetchAIFeedback = async () => {
      try {
        const snap = await getDocs(query(collection(db, "aiFeedback"), limit(25)));
        const data: any[] = snap.docs.map(d => ({id: d.id, ...d.data()}));
        setFeedbacks(data.reverse()); // most recent first
        
        let rejectCount = 0;
        data.forEach(d => {
          if (d.action === 'REJECT') rejectCount++;
        });
        setMetrics({ rejectionCount: rejectCount });
      } catch(err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAIFeedback();
  }, []);

  if (loading) {
    return <div className="p-8 flex items-center justify-center font-bold text-slate-400 uppercase tracking-widest animate-pulse">Loading AI Subsystems...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 border-b border-indigo-500 pb-2 inline-block shadow-[inset_0_-2px_0_rgba(99,102,241,1)]">
            AI Feedback & Learning Loop
          </h1>
          <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-2">
            <BrainCircuit size={14} className="text-indigo-500" /> Neural Recalibration & Heuristic Adjustments
          </p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-200 transition-all flex items-center gap-2">
           <RefreshCcw size={14} /> Commit Weight Updates
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         
         {/* Live Feedback Stream */}
         <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
               <h3 className="font-bold text-slate-800 uppercase tracking-widest text-xs flex items-center gap-2">
                  <Sparkles size={14} className="text-indigo-500" /> Human-in-the-loop Stream
               </h3>
            </div>
            <div className="p-6 flex-1 space-y-4 max-h-[500px] overflow-y-auto">
               
               {feedbacks.length === 0 ? (
                  <p className="text-sm text-slate-500 italic p-4 text-center">No AI Feedback events recorded yet.</p>
               ) : feedbacks.map((fb) => (
                  <div key={fb.id} className={cn("p-4 rounded-xl border flex gap-4 items-start", fb.action === 'REJECT' ? 'bg-rose-50/50 border-rose-100' : 'bg-emerald-50/50 border-emerald-100')}>
                     <div className={cn("p-2 rounded-lg mt-0.5", fb.action === 'REJECT' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600')}>
                        {fb.action === 'REJECT' ? <ThumbsDown size={16} /> : <ThumbsUp size={16} />}
                     </div>
                     <div className="flex-1">
                        <div className="flex justify-between">
                           <p className="text-sm font-bold text-slate-800">{fb.candidateName || fb.candidateId || "Candidate"} <ArrowRight size={12} className="inline mx-1 text-slate-400" /> {fb.requirementName || fb.requirementId || "Requirement"}</p>
                           <span className="text-[10px] font-mono font-black text-slate-400">{fb.userId || "System"}</span>
                        </div>
                        <p className={cn("text-xs mt-2 font-medium italic", fb.action === 'REJECT' ? 'text-rose-700' : 'text-emerald-700')}>
                           "{fb.reason || "No explicit reason provided"}"
                        </p>
                     </div>
                  </div>
               ))}

            </div>
         </div>

         {/* Heuristic Recalibration */}
         <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl text-white p-6">
               <h3 className="font-bold text-slate-100 uppercase tracking-widest text-xs flex items-center gap-2 mb-6">
                  <GitMerge size={14} className="text-indigo-400" /> Proposed Recalibrations
               </h3>
               
               <div className="space-y-6 mt-4">
                  <div>
                     <div className="flex justify-between items-end mb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Base Skills Weight</span>
                        <div className="text-right">
                           <span className="text-[10px] text-slate-500 line-through mr-2">40%</span>
                           <span className="text-sm font-black text-indigo-400">38%</span>
                        </div>
                     </div>
                     <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                        <div className="bg-slate-500 h-full w-[40%]"></div>
                     </div>
                     <p className="text-[10px] text-slate-500 mt-2 italic border-l-2 border-slate-700 pl-2">Triggered by {metrics.rejectionCount} specific rejections citing over-indexing on keyword-stuffed resumes.</p>
                  </div>

                  <div>
                     <div className="flex justify-between items-end mb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Location Precision</span>
                        <div className="text-right">
                           <span className="text-[10px] text-slate-500 line-through mr-2">15%</span>
                           <span className="text-sm font-black text-emerald-400">22%</span>
                        </div>
                     </div>
                     <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                        <div className="bg-slate-500 h-full w-[15%]"></div>
                     </div>
                     <p className="text-[10px] text-slate-500 mt-2 italic border-l-2 border-slate-700 pl-2">Triggered by High Priority rejections from On-Site requirements.</p>
                  </div>
               </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
               <h4 className="text-xs font-black uppercase text-amber-800 tracking-widest mb-2">Safety Gate Warning</h4>
               <p className="text-xs text-amber-900/80 leading-relaxed">
                  Modifying base heuristic weights requires an AI Governance approval. The changes will be passed through the `aiGovernanceAuditor` prior to release to ensure core validity limits are preserved.
               </p>
            </div>
         </div>

      </div>
    </div>
  );
}
