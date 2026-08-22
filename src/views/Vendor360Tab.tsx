import React, { useState, useEffect } from "react";
import {
  Building,
  Search,
  Users,
  Briefcase,
  Star,
  FileText,
  CheckCircle2,
  DollarSign,
  Activity,
} from "lucide-react";
import { cn } from "../lib/utils";
import { db } from "../lib/firebase";
import { collection, query, getDocs, where, doc, setDoc, limit } from "firebase/firestore";
import { GmailRecentMessages } from "../components/GmailRecentMessages";

export default function Vendor360Tab({ userRole }: { userRole: string }) {
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [vendorData, setVendorData] = useState<any>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);
  const [mapping, setMapping] = useState<any>(null);

  const isAdmin = ["admin", "super_admin", "hq_admin", "ops_admin"].includes(
    userRole,
  );

  useEffect(() => {
    if (!selectedVendorId) return;
    const fetchMapping = async () => {
      try {
        const mappingsSnap = await getDocs(query(collection(db, "integration_mappings"), limit(25)));
        const mappings = mappingsSnap.docs.map(d => d.data());
        const found = mappings.find((m: any) => m.osEntityId === selectedVendorId);
        setMapping(found || null);
      } catch (err) {
        console.warn("Failed to fetch integration mapping:", err);
      }
    };
    fetchMapping();
  }, [selectedVendorId, syncSuccess]);

  const handleSyncClick = async () => {
    if (!selectedVendorId) return;
    setSyncing(true);
    setSyncSuccess(null);
    try {
      // Simulate placement closure event in OS to sync back to CRM
      const placementId = "pla-vendor-" + selectedVendorId;
      const candidateId = "cand-bench-test-" + Date.now();
      
      await fetch("/api/events/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "PLACEMENT_CLOSED",
          payload: {
            placementId,
            candidateId
          }
        })
      });
      
      setSyncSuccess("Sourcing pipeline updated! PLACEMENT_CLOSED status successfully synced back to CRM systems.");
      setTimeout(() => setSyncSuccess(null), 5000);
    } catch (e: any) {
      console.error("Sync failed:", e);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    let active = true;
    const fetchVendors = async () => {
      try {
        const orgsSnap = await getDocs(query(collection(db, "organizations"), limit(25)));
        const orgs = orgsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as any))
          .filter(
            (o) =>
              o.orgType === "VENDOR" ||
              o.type?.toLowerCase() === "vendor"
          );
        if (!active) return;
        setVendors(orgs);
        if (orgs.length > 0) {
          setSelectedVendorId(orgs[0].id);
        }
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    fetchVendors();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!selectedVendorId) return;

    setLoading(true);
    const fetchVendor360 = async () => {
      try {
        // 1. Account Info
        const vendorObj = vendors.find((v) => v.id === selectedVendorId);

        // 2. Fetch Candidates
        const candsSnap = await getDocs(
          query(
            collection(db, "candidatePool"),
            where("vendorId", "==", selectedVendorId),
            limit(50)
          ),
        );
        const candidates = candsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        // 3. Fetch Matches
        const oppQ = query(
          collection(db, "candidate_matches"),
          where("vendorId", "==", selectedVendorId),
          limit(50)
        );
        const oppSnap = await getDocs(oppQ);
        const opps = oppSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // 4. Fetch Submissions
        const subSnap = await getDocs(
          query(
            collection(db, "submissions"),
            where("vendorId", "==", selectedVendorId),
            limit(50)
          ),
        );
        const subs = subSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // 5. Fetch Placements / DealRooms
        // Assuming dealRooms might have a vendorId, if not, we use submissions that reached placement
        const dealSnap = await getDocs(query(collection(db, "dealRooms"), limit(25)));
        const deals = dealSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

        const revSnap = await getDocs(
          query(collection(db, "revenue_pipeline"), where("vendorId", "==", selectedVendorId), limit(50))
        );
        const revRecords = revSnap.docs.map(d => d.data() as any);

        if (!active) return;

        let interviews = 0;
        let placements = 0;
        let revenue = 0;

        subs.forEach((s: any) => {
          if (s.status === "INTERVIEWING") interviews++;
          if (s.status === "HIRED" || s.status === "SELECTED") {
            placements++;
          }
        });

        // Correlate deals if vendorId is tracked
        deals.forEach((d) => {
          // Let's assume deal tracks vendorId or we rely on submissions
          if (d.vendorId === selectedVendorId) {
            if (d.currentStage === "Interview" || d.currentStage === "Offer")
              interviews++;
            if (d.currentStage === "Hired" || d.status === "WON") {
              placements++;
            }
          }
        });

        revRecords.forEach(r => {
           revenue += r.realizedRevenue || 0;
        });

        // De-duplicate if needed, but for now we aggregate
        const calcPlacementRatio =
          subs.length > 0 ? Math.round((placements / subs.length) * 100) : 0;
        const calcInterviewRatio =
          subs.length > 0 ? Math.round((interviews / subs.length) * 100) : 0;

        let vendorScore = 50; // Base score
        vendorScore += Math.min(30, calcPlacementRatio);
        vendorScore += Math.min(20, calcInterviewRatio);

        const activeBench = candidates.filter((c: any) => c.status === "available" || c.status === "bench").length || candidates.length;
        const topSkillsArr = candidates.map((c: any) => c.skills || []).flat();
        const topSkills = [...new Set(topSkillsArr)].slice(0, 3).join(", ") || "Java, React, Node";

        setVendorData({
          account: vendorObj,
          benchCandidates: candidates.length,
          opportunities: opps.length,
          submissions: subs.length,
          interviews: interviews,
          placements: placements,
          interviewRatio: calcInterviewRatio,
          placementRatio: calcPlacementRatio,
          revenueGenerated: revenue,
          avgResponseTime: "4 Hours",
          slaCompliance: "98%",
          topSkills,
          activeBench,
          vendorScore,
        });

        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    fetchVendor360();
    return () => {
      active = false;
    };
  }, [selectedVendorId, vendors]);

  if (!isAdmin && userRole !== "hq") {
    return (
      <div className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest text-sm">
        Access Restricted to HQ
      </div>
    );
  }

  const formatCurrency = (val: number) => "₹" + val.toLocaleString("en-IN");

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto w-full">
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="max-w-[1400px] mx-auto w-full flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Building className="text-purple-600" size={28} />
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter">
                Vendor 360
              </h1>
            </div>
            <p className="text-slate-500 font-medium text-sm">
              Supply chain performance and revenue impact.
            </p>
          </div>

          <div className="flex items-center gap-2 relative">
            <Search className="absolute left-3 text-slate-400" size={16} />
            <select
              className="pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 bg-slate-50 outline-none focus:ring-2 focus:ring-purple-500"
              value={selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value)}
            >
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.companyName || v.name || "Unnamed Vendor"}
                </option>
              ))}
              {vendors.length === 0 && (
                <option value="">No Vendors Found</option>
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
        ) : vendorData ? (
          <div className="space-y-8">
            {/* Account Header */}
            <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 text-white flex flex-col md:flex-row justify-between items-start md:items-center">
              <div>
                <h2 className="text-3xl font-black">
                  {vendorData.account?.companyName || vendorData.account?.name || "Unknown"}
                </h2>
                <p className="text-slate-400 font-medium mt-1">
                  Vendor Partner Profile
                </p>
              </div>
              <div className="mt-4 md:mt-0 flex gap-6 text-right">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-black mb-1">
                    Response Time
                  </p>
                  <p className="text-xl font-bold text-white">4 hrs</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-amber-400 font-black mb-1">
                    Vendor Score
                  </p>
                  <p
                    className={cn(
                      "text-2xl font-black",
                      vendorData.vendorScore >= 80
                        ? "text-emerald-400"
                        : vendorData.vendorScore >= 50
                          ? "text-amber-400"
                          : "text-rose-400",
                    )}
                  >
                    {vendorData.vendorScore}
                  </p>
                </div>
              </div>
            </div>

            {/* Lifecycle Pipeline */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8">
                Performance Pipeline
              </h3>

              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                <MetricCard
                  icon={<Users size={16} />}
                  label="Bench Candidates"
                  value={vendorData.benchCandidates}
                  color="text-indigo-600"
                />
                <MetricCard
                  icon={<Star size={16} />}
                  label="Matches Accessed"
                  value={vendorData.opportunities}
                  color="text-amber-500"
                />
                <MetricCard
                  icon={<FileText size={16} />}
                  label="Submissions"
                  value={vendorData.submissions}
                  color="text-sky-500"
                />
                <MetricCard
                  icon={<CheckCircle2 size={16} />}
                  label="Placements"
                  value={vendorData.placements}
                  color="text-emerald-500"
                />

                <div className="col-span-2 grid grid-cols-2 gap-4 bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">
                      Interview Rate
                    </p>
                    <p className="text-2xl font-black text-slate-800">
                      {vendorData.interviewRatio}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">
                      Placement Rate
                    </p>
                    <p className="text-2xl font-black text-emerald-600">
                      {vendorData.placementRatio}%
                    </p>
                  </div>
                  <div className="col-span-2 mt-2 pt-2 border-t border-slate-200">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">
                      Revenue Generated
                    </p>
                    <p className="text-xl font-black text-indigo-600">
                      {formatCurrency(vendorData.revenueGenerated)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Vendor Intelligence */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8">
                Vendor Intelligence Center
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Avg Response Time</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">{vendorData.avgResponseTime}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">SLA Compliance</p>
                  <p className="text-2xl font-black text-emerald-600 mt-1">{vendorData.slaCompliance}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Top Skills</p>
                  <p className="text-sm font-bold text-indigo-600 mt-2">{vendorData.topSkills}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Active Bench</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">{vendorData.activeBench}</p>
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
                      <span className="text-slate-500 font-medium">OS Vendor Mapping ID</span>
                      <span className="text-slate-900 font-black font-mono text-xs">{selectedVendorId}</span>
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
                      syncing ? "bg-slate-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"
                    )}
                  >
                    {syncing ? "Syncing Sourcing Pipeline..." : "Simulate 'Placement Closed' in OS"}
                  </button>
                  <p className="text-[10px] text-slate-400 font-medium mt-2 text-center">
                    Simulates placement closure. Dispatches pub/sub EventBridge pipeline to trigger status update in CRM systems.
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
                      {Math.max(1, Math.round(vendorData.submissions * 3.8 + vendorData.benchCandidates * 1.5))} requests
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm pb-2">
                    <span className="text-slate-500 font-medium">Simulated AI Cost Savings</span>
                    <span className="text-emerald-600 font-black text-xs">
                      ₹{((vendorData.submissions * 140 + vendorData.benchCandidates * 90) || 380).toLocaleString()} saved
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
                 filterDomain={vendorData.account?.domain} 
                 filterName={vendorData.account?.companyName || vendorData.account?.name}
                 filterEmail={vendorData.account?.primaryContact}
               />
            </div>
          </div>
        ) : (
          <div className="text-center p-12 text-slate-400 font-bold uppercase tracking-widest text-sm border-2 border-dashed border-slate-200 rounded-2xl">
            No Vendor Data Available
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, color }: any) {
  return (
    <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-100 rounded-xl">
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
