import React from "react";
import { Clock, CheckCircle2, AlertTriangle, PlayCircle } from "lucide-react";

export default function SLAMonitor() {
  const slaWorkflows = [
    { type: "INTERVIEW_FEEDBACK_SLA", id: "wf-sla-1", tenant: "org-apex", entity: "int-0912", status: "TICKING", remainingHrs: 18 },
    { type: "VENDOR_SLA", id: "wf-sla-2", tenant: "org-global", entity: "req-771", status: "BREACHED", remainingHrs: -2 },
    { type: "CLIENT_FEEDBACK_SLA", id: "wf-sla-3", tenant: "org-startup", entity: "sub-110", status: "FULFILLED", remainingHrs: 0 },
  ];

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 border rounded-sm">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Active Trackers</div>
          <div className="text-3xl font-black text-slate-800">1,248</div>
        </div>
        <div className="bg-emerald-50 p-4 border border-emerald-100 rounded-sm">
          <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-2">Fulfilled (24h)</div>
          <div className="text-3xl font-black text-emerald-700">412</div>
        </div>
        <div className="bg-rose-50 p-4 border border-rose-100 rounded-sm">
          <div className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-2">Breaches (24h)</div>
          <div className="text-3xl font-black text-rose-700">6</div>
        </div>
      </div>

      <div className="flex-1 bg-white border rounded-sm flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b flex justify-between items-center bg-slate-50/50">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center">
            <Clock className="w-4 h-4 mr-2" /> Monitored SLAs
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 max-h-[600px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <th className="pb-3 px-2 font-bold">Type</th>
                <th className="pb-3 px-2 font-bold">Workflow ID</th>
                <th className="pb-3 px-2 font-bold">Tenant</th>
                <th className="pb-3 px-2 font-bold">Entity</th>
                <th className="pb-3 px-2 font-bold">Remaining</th>
                <th className="pb-3 px-2 font-bold right-0 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {slaWorkflows.map(sla => (
                <tr key={sla.id} className="border-b border-slate-50 hover:bg-slate-50 text-sm">
                  <td className="py-3 px-2 font-bold text-slate-800">{sla.type}</td>
                  <td className="py-3 px-2 font-mono text-slate-500 text-[10px]">{sla.id}</td>
                  <td className="py-3 px-2 font-mono text-slate-500 text-[10px]">{sla.tenant}</td>
                  <td className="py-3 px-2 font-mono text-slate-500 text-[10px]">{sla.entity}</td>
                  <td className="py-3 px-2 font-mono font-bold text-slate-700">{sla.remainingHrs > 0 ? `${sla.remainingHrs}h` : '--'}</td>
                  <td className="py-3 px-2 text-right">
                    {sla.status === "TICKING" && <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded uppercase font-bold tracking-widest flex items-center justify-end gap-1 w-max ml-auto"><PlayCircle className="w-3 h-3" /> TICKING</span>}
                    {sla.status === "BREACHED" && <span className="text-[10px] bg-rose-50 text-rose-600 px-2 py-0.5 rounded uppercase font-bold tracking-widest flex items-center justify-end gap-1 w-max ml-auto"><AlertTriangle className="w-3 h-3" /> BREACHED</span>}
                    {sla.status === "FULFILLED" && <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded uppercase font-bold tracking-widest flex items-center justify-end gap-1 w-max ml-auto"><CheckCircle2 className="w-3 h-3" /> FULFILLED</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
