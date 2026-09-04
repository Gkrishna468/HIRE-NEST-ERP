import React, { useState, useEffect } from "react";
import { AlertCircle, RefreshCw, Trash2, ShieldAlert, ArrowRight, XCircle } from "lucide-react";

export default function DLQViewer() {
  const [dlqEvents, setDlqEvents] = useState<any[]>([
    {
      id: "dlq-1234",
      workflowId: "wf-error-991",
      eventType: "INTERVIEW_FEEDBACK_OVERDUE",
      error: "Network timeout communicating with Mailgun API",
      retries: 3,
      tenantId: "org-apex-123",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
    {
      id: "dlq-5511",
      workflowId: "wf-error-882",
      eventType: "VENDOR_SLA_BREACHED",
      error: "Missing required vendor escalation contact",
      retries: 3,
      tenantId: "org-global-88",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    }
  ]);

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="bg-rose-50 border border-rose-200 rounded-sm p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-rose-500 mt-0.5" />
        <div>
          <h3 className="text-sm font-bold text-rose-800">Dead Letter Queue (DLQ)</h3>
          <p className="text-xs text-rose-700 mt-1">
            Events listed here have exhausted all Temporal retries and require administrative intervention. 
            Once the underlying issue is resolved, they can be safely re-queued.
          </p>
        </div>
      </div>

      <div className="flex-1 bg-white border rounded-sm flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b flex justify-between items-center bg-slate-50/50">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center">
             Poison Messages ({dlqEvents.length})
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {dlqEvents.map(evt => (
            <div key={evt.id} className="border border-rose-100 bg-white rounded-sm overflow-hidden flex flex-col">
              <div className="p-3 bg-rose-50/30 flex justify-between items-center border-b border-rose-100">
                <div className="flex items-center gap-3">
                  <XCircle className="w-4 h-4 text-rose-500" />
                  <span className="text-xs font-bold text-slate-800">{evt.eventType}</span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">TENANT: {evt.tenantId}</span>
                </div>
                <div className="text-[10px] font-bold text-slate-500">{new Date(evt.timestamp).toLocaleString()}</div>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Fatal Error</div>
                  <div className="text-sm font-mono text-rose-600 bg-rose-50 p-2 rounded-sm border border-rose-100">
                    {evt.error}
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-2">
                  <div className="text-[10px] font-mono text-slate-500">WF ID: {evt.workflowId}</div>
                  <div className="text-[10px] font-mono text-slate-500">Retries Exhausted: {evt.retries}</div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-50">
                  <button className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 bg-slate-50 border border-slate-200 rounded-sm hover:bg-slate-100 flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Dismiss
                  </button>
                  <button className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-sm hover:bg-indigo-100 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Replay Event
                  </button>
                </div>
              </div>
            </div>
          ))}
          {dlqEvents.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <AlertCircle className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
              <p className="text-xs font-bold">No poisoned messages in DLQ.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
