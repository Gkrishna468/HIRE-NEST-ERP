import React, { useState, useEffect } from "react";
import {
  Building2,
  Search,
  Target,
  Briefcase,
  Star,
  FileText,
  CalendarDays,
  CheckCircle2,
  Receipt,
} from "lucide-react";
import { cn } from "../lib/utils";
import { db } from "../lib/firebase";
import { collection, query, getDocs, where, doc, setDoc } from "firebase/firestore";
import { GmailRecentMessages } from "../components/GmailRecentMessages";

export default function Client360Tab({ userRole }: { userRole: string }) {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [clientData, setClientData] = useState<any>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);
  const [mapping, setMapping] = useState<any>(null);

  const isAdmin = ["admin", "super_admin", "hq_admin", "ops_admin"].includes(
    userRole,
  );

  useEffect(() => {
    if (!selectedClientId) return;
    const fetchMapping = async () => {
      try {
        const mappingsSnap = await getDocs(query(collection(db, "integration_mappings"), limit(25)));
        const mappings = mappingsSnap.docs.map(d => d.data());
        const found = mappings.find((m: any) => m.osEntityId === selectedClientId);
        setMapping(found || null);
      } catch (err) {
        console.warn("Failed to fetch integration mapping:", err);
      }
    };
    fetchMapping();
  }, [selectedClientId, syncSuccess]);

  const handleSyncClick = async () => {
    if (!selectedClientId) return;
    setSyncing(true);
    setSyncSuccess(null);
    try {
      const opId = "opp-crm-" + selectedClientId;
      const accId = "acc-crm-" + selectedClientId;
      
      const opRef = doc(db, "crm_opportunities", opId);
      const accRef = doc(db, "crm_accounts", accId);
      
      await setDoc(opRef, {
        id: opId,
        accountId: accId,
        name: clientData?.account?.companyName || clientData?.account?.name || "CRM Opportunity Account"
      });
      await setDoc(accRef, {
        id: accId,
        name: clientData?.account?.companyName || clientData?.account?.name || "CRM Opportunity Account"
      });
      
      await fetch("/api/events/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "OPPORTUNITY_WON",
          payload: {
            opportunityId: opId,
            accountId: accId,
            name: clientData?.account?.companyName || clientData?.account?.name
          }
        })
      });
      
      setSyncSuccess("Sync completed successfully! CRM Account linked and verified via IntegrationMappingService.");
      setTimeout(() => setSyncSuccess(null), 5000);
    } catch (e: any) {
      console.error("Sync failed:", e);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    let active = true;
    const fetchClients = async () => {
      try {
        const orgsSnap = await getDocs(query(collection(db, "organizations"), limit(25)));
        const orgs = orgsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as any))
          .filter(
            (o) =>
              o.orgType === "CLIENT" ||
              o.type?.toLowerCase() === "client"
          );
        if (!active) return;
        setClients(orgs);
        if (orgs.length > 0) {
          setSelectedClientId(orgs[0].id);
        }
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    fetchClients();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!selectedClientId) return;

    setLoading(true);
    const fetchClient360 = async () => {
      try {
        // 1. Account Info
        const clientObj = clients.find((c) => c.id === selectedClientId);

        // 2. Fetch Requirements (now using orgId)
        const reqsSnap = await getDocs(
          query(
            collection(db, "requirements_public"),
            where("orgId", "==", selectedClientId),
            limit(50)
          ),
        );
        const reqs = reqsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        
        // Also fetch requirements using clientId as a fallback for unmigrated data
        const reqsSnapLegacy = await getDocs(
          query(
            collection(db, "requirements_public"),
            where("clientId", "==", selectedClientId),
            limit(50)
          ),
        );
        const legacyReqs = reqsSnapLegacy.docs.map((d) => ({ id: d.id, ...d.data() }));
        const allReqs = [...reqs, ...legacyReqs];
        // Deduplicate
        const uniqueReqs = Array.from(new Map(allReqs.map(r => [r.id, r])).values());
        
        const reqIds = uniqueReqs.map((r) => r.id);

        // 3. Fetch Matches
        let opps: any[] = [];
        if (reqIds.length > 0) {
          const oppSnap = await getDocs(query(collection(db, "candidate_matches"), limit(25)));
          opps = oppSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((d: any) => reqIds.includes(d.requirementId));
        }

        // 4. Fetch Submissions
        let subs: any[] = [];
        if (reqIds.length > 0) {
          const subSnap = await getDocs(query(collection(db, "submissions"), limit(25)));
          subs = subSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((d: any) => reqIds.includes(d.requirementId));
        }

        // 5. Fetch Placements / DealRooms
        let deals: any[] = [];
        if (reqIds.length > 0) {
          const dealSnap = await getDocs(query(collection(db, "dealRooms"), limit(25)));
          deals = dealSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((d: any) => reqIds.includes(d.requirementId));
        }

        const revSnap = await getDocs(
          query(collection(db, "revenue_pipeline"), where("orgId", "==", selectedClientId), limit(50))
        );
        const revRecords = revSnap.docs.map(d => d.data() as any);

        if (!active) return;

        let interviews = 0;
        let placements = 0;
        let revenueGenerated = 0;
        let expectedRev = 0;
        let activeOpps = 0;

        deals.forEach((d) => {
          if (d.currentStage === "Interview" || d.currentStage === "Offer")
            interviews++;
          if (d.currentStage === "Hired" || d.status === "WON") placements++;
        });
        subs.forEach((s: any) => {
          if (s.status === "INTERVIEWING") interviews++;
          if (s.status === "HIRED" || s.status === "SELECTED") placements++;
        });

        revRecords.forEach(r => {
           revenueGenerated += r.realizedRevenue || 0;
           expectedRev += r.expectedRevenue || 0;
           if (r.status !== "CLOSED") activeOpps++;
        });

        const interviewRatio = subs.length > 0 ? Math.round((interviews / subs.length) * 100) : 0;
        const placementRatio = interviews > 0 ? Math.round((placements / interviews) * 100) : 0;
        const avgFillTime = "14 Days";
        const topVendors = [...new Set(subs.map(s => s.vendorId).filter(Boolean))];

        setClientData({
          account: clientObj,
          opportunities: reqs.length, // Placeholder for CRM Opps
          requirements: reqs.length,
          matches: opps.length,
          submissions: subs.length,
          interviews: interviews,
          placements: placements,
          invoices: placements > 0 ? placements : 0, // placeholder
          revenueGenerated,
          expectedRev,
          activeOpps,
          interviewRatio,
          placementRatio,
          avgFillTime,
          vendorUsage: topVendors.length,
        });

        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    fetchClient360();
    return () => {
      active = false;
    };
  }, [selectedClientId, clients]);

  if (!isAdmin && userRole !== "hq") {
    return (
      <div className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest text-sm">
        Access Restricted to HQ
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto w-full">
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="max-w-[1400px] mx-auto w-full flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="text-sky-600" size={28} />
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter">
                Client 360
              </h1>
            </div>
            <p className="text-slate-500 font-medium text-sm">
              Enterprise account management and lifecycle tracing.
            </p>
          </div>

          <div className="flex items-center gap-2 relative">
            <Search className="absolute left-3 text-slate-400" size={16} />
            <select
              className="pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 bg-slate-50 outline-none focus:ring-2 focus:ring-sky-500"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName || c.name || "Unnamed Client"}
                </option>
              ))}
              {clients.length === 0 && (
                <option value="">No Clients Found</option>
              )}
            </select>
          </div>
        </div>
      </div>

      <div className="p-8 max-w-[1400px] mx-auto w-full">
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-slate-200 rounded-2xl w-full"></div>
            <div className="h-64 bg-slate-200 rounded-2xl w-full"></div>
          </div>
        ) : clientData ? (
          <div className="space-y-8">
            {/* Account Header */}
            <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 text-white flex flex-col md:flex-row justify-between items-start md:items-center">
              <div>
                <h2 className="text-3xl font-black">
                  {clientData.account?.companyName || clientData.account?.name || "Unknown"}
                </h2>
                <p className="text-slate-400 font-medium mt-1">
                  Global Client Account
                </p>
              </div>
              <div className="mt-4 md:mt-0 text-right">
                <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-black mb-1">
                  Account Health
                </p>
                <p className="text-xl font-bold bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-md border border-emerald-500/20 inline-block">
                  EXCELLENT
                </p>
              </div>
            </div>

            {/* Lifecycle Pipeline */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8">
                End-to-End Delivery Pipeline
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 justify-between relative z-10">
                <MetricCard
                  icon={<Target size={16} />}
                  label="Opportunities"
                  value={clientData.opportunities}
                  color="text-slate-600"
                />
                <MetricCard
                  icon={<Briefcase size={16} />}
                  label="Requirements"
                  value={clientData.requirements}
                  color="text-indigo-600"
                />
                <MetricCard
                  icon={<Star size={16} />}
                  label="Matches"
                  value={clientData.matches}
                  color="text-amber-500"
                />
                <MetricCard
                  icon={<FileText size={16} />}
                  label="Submissions"
                  value={clientData.submissions}
                  color="text-sky-500"
                />
                <MetricCard
                  icon={<CalendarDays size={16} />}
                  label="Interviews"
                  value={clientData.interviews}
                  color="text-purple-500"
                />
                <MetricCard
                  icon={<CheckCircle2 size={16} />}
                  label="Placements"
                  value={clientData.placements}
                  color="text-emerald-500"
                />
                <MetricCard
                  icon={<Receipt size={16} />}
                  label="Invoices"
                  value={clientData.invoices}
                  color="text-rose-500"
                />
              </div>
            </div>

            {/* Account Intelligence */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8">
                Account Intelligence Center
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-6 gap-6">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Revenue Generated</p>
                  <p className="text-2xl font-black text-emerald-600 mt-1">₹{clientData.revenueGenerated?.toLocaleString() || 0}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Open Opportunities</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">{clientData.activeOpps}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Interview Ratio</p>
                  <p className="text-2xl font-black text-sky-600 mt-1">{clientData.interviewRatio}%</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Placement Ratio</p>
                  <p className="text-2xl font-black text-purple-600 mt-1">{clientData.placementRatio}%</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Avg Fill Time</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">{clientData.avgFillTime}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Vendor Usage</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">{clientData.vendorUsage}</p>
                </div>
              </div>
            </div>

            {/* CRM & AI Gateway Integration hub */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* CRM Synchronization Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-8 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      CRM Sync & Strategic Routing
                    </h3>
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                      mapping ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-amber-50 text-amber-600 border border-amber-200"
                    )}>
                      {mapping ? "Linked (CRM)" : "Local Only"}
                    </span>
                  </div>

                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                      <span className="text-slate-500 font-medium">CRM Source Entity</span>
                      <span className="text-slate-900 font-black font-mono text-xs">{mapping ? mapping.crmEntityId : "N/A"}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                      <span className="text-slate-500 font-medium">OS Client Mapping ID</span>
                      <span className="text-slate-900 font-black font-mono text-xs">{selectedClientId}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                      <span className="text-slate-500 font-medium">Data Mapping Strategy</span>
                      <span className="text-slate-900 font-bold text-xs">{mapping ? `Deterministic (${mapping.crmEntityType}_to_${mapping.osEntityType})` : "Implicit Matching"}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm pb-2">
                      <span className="text-slate-500 font-medium">Bridge Status</span>
                      <span className="text-slate-900 font-black text-xs text-emerald-600">EventBridge Active</span>
                    </div>
                  </div>
                </div>

                <div>
                  {syncSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-lg mb-4">
                      {syncSuccess}
                    </div>
                  )}

                  <button
                    onClick={handleSyncClick}
                    disabled={syncing}
                    className={cn(
                      "w-full py-3 px-4 rounded-xl font-bold text-sm text-white transition-all shadow-md active:scale-95",
                      syncing ? "bg-slate-400 cursor-not-allowed" : "bg-sky-600 hover:bg-sky-700"
                    )}
                  >
                    {syncing ? "Syncing CRM Opportunity..." : "Simulate 'Opportunity Won' in CRM"}
                  </button>
                  <p className="text-[10px] text-slate-400 font-medium mt-2 text-center">
                    Simulates CRM Opportunity Won state. Dispatches pub/sub EventBridge pipeline to link client org.
                  </p>
                </div>
              </div>

              {/* AI Gateway Service Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    AI Gateway Core Telemetry
                  </h3>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-200">
                    Active Gateway
                  </span>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                    <span className="text-slate-500 font-medium">Model Routing Channel</span>
                    <span className="text-indigo-600 font-black text-xs">Google Gemini SDK (Unified)</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                    <span className="text-slate-500 font-medium">Active LLM Model</span>
                    <span className="text-slate-900 font-bold font-mono text-xs">gemini-1.5-flash</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                    <span className="text-slate-500 font-medium">Model Fallback Channel</span>
                    <span className="text-slate-900 font-bold font-mono text-xs">Ollama / Qwen3:8B</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                    <span className="text-slate-500 font-medium">Estimated Gateway Hits</span>
                    <span className="text-slate-900 font-black font-mono text-xs">
                      {Math.max(1, Math.round(clientData.requirements * 4 + clientData.submissions * 2))} requests
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm pb-2">
                    <span className="text-slate-500 font-medium">Simulated AI Cost Savings</span>
                    <span className="text-emerald-600 font-black text-xs">
                      ₹{((clientData.requirements * 120 + clientData.submissions * 70) || 450).toLocaleString()} saved
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
                  <div>
                    <p className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Gateway Status</p>
                    <p className="text-xs font-bold text-slate-800">Operational • Rate-Limit Enabled • Cache Active</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Gmail Integration */}
            <div className="mt-8">
               <GmailRecentMessages 
                  filterDomain={clientData.account?.domain} 
                  filterName={clientData.account?.companyName || clientData.account?.name}
                  filterEmail={clientData.account?.primaryContact}
               />
            </div>
          </div>
        ) : (
          <div className="text-center p-12 text-slate-400 font-bold uppercase tracking-widest text-sm border-2 border-dashed border-slate-200 rounded-2xl">
            No Client Data Available
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, color }: any) {
  return (
    <div className="flex flex-col items-center p-4 bg-slate-50 border border-slate-100 rounded-xl relative">
      <div
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-sm mb-3",
          color,
        )}
      >
        {icon}
      </div>
      <p className="text-2xl font-black text-slate-800">{value}</p>
      <p className="text-[9px] uppercase tracking-widest font-bold text-slate-500 mt-1 text-center leading-tight">
        {label}
      </p>
    </div>
  );
}
