import React, { useState, useEffect } from 'react';
import { FileText, Search, Plus, FileSignature, ShieldCheck, Download, Filter } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';

export default function ContractsTab() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real database, we'd fetch from a 'contracts' collection
    // We simulate the fetching delay but only use real data if it exists.
    const fetchContracts = async () => {
      try {
         const q = query(collection(db, "contracts"), orderBy("createdAt", "desc"), limit(50));
         const snap = await getDocs(q);
         const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
         setContracts(fetched);
      } catch (err) {
         console.error("No contracts collection yet or permission denied", err);
         setContracts([]);
      } finally {
         setLoading(false);
      }
    };
    fetchContracts();
  }, []);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <FileText className="text-indigo-600" /> Contract Lifecycle
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Manage NDAs, MSAs, and SOWs across clients and vendors.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search contracts..." 
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
            />
          </div>
          <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors">
            <Plus size={16} />
            New Contract
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active MSAs</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{contracts.filter(c => c.type === 'MSA' && c.status === 'ACTIVE').length}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
            <FileSignature size={18} />
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Signed NDAs</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{contracts.filter(c => c.type === 'NDA' && c.status === 'SIGNED').length}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
            <ShieldCheck size={18} />
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Signatures</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{contracts.filter(c => c.status === 'PENDING').length}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
            <FileText size={18} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Contract Repository</h2>
          <button className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-xs font-bold uppercase tracking-widest">
             <Filter size={14} /> Filter
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-xs font-bold uppercase tracking-widest">Loading Contracts...</p>
            </div>
          ) : contracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
              <FileSignature size={48} className="text-slate-200" />
              <p className="text-sm font-medium">No contracts found in the database.</p>
              <button className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50">
                Upload First Contract
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest uppercase">
                  <th className="p-3">Entity</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Effective Date</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map(contract => (
                  <tr key={contract.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-sm text-slate-800">{contract.entityName}</div>
                      <div className="text-xs text-slate-500">{contract.entityType}</div>
                    </td>
                    <td className="p-3 font-medium text-xs text-slate-600">{contract.type}</td>
                    <td className="p-3">
                      <span className="px-2 py-1 bg-emerald-50 text-emerald-700 font-bold text-[10px] uppercase tracking-widest rounded">
                        {contract.status}
                      </span>
                    </td>
                    <td className="p-3 text-xs font-medium text-slate-600">{contract.effectiveDate || 'N/A'}</td>
                    <td className="p-3 text-right">
                       <button className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 hover:border-indigo-200 shadow-sm">
                          <Download size={14} />
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
