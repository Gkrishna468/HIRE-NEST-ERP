import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { PlacementOrchestrator, PlacementStage } from '../lib/workflows/PlacementOrchestrator';
import { Button } from '../lib/Button';
import { IndianRupee, UserCheck, Calendar, Receipt, CreditCard, ChevronRight, CheckCircle, TrendingUp } from 'lucide-react';
import { formatINR } from '../lib/currency';

const STAGES: { id: PlacementStage; label: string; icon: any }[] = [
  { id: 'OFFER_RELEASED', label: 'Offer Released', icon: IndianRupee },
  { id: 'OFFER_ACCEPTED', label: 'Accepted', icon: UserCheck },
  { id: 'NOTICE_PERIOD', label: 'Notice Period', icon: Calendar },
  { id: 'JOINING_CONFIRMED', label: 'Confirmed', icon: CheckCircle },
  { id: 'JOINED', label: 'Joined', icon: UserCheck },
  { id: 'GUARANTEE_PERIOD', label: 'Guarantee', icon: Receipt },
  { id: 'INVOICE_PENDING', label: 'To Invoice', icon: Receipt },
  { id: 'INVOICED', label: 'Invoiced', icon: Receipt },
  { id: 'PAID', label: 'Paid', icon: CreditCard }
];

export function PlacementsTab() {
  const [placements, setPlacements] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>('guest');
  const [userOrgId, setUserOrgId] = useState<string>('');

  useEffect(() => {
     if (!auth.currentUser) return;
     const fetchUser = async () => {
        const { doc, getDoc } = await import("firebase/firestore");
        const u = await getDoc(doc(db, "users", auth.currentUser!.uid));
        if (u.exists()) {
           setUserRole(u.data().role || 'guest');
           setUserOrgId(u.data().organizationId || '');
        }
     };
     fetchUser();
  }, []);

  useEffect(() => {
    if (!userRole) return;
    let qAll = query(collection(db, "placements"));
    
    if (['admin', 'hq_admin', 'super_admin'].includes(userRole)) {
       qAll = query(collection(db, "placements"));
    } else if (userRole.includes('vendor')) {
       qAll = query(collection(db, "placements"), where("vendorId", "==", userOrgId));
    } else if (userRole.includes('client')) {
       qAll = query(collection(db, "placements"), where("clientId", "==", userOrgId));
    }

    const unsub = onSnapshot(qAll, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      const myPlacements = data.filter((p: any) => {
         if (['admin', 'hq_admin', 'super_admin'].includes(userRole)) return true;
         if (userRole.includes('vendor') && p.vendorId === userOrgId) return true;
         if (userRole.includes('client') && p.clientId === userOrgId) return true;
         return false;
      });
      // Sort by creation desc
      myPlacements.sort((a: any, b: any) => {
         const dA = a.createdAt?.seconds || 0;
         const dB = b.createdAt?.seconds || 0;
         return dB - dA;
      });
      setPlacements(myPlacements);
    });
    return () => unsub();
  }, [userRole, userOrgId]);

  const updateStage = async (id: string, newStage: PlacementStage) => {
     try {
       await PlacementOrchestrator.updateStatus(id, newStage);
     } catch (e) {
       alert("Error updating placement");
     }
  };

  const totalExpectedRevenue = placements
    .filter(p => p.status !== 'OFFER_DECLINED' && p.status !== 'DROPPED_OUT')
    .reduce((acc, p) => acc + (p.expectedFee || 0), 0);
  
  const totalRealizedRevenue = placements
    .filter(p => p.status === 'PAID' || p.status === 'INVOICED')
    .reduce((acc, p) => acc + (p.expectedFee || 0), 0);

  return (
    <div className="flex-1 bg-slate-50 flex flex-col min-h-screen text-slate-900 font-sans p-6 overflow-auto">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        <div className="flex items-center justify-between">
           <div>
             <h1 className="text-3xl font-black tracking-tight text-slate-900">Placement & Revenue Control</h1>
             <p className="text-slate-500 mt-2 font-medium">Manage post-offer lifecycle, background checks, and invoice schedules.</p>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 flex items-center justify-between">
              <div>
                 <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Booked Value</p>
                 <p className="text-4xl font-black text-emerald-600 mt-2">{formatINR(totalExpectedRevenue)}</p>
                 <p className="text-sm font-medium text-emerald-500 mt-2 flex items-center gap-1"><TrendingUp size={14}/> Across {placements.length} placements</p>
              </div>
           </div>
           <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 flex items-center justify-between">
              <div>
                 <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Realized Revenue</p>
                 <p className="text-4xl font-black text-indigo-600 mt-2">{formatINR(totalRealizedRevenue)}</p>
                 <p className="text-sm font-medium text-slate-500 mt-2 flex items-center gap-1"><Receipt size={14}/> Invoiced & Paid</p>
              </div>
           </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
           <table className="w-full text-left border-collapse">
             <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                   <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Candidate</th>
                   <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Client & Role</th>
                   <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Offer Details</th>
                   <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Expected Fee</th>
                   <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Lifecycle Stage</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
                {placements.map(p => {
                   const sIdx = STAGES.findIndex(s => s.id === p.status);
                   const stageObj = STAGES.find(s => s.id === p.status) || STAGES[0];
                   
                   return (
                     <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4">
                           <div className="font-bold text-slate-800">{p.candidateName}</div>
                           <div className="text-xs text-slate-500 mt-1 flex items-center gap-1"><Calendar size={12}/> Joining: {p.offerDetails?.joiningDate || 'TBD'}</div>
                        </td>
                        <td className="p-4">
                           <div className="font-medium text-slate-700">{p.clientId}</div>
                           <div className="text-xs text-slate-500 mt-1">Req: {p.requirementId.substring(0, 8)}</div>
                        </td>
                        <td className="p-4">
                           <div className="font-bold text-slate-700">{p.offerDetails?.baseSalary ? formatINR(p.offerDetails.baseSalary) : "Competitive"}</div>
                           <div className="text-xs text-slate-500 mt-1">{p.offerDetails?.placementFeePercent || 20}% Margin/Fee</div>
                        </td>
                        <td className="p-4">
                           <div className="font-bold text-emerald-600">{formatINR(p.expectedFee || 0)}</div>
                        </td>
                        <td className="p-4 text-center">
                           <div className="inline-flex flex-col items-center gap-2">
                              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-[10px] uppercase font-bold tracking-widest flex items-center gap-1">
                                 {stageObj && <stageObj.icon size={12}/>} {stageObj?.label || p.status}
                              </span>
                              {sIdx >= 0 && sIdx < STAGES.length - 1 && userRole !== 'client' && (
                                 <button 
                                    onClick={() => updateStage(p.id, STAGES[sIdx + 1].id)}
                                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold uppercase tracking-wider flex items-center"
                                 >
                                    Move to {STAGES[sIdx + 1].label} <ChevronRight size={12}/>
                                 </button>
                              )}
                           </div>
                        </td>
                     </tr>
                   )
                })}
                {placements.length === 0 && (
                  <tr>
                     <td colSpan={5} className="p-12 text-center text-slate-500">
                        <IndianRupee size={48} className="mx-auto text-slate-300 mb-4" />
                        <h3 className="font-bold text-slate-700 text-lg">No placements yet</h3>
                        <p className="text-sm">When candidates are offered and hired, they will appear here for revenue tracing.</p>
                     </td>
                  </tr>
                )}
             </tbody>
           </table>
        </div>
      </div>
    </div>
  );
}
