import React, { useState, useEffect } from "react";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  UserCheck,
  ShieldCheck,
  FileText,
  DollarSign,
  History,
  Bot,
  Plus,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { collection, getDocs, onSnapshot, query, addDoc, doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { cn } from "../lib/utils";
import { checkIsAdmin } from "../lib/permissions";
import { assertNoMockData } from "../lib/ProductionDataGuard";
import { ExplainableEvidenceCard, EvidenceObject } from "../components/ExplainableEvidenceCard";

export default function HumanApprovalCenterTab({ userRole }: { userRole: string }) {
  const [activeTab, setActiveTab] = useState('pending');
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "approval_requests"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setApprovals(list);
      setLoading(false);
      assertNoMockData(list, "approval_requests");
    }, (error) => {
      console.error("Error loading approvals:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleInitializeDefaultApprovals = async () => {
    setIsInitializing(true);
    const defaults = [
      { 
        type: 'OFFER', 
        title: 'Offer Release: Jane Doe', 
        desc: 'SDE II at Google - $145k Base', 
        requester: 'Autonomous Ops', 
        time: '10 mins ago', 
        risk: 'low', 
        status: 'PENDING',
        evidence: {
            id: 'OFFER-2026-001',
            decision: 'Authorize offer release based on verified budget and candidate acceptance probability.',
            confidence: 96,
            graphNodes: ['Candidate-Jane-Doe', 'Requirement-SDE-II', 'Budget-2026-Q3'],
            experiences: ['Matched candidate salary expectations', 'Background check cleared', 'Interview scorecard: 4.5/5'],
            decisionFactors: ['Market rate parity verified', 'Budget allocation confirmed', 'Team capacity bottleneck identified'],
            telemetrySnapshot: ['LATENCY: 12ms', 'COST: $0.05', 'MODEL: gemini-3.6-flash'],
            version: '2.1.0'
        }
      },
      { 
        type: 'INVOICE', 
        title: 'Invoice Generation: PL-882', 
        desc: '$25,000 Placement Fee for TechSource', 
        requester: 'Finance Agent', 
        time: '1 hour ago', 
        risk: 'low', 
        status: 'PENDING',
        evidence: {
            id: 'INV-2026-882',
            decision: 'Trigger invoice generation following placement confirmation.',
            confidence: 99,
            graphNodes: ['Placement-882', 'Vendor-TechSource', 'Account-Receivable'],
            experiences: ['Placement signed by client', 'Vendor commission verified', 'Tax compliance pass'],
            decisionFactors: ['Contractual terms met', 'Invoice sequence valid', 'Payment gateway connected'],
            telemetrySnapshot: ['FINANCE_CORE_ACTIVE', 'AUTH: VALID'],
            version: '1.0.5'
        }
      },
      { 
        type: 'VENDOR', 
        title: 'Vendor Onboarding: Nova Staffing', 
        desc: 'Compliance checks passed, awaiting final sign-off', 
        requester: 'Compliance Checker', 
        time: '2 hours ago', 
        risk: 'medium', 
        status: 'PENDING',
        evidence: {
            id: 'VND-2026-015',
            decision: 'Approve vendor partnership based on tiered compliance audit.',
            confidence: 88,
            graphNodes: ['Vendor-Nova-Staffing', 'Region-APAC', 'Tier-Preferred'],
            experiences: ['KYC/AML verified', 'Insurance certificates uploaded', 'Bank details confirmed'],
            decisionFactors: ['Audit score: 88/100', 'Risk category: Low-Medium', 'Strategic need in APAC confirmed'],
            telemetrySnapshot: ['COMPLIANCE_RUN_ID: 9912', 'VECTOR_SIM: 0.92'],
            version: '2.0.1'
        }
      },
      { 
        type: 'ESCALATION', 
        title: 'Requirement Escalation: Senior PM', 
        desc: 'Open > 30 days, requesting 20% margin increase', 
        requester: 'Ops Agent', 
        time: '5 hours ago', 
        risk: 'high', 
        status: 'PENDING',
        evidence: {
            id: 'ESC-2026-101',
            decision: 'Escalate requirement for executive margin review.',
            confidence: 82,
            graphNodes: ['Requirement-SR-PM', 'Market-Conditions-Tight', 'Margin-Target-25'],
            experiences: ['0 candidates submitted in 30 days', 'Competitor fill rates are < 10%', 'Target margin is currently uncompetitive'],
            decisionFactors: ['Time-to-fill SLA breached', 'Ecosystem scarcity detected', 'Revenue risk high'],
            telemetrySnapshot: ['MODEL: gemini-exp', 'TEMPERATURE: 0.7'],
            version: '3.0.0-beta'
        }
      }
    ];

    try {
      for (const app of defaults) {
        await addDoc(collection(db, "approval_requests"), app);
      }
    } catch (err) {
      console.error("Failed to seed approvals:", err);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleAction = async (id: string, action: 'APPROVED' | 'REJECTED') => {
    try {
      const docRef = doc(db, "approval_requests", id);
      await updateDoc(docRef, { status: action, actionedAt: new Date().toISOString() });
    } catch (err) {
      console.error("Failed to update approval action:", err);
    }
  };

  if (!checkIsAdmin(userRole)) {
    return (
      <div className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest text-sm">
        Unauthorized Access
      </div>
    );
  }

  const getIcon = (type: string) => {
      switch (type) {
          case 'OFFER': return <UserCheck className="text-emerald-500" />;
          case 'INVOICE': return <DollarSign className="text-indigo-500" />;
          case 'VENDOR': return <ShieldCheck className="text-amber-500" />;
          case 'ESCALATION': return <AlertTriangle className="text-rose-500" />;
          default: return <FileText className="text-slate-500" />;
      }
  };

  const pendingApprovals = approvals.filter(a => a.status === 'PENDING');
  const historyApprovals = approvals.filter(a => a.status === 'APPROVED' || a.status === 'REJECTED');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 border-b border-indigo-900 pb-2 inline-block shadow-[inset_0_-2px_0_rgba(30,58,138,1)]">
            Approval Center
          </h1>
          <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-indigo-900" /> Human-in-the-Loop Governance (Demo Sandbox)
          </p>
        </div>
        <button 
          onClick={handleInitializeDefaultApprovals}
          disabled={isInitializing}
          className="bg-indigo-900 text-white hover:bg-indigo-800 disabled:opacity-50 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm transition-colors"
        >
          <Plus size={14} /> {isInitializing ? 'Initializing...' : 'Seed Demo Approvals'}
        </button>
      </div>

      <div className="flex space-x-2 border-b border-slate-200">
        <button 
            onClick={() => setActiveTab('pending')}
            className={cn("px-4 py-3 text-sm font-bold uppercase tracking-widest transition-colors border-b-2", activeTab === 'pending' ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700")}
        >
            Pending ({loading ? '-' : pendingApprovals.length})
        </button>
        <button 
            onClick={() => setActiveTab('history')}
            className={cn("px-4 py-3 text-sm font-bold uppercase tracking-widest transition-colors border-b-2", activeTab === 'history' ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700")}
        >
            History ({loading ? '-' : historyApprovals.length})
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm font-bold animate-pulse uppercase tracking-wider">
          Loading Approval Matrix...
        </div>
      ) : activeTab === 'pending' && (
          <div className="grid grid-cols-1 gap-4">
              {pendingApprovals.length === 0 ? (
                  <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-12 text-center text-slate-400 shadow-sm">
                      <CheckCircle2 size={48} className="mx-auto mb-4 text-emerald-400" />
                      <p className="font-bold text-slate-700 text-sm">All Clear!</p>
                      <p className="text-xs text-slate-400 mt-1">No pending human-in-the-loop approvals found in the queue.</p>
                  </div>
              ) : (
                  pendingApprovals.map(app => (
                      <div key={app.id} className="bg-white border border-slate-200 rounded-2xl p-0 overflow-hidden shadow-sm flex flex-col group hover:border-indigo-200 transition-colors">
                          <div 
                            onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
                            className="p-6 flex items-center justify-between cursor-pointer"
                          >
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    {getIcon(app.type)}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-sm font-bold text-slate-800">{app.title}</h3>
                                        {app.risk === 'high' && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200">High Risk</span>}
                                    </div>
                                    <p className="text-sm text-slate-500 mb-2">{app.desc}</p>
                                    <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                        <span className="flex items-center gap-1"><Bot size={12} /> {app.requester}</span>
                                        <span className="flex items-center gap-1"><Clock size={12} /> {app.time}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity mr-4">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleAction(app.id, 'REJECTED'); }}
                                      className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 rounded-lg text-sm font-bold transition-colors"
                                    >
                                        <XCircle size={16} /> Reject
                                    </button>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleAction(app.id, 'APPROVED'); }}
                                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-bold shadow-sm transition-colors"
                                    >
                                        <CheckCircle2 size={16} /> Approve
                                    </button>
                                </div>
                                {expandedId === app.id ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
                            </div>
                          </div>

                          {expandedId === app.id && app.evidence && (
                              <div className="px-6 pb-6 pt-0 border-t border-slate-50 bg-slate-50/30">
                                  <ExplainableEvidenceCard 
                                    evidence={app.evidence} 
                                    isDark={false}
                                    className="mt-4 border-slate-200 shadow-none" 
                                  />
                              </div>
                          )}
                      </div>
                  ))
              )}
          </div>
      )}

      {!loading && activeTab === 'history' && (
          <div className="grid grid-cols-1 gap-4">
              {historyApprovals.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-sm">
                      <History size={48} className="mx-auto mb-4 text-slate-300" />
                      <p className="font-bold">No recent history</p>
                  </div>
              ) : (
                  historyApprovals.map(app => (
                      <div key={app.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center justify-between opacity-80">
                          <div className="flex items-center gap-4">
                              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                  {getIcon(app.type)}
                              </div>
                              <div>
                                  <div className="flex items-center gap-2 mb-1">
                                      <h3 className="text-sm font-bold text-slate-800">{app.title}</h3>
                                      <span className={cn(
                                          "text-[10px] font-bold uppercase px-2 py-0.5 rounded border",
                                          app.status === 'APPROVED' ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-rose-50 text-rose-600 border-rose-200"
                                      )}>
                                          {app.status}
                                      </span>
                                  </div>
                                  <p className="text-sm text-slate-500 mb-2">{app.desc}</p>
                                  <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                      <span className="flex items-center gap-1"><Bot size={12} /> {app.requester}</span>
                                      <span className="text-slate-400">Actioned at: {app.actionedAt ? new Date(app.actionedAt).toLocaleTimeString() : 'Recently'}</span>
                                  </div>
                              </div>
                          </div>
                      </div>
                  ))
              )}
          </div>
      )}

    </div>
  );
}
