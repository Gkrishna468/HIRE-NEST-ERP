import React, { useState } from "react";
import { Check, X, ShieldAlert, Bot } from "lucide-react";

export default function ApprovalQueue() {
  const [approvals] = useState<any[]>([
    {
      id: "app-11",
      actorId: "system:ai-agent:recruiter",
      tenantId: "org-apex",
      targetEntityId: "sub-12491",
      targetEntityType: "SUBMISSION",
      proposedAction: "REJECT_CANDIDATE",
      reasoning: "Candidate lacks 3 years of mandated SQL experience as per the vendor specification.",
      status: "PENDING_APPROVAL",
      timestamp: new Date().toISOString()
    }
  ]);

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-sm p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-500 mt-0.5" />
        <div>
          <h3 className="text-sm font-bold text-amber-800">Human-In-The-Loop (HITL) Gate</h3>
          <p className="text-xs text-amber-700 mt-1">
            Review state transitions proposed by AI agents. Agents are not permitted to mutate critical state boundaries without human authorization.
          </p>
        </div>
      </div>

      <div className="flex-1 bg-white border rounded-sm flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b flex justify-between items-center bg-slate-50/50">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center">
            Pending Escapements ({approvals.length})
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {approvals.map(req => (
            <div key={req.id} className="border border-slate-200 rounded-sm overflow-hidden flex flex-col">
              <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-mono font-bold text-slate-700">{req.actorId}</span>
                  <span className="ml-2 text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded uppercase font-bold tracking-widest">{req.tenantId}</span>
                </div>
                <div className="text-[10px] font-bold text-slate-400">{new Date(req.timestamp).toLocaleString()}</div>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex gap-8">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Proposed Action</div>
                    <div className="text-sm font-black text-rose-600">{req.proposedAction}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Target Entity</div>
                    <div className="text-sm font-mono text-slate-800">{req.targetEntityType} | {req.targetEntityId}</div>
                  </div>
                </div>
                
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">AI Reasoning</div>
                  <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-sm border border-slate-100 italic">
                    "{req.reasoning}"
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-white bg-slate-900 rounded-sm hover:bg-slate-800 flex items-center gap-2">
                    <Check className="w-4 h-4" /> Approve Action
                  </button>
                  <button className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-rose-600 bg-rose-50 border border-rose-200 rounded-sm hover:bg-rose-100 flex items-center gap-2">
                    <X className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
