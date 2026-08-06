import React, { useState, useEffect } from 'react';
import { Clock, Search, Filter, Calendar, CheckSquare, Settings } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, getDocs, orderBy, where, limit } from 'firebase/firestore';
import { EmptyState } from '../components/EmptyState';

export default function TimesheetsTab() {
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTimesheets = async () => {
      try {
         const q = query(collection(db, "timesheets"), orderBy("periodEnd", "desc"), limit(50));
         const snap = await getDocs(q);
         const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
         setTimesheets(fetched);
      } catch (err) {
         console.error("No timesheets collection yet or permission denied", err);
         setTimesheets([]);
      } finally {
         setLoading(false);
      }
    };
    fetchTimesheets();
  }, []);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Clock className="text-indigo-600" /> Timesheet Management
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Review and approve contractor work hours before invoicing.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search by consultant..." 
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
            />
          </div>
          <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">
            <Settings size={16} />
            Period Config
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Approvals</p>
           <p className="text-2xl font-black text-amber-600 mt-1">{timesheets.filter(t => t.status === 'PENDING').length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Approved (This Period)</p>
           <p className="text-2xl font-black text-emerald-600 mt-1">{timesheets.filter(t => t.status === 'APPROVED').length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rejected / Disputed</p>
           <p className="text-2xl font-black text-rose-600 mt-1">{timesheets.filter(t => t.status === 'REJECTED').length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border-l-4 border-indigo-500 shadow-sm flex flex-col justify-center bg-indigo-50/30">
           <p className="text-xs font-black text-indigo-800 uppercase tracking-widest">Current Cycle</p>
           <p className="text-sm font-bold text-indigo-600 mt-1 flex items-center gap-2">
             <Calendar size={14} /> Nov 1 - Nov 15
           </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Timesheet Registry</h2>
          <div className="flex gap-2">
             <button className="px-3 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-600 uppercase tracking-widest hover:bg-slate-50">
               All
             </button>
             <button className="px-3 py-1 bg-amber-50 text-amber-700 rounded text-[10px] font-bold uppercase tracking-widest">
               Pending
             </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
             <div className="flex flex-col items-center justify-center h-full text-slate-400">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
               <p className="text-xs font-bold uppercase tracking-widest">Loading Timesheets...</p>
             </div>
          ) : timesheets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full max-w-xl mx-auto">
              <EmptyState
                icon={Clock}
                title="No timesheets submitted"
                description="Contractor timesheets will appear here once consultants log their hours. Use this dashboard to review and approve work hours before invoicing."
              />
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="p-3">Consultant / Vendor</th>
                  <th className="p-3">Client / Project</th>
                  <th className="p-3">Period</th>
                  <th className="p-3 text-right">Hours</th>
                  <th className="p-3 text-right">Status</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {timesheets.map(ts => (
                  <tr key={ts.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-sm text-slate-800">{ts.consultantName}</div>
                      <div className="text-xs text-slate-500">{ts.vendorName}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-sm text-slate-700">{ts.clientName}</div>
                      <div className="text-xs text-slate-500">{ts.projectName || 'General'}</div>
                    </td>
                    <td className="p-3 text-xs font-medium text-slate-600">
                      {ts.periodStart} - {ts.periodEnd}
                    </td>
                    <td className="p-3 text-right font-mono text-sm text-slate-800 font-bold">{ts.totalHours}</td>
                    <td className="p-3 text-right">
                       <span className="px-2 py-1 bg-amber-50 text-amber-700 font-bold text-[10px] uppercase tracking-widest rounded">
                         {ts.status}
                       </span>
                    </td>
                    <td className="p-3 text-center">
                       <button className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg shadow-sm">
                          <CheckSquare size={16} />
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
