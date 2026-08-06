import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Filter, ShieldAlert, CheckCircle2, History, AlertTriangle, Fingerprint } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, query, getDocs, orderBy, getDoc, doc, where, limit } from 'firebase/firestore';
import { EmptyState } from '../components/EmptyState';

export default function OwnershipLedgerTab() {
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLedger = async () => {
      try {
         let filterOrgId = null;
         if (auth.currentUser) {
            const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
            if (userDoc.exists()) {
               const data = userDoc.data();
               const r = data.role || "";
               if (r.includes('vendor') || r.includes('recruiter')) filterOrgId = data.organizationId;
            }
         }
         
         let q: any = collection(db, "ownership_claims");
         if (filterOrgId && filterOrgId !== "ORG-GLOBAL-HQ") {
            q = query(q, where("vendorId", "==", filterOrgId), limit(50));
            // Firestore might need index if combining where + orderBy. So just where initially.
         } else {
            q = query(q, orderBy("claimedAt", "desc"), limit(50));
         }
         
         const snap = await getDocs(q);
         const fetched = snap.docs.map(document => ({ id: document.id, ...(document.data() as any) }));
         setLedgerEntries(fetched);
      } catch (err) {
         console.error("No candidate_ownership collection yet or permission denied", err);
         setLedgerEntries([]);
      } finally {
         setLoading(false);
      }
    };
    fetchLedger();
  }, []);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <BookOpen className="text-indigo-600" /> Candidate Ownership
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Immutable register of candidate ownership rights, time windows, and submission timestamps.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search by candidate name or hash..." 
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64 md:w-80"
            />
          </div>
          <button className="bg-slate-900 flex items-center gap-2 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200">
            <ShieldAlert size={16} />
            Resolve Dispute
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Ownerships</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{ledgerEntries.filter(l => l.status === 'ACTIVE').length}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 size={18} />
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expired Window</p>
            <p className="text-2xl font-black text-slate-400 mt-1">{ledgerEntries.filter(l => l.status === 'EXPIRED').length}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
            <History size={18} />
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-rose-100 bg-rose-50/30 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Ownership Disputes</p>
            <p className="text-2xl font-black text-rose-700 mt-1">{ledgerEntries.filter(l => l.status === 'DISPUTED').length}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
            <AlertTriangle size={18} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Universal Candidate Registry</h2>
          <button className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-xs font-bold uppercase tracking-widest">
             <Filter size={14} /> View History
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
             <div className="flex flex-col items-center justify-center h-full text-slate-400">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
               <p className="text-xs font-bold uppercase tracking-widest">Verifying ledger integrity...</p>
             </div>
          ) : ledgerEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full max-w-xl mx-auto">
              <EmptyState
                icon={BookOpen}
                title="Ledger is empty"
                description="Candidate ownership records are immutably written here when a candidate is first submitted to the platform. No candidate claims exist yet."
              />
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="p-3">Candidate Asset</th>
                  <th className="p-3">First Submitter (Owner)</th>
                  <th className="p-3">Submission Timestamp (UTC)</th>
                  <th className="p-3">Client Assignment</th>
                  <th className="p-3">Ownership Window</th>
                  <th className="p-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.map(entry => {
                  const now = new Date();
                  const windowEnd = entry.expiresAt?.toDate ? entry.expiresAt.toDate() : new Date(entry.expiresAt || Date.now() + 180 * 24 * 60 * 60 * 1000);
                  const claimedAt = entry.claimedAt?.toDate ? entry.claimedAt.toDate() : new Date(entry.claimedAt || Date.now());
                  const daysRemaining = Math.max(0, Math.floor((windowEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                  const isSoonExpired = daysRemaining < 15;
                  
                  return (
                  <tr key={entry.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
                        {entry.candidateName || entry.candidateHash?.slice(0,8)}
                        {entry.isMasked && <span className="bg-slate-100 text-slate-500 text-[8px] px-1 py-0.5 rounded uppercase tracking-wider tooltip">Masked</span>}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                        <Fingerprint size={10} /> Hash: {entry.candidateHash?.slice(0, 16)}...
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-sm text-indigo-700">{entry.vendorName || entry.vendorId}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <ShieldAlert size={10} /> Primary Claimant
                      </div>
                    </td>
                    <td className="p-3 font-mono text-xs font-medium text-slate-600">
                      {claimedAt.toLocaleString()}
                    </td>
                    <td className="p-3 text-xs font-bold text-slate-700">
                       Global (Not Job Specific)
                    </td>
                    <td className="p-3">
                       <span className="text-xs font-medium text-slate-600">
                           Extended up to {windowEnd.toLocaleDateString()}
                       </span>
                       <div className={`text-[10px] uppercase font-bold mt-1 ${isSoonExpired ? 'text-amber-500' : 'text-emerald-500'}`}>
                         {daysRemaining} Days Remaining
                       </div>
                    </td>
                    <td className="p-3 text-right">
                       <span className={`px-2 py-1 font-bold text-[10px] uppercase tracking-widest rounded ${
                          entry.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' :
                          entry.status === 'DISPUTED' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          'bg-slate-50 text-slate-500'
                       }`}>
                         {entry.status || 'ACTIVE'}
                       </span>
                       {entry.status === 'DISPUTED' && (
                         <div className="text-[8px] text-rose-500 mt-1 uppercase font-bold tracking-wider animate-pulse">
                           Dispute Opened
                         </div>
                       )}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
