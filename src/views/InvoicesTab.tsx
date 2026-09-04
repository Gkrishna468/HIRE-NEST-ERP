import React, { useState, useEffect } from 'react';
import { Receipt, Search, Download, CreditCard, ExternalLink, Filter, FileText, Calculator } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, query, getDocs, orderBy, getDoc, doc, where, limit } from 'firebase/firestore';
import { EmptyState } from '../components/EmptyState';
import { EntityName } from '../components/EntityName';
import { formatINR } from '../lib/currency';

export default function InvoicesTab() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'AR' | 'AP'>('AR');

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
         let filterOrgId = null;
         let roleStr = "";
         if (auth.currentUser) {
            const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
            if (userDoc.exists()) {
               const data = userDoc.data();
               roleStr = data.role || "";
               if (!roleStr.includes('admin') && roleStr !== 'super_admin' && roleStr !== 'ops_admin') {
                  filterOrgId = data.organizationId;
               }
            }
         }
         
         let q = (collection(db, "invoices") as any);
         if (filterOrgId && filterOrgId !== "ORG-GLOBAL-HQ") {
            if (roleStr.includes('client')) {
               q = query(q, where("clientId", "==", filterOrgId), limit(50));
            } else {
               q = query(q, where("vendorId", "==", filterOrgId), limit(50));
            }
         } else {
            q = query(q, orderBy("createdAt", "desc"), limit(50));
         }
         
         const snap = await getDocs(q);
         const fetched = snap.docs.map(document => ({ id: document.id, ...(document.data() as any) }));
         
         // Demo data if empty, so the user can see the GST/margin functionality in action if they don't have records yet
         if (fetched.length === 0) {
            fetched.push({
               id: 'INV-DEMO-1',
               invoiceId: 'INV-2023-001',
               clientId: 'CLI-001',
               vendorId: 'VEN-001',
               type: 'RECEIVABLE',
               issueDate: '2023-10-01',
               dueDate: '2023-10-31',
               amountINR: 230000,
               vendorRateINR: 210000,
               gstPercent: 18,
               tdsPercent: 10,
               status: 'SENT',
               hsnCode: '998311',
               paymentTerms: 'Net30'
            });
         }
         
         setInvoices(fetched);
      } catch (err) {
         console.error("No invoices collection yet or permission denied", err);
         setInvoices([]);
      } finally {
         setLoading(false);
      }
    };
    fetchInvoices();
  }, []);

  const getFilteredInvoices = () => {
    return invoices.filter(inv => activeTab === 'AR' ? (inv.type !== 'PAYABLE') : (inv.type === 'PAYABLE' || inv.vendorRateINR > 0));
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Receipt className="text-indigo-600" /> FinanceOS Engine
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Full revenue recognition lifecycle, GST tracking, Gross Margins, and settlements (INR).</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-bold">
            <span>₹ Indian Rupees (INR)</span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search by invoice ID..." 
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
            />
          </div>
          <button className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200">
            Generate Run
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
           <Calculator className="absolute -right-4 -bottom-4 text-slate-100" size={80} />
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">Uncollected Revenue (AR)</p>
           <p className="text-2xl font-black text-slate-800 mt-1 relative z-10">
             {formatINR(invoices.filter(i => i.status === 'SENT' || i.status === 'OVERDUE').reduce((acc, i) => acc + (i.amountINR || i.amount || 0), 0))}
           </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">Total Gross Margin (YTD)</p>
           <p className="text-2xl font-black text-indigo-600 mt-1 relative z-10">
             {formatINR(invoices.reduce((acc, i) => {
                const clientRate = i.amountINR || i.amount || 0;
                const vendorRate = i.vendorRateINR || 0;
                return acc + (clientRate - vendorRate);
             }, 0))}
           </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">Pending Vendor Settlements (AP)</p>
           <p className="text-2xl font-black text-amber-600 mt-1 relative z-10">
             {formatINR(invoices.reduce((acc, i) => acc + (i.vendorRateINR || 0), 0))}
           </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">Total Collected</p>
           <p className="text-2xl font-black text-emerald-600 mt-1 relative z-10">
             {formatINR(invoices.filter(i => i.status === 'PAID').reduce((acc, i) => acc + (i.amountINR || i.amount || 0), 0))}
           </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex gap-6">
             <button 
                onClick={() => setActiveTab('AR')}
                className={`text-sm font-black uppercase tracking-widest border-b-2 pb-1 transition-colors ${activeTab === 'AR' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
             >
                Client Invoices (AR)
             </button>
             <button 
                onClick={() => setActiveTab('AP')}
                className={`text-sm font-black uppercase tracking-widest border-b-2 pb-1 transition-colors ${activeTab === 'AP' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
             >
                Vendor Settlements (AP)
             </button>
          </div>
          <button className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-xs font-bold uppercase tracking-widest">
             <Filter size={14} /> Filter
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
             <div className="flex flex-col items-center justify-center h-full text-slate-400">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
               <p className="text-xs font-bold uppercase tracking-widest">Loading ledgers...</p>
             </div>
          ) : getFilteredInvoices().length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full max-w-xl mx-auto">
              <EmptyState
                icon={Receipt}
                title="No invoices found"
                description="Your accounting ledger is clear. Invoices will automatically appear here once placements are marked as joined or timesheets are approved."
                actionLabel="Create Manual Invoice"
                onAction={() => alert('Manual invoice creation process initiated')}
              />
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="p-3">Invoice #</th>
                  <th className="p-3">Client / Vendor</th>
                  <th className="p-3">Dates</th>
                  <th className="p-3 text-right">Gross Billing</th>
                  <th className="p-3 text-right">Vendor Payout</th>
                  <th className="p-3 text-right">Margin / Tax</th>
                  <th className="p-3 text-right">Status</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {getFilteredInvoices().map(inv => {
                   const clientRate = inv.amountINR || inv.amount || 0;
                   const vendorRate = inv.vendorRateINR || 0;
                   const grossMargin = clientRate - vendorRate;
                   const gstAmount = (clientRate * (inv.gstPercent || 0)) / 100;

                   return (
                     <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                       <td className="p-3">
                         <div className="font-mono text-xs font-bold text-indigo-600">{inv.invoiceId || inv.id}</div>
                         {inv.hsnCode && <div className="text-[10px] text-slate-400 font-mono mt-1">HSN: {inv.hsnCode}</div>}
                       </td>
                       <td className="p-3">
                         <div className="font-bold text-xs text-slate-800 uppercase">
                           <EntityName id={inv.clientId} type="client" fallback="Client" />
                         </div>
                         <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                           via <EntityName id={inv.vendorId} type="vendor" fallback="Vendor" />
                         </div>
                       </td>
                       <td className="p-3 text-xs text-slate-500">
                         <div>Iss: {inv.issueDate || 'Pending'}</div>
                         <div className="font-bold text-slate-700 mt-1">Due: {inv.dueDate || inv.paymentTerms || 'Net30'}</div>
                       </td>
                       <td className="p-3 text-right">
                         <div className="font-mono text-sm font-black text-slate-800">{formatINR(clientRate)}</div>
                       </td>
                       <td className="p-3 text-right">
                         <div className="font-mono text-sm font-bold text-slate-500">{formatINR(vendorRate)}</div>
                       </td>
                       <td className="p-3 text-right">
                         <div className="font-mono text-xs font-black text-emerald-600 mb-1">{formatINR(grossMargin)}</div>
                         {inv.gstPercent > 0 && (
                            <div className="text-[10px] font-bold text-slate-400">+ {inv.gstPercent}% GST ({formatINR(gstAmount)})</div>
                         )}
                         {inv.tdsPercent > 0 && (
                            <div className="text-[10px] font-bold text-slate-400">- {inv.tdsPercent}% TDS</div>
                         )}
                       </td>
                       <td className="p-3 text-right">
                          <span className={`px-2 py-1 font-bold text-[10px] uppercase tracking-widest rounded ${
                             inv.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                             inv.status === 'OVERDUE' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                             'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {inv.status || 'PENDING'}
                          </span>
                       </td>
                       <td className="p-3 text-center flex justify-center gap-2">
                          <button className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors" title="Download PDF">
                             <FileText size={14} />
                          </button>
                          <button className="p-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg shadow-sm" title="View Details">
                             <ExternalLink size={14} />
                          </button>
                       </td>
                     </tr>
                   );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
