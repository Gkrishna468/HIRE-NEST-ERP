import React, { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  getDocs
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { 
  Shield, 
  Activity, 
  AlertTriangle, 
  Lock, 
  Server,
  Fingerprint,
  RefreshCw,
  CheckCircle2,
  BrainCircuit,
  Zap,
  Target,
  ShieldAlert,
  Cpu,
  BarChart3,
  Network
} from "lucide-react";
import { Badge } from "../lib/Badge";
import { Button } from "../lib/Button";
import { cn } from "../lib/utils";
import { runAutonomousReasoning } from "../services/intelligenceService";
import { MatchEngine, EmploymentType, CompensationModel, WorkMode } from "../services/matchEngine";

export default function AdminSecurityDashboard() {
  const [logs, setLogs] = useState<any[]>([]);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [preFlight, setPreFlight] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reasoningActive, setReasoningActive] = useState(false);
  const [reasoningResult, setReasoningResult] = useState<any>(null);
  const [testMatch, setTestMatch] = useState<any>(null);

  // Founder Narrative Strategy
  const strategyNarrative = "AI can help you ship fast. But if you don't secure what you build, you're creating liabilities. HireNest OS transforms 'vibe coding' into enterprise-grade production infrastructure.";

  const runMatchProbe = () => {
    const jd = {
      skills: ["React", "TypeScript", "Node.js", "Firebase"],
      domain: "Fintech",
      experience: 5,
      location: "Hyderabad",
      budget: 35,
      employmentType: EmploymentType.CONTRACT,
      compensationModel: CompensationModel.LPM,
      workMode: WorkMode.REMOTE
    };
    const candidate = {
      skills: ["React", "TypeScript", "Next.js"],
      domain: "Fintech",
      experience: 4,
      location: "Bangalore",
      budget: 32,
      employmentType: EmploymentType.CONTRACT,
      compensationModel: CompensationModel.LPM,
      workMode: WorkMode.REMOTE
    };
    const vendor = {
      trustScore: 92,
      deliveryHistory: 88,
      specializations: ["Web-Development", "Fintech"]
    };
    const result = MatchEngine.calculateUniversalScore(jd, candidate, vendor);
    setTestMatch(result);
  };

  const runGovernanceAudit = async () => {
    setReasoningActive(true);
    try {
      const intent = "Audit the current governance state and identify architecture blindspots.";
      const payload = {
        diagnostics,
        preFlight,
        securityChecklist
      };
      const result = await runAutonomousReasoning(intent, payload);
      setReasoningResult(result);
    } catch (e: any) {
      console.warn("Reasoning failed:", e.message);
    } finally {
      setReasoningActive(false);
    }
  };

  const securityChecklist = [
    { id: 'pwp', label: 'Project Workflow Protocol (PWP)', status: 'secure' },
    { id: 'sa', label: 'Runtime Identity Isolation', status: diagnostics?.serviceAccount ? 'secure' : 'pending' },
    { id: 'rbac', label: 'Authority Role-Based Access', status: diagnostics?.auth === 'healthy' ? 'secure' : 'blocked' },
    { id: 'mirror', label: 'Entity Mirror Replication', status: diagnostics?.firestore === 'healthy' ? 'secure' : 'blocked' },
    { id: 'abac', label: 'Attribute-Based Access Control', status: 'secure' },
    { id: 'pii', label: 'PII Data Isolation (PII-TRUST)', status: 'secure' },
    { id: 'input', label: 'Strict Input Validation Layers', status: 'secure' },
    { id: 'cost', label: 'Cost Management & Query Caching', status: 'secure' },
    { id: 'audit', label: 'Immutable Audit Stream', status: logs.length > 0 ? 'secure' : 'pending' },
    { id: 'zero', label: 'Zero-Trust Protocol Layer', status: diagnostics?.auth === 'healthy' || preFlight?.status === 'operational' ? 'secure' : 'pending' }
  ];

  useEffect(() => {
    let unsubLogs: (() => void) | null = null;

    const initSecurityNodes = async () => {
      const safetyTimeout = setTimeout(() => {
        setLoading(false);
      }, 6000); // Max 6s wait for establishing node connection

      auth.onAuthStateChanged(async (user) => {
        if (!user) {
          clearTimeout(safetyTimeout);
          setLoading(false);
          return;
        }
        
        try {
          const token = await user.getIdToken();

          // 1. Fetch Audit Logs (Hybrid: Stream + REST)
          const qLogs = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"), limit(20));
          unsubLogs = onSnapshot(qLogs, (snap) => {
            setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
          }, (err) => {
            console.warn("Firestore Real-time Stream Blocked. Falling back to diagnostics polling.");
            setLoading(false);
          });

          // 2. Pre-flight Check (Public)
          fetch('/api/pre-flight')
            .then(async (r) => {
              const text = await r.text();
              if (r.ok) {
                try { return JSON.parse(text); } catch (e) { return null; }
              }
              try {
                const err = JSON.parse(text);
                return { status: "error", initializationError: err.message || err.details || text };
              } catch (e) {
                return { status: "error", initializationError: text };
              }
            })
            .then(data => {
              if (data) setPreFlight(data);
            })
            .catch(() => console.warn("Pre-flight handshake offline"));

      // 3. Server Diagnostics (Authenticated)
          fetch('/api/diagnostics', {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          .then(async (r) => {
            const errorRaw = await r.text();
            if (r.ok) {
              try {
                return JSON.parse(errorRaw);
              } catch (e) {
                return { auth: "handshake-failed", authDetails: "Invalid JSON response from authority node.", raw: errorRaw };
              }
            }
            
            let errorData: any = { details: "Unknown Protocol Error", requestId: "N/A" };
            try { errorData = JSON.parse(errorRaw); } catch(e) {}
            
            return {
              ok: false,
              governance: "degraded",
              auth: "sync-delayed",
              firestore: "sync-delayed",
              authDetails: errorData.details || errorData.message || errorRaw || `HTTP ${r.status}`,
              remediation: errorData.remediation || (errorData as any).remediation,
              serviceAccount: errorData.serviceAccount || (errorData as any).serviceAccount || null,
              iamCommand: errorData.iamCommand || (errorData as any).iamCommand,
              requestId: errorData.requestId || (errorData as any).requestId || "SRV-ERR",
              statusText: r.statusText,
              statusCode: r.status,
              raw: errorRaw
            };
          })
          .then(setDiagnostics)
          .catch(err => {
            setDiagnostics({ 
              auth: "network-error", 
              firestore: "network-error", 
              authDetails: `Client Node unreachable: ${err.message}` 
            });
          });
        } catch (e: any) {
          console.warn("Identity Verification Protocol Error:", e.message);
          setLoading(false);
        }
      });
    };

    initSecurityNodes();

    return () => {
      if (unsubLogs) unsubLogs();
    };
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-8 font-mono text-indigo-500">
      <div className="w-24 h-24 border-t-4 border-indigo-500 rounded-full animate-spin" />
      <div className="space-y-2 text-center">
        <p className="tracking-[0.5em] animate-pulse uppercase">Establishing Governance Bridge</p>
        <p className="text-[10px] text-slate-600 opacity-50 uppercase">ENCRYPTING_AUTHORITY_SIGNAL...</p>
      </div>
    </div>
  );

  // NEW TIERED HEALTH MODEL
   const runtimeStatus = preFlight?.ok ? "healthy" : "fallback";
  const governanceStatus = diagnostics?.ok ? diagnostics.governance : "fallback";
  
  const isBlocked = runtimeStatus === "fallback"; 
  const isDegraded = runtimeStatus === "healthy" && governanceStatus !== "healthy";
  const isNominal = runtimeStatus === "healthy" && governanceStatus === "healthy";

  const isProjectMismatch = preFlight?.status === "restricted" || (isBlocked && (diagnostics?.projectId === "hirenest-os" && window.location.hostname !== "localhost" && !window.location.hostname.includes("asia-east1.run.app")));

  return (
    <div className="min-h-screen bg-[#FDFDFD] p-8 lg:p-16 max-w-[1920px] mx-auto font-sans flex flex-col gap-12 text-[#141414]">
      {/* HEADER: MASSIVE & BRUTALIST */}
      <header className="border-b-[12px] border-[#141414] pb-12 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[#141414] text-white flex items-center justify-center rounded-2xl shadow-2xl">
              <Shield size={40} />
            </div>
            <h1 className="text-7xl lg:text-9xl font-black tracking-[-0.05em] uppercase italic leading-none flex items-center gap-6">
              Integrity <span className="text-indigo-600">OS</span>
              <span className="text-emerald-500 text-sm tracking-[0.5em] uppercase not-italic align-middle border-4 border-emerald-500 px-4 py-2 rounded-xl h-fit">PWP_ACTIVE</span>
            </h1>
          </div>
          <p className="text-xl font-black uppercase tracking-[0.2em] opacity-40 max-w-2xl pl-2">
            Enterprise Governance Layer / Node: {diagnostics?.projectId || preFlight?.runtimeProjectId || "hirenest-os"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6">
           <div className="text-right">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">State Verification</p>
             <Badge className={cn(
               "py-2 px-6 rounded-xl border-4 font-black uppercase tracking-widest text-sm",
               isBlocked ? "bg-rose-50 border-rose-600 text-rose-600 animate-pulse" : 
               isDegraded ? "bg-amber-50 border-amber-600 text-amber-600" :
               "bg-emerald-50 border-emerald-600 text-emerald-600"
             )}>
                {isBlocked ? "CLIENT_FALLBACK" : isDegraded ? "GOVERNANCE_DEGRADED" : "NOMINAL_ACTIVE"}
             </Badge>
           </div>
           
           <div className="h-16 w-16 rounded-full border-4 border-[#141414] flex items-center justify-center p-2 group hover:bg-[#141414] transition-colors cursor-pointer"
                onClick={() => window.location.reload()}>
              <RefreshCw className="text-[#141414] group-hover:text-white transition-colors" />
           </div>
        </div>
      </header>

      {/* MISSION CONTROL GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        
        {/* LEFT COLUMN: CRITICAL INFRASTRUCTURE */}
        <div className="lg:col-span-8 space-y-12">
          
          {/* DIAGNOSTICS TILES (Visible Grid Recipe 1) */}
          <div className="grid grid-cols-1 md:grid-cols-4 border-4 border-[#141414] divide-y-4 md:divide-y-0 md:divide-x-4 divide-[#141414] shadow-[12px_12px_0px_rgba(20,20,20,0.05)]">
            {[
              { label: "Authority Node", value: preFlight?.ok ? "CONNECTED" : (diagnostics?.status === "STABLE" ? "STABLE" : "PENDING"), status: preFlight?.ok ? "OK" : (diagnostics?.status === "STABLE" ? "OK" : "ERR") },
              { label: "Governance Sync", value: diagnostics?.ok ? "SYNCHRONIZED" : (diagnostics?.error || "GOVERNANCE_SYNC_DELAYED"), status: diagnostics?.ok ? "OK" : "ERR" },
              { label: "Runtime Identity", value: preFlight?.identitySource ? `${diagnostics?.serviceAccount || preFlight?.runtimeIdentity || "IDENTIFYING..."} [VIA: ${preFlight.identitySource}]` : (diagnostics?.serviceAccount || preFlight?.runtimeIdentity || "IDENTIFYING..."), status: "DATA" },
              { label: "Project Details", value: `${diagnostics?.projectId || preFlight?.nodeId || "hirenest-os"} (#${diagnostics?.projectNumber || "..."})`, status: "DATA" }
            ].map((item, idx) => (
              <div key={idx} className="p-8 space-y-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between">
                   <p className="italic font-serif text-sm opacity-50">{item.label}</p>
                   <span className={cn(
                     "font-mono text-[10px] px-2 py-0.5 rounded border",
                     item.status === 'OK' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                     item.status === 'ERR' ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"
                   )}>
                     {item.status}
                   </span>
                </div>
                <p className="font-mono text-xs font-black break-all leading-relaxed uppercase tracking-tighter">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {/* BLOCKAGE / DEGRADATION / NOMINAL LAYER */}
          {isBlocked ? (
            <div className="bg-[#141414] text-white p-12 rounded-[48px] border-[12px] border-[#2A2A2A] shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 w-80 h-80 bg-rose-600/10 blur-[100px] -mr-40 -mt-40" />
               
               <div className="flex items-start gap-10 relative">
                 <div className="bg-rose-600 p-8 rounded-3xl text-white shadow-[0_0_80px_rgba(225,29,72,0.4)] animate-pulse shrink-0">
                    <ShieldAlert size={56} strokeWidth={3} />
                 </div>
                 <div className="space-y-4">
                   <h2 className="text-5xl font-black tracking-tighter uppercase italic text-white underline decoration-rose-600 decoration-8 underline-offset-[12px]">Runtime Restricted</h2>
                   {preFlight?.initializationError && (
                      <div className="bg-rose-500/20 border-2 border-rose-500 p-6 rounded-2xl flex flex-col gap-4 mt-6">
                        <div className="flex items-center gap-4">
                           <ShieldAlert className="text-rose-400" size={24} />
                           <p className="text-rose-100 font-black uppercase tracking-widest text-xs">Initialization Core Failure</p>
                        </div>
                        <div className="bg-black/40 p-4 rounded-xl border border-rose-500/30 overflow-hidden">
                           <p className="text-rose-200 font-mono text-[10px] leading-tight break-words max-h-[200px] overflow-y-auto">{preFlight.initializationError}</p>
                        </div>
                        {preFlight.initializationError.includes("sk_") && (
                           <div className="bg-amber-500/10 border border-amber-500/50 p-4 rounded-xl">
                              <p className="text-amber-200 text-[10px] font-bold uppercase tracking-tight">Warning: Detected Stripe key in Firebase field. A Firebase Service Account must be a JSON object starting with {"{"} .</p>
                           </div>
                        )}
                      </div>
                   )}
                   {isProjectMismatch && (
                     <div className="bg-rose-500/10 border-2 border-rose-500/50 p-6 rounded-2xl flex items-center gap-6 mt-4 animate-pulse">
                        <Target className="text-rose-400 shrink-0" size={32} />
                        <div className="space-y-1">
                           <p className="text-rose-200 font-bold uppercase tracking-widest text-[10px]">Project Identity Conflict</p>
                           <p className="text-rose-300/70 text-[11px] leading-tight">Node is requesting <span className="text-rose-100 font-mono">hirenest-os</span>, but you appear to be in production. Configure secrets and **Redeploy** on Vercel.</p>
                        </div>
                     </div>
                   )}
                   <p className="text-slate-400 text-xl font-medium leading-relaxed max-w-3xl">
                     The Authority Signal is being filtered. This usually indicates <span className="text-white font-bold">IAM Authorization</span> or <span className="text-white font-bold">API Access</span> is missing for the runtime node.
                   </p>
                 </div>
               </div>

               <div className="mt-16 flex flex-col gap-12 relative">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                       <div className="flex items-center gap-4 border-b-2 border-white/10 pb-4">
                          <Fingerprint className="text-indigo-400" />
                          <p className="text-xs font-black uppercase tracking-[0.4em] text-slate-500">Service Principle</p>
                       </div>
                       <div className="bg-white/5 p-6 rounded-2xl border-2 border-white/10 flex flex-col gap-3 font-mono text-sm group">
                          <div className="flex items-center justify-between hover:bg-white/5 p-2 rounded cursor-copy transition-colors" 
                               onClick={() => {
                                 const sa = diagnostics?.serviceAccount || preFlight?.runtimeIdentity || "ais-sandbox@ais-asia-east1-5a5059f2763f49b.iam.gserviceaccount.com";
                                 navigator.clipboard.writeText(sa);
                               }}>
                             <code className="text-emerald-400 truncate pr-4">{diagnostics?.serviceAccount || preFlight?.runtimeIdentity || "ais-sandbox@ais-asia-east1-5..."}</code>
                             <span className="text-[9px] font-black uppercase text-indigo-400 shrink-0">COPY PRIMARY</span>
                          </div>
                          <div className="flex items-center justify-between hover:bg-white/5 p-2 rounded cursor-copy pt-2 border-t border-white/5" onClick={() => {
                            navigator.clipboard.writeText(`ais-sandbox@ais-asia-east1-5a5059f2763f49b.iam.gserviceaccount.com`);
                          }}>
                             <code className="text-blue-400 truncate pr-4">ais-sandbox@ais-asia-east1-5...</code>
                             <span className="text-[9px] font-black uppercase text-indigo-400 shrink-0">COPY SANDBOX</span>
                          </div>
                       </div>
                    </div>

                    <div className="space-y-6">
                       <div className="flex items-center gap-4 border-b-2 border-white/10 pb-4">
                          <Lock className="text-rose-400" />
                          <p className="text-xs font-black uppercase tracking-[0.4em] text-slate-500">Detection Logs</p>
                       </div>
                       <div className="bg-white/5 p-6 rounded-2xl border-2 border-rose-900/20 max-h-[150px] overflow-y-auto">
                          <p className="text-xs font-medium text-slate-400 leading-relaxed italic opacity-80 break-words">
                            {diagnostics?.authDetails || diagnostics?.firestoreDetails || (diagnostics as any)?.raw || diagnostics?.error || diagnostics?.details || (diagnostics?.statusCode ? `HTTP ${diagnostics.statusCode}: ${diagnostics.statusText || 'Connection Rejected'}` : "Protocol handshake failed at edge node.")}
                          </p>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-8 bg-white/5 p-10 rounded-[48px] border-2 border-white/10 shadow-inner">
                    <div className="flex items-center justify-between border-b-2 border-white/5 pb-6">
                       <div className="flex items-center gap-4">
                          <div className="bg-rose-500/20 p-3 rounded-xl">
                             <Target className="text-rose-400" size={24} />
                          </div>
                          <div>
                             <h4 className="font-black uppercase tracking-widest text-sm text-rose-400 italic">Goverance Remediation Sequence</h4>
                             <p className="text-[10px] text-slate-500 uppercase font-black">Manual Authority Alignment Required</p>
                          </div>
                       </div>
                       <Badge variant="outline" className="text-[10px] border-white/20 text-slate-500 font-mono tracking-[0.3em] py-2 px-4">SHELL_V2_ENFORCED</Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <p className="text-[10px] text-slate-400 uppercase font-black">Step 1: Session Authorization</p>
                          <div className="bg-slate-900 p-5 rounded-2xl border border-white/10 font-mono text-[11px] text-white flex items-center justify-between group cursor-copy hover:bg-slate-800 transition-colors"
                               onClick={() => navigator.clipboard.writeText("gcloud auth login && gcloud config set project hirenest-os")}>
                             <div className="flex flex-col">
                                <code>gcloud auth login</code>
                                <code className="text-indigo-400">gcloud config set project hirenest-os</code>
                             </div>
                             <span className="text-[9px] font-black text-indigo-400 opacity-0 group-hover:opacity-100 uppercase shrink-0">Click to Copy</span>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <p className="text-[10px] text-slate-400 uppercase font-black">Step 2: Resource Availability</p>
                          <div className="bg-slate-900 p-5 rounded-2xl border border-white/10 font-mono text-[11px] text-white flex items-center justify-between group cursor-copy hover:bg-slate-800 transition-colors"
                               onClick={() => navigator.clipboard.writeText("gcloud services enable identitytoolkit.googleapis.com firebaserules.googleapis.com firestore.googleapis.com")}>
                             <code>gcloud services enable ...</code>
                             <span className="text-[9px] font-black text-indigo-400 opacity-0 group-hover:opacity-100 uppercase shrink-0">Enable APIs</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-3">
                          <p className="text-[10px] text-slate-400 uppercase font-black">Step 3: Identity Manifest Deployment</p>
                          <div className="bg-slate-900 p-6 rounded-3xl border-2 border-rose-900/40 font-mono text-[10px] text-rose-100 whitespace-pre-wrap leading-relaxed shadow-2xl h-[120px] overflow-y-auto scrollbar-thin scrollbar-thumb-rose-900/40">
                            {(() => {
                              if (diagnostics?.remediation || diagnostics?.iamCommand || diagnostics?.emergencyFix) {
                                return diagnostics.remediation || diagnostics.iamCommand || diagnostics.emergencyFix;
                              }
                              const sa = diagnostics?.serviceAccount || preFlight?.runtimeIdentity || "ais-sandbox@ais-asia-east1-5a5059f2763f49b.iam.gserviceaccount.com";
                              const proj = diagnostics?.projectId || preFlight?.nodeId || "hirenest-os";
                              return `gcloud projects add-iam-policy-binding ${proj} --member="serviceAccount:${sa}" --role="roles/owner"`;
                            })()}
                          </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-4">
                          <Button className="flex-1 bg-white text-black hover:bg-slate-200 rounded-2xl font-black uppercase text-[10px] py-5 shadow-xl transition-transform active:scale-95"
                                  onClick={() => {
                                    const sa = diagnostics?.serviceAccount || preFlight?.runtimeIdentity || "ais-sandbox@ais-asia-east1-5a5059f2763f49b.iam.gserviceaccount.com";
                                    const proj = diagnostics?.projectId || preFlight?.nodeId || "hirenest-os";
                                    const fallback = `gcloud projects add-iam-policy-binding ${proj} --member="serviceAccount:${sa}" --role="roles/owner"`;
                                    navigator.clipboard.writeText(diagnostics?.remediation || diagnostics?.iamCommand || diagnostics?.emergencyFix || fallback);
                                  }}>
                            Copy Full Manifest
                          </Button>
                          <Button variant="outline" className="flex-1 border-white/20 text-white hover:bg-white/10 rounded-2xl font-black uppercase text-[10px] py-5 transition-transform active:scale-95"
                                  onClick={async () => {
                                    setLoading(true);
                                    try {
                                      const token = await auth.currentUser?.getIdToken();
                                      const r = await fetch('/api/admin/system/re-init', {
                                        method: 'POST',
                                        headers: { 'Authorization': `Bearer ${token}` }
                                      });
                                      if (r.ok) {
                                        const data = await r.json();
                                        alert(`Sync Success: ${data.message}\nNode: ${data.report?.newProject || 'Unknown'}\nStatus: ${data.report?.status}`);
                                        window.location.reload();
                                      } else {
                                        let msg = "Sync Failed";
                                        try {
                                          const err = await r.json();
                                          msg = err.details || err.error || err.message || msg;
                                        } catch (e) {
                                          const raw = await r.text();
                                          msg = raw || `HTTP ${r.status}`;
                                        }
                                        alert(`Sync Failed: ${msg}\n\nTry refreshing the page or checking Gcloud permissions for the Service Account.`);
                                      }
                                    } catch (e: any) {
                                      alert(`Network failure: ${e.message}`);
                                    } finally {
                                      setLoading(false);
                                    }
                                  }}>
                            Re-Sync Server Node
                          </Button>
                          <Button variant="outline" className="flex-1 border-rose-500/50 text-rose-400 hover:bg-rose-500/10 rounded-2xl font-black uppercase text-[10px] py-5 transition-transform active:scale-95"
                                  onClick={() => {
                                    if (diagnostics?.emergencyFix) {
                                      navigator.clipboard.writeText(diagnostics.emergencyFix);
                                      return;
                                    }
                                    const sa = diagnostics?.serviceAccount || preFlight?.runtimeIdentity || "ais-sandbox@ais-asia-east1-5a5059f2763f49b.iam.gserviceaccount.com";
                                    const proj = diagnostics?.projectId || "hirenest-os";
                                    const cmd = `gcloud projects add-iam-policy-binding ${proj} --member="serviceAccount:${sa}" --role="roles/owner"`;
                                    navigator.clipboard.writeText(cmd);
                                  }}>
                            Copy Identity Fix
                          </Button>
                        </div>
                      </div>
                    </div>
                 </div>
               </div>
            </div>
          ) : isDegraded ? (
            <div className="bg-[#1A1A1A] text-white p-12 rounded-[48px] border-[12px] border-amber-600/20 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 w-80 h-80 bg-amber-600/10 blur-[100px] -mr-40 -mt-40" />
               
               <div className="flex items-start gap-10 relative">
                 <div className="bg-amber-600 p-8 rounded-3xl text-white shadow-[0_0_80px_rgba(217,119,6,0.3)] shrink-0">
                    <Activity size={56} strokeWidth={3} />
                 </div>
                 <div className="space-y-4">
                   <h2 className="text-5xl font-black tracking-tighter uppercase italic text-white underline decoration-amber-600 decoration-8 underline-offset-[12px]">Governance Sync Delayed</h2>
                   <p className="text-slate-400 text-xl font-medium leading-relaxed max-w-3xl">
                     Governance synchronization is temporarily degraded. <span className="text-white font-bold">Policy Deployment</span> is restricted, but the runtime node is operational.
                   </p>
                 </div>
               </div>

               <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-12 relative">
                 <div className="space-y-8">
                    <div className="bg-white/5 p-6 rounded-2xl border-2 border-white/10 flex items-center justify-between group cursor-pointer"
                         onClick={() => {
                           const sa = diagnostics?.serviceAccount || preFlight?.runtimeIdentity || "Detecting...";
                           navigator.clipboard.writeText(sa);
                         }}>
                       <code className="font-mono text-sm text-amber-400 truncate pr-4">{diagnostics?.serviceAccount || preFlight?.runtimeIdentity || "Identifying Authority..."}</code>
                       <span className="text-[10px] font-black uppercase text-amber-400">COPY IDENTITY</span>
                    </div>

                    <div className="bg-white/5 p-8 rounded-3xl border-2 border-white/10 space-y-4">
                       <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-500 italic">Integrity Log</p>
                       <p className="text-sm font-medium text-slate-400 leading-relaxed italic opacity-80 break-words">
                         {diagnostics?.authDetails || diagnostics?.firestore || "Governance handshake incomplete. Ruleset creation permissions rejected."}
                       </p>
                    </div>
                 </div>

                 <div className="bg-amber-600/5 p-10 rounded-[40px] border-2 border-amber-600/20 space-y-8">
                    <div className="flex justify-between items-center">
                       <p className="text-xs font-black uppercase tracking-[0.3em] text-amber-500">Remediation Directive</p>
                       <Badge variant="outline" className="text-[10px] border-amber-600/30 text-amber-600 font-mono tracking-[0.3em]">IAM_V2</Badge>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <p className="text-[10px] text-slate-500 uppercase font-black">1. Auth Session in Cloud Shell:</p>
                        <div className="bg-black/40 p-4 rounded-xl font-mono text-[11px] text-amber-100 border border-amber-600/20 group cursor-copy" onClick={() => navigator.clipboard.writeText("gcloud auth login")}>
                          gcloud auth login
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-[10px] text-slate-500 uppercase font-black">2. Execute Policy Binding:</p>
                        <div className="bg-slate-900 p-6 rounded-2xl border-2 border-amber-900/30 font-mono text-[11px] text-amber-100 whitespace-pre-wrap leading-relaxed shadow-lg break-all">
                          {diagnostics?.remediation || diagnostics?.iamCommand || "No remediation generated."}
                        </div>
                      </div>

                      <Button className="w-full bg-amber-600 text-white hover:bg-amber-700 mt-4 rounded-xl font-black uppercase text-[10px] py-4"
                              onClick={() => {
                                navigator.clipboard.writeText(diagnostics?.remediation || diagnostics?.iamCommand || "");
                              }}>
                        Batch Copy Command
                      </Button>
                    </div>
                 </div>
               </div>
            </div>
          ) : isNominal && (
            <div className="bg-emerald-500 text-white p-12 rounded-[48px] shadow-2xl relative overflow-hidden border-[12px] border-emerald-600/20">
               <div className="absolute top-0 right-0 w-80 h-80 bg-white/20 blur-[100px] -mr-40 -mt-40" />
               <div className="flex items-center gap-10 relative">
                  <div className="bg-white text-emerald-600 p-8 rounded-3xl shadow-xl">
                    <CheckCircle2 size={56} strokeWidth={3} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-5xl font-black tracking-tighter uppercase italic">System Operational</h2>
                    <p className="text-emerald-100 text-xl font-medium tracking-tight">Governance node established. Authority signal validated across all cloud sectors.</p>
                  </div>
               </div>
            </div>
          )}

          {/* RUNTIME ORCHESTRATION / QUEUE HEALTH (Grid Recipe 1 extension) */}
          <div className="bg-white border-4 border-[#141414] shadow-[16px_16px_0px_rgba(20,20,20,0.02)] rounded-[40px] overflow-hidden mt-12 p-12">
            <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-4"><span className="text-indigo-600">Runtime</span> Orchestration</h2>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-8">Service mesh configuration and queue states</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
               <div className="p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">MODE</p>
                  <p className="font-mono text-lg font-black text-[#141414] truncate">{diagnostics?.runtimeMode || "PENDING"}</p>
               </div>
               <div className="p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">SDK HEALTH</p>
                  <p className="font-mono text-lg font-black text-emerald-600">
                    {diagnostics?.adminSdkHealthy ? "HEALTHY" : (diagnostics?.adminSdkHealthy === false ? "FAILED" : "PENDING")}
                  </p>
               </div>
               <div className="p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">QUEUE BACKLOG</p>
                  <p className="font-mono text-lg font-black text-[#141414]">{diagnostics?.queueBacklog ?? "0"}</p>
               </div>
               <div className="p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">DEGRADED ROUTES</p>
                  <p className={cn("font-mono text-lg font-black truncate", (diagnostics?.degradedRoutes?.length > 0) ? "text-amber-500" : "text-emerald-600")}>
                    {diagnostics?.degradedRoutes?.length || "0"}
                  </p>
               </div>
            </div>
            {diagnostics?.degradedRoutes?.length > 0 && (
              <div className="mt-8 p-6 bg-amber-50 border-2 border-amber-200 rounded-3xl">
                <p className="text-xs font-black text-amber-600 uppercase mb-4 tracking-widest">Restricted APIs</p>
                <div className="flex gap-2 flex-wrap">
                  {diagnostics.degradedRoutes.map((r: string, i: number) => (
                    <span key={i} className="px-3 py-1 bg-white border border-amber-200 rounded font-mono text-[10px] text-amber-700">{r}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* AUDIT LOGS (Visible Grid) */}
          <div className="bg-white border-4 border-[#141414] shadow-[16px_16px_0px_rgba(20,20,20,0.02)] rounded-[40px] overflow-hidden">
             <div className="p-12 border-b-4 border-[#141414] flex items-center justify-between">
                <div className="space-y-2">
                   <h2 className="text-5xl font-black uppercase italic tracking-tighter">Event <span className="text-indigo-600">Mirror</span></h2>
                   <p className="text-xs font-black uppercase tracking-[0.5em] text-slate-400 pl-1">Immutable Authority Audit Stream</p>
                </div>
                <div className="px-6 py-3 bg-[#141414] rounded-2xl flex items-center gap-4 ring-8 ring-slate-100">
                   <div className="w-3 h-3 bg-indigo-500 animate-pulse rounded-full" />
                   <p className="text-[10px] font-black text-white uppercase tracking-[0.3em]">LIVE_SYNC: ON</p>
                </div>
             </div>

             <div className="overflow-x-auto min-h-[500px]">
                <table className="w-full border-collapse">
                   <thead>
                      <tr className="bg-slate-50 border-b-4 border-[#141414] text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">
                         <th className="px-10 py-6 text-left">Protocol_ID</th>
                         <th className="px-10 py-6 text-left">Action_Type</th>
                         <th className="px-10 py-6 text-left">Internal_Node</th>
                         <th className="px-10 py-6 text-right">Sequence_Time</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y-2 divide-slate-100 italic">
                      {logs.length > 0 ? logs.map((log, i) => (
                        <tr key={log.id || i} className="hover:bg-indigo-50/30 transition-colors group">
                           <td className="px-10 py-8 font-mono text-xs opacity-50 group-hover:opacity-100">{log.logId || `TX-${i.toString().padStart(4, '0')}`}</td>
                           <td className="px-10 py-8">
                              <div className="flex items-center gap-4">
                                 <div className={cn(
                                   "w-3 h-3 rounded-full",
                                   log.severity === 'HIGH' ? "bg-rose-500" : "bg-indigo-600"
                                 )} />
                                 <p className="text-lg font-black uppercase tracking-tight text-[#141414] group-hover:text-indigo-700">{log.action}</p>
                              </div>
                           </td>
                           <td className="px-10 py-8">
                              <p className="text-[11px] font-black opacity-40 uppercase truncate max-w-[200px]">{log.userId || "SYSTEM_DAEMON"}</p>
                           </td>
                           <td className="px-10 py-8 text-right font-mono text-[10px] opacity-40">
                              {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString() : new Date().toLocaleTimeString()}
                           </td>
                        </tr>
                      )) : (
                        <tr>
                           <td colSpan={4} className="py-40 text-center text-slate-200">
                              <p className="font-mono text-sm tracking-[1em] uppercase animate-pulse">Awaiting Signal Synchronization...</p>
                           </td>
                        </tr>
                      )}
                   </tbody>
                </table>
             </div>
          </div>

          {/* AI ORCHESTRATION PREVIEW (New Enterprise Layer) */}
          <div className="bg-[#141414] text-white p-12 rounded-[48px] border-[12px] border-[#2A2A2A] shadow-2xl space-y-12">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-[0_0_60px_rgba(79,70,229,0.3)]">
                  <Cpu size={40} strokeWidth={3} />
                </div>
                <div>
                  <h2 className="text-4xl font-black tracking-tighter uppercase italic">AI Orchestration <span className="text-indigo-400">V2</span></h2>
                  <p className="text-indigo-200/60 font-black uppercase tracking-[0.3em] text-[10px]">Universal Match & Broadcast Engine</p>
                </div>
              </div>
              <Button 
                className="bg-white text-black hover:bg-slate-200 rounded-2xl font-black uppercase text-xs px-8 py-6 shadow-xl"
                onClick={runMatchProbe}
              >
                Execute Match Probe
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {/* MATCH ENGINE PREVIEW */}
              <div className="bg-white/5 p-8 rounded-[40px] border-2 border-white/10 space-y-8">
                <div className="flex items-center gap-4 border-b-2 border-white/5 pb-6">
                   <Target className="text-emerald-400" size={24} />
                   <div className="space-y-0.5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Universal Match Engine</p>
                      <h4 className="text-xl font-black italic uppercase">Enterprise Fit Score</h4>
                   </div>
                </div>

                {testMatch ? (
                  <div className="space-y-8">
                    <div className="flex items-center justify-between">
                       <span className="text-5xl font-black italic tracking-tighter text-emerald-400">{testMatch.finalScore}%</span>
                       <Badge className="bg-emerald-500/20 border-emerald-500/40 text-emerald-400">HIGH_CONFIDENCE</Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                       {Object.entries(testMatch.breakdown).map(([k, v]: any) => (
                         <div key={k} className="bg-white/5 p-4 rounded-2xl border border-white/5">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">{k}</p>
                            <div className="flex items-center justify-between">
                               <p className="font-mono text-sm font-bold">{v}%</p>
                               <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
                                  <div className="h-full bg-indigo-500" style={{ width: `${v}%` }} />
                               </div>
                            </div>
                         </div>
                       ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-20 text-center space-y-4">
                     <p className="font-mono text-xs text-slate-500 animate-pulse tracking-widest">AWAITING_PROBE_EXECUTION...</p>
                     <p className="text-[10px] text-slate-600 uppercase max-w-[200px] mx-auto italic leading-relaxed">
                        Matches candidates using specialized LPM/LPA weighing models and vendor trust scores.
                     </p>
                  </div>
                )}
              </div>

              {/* BROADCAST ENGINE PREVIEW */}
              <div className="bg-white/5 p-8 rounded-[40px] border-2 border-white/10 space-y-8">
                <div className="flex items-center gap-4 border-b-2 border-white/5 pb-6">
                   <Network className="text-indigo-400" size={24} />
                   <div className="space-y-0.5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Vector Broadcast Engine</p>
                      <h4 className="text-xl font-black italic uppercase">Vendor Segmentation</h4>
                   </div>
                </div>

                <div className="space-y-6">
                   <div className="space-y-4">
                      <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-tight">
                         <span className="text-slate-500">Segmentation Model</span>
                         <span className="text-indigo-400">AI-SEGMENT_V2</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                         <div className="h-full w-[85%] bg-indigo-500" />
                      </div>
                   </div>

                   <div className="space-y-3 bg-white/5 p-6 rounded-2xl border border-white/5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Broadcast Guardrails</p>
                      <ul className="space-y-2">
                        {[
                          "Trust Score Floor: 70",
                          "Domain Specialization Multiplier",
                          "Delivery Velocity Weighing",
                          "Anti-Spam Throttling"
                        ].map((rule, i) => (
                          <li key={i} className="flex items-center gap-3 text-xs font-semibold text-slate-400 italic">
                             <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                             {rule}
                          </li>
                        ))}
                      </ul>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SECURITY POSTURE */}
        <div className="lg:col-span-4 space-y-12">
           
           {/* REASONING ENGINE PULSE */}
           <div className={cn(
             "bg-indigo-600 text-white p-10 rounded-[56px] border-[8px] border-indigo-700/50 space-y-8 shadow-2xl relative overflow-hidden transition-all duration-500",
             reasoningActive && "animate-pulse ring-8 ring-indigo-500/30"
           )}>
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-[80px] -mr-32 -mt-32" />
              
              <div className="flex items-center justify-between relative">
                 <div className="flex items-center gap-4">
                    <div className="bg-white/20 p-4 rounded-2xl">
                       <BrainCircuit className="text-white" size={32} />
                    </div>
                    <div>
                       <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-60">Intent Engine</p>
                       <h3 className="text-2xl font-black italic uppercase tracking-tighter">Integrity Cortex</h3>
                    </div>
                 </div>
                 <Badge className="bg-white/20 border-white/30 text-white font-mono text-[10px] py-1 px-4 tracking-widest">
                    V1.2_ACTIVE
                 </Badge>
              </div>

              {reasoningResult ? (
                <div className="space-y-6 relative">
                  <div className="bg-black/20 p-6 rounded-3xl border border-white/10 backdrop-blur-md">
                    <p className="text-sm font-medium leading-relaxed italic text-indigo-50">
                      {reasoningResult.analysis}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {reasoningResult.appliedModes.map((mode: any) => (
                      <span key={mode}>
                        <Badge className="bg-indigo-900/50 border-indigo-400/30 text-indigo-200 text-[9px] uppercase tracking-tighter">
                           /{mode}
                        </Badge>
                      </span>
                    ))}
                  </div>
                  {reasoningResult.suggestions && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Strategic Directives</p>
                      <div className="space-y-2">
                         {reasoningResult.suggestions.slice(0, 2).map((s: string, i: number) => (
                           <div key={i} className="flex items-center gap-3 bg-white/5 p-3 rounded-xl text-xs font-semibold">
                              <Zap size={14} className="text-amber-400 shrink-0" />
                              <span>{s}</span>
                           </div>
                         ))}
                      </div>
                    </div>
                  )}
                  <Button 
                    variant="outline" 
                    className="w-full border-white/20 text-white hover:bg-white/10 rounded-2xl py-4 font-black uppercase text-[10px] tracking-widest"
                    onClick={runGovernanceAudit}
                    disabled={reasoningActive}
                  >
                    {reasoningActive ? "ORCHESTRATING..." : "RE-EVALUATE PROTOCOLS"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-8 relative">
                  <p className="text-sm font-medium text-indigo-100 opacity-80 leading-relaxed italic">
                    The Intent-Based Reasoning Engine is idling. Run an autonomous audit to activate strategic protocols.
                  </p>
                  <Button 
                    className="w-full bg-white text-indigo-600 hover:bg-indigo-50 rounded-2xl py-6 font-black uppercase italic tracking-tighter text-lg shadow-xl shrink-0 h-auto"
                    onClick={runGovernanceAudit}
                    disabled={reasoningActive}
                  >
                    {reasoningActive ? (
                      <div className="flex items-center gap-3">
                        <RefreshCw className="animate-spin" />
                        <span>BOOTING_REASONING_NODE...</span>
                      </div>
                    ) : "ACTIVATE AUTONOMOUS AUDIT"}
                  </Button>
                </div>
              )}
           </div>

           {/* SECURITY STATE LIST */}
           <div className="bg-[#141414] text-white p-12 rounded-[56px] border-[8px] border-[#2A2A2A] space-y-12 shadow-2xl relative">
              <div className="space-y-4">
                 <p className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.5em]">Network Topology</p>
                 <h2 className="text-4xl font-black italic uppercase tracking-tighter">Security State</h2>
              </div>

              <div className="space-y-8">
                 {securityChecklist.map((item) => (
                   <div key={item.id} className="group cursor-help">
                      <div className="flex items-center justify-between gap-4 mb-2">
                         <p className="text-[13px] font-black uppercase italic tracking-tight text-slate-500 group-hover:text-indigo-400 transition-colors">{item.label}</p>
                         <p className={cn(
                           "text-[10px] font-black uppercase tracking-widest",
                           item.status === 'secure' ? "text-emerald-400" : item.status === 'blocked' ? "text-rose-500 animate-pulse" : "text-slate-700"
                         )}>
                           {item.status === 'secure' ? '[ SECURE ]' : item.status === 'blocked' ? '[ RESTRICTED ]' : '[ PENDING ]'}
                         </p>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                         <div className={cn(
                           "h-full transition-all duration-1000",
                           item.status === 'secure' ? "w-full bg-emerald-500" : item.status === 'blocked' ? "w-1/3 bg-rose-600" : "w-1/12 bg-slate-800"
                         )} />
                      </div>
                   </div>
                 ))}
              </div>

              <div className="pt-12 border-t-2 border-white/5">
                 <div className="bg-white/5 p-8 rounded-3xl border-2 border-white/10 hover:border-indigo-500 transition-all group/node">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-4">Authority Cluster</p>
                    <div className="flex items-center gap-4">
                       <div className="w-3 h-3 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,1)]" />
                       <code className="text-sm font-mono text-white opacity-60 group-hover/node:opacity-100 transition-opacity truncate">{diagnostics?.projectId || "hirenest-os"}.cloud</code>
                    </div>
                 </div>
              </div>
           </div>

           {/* INFRASTRUCTURE HEALTH (Data Grid Table) */}
           <div className="bg-white border-4 border-[#141414] rounded-[48px] p-12 space-y-12 shadow-[12px_12px_0px_rgba(20,20,20,0.02)]">
              <h3 className="text-xl font-black italic uppercase tracking-widest border-b-4 border-[#141414] pb-6">Integrity Metrics</h3>
              
              <div className="space-y-10">
                 {[
                   { label: "Trust Reliability", val: "99.99%", status: "STABLE", color: "text-emerald-600" },
                   { label: "Identity Nodes", val: (logs.length + 5).toString().padStart(2, '0'), status: "GROWING", color: "text-indigo-600" },
                   { label: "Node Latency", val: "18ms", status: "FAST", color: "text-[#141414]" }
                 ].map((metric, i) => (
                   <div key={i} className="flex items-center justify-between border-b-2 border-slate-50 pb-8 last:border-0 last:pb-0">
                      <div className="space-y-1">
                         <p className="font-serif italic text-xs opacity-50">{metric.label}</p>
                         <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{metric.status}</p>
                      </div>
                      <p className={cn("text-4xl font-black italic tracking-tighter", metric.color)}>{metric.val}</p>
                   </div>
                 ))}
              </div>
           </div>

           {/* ADMIN ACTION CORD */}
           <div className="p-4">
              <Button className="w-full py-10 rounded-[32px] border-4 border-[#141414] border-dashed text-[#141414] font-black uppercase tracking-[0.3em] hover:bg-[#141414] hover:text-white transition-all shadow-xl">
                 [ RECONFIGURE BOUNDARIES ]
              </Button>
           </div>

        </div>
      </div>
    </div>
  );
}

