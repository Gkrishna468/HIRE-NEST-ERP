import React, { useState, useEffect } from "react";
import { TrendingUp, DollarSign, Receipt, CreditCard, PieChart, Activity, Building2, Calendar, FileText, CheckCircle2, AlertCircle, ArrowUpRight, ArrowDownRight, Clock, Plus } from "lucide-react";
import { collection, query, limit, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { cn } from "../lib/utils";
import { formatINR } from "../lib/currency";

export default function FinanceOSTab({ userRole }: { userRole: string }) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [placements, setPlacements] = useState<any[]>([]);
  
  const [clients, setClients] = useState<Record<string, any>>({});
  const [vendors, setVendors] = useState<Record<string, any>>({});

  useEffect(() => {
    const unsubInvoices = onSnapshot(collection(db, "invoices"), (snap) => {
      setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubPayouts = onSnapshot(collection(db, "vendor_payouts"), (snap) => {
      setPayouts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubPlacements = onSnapshot(collection(db, "placements"), (snap) => {
      setPlacements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    // Load clients and vendors for mapping IDs to Names
    const fetchEntities = async () => {
        try {
            const [clientsSnap, vendorsSnap] = await Promise.all([
                getDocs(query(collection(db, "clients"), limit(25))),
                getDocs(query(collection(db, "vendors"), limit(25)))
            ]);
            
            const clientMap: Record<string, any> = {};
            clientsSnap.forEach(d => clientMap[d.id] = d.data());
            setClients(clientMap);
            
            const vendorMap: Record<string, any> = {};
            vendorsSnap.forEach(d => vendorMap[d.id] = d.data());
            setVendors(vendorMap);
        } catch (e) {
            console.error("Failed to load entities for mapping", e);
        }
    };
    fetchEntities();

    return () => { unsubInvoices(); unsubPayouts(); unsubPlacements(); };
  }, []);

  const totalRevenue = invoices.filter(i => i.status === 'PAID').reduce((acc, i) => acc + (i.amount || 0), 0);
  const outstandingInvoices = invoices.filter(i => i.status === 'ISSUED' || i.status === 'OVERDUE' || i.status === 'PENDING').reduce((acc, i) => acc + (i.amount || 0), 0);
  const totalPayouts = payouts.filter(p => p.status === 'PAID').reduce((acc, p) => acc + (p.amount || 0), 0);
  const pendingPayouts = payouts.filter(p => p.status === 'PENDING' || p.status === 'PROCESSING').reduce((acc, p) => acc + (p.amount || 0), 0);
  
  const margin = totalRevenue - totalPayouts;
  const marginPercentage = totalRevenue > 0 ? ((margin / totalRevenue) * 100).toFixed(1) : "0.0";
  
  const gstPayable = totalRevenue * 0.18; // 18% GST on INR collected

  const formatMoney = (amount: number) => {
    return formatINR(amount);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
      <div className="px-8 py-8 border-b bg-white flex justify-between items-end sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">FinanceOS</h1>
          <p className="text-sm text-slate-500 mt-1">Unified revenue collection, margin tracking, and vendor settlements (INR).</p>
        </div>
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm">
          ₹ Indian Rupees (INR)
        </div>
      </div>

      <div className="p-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white p-5 border rounded-xl shadow-sm">
             <div className="flex items-center justify-between mb-4">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Revenue Collected</div>
                <DollarSign className="w-4 h-4 text-emerald-500" />
             </div>
             <div className="text-2xl font-black text-emerald-600">{formatMoney(totalRevenue)}</div>
             <div className="text-xs text-slate-500 mt-1">Paid Invoices</div>
          </div>
          <div className="bg-white p-5 border rounded-xl shadow-sm">
             <div className="flex items-center justify-between mb-4">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Outstanding AR</div>
                <Receipt className="w-4 h-4 text-amber-500" />
             </div>
             <div className="text-2xl font-black text-amber-600">{formatMoney(outstandingInvoices)}</div>
             <div className="text-xs text-slate-500 mt-1">Pending Collection</div>
          </div>
          <div className="bg-white p-5 border rounded-xl shadow-sm">
             <div className="flex items-center justify-between mb-4">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vendor Payouts</div>
                <CreditCard className="w-4 h-4 text-indigo-500" />
             </div>
             <div className="text-2xl font-black text-slate-800">{formatMoney(totalPayouts)}</div>
             <div className="text-xs text-slate-500 mt-1">Settled</div>
          </div>
          <div className="bg-white p-5 border rounded-xl shadow-sm">
             <div className="flex items-center justify-between mb-4">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pending Payables</div>
                <Clock className="w-4 h-4 text-rose-500" />
             </div>
             <div className="text-2xl font-black text-slate-800">{formatMoney(pendingPayouts)}</div>
             <div className="text-xs text-slate-500 mt-1">Awaiting Settlement</div>
          </div>
          <div className="bg-white p-5 border rounded-xl shadow-sm">
             <div className="flex items-center justify-between mb-4">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">GST Payable</div>
                <AlertCircle className="w-4 h-4 text-rose-500" />
             </div>
             <div className="text-2xl font-black text-rose-600">{formatMoney(gstPayable)}</div>
             <div className="text-xs text-slate-500 mt-1">On collected revenue</div>
          </div>
          <div className="bg-white p-5 border border-indigo-100 rounded-xl shadow-sm bg-gradient-to-br from-indigo-50 to-white">
             <div className="flex items-center justify-between mb-4">
                <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Gross Margin</div>
                <PieChart className="w-4 h-4 text-indigo-600" />
             </div>
             <div className="text-2xl font-black text-indigo-700">{marginPercentage}%</div>
             <div className="text-xs text-indigo-500 mt-1">{formatMoney(margin)} realized</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           {/* Invoices Ledger */}
           <div className="bg-white border rounded-xl overflow-hidden shadow-sm flex flex-col min-h-[400px]">
              <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
                 <h2 className="text-sm font-bold text-slate-800 flex items-center">
                   <FileText className="w-4 h-4 mr-2 text-slate-400" /> Client Invoices (AR)
                 </h2>
                 <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg flex items-center"><Plus size={14} className="mr-1" /> New Invoice</button>
              </div>
              <div className="p-0 overflow-y-auto flex-1">
                 {invoices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
                       <Receipt className="w-8 h-8 mb-3 opacity-20" />
                       <p className="text-sm">No invoices generated yet</p>
                    </div>
                 ) : (
                    <table className="w-full text-left border-collapse">
                       <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                             <th className="py-3 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Client</th>
                             <th className="py-3 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                             <th className="py-3 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                             <th className="py-3 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Due Date</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {invoices.map(inv => (
                             <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-3 px-6">
                                   <div className="text-sm font-bold text-slate-800">
                                       {clients[inv.clientId]?.companyName || clients[inv.clientId]?.name || (inv.clientId ? inv.clientId.substring(0,8) + '...' : 'Unknown')}
                                   </div>
                                   <div className="text-xs text-slate-500">INV-{inv.id.substring(0,6).toUpperCase()}</div>
                                </td>
                                <td className="py-3 px-6 text-sm font-medium text-slate-800">{formatMoney(inv.amount || 0)}</td>
                                <td className="py-3 px-6">
                                   <span className={cn(
                                      "text-[10px] px-2 py-1 rounded-sm font-bold uppercase tracking-wider",
                                      inv.status === 'PAID' ? "bg-emerald-100 text-emerald-700" :
                                      inv.status === 'OVERDUE' ? "bg-rose-100 text-rose-700" :
                                      "bg-amber-100 text-amber-700"
                                   )}>
                                      {inv.status || 'PENDING'}
                                   </span>
                                </td>
                                <td className="py-3 px-6 text-sm text-slate-500">
                                   {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : 'N/A'}
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 )}
              </div>
           </div>

           {/* Vendor Payouts */}
           <div className="bg-white border rounded-xl overflow-hidden shadow-sm flex flex-col min-h-[400px]">
              <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
                 <h2 className="text-sm font-bold text-slate-800 flex items-center">
                   <Building2 className="w-4 h-4 mr-2 text-slate-400" /> Vendor Payouts (AP)
                 </h2>
                 <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg flex items-center"><Plus size={14} className="mr-1" /> Run Payouts</button>
              </div>
              <div className="p-0 overflow-y-auto flex-1">
                 {payouts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
                       <CreditCard className="w-8 h-8 mb-3 opacity-20" />
                       <p className="text-sm">No vendor payouts scheduled</p>
                    </div>
                 ) : (
                    <table className="w-full text-left border-collapse">
                       <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                             <th className="py-3 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vendor</th>
                             <th className="py-3 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                             <th className="py-3 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                             <th className="py-3 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Scheduled</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {payouts.map(p => (
                             <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-3 px-6">
                                   <div className="text-sm font-bold text-slate-800">
                                       {vendors[p.vendorId]?.companyName || vendors[p.vendorId]?.name || (p.vendorId ? p.vendorId.substring(0,8) + '...' : 'Unknown')}
                                   </div>
                                   <div className="text-xs text-slate-500">PAY-{p.id.substring(0,6).toUpperCase()}</div>
                                </td>
                                <td className="py-3 px-6 text-sm font-medium text-slate-800">{formatMoney(p.amount || 0)}</td>
                                <td className="py-3 px-6">
                                   <span className={cn(
                                      "text-[10px] px-2 py-1 rounded-sm font-bold uppercase tracking-wider",
                                      p.status === 'PAID' ? "bg-emerald-100 text-emerald-700" :
                                      p.status === 'FAILED' ? "bg-rose-100 text-rose-700" :
                                      "bg-indigo-100 text-indigo-700"
                                   )}>
                                      {p.status || 'PENDING'}
                                   </span>
                                </td>
                                <td className="py-3 px-6 text-sm text-slate-500">
                                   {p.scheduledDate ? new Date(p.scheduledDate).toLocaleDateString() : 'N/A'}
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 )}
              </div>
           </div>
        </div>

        <div className="mt-8 bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-lg">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-indigo-500"></div>
           <h3 className="text-sm font-bold text-white flex items-center mb-6">
             <Activity className="w-4 h-4 mr-2 text-indigo-400" /> Cash Flow Intelligence
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">30-Day Forecast</div>
                 <div className="text-xl font-black text-emerald-400">+{formatMoney(outstandingInvoices)} Inflows</div>
                 <div className="text-sm text-rose-400 mt-1">-{formatMoney(pendingPayouts)} Outflows</div>
              </div>
              <div className="col-span-2">
                 <div className="bg-slate-800/80 p-5 rounded-xl border border-slate-700">
                    <p className="text-sm text-slate-300 font-medium">
                      "Projecting strong positive cash flow this month. High-value invoices are due next week, which will cover the scheduled vendor payout batch, retaining {marginPercentage}% gross margin."
                    </p>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

