import React, { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, limit } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { Button } from "../lib/Button";
import { cn } from "../lib/utils";
import { Trash2, Check, Save, Lock, Clock } from "lucide-react";

function SafeUserRow({ 
  u, 
  getRoleCategory, 
  safeInitial, 
  getRoleLabel, 
  setSelectedUserForTracking, 
  VerificationBadge, 
  auth, 
  setIsSubmitting, 
  setUserToDelete, 
  setEditingUser, 
  isSubmitting 
}: any) {
  try {
    const userId = u?.id || u?.uid || "unknown";
    const userRole = u?.role || "member";
    const userEmail = u?.email || "No Email Provided";
    const displayName = u?.displayName || u?.name || "Anonymous User";
    const orgName = u?.org?.companyName || u?.org?.name || u?.organizationId || "unmapped entity";
    const plan = u?.org?.plan || null;
    const lastLogin = u?.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never";

    return (
      <div key={userId} className="group flex items-center justify-between p-6 bg-white border-2 border-slate-50 rounded-[28px] hover:border-indigo-100 hover:shadow-xl hover:shadow-slate-50 transition-all">
        <div className="flex items-center gap-6">
          <div className={cn(
            "h-12 w-12 rounded-2xl flex items-center justify-center font-black",
            getRoleCategory(userRole) === 'GOVERNANCE' ? 'bg-slate-900 text-white' :
            getRoleCategory(userRole) === 'DEMAND' ? 'bg-indigo-600 text-white' : 'bg-amber-500 text-white'
          )}>
            {safeInitial(userEmail || displayName, 'U')}
          </div>
          <div className="text-left">
            <div className="font-black text-slate-900 lowercase tracking-tight flex items-center gap-2">
              <button onClick={() => setSelectedUserForTracking(u)} className="hover:text-indigo-600 transition-colors text-left underline decoration-slate-200 underline-offset-4">
                {userEmail || displayName}
              </button>
              {userRole === 'admin' && <Check size={12} className="text-indigo-600" />}
            </div>
            <div className="flex items-center gap-3 mt-1">
               <span className="text-[10px] text-slate-400 font-bold lowercase tracking-widest">
                  {orgName.toLowerCase()}
                  {plan && (
                    <span className="ml-2 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] uppercase font-black">
                      {plan}
                    </span>
                  )}
               </span>
               <span className="h-1 w-1 rounded-full bg-slate-200" />
               <span className={cn(
                 "text-[10px] font-black lowercase tracking-widest",
                 getRoleCategory(userRole) === 'GOVERNANCE' ? 'text-slate-900' :
                 getRoleCategory(userRole) === 'DEMAND' ? 'text-indigo-600' : 'text-amber-600'
               )}>
                 {getRoleLabel(userRole).toLowerCase()}
               </span>
            </div>
            <div className="mt-2 flex items-center gap-4">
               <VerificationBadge verification={u?.verification} role={userRole} email={userEmail} />
               <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                 <Clock size={12} className="text-slate-400" />
                 {lastLogin}
               </div>
               <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                 <span className={cn("w-1.5 h-1.5 rounded-full", u?.disabled ? "bg-red-500" : "bg-emerald-500")} />
                 {u?.disabled ? 'Disabled' : 'Active'}
               </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
           <button 
              onClick={async () => {
                if (confirm(`Sync ${userEmail} role [${userRole}] to Custom Claims? This enables enterprise rule enforcement.`)) {
                  try {
                    setIsSubmitting(true);
                    const token = await auth.currentUser?.getIdToken();
                    const resp = await fetch('/api/assign-role', {
                      method: 'POST',
                      headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                      },
                      body: JSON.stringify({ uid: userId, role: userRole, organizationId: u?.organizationId })
                    });
                    if (resp.ok) alert("IAM Role synchronized. Access Protocol Updated.");
                    else alert("IAM sync failed.");
                  } catch (e) {
                    alert("Network handshake failure");
                  } finally {
                    setIsSubmitting(false);
                  }
                }
              }}
              className="h-10 w-10 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-500 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
              title="Sync IAM Custom Claims"
           >
              <Lock size={16} />
           </button>
           <button 
              onClick={() => setUserToDelete({ id: userId, orgId: u?.organizationId, email: userEmail, name: displayName, role: userRole, data: u })}
              className="h-10 w-10 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-600 hover:text-white transition-all shadow-sm"
           >
              <Trash2 size={16} />
           </button>
        </div>
      </div>
    );
  } catch (err) {
    console.error("Failed to render corrupt user record:", err);
    return (
      <div className="p-6 bg-rose-50 border-2 border-rose-100 rounded-[28px] text-xs text-rose-700 flex items-center justify-between">
        <div className="text-left">
          <span className="font-bold">Corrupt User Record Detected</span> (ID: {u?.id || u?.uid || "unknown"})
        </div>
        <div className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-black">Malformed Data</div>
      </div>
    );
  }
}

export default function AdminUsersManager({ orgData }: { orgData: any }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncMode, setSyncMode] = useState<string>("INITIALIZING");
  const [nodeId, setNodeId] = useState<string>("");
  const [dbStatus, setDbStatus] = useState<{ projectId: string, connected: boolean, lastCheck: string }>({ 
    projectId: 'initializing', 
    connected: false, 
    lastCheck: '-' 
  });
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "DEMAND" | "SUPPLY" | "GOVERNANCE" | "ONBOARDING" | "PERMISSIONS">("ALL");
  const [onboardingRequests, setOnboardingRequests] = useState<any[]>([]);
  
  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<any>("client_admin");
  const [companyName, setCompanyName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userToDelete, setUserToDelete] = useState<{ id: string, orgId: string, email: string, name: string, role: string, data?: any } | null>(null);
  const [selectedUserForTracking, setSelectedUserForTracking] = useState<any>(null);

  const roles = [
    { value: 'super_admin', label: 'platform authority (hq)', category: 'GOVERNANCE' },
    { value: 'client_admin', label: 'Client', category: 'DEMAND' },
    { value: 'vendor_admin', label: 'Vendor HQ', category: 'SUPPLY' },
    { value: 'vendor_recruiter', label: 'Vendor Recruiter', category: 'SUPPLY' },
    { value: 'recruiter', label: 'Recruiter', category: 'SUPPLY' },
    { value: 'independent', label: 'Independent', category: 'SUPPLY' },
    { value: 'ACCOUNT_MANAGER', label: 'account manager', category: 'DEMAND' },
    { value: 'ops_admin', label: 'ops administrator', category: 'GOVERNANCE' },
  ];

  const getRoleCategory = (r?: string) => {
    if (!r) return 'DEMAND';
    return roles.find(ro => ro.value === r)?.category || 'DEMAND';
  };

  const getRoleLabel = (r?: string) => {
    if (!r) return 'Member';
    return roles.find(ro => ro.value === r)?.label || r;
  };

  const safeInitial = (text?: string, fallback = 'U') => {
    if (!text || typeof text !== 'string') return fallback.toLowerCase();
    const trimmed = text.trim();
    return trimmed.length > 0 ? trimmed.charAt(0).toLowerCase() : fallback.toLowerCase();
  };

  const VerificationBadge = ({ verification, role, email }: { verification: any, role: string, email: string }) => {
    const trustScore = verification?.trustScore || 0;
    const isGlobalHQ = role === 'super_admin' || role === 'hq_admin';

    if (isGlobalHQ) {
      return (
        <div className="flex items-center gap-1">
          <span className="text-[8px] bg-slate-900 text-white px-2 py-0.5 rounded font-black lowercase tracking-widest">global authority node</span>
          <span className="text-[10px] font-black text-indigo-600 ml-2 whitespace-nowrap lowercase tracking-tighter">trust: 100</span>
        </div>
      );
    }

    if (!verification) return <span className="text-[8px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded font-black tracking-widest lowercase">unverified node</span>;
    
    return (
      <div className="flex items-center gap-1">
        {verification.emailVerified && <span className="text-[8px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded font-black lowercase">email</span>}
        {verification.identityVerified && <span className="text-[8px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded font-black lowercase">identity</span>}
        {verification.businessVerified && <span className="text-[8px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded font-black lowercase">business</span>}
        {verification.aadhaarVerified && <span className="text-[8px] bg-amber-100 text-amber-600 px-2 py-0.5 rounded font-black lowercase">aadhaar</span>}
        <span className="text-[10px] font-black text-indigo-600 ml-2 whitespace-nowrap lowercase tracking-tighter">trust: {trustScore}</span>
      </div>
    );
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchUsers();
      } else {
        setLoading(false);
        setError("IDENTITY_REQUIRED: Please sign in with an authorized Global HQ node account.");
      }
    });
    return () => unsub();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("No active identity found. Access Denied.");
      
      const token = await user.getIdToken();
      // Fetch everything via governance API (bypasses rules via Admin SDK)
      const govResp = await fetch('/api/governance', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (govResp.ok) {
        const data = await govResp.json();
        const orgs = data.organizations || [];
        const remoteUsers = (data.users || []).filter((u: any) => !u.deleted);
        const remoteRequests = data.onboarding_requests || [];

        setSyncMode(data.mode || (data.isMock ? "FALLBACK" : "LIVE"));
        setNodeId(data.nodeId || "");
        setDbStatus({
          projectId: data.nodeId || 'unknown',
          connected: data.mode !== 'FALLBACK' && data.mode !== 'FATAL_FALLBACK',
          lastCheck: new Date().toLocaleTimeString()
        });
        
        setUsers(remoteUsers.map((u: any) => {
          const orgId = u.organizationId || u.orgId || (u.org && u.org.id);
          const org = orgs.find((o: any) => o.id === orgId || o.organizationId === orgId);
          return { ...u, id: u.uid || u.id, uid: u.uid || u.id, org };
        }));

        setOnboardingRequests(remoteRequests);
      } else {
        throw new Error("Governance metadata handshake failed");
      }
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('permission')) {
        console.warn("Governance Queue: ACCESS_DENIED. Check Rules/IAM.");
        setError(`DATABASE ACCESS DENIED: Authority Rejection for [${auth.currentUser?.email}]. Ensure you have granted IAM permissions to the service account shown in the Security & Trust dashboard.`);
      }
      console.warn("Governance API failed, attempting Firestore fallback", err.message);
      setSyncMode("FS_FALLBACK");
      try {
        const [userSnap, orgSnap, reqSnap] = await Promise.all([
          getDocs(query(collection(db, "users"), limit(25))),
          getDocs(query(collection(db, "organizations"), limit(25))),
          getDocs(query(collection(db, "onboarding_requests"), limit(25)))
        ]);
        const orgs = orgSnap.docs.map(d => ({ id: d.id, ...d.data() }) as any);
        setUsers(userSnap.docs.map(d => {
          const u = d.data() as any;
          const org = orgs.find(o => o.id === u.organizationId);
          return { id: d.id, uid: d.id, ...u, org };
        }).filter((u: any) => !u.deleted));
        setOnboardingRequests(reqSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (fErr: any) {
        const identity = auth.currentUser?.email?.toLowerCase() || "Unknown Identity";
        setError(`IDENTITY ACCESS DENIED: Authority Rejection for [${identity}]. Ensure your email has Admin authority and you have granted IAM permissions to the service account in GCP Console.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async (requestId: string, targetRole: string) => {
    if (!window.confirm("Approve this request and provision live authority?")) return;
    setIsSubmitting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/approve-request', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ requestId, role: targetRole })
      });
      if (!response.ok) throw new Error("Approval protocol failed");
      await fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateUserClientFallback = async (emailVal: string, passwordVal: string, roleVal: string, companyNameVal: string) => {
    console.log("[ClientOnboarding] Falling back to local client-side onboarding due to authority node credential exception.");
    
    const { initializeApp: initClientApp, deleteApp } = await import("firebase/app");
    const { getAuth: getClientAuth, createUserWithEmailAndPassword, signOut } = await import("firebase/auth");
    const { doc, setDoc } = await import("firebase/firestore");
    const firebaseConfig = (await import("../../firebase-applet-config.json")).default;
    
    const config = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || firebaseConfig.apiKey,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || firebaseConfig.appId,
    };

    const tempAppName = `temp-onboard-${Date.now()}`;
    const tempApp = initClientApp(config, tempAppName);
    const tempAuth = getClientAuth(tempApp);

    try {
      const userCredential = await createUserWithEmailAndPassword(tempAuth, emailVal, passwordVal);
      const newUid = userCredential.user.uid;
      console.log("[ClientOnboarding] Auth account created client-side under UID:", newUid);

      const orgId = "ORG-" + Math.random().toString(36).substr(2, 9);
      let orgType = 'client';
      if (roleVal?.includes('vendor')) orgType = 'vendor';
      else if (roleVal?.includes('recruiter')) orgType = 'recruiter';
      else if (roleVal?.includes('independent')) orgType = 'independent';

      await setDoc(doc(db, "organizations", orgId), {
        id: orgId,
        organizationId: orgId,
        companyName: companyNameVal || "New Entity",
        type: orgType,
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      });

      await setDoc(doc(db, "users", newUid), {
        uid: newUid,
        email: emailVal,
        role: roleVal || 'client_admin',
        organizationId: orgId,
        status: 'ACTIVE',
        onboardingCompleted: true,
        createdAt: new Date().toISOString()
      });

      await signOut(tempAuth);
      await deleteApp(tempApp);

      return { ok: true, uid: newUid };
    } catch (err: any) {
      try {
        await deleteApp(tempApp);
      } catch (_) {}
      throw err;
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters for Firebase security protocols.");
      }

      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ email, password, role, companyName })
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        let errorMessage = "Onboarding failed";
        
        if (contentType && contentType.includes("application/json")) {
          const errData = await response.json();
          errorMessage = errData.error || errorMessage;
        } else {
          const text = await response.text();
          errorMessage = text || `Server error (${response.status})`;
        }
        
        console.warn(`[Onboarding] Primary API failed: ${errorMessage}. Invoking client fallback...`);
        await handleCreateUserClientFallback(email, password, role, companyName);
        console.log("[Onboarding] Client-side user fallback successful!");
      }

      setEmail("");
      setPassword("");
      setCompanyName("");
      await fetchUsers();
    } catch (err: any) {
       console.warn(`[Onboarding] API error encountered (${err.message}). Invoking client-side setup...`);
       try {
         await handleCreateUserClientFallback(email, password, role, companyName);
         setEmail("");
         setPassword("");
         setCompanyName("");
         await fetchUsers();
       } catch (fallbackError: any) {
         setError(`Onboarding failed. Details: ${fallbackError.message}`);
       }
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      setIsSubmitting(true);
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ uid: userToDelete.id, organizationId: userToDelete.orgId })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete user");
      }
      setUserToDelete(null);
      await fetchUsers();
    } catch (err: any) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = users.filter(u => {
    if (activeTab === "ALL") return true;
    return getRoleCategory(u.role) === activeTab;
  });

  const isAdmin = orgData?.role === 'admin' || orgData?.role === 'super_admin' || orgData?.role === 'ops_admin';

  if (!isAdmin) {
    return <div className="p-8 text-red-500 font-bold uppercase tracking-tight">Access Denied. Global HQ Node Only.</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-12 flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight lowercase">identity protocol matrix</h1>
            <p className="text-slate-400 font-bold text-[10px] lowercase tracking-widest mt-1">
              <span className="text-indigo-600">governance protocol hub</span> • platform node authority & scaling
            </p>
        </div>
        <div className="flex bg-slate-900 p-1 rounded-xl items-center gap-2">
          {nodeId && (
            <div className="px-3 py-1 bg-indigo-600 rounded-lg text-[8px] font-black text-white uppercase tracking-tighter">
               ID: {nodeId}
            </div>
          )}
          <div className="px-4 py-2 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            <div className={cn(
              "h-2 w-2 rounded-full animate-pulse",
              syncMode === 'LIVE' ? 'bg-emerald-500' : 
              syncMode === 'HYBRID_MOCK' ? 'bg-amber-500' : 'bg-red-500'
            )} />
            Node Sync: {syncMode}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        <div className="lg:col-span-1 space-y-6">
          <div className="border-2 border-slate-100 rounded-[32px] p-8 transition-all bg-white shadow-sm">
            <h2 className="text-xs font-black lowercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-2">
               <Save size={14} className="text-indigo-600" />
               onboard new node
            </h2>
            
            {error && (
              <div className="mb-6 bg-red-50 border border-red-100 rounded-2xl p-4">
                <p className="text-[10px] font-black lowercase tracking-widest text-red-600 mb-2">{error}</p>
                {error.toUpperCase().includes("API_DISABLED") || 
                 error.toUpperCase().includes("INFRASTRUCTURE_FAILURE") || 
                 error.toUpperCase().includes("ACCESS DENIED") ||
                 error.toUpperCase().includes("PERMISSION_DENIED") ? (
                  <div className="space-y-2">
                    <p className="text-[9px] text-red-500 font-bold leading-relaxed">
                      critical: identity protocol requires "identity toolkit api" and correct "iam roles" (including service usage consumer) for the service account in project {nodeId || 'hirenest-os'}.
                    </p>
                    <div className="flex gap-2">
                        <a 
                          href={`https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com?project=${nodeId || 'hirenest-os'}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block bg-red-600 text-white text-[9px] font-black px-3 py-2 rounded-lg hover:bg-slate-900 transition-all uppercase tracking-tighter"
                        >
                          Enable API
                        </a>
                        <a 
                          href={`https://console.cloud.google.com/iam-admin/iam?project=${nodeId || 'hirenest-os'}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block bg-slate-800 text-white text-[9px] font-black px-3 py-2 rounded-lg hover:bg-slate-900 transition-all uppercase tracking-tighter"
                        >
                          Grant IAM Roles
                        </a>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
            
            <form onSubmit={handleCreateUser} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-500 lowercase tracking-widest mb-2">entity name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-600 rounded-2xl p-4 text-sm font-bold focus:bg-white transition-all outline-none"
                  placeholder="e.g. acme agency"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-slate-500 lowercase tracking-widest mb-2">node email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-600 rounded-2xl p-4 text-sm font-bold focus:bg-white transition-all outline-none"
                  placeholder="user@example.com"
                />
              </div>
 
              <div>
                <label className="block text-[10px] font-black text-slate-500 lowercase tracking-widest mb-2">initial key</label>
                <input
                  type="text" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-600 rounded-2xl p-4 text-sm font-bold focus:bg-white transition-all outline-none"
                  placeholder="secure key"
                />
              </div>
 
              <div>
                <label className="block text-[10px] font-black text-slate-500 lowercase tracking-widest mb-2">node role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-600 rounded-2xl p-4 text-sm font-bold focus:bg-white transition-all outline-none appearance-none"
                >
                  {roles.filter(r => r.value !== 'admin').map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                  <option value="admin">platform authority (hq)</option>
                </select>
              </div>
 
              <Button 
                type="submit" 
                disabled={isSubmitting} 
                className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-slate-900 font-black lowercase tracking-[0.2em] text-[11px] transition-all shadow-xl shadow-indigo-100"
              >
                {isSubmitting ? "syncing..." : "onboard identity"}
              </Button>
            </form>
          </div>
 
          <div className="bg-slate-900 rounded-[32px] p-8 text-white">
            <h3 className="text-[10px] font-black lowercase tracking-[0.3em] text-slate-500 mb-6 text-center">Protocol Connectivity</h3>
            <div className="space-y-4">
               <div className="flex items-center justify-between">
                 <span className="text-[10px] font-black lowercase tracking-widest text-slate-400">Node ID</span>
                 <span className="text-[10px] font-mono text-indigo-400 truncate max-w-[120px]">{dbStatus.projectId}</span>
               </div>
               <div className="flex items-center justify-between">
                 <span className="text-[10px] font-black lowercase tracking-widest text-slate-400">Sync Status</span>
                 <span className={cn(
                   "text-[10px] font-black lowercase tracking-widest",
                   dbStatus.connected ? "text-emerald-400" : "text-amber-400"
                 )}>
                   {dbStatus.connected ? "verified" : "fallback_mode"}
                 </span>
               </div>
               <div className="flex items-center justify-between">
                 <span className="text-[10px] font-black lowercase tracking-widest text-slate-400">Last Latency</span>
                 <span className="text-[10px] font-mono text-slate-500">{dbStatus.lastCheck}</span>
               </div>
               <div className="pt-4 border-t border-slate-800">
                  <Button 
                    variant="ghost" 
                    onClick={fetchUsers}
                    className="w-full text-[9px] h-8 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg tracking-widest uppercase font-black"
                  >
                    Refresh Matrix
                  </Button>
               </div>
            </div>
          </div>

          <div className="bg-white border-2 border-slate-50 rounded-[32px] p-8">
            <h3 className="text-[10px] font-black lowercase tracking-[0.3em] text-slate-400 mb-6 text-center">node composition</h3>
            <div className="space-y-4">
               {['GOVERNANCE', 'DEMAND', 'SUPPLY'].map(cat => {
                 const count = users.filter(u => getRoleCategory(u.role) === cat).length;
                 return (
                   <div key={cat} className="flex items-center justify-between">
                     <span className="text-[10px] font-black lowercase tracking-widest text-slate-500">{cat.toLowerCase()}</span>
                     <span className="bg-slate-50 px-3 py-1 rounded-lg text-[10px] text-slate-900 font-black">{count}</span>
                   </div>
                 );
               })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit">
            {(["ALL", "GOVERNANCE", "DEMAND", "SUPPLY", "ONBOARDING", "PERMISSIONS"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-6 py-3 rounded-xl text-[10px] font-black lowercase tracking-widest transition-all relative",
                  activeTab === tab ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-900"
                )}
              >
                {tab.toLowerCase()}
                {tab === "ONBOARDING" && onboardingRequests.filter(r => r.verificationStatus === 'PENDING').length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[8px] font-black">{onboardingRequests.filter(r => r.verificationStatus === 'PENDING').length}</span>
                )}
              </button>
            ))}
          </div>

          <div className="bg-white border-2 border-slate-50 rounded-[40px] p-10 shadow-sm">
            <div className="space-y-4">
              {loading ? (
                <div className="py-32 text-center text-[10px] font-black lowercase tracking-[0.3em] text-slate-400">syncing matrix...</div>
              ) : activeTab === "PERMISSIONS" ? (
                <div className="space-y-6">
                   <div className="flex items-center justify-between mb-8 border-b border-slate-50 pb-6">
                      <h3 className="text-sm font-black lowercase italic tracking-tight">saas capability matrix</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Pricing & Variations</p>
                   </div>
                   <div className="space-y-4">
                     {[
                       { role: "super_admin", access: "Full System Write & Read, Billing, Orchestration", tier: "Global HQ" },
                       { role: "vendor_admin", access: "Vendor OS, Master Agency Settings, Sub-recruiter Management, Job Visibility", tier: "Enterprise Vendor" },
                       { role: "vendor_recruiter", access: "Candidate Submission, Job Matching, Deal Rooms", tier: "Sub-seat (Vendor)" },
                       { role: "client_admin", access: "Client OS, Requisition Creation, Candidate Review, Offers", tier: "Enterprise Client" },
                       { role: "independent", access: "Single-seat Recruiting, Job Matching, Candidate Submission", tier: "Pro Seat" },
                     ].map((item, idx) => (
                       <div key={idx} className="flex flex-col md:flex-row justify-between p-6 bg-slate-50 rounded-[28px] border-2 border-slate-100 items-start md:items-center gap-4">
                         <div>
                           <div className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-1">{item.role}</div>
                           <div className="text-sm font-medium text-slate-700">{item.access}</div>
                         </div>
                         <div className="bg-white px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase border border-slate-200">
                           {item.tier}
                         </div>
                       </div>
                     ))}
                   </div>
                </div>
              ) : activeTab === "ONBOARDING" ? (
                <div className="space-y-6">
                   <div className="flex items-center justify-between mb-8 border-b border-slate-50 pb-6">
                      <h3 className="text-sm font-black lowercase italic tracking-tight">network verification center</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Global Admission Queue</p>
                   </div>
                   {onboardingRequests.map(req => (
                     <div key={req.id} className="group p-6 bg-slate-50 border-2 border-slate-100 rounded-[32px] hover:border-indigo-200 hover:bg-white hover:shadow-2xl transition-all">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-6">
                              <div className={cn(
                                "h-14 w-14 rounded-2xl flex items-center justify-center text-white font-black",
                                req.verificationStatus === 'VERIFIED' ? 'bg-emerald-500' : 'bg-indigo-600'
                              )}>
                                 {safeInitial(req.companyName || req.email, 'O')}
                              </div>
                              <div>
                                 <div className="text-sm font-black text-slate-900 tracking-tight">{req.companyName || 'Unnamed Entity'}</div>
                                 <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] text-slate-400 font-bold lowercase tracking-widest">{req.email || 'No email'}</span>
                                    <span className="h-1 w-1 rounded-full bg-slate-200" />
                                    <span className={cn(
                                      "text-[10px] font-black uppercase tracking-tighter",
                                      req.type === 'client' ? 'text-indigo-600' : 'text-amber-600'
                                    )}>{req.type} invitation</span>
                                 </div>
                                 <div className="mt-2 flex items-center gap-2">
                                    <span className={cn(
                                      "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded",
                                      req.verificationStatus === 'PENDING' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                                    )}>{req.verificationStatus}</span>
                                    <span className="text-[10px] font-black text-red-500 ml-2">Risk: {req.riskScore}</span>
                                 </div>
                              </div>
                           </div>
                           
                           {req.verificationStatus === 'PENDING' && (
                             <div className="flex items-center gap-3">
                                <select 
                                  className="bg-white border border-slate-200 rounded-lg text-[10px] font-bold p-2 outline-none focus:ring-1 focus:ring-indigo-500"
                                  id={`role-${req.id}`}
                                >
                                  {roles.filter(r => !r.value.includes('hq')).map(r => (
                                    <option key={r.value} value={r.value}>{r.label}</option>
                                  ))}
                                </select>
                                <Button 
                                  size="sm"
                                  onClick={() => {
                                    const roleSelect = document.getElementById(`role-${req.id}`) as HTMLSelectElement;
                                    handleApproveRequest(req.id, roleSelect.value);
                                  }}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black py-2 px-6"
                                >
                                  Approve & Provision
                                </Button>
                             </div>
                           )}
                        </div>
                     </div>
                   ))}
                   {onboardingRequests.length === 0 && (
                     <div className="py-20 text-center bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-100">
                       <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Queue Empty</p>
                     </div>
                   )}
                </div>
              ) : (
                <>
                  {filteredUsers.map(u => (
                    <SafeUserRow 
                       key={u.id || Math.random().toString()} 
                       u={u} 
                       getRoleCategory={getRoleCategory} 
                       safeInitial={safeInitial} 
                       getRoleLabel={getRoleLabel} 
                       setSelectedUserForTracking={setSelectedUserForTracking} 
                       VerificationBadge={VerificationBadge} 
                       auth={auth} 
                       setIsSubmitting={setIsSubmitting} 
                       setUserToDelete={setUserToDelete} 
                       setEditingUser={setEditingUser} 
                       isSubmitting={isSubmitting} 
                    />
                  ))}
                  {false && filteredUsers.map(u => (
                    <div key={u.id} className="group flex items-center justify-between p-6 bg-white border-2 border-slate-50 rounded-[28px] hover:border-indigo-100 hover:shadow-xl hover:shadow-slate-50 transition-all">
                      <div className="flex items-center gap-6">
                        <div className={cn(
                          "h-12 w-12 rounded-2xl flex items-center justify-center font-black",
                          getRoleCategory(u.role) === 'GOVERNANCE' ? 'bg-slate-900 text-white' :
                          getRoleCategory(u.role) === 'DEMAND' ? 'bg-indigo-600 text-white' : 'bg-amber-500 text-white'
                        )}>
                          {safeInitial(u.email || u.displayName || u.name, 'U')}
                        </div>
                        <div>
                          <div className="font-black text-slate-900 lowercase tracking-tight flex items-center gap-2">
                            <button onClick={() => setSelectedUserForTracking(u)} className="hover:text-indigo-600 transition-colors text-left underline decoration-slate-200 underline-offset-4">
                              {u.email || u.displayName || u.name || 'Anonymous User'}
                            </button>
                            {u.role === 'admin' && <Check size={12} className="text-indigo-600" />}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                             <span className="text-[10px] text-slate-400 font-bold lowercase tracking-widest">
                               {u.org?.companyName?.toLowerCase() || 'unmapped entity'}
                               {u.org?.plan && (
                                 <span className="ml-2 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] uppercase font-black">
                                   {u.org.plan}
                                 </span>
                               )}
                             </span>
                             <span className="h-1 w-1 rounded-full bg-slate-200" />
                             <span className={cn(
                               "text-[10px] font-black lowercase tracking-widest",
                               getRoleCategory(u.role) === 'GOVERNANCE' ? 'text-slate-900' :
                               getRoleCategory(u.role) === 'DEMAND' ? 'text-indigo-600' : 'text-amber-600'
                             )}>
                               {getRoleLabel(u.role).toLowerCase()}
                             </span>
                          </div>
                          <div className="mt-2 flex items-center gap-4">
                             <VerificationBadge verification={u.verification} role={u.role} email={u.email} />
                             <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                               <Clock size={12} className="text-slate-400" />
                               {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                             </div>
                             <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                               <span className={cn("w-1.5 h-1.5 rounded-full", u.disabled ? "bg-red-500" : "bg-emerald-500")} />
                               {u.disabled ? 'Disabled' : 'Active'}
                             </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                            onClick={async () => {
                              if (confirm(`Sync ${u.email} role [${u.role}] to Custom Claims? This enables enterprise rule enforcement.`)) {
                                try {
                                  setIsSubmitting(true);
                                  const token = await auth.currentUser?.getIdToken();
                                  const resp = await fetch('/api/assign-role', {
                                    method: 'POST',
                                    headers: { 
                                      'Content-Type': 'application/json',
                                      'Authorization': `Bearer ${token}` 
                                    },
                                    body: JSON.stringify({ uid: u.id, role: u.role, organizationId: u.organizationId })
                                  });
                                  if (resp.ok) alert("IAM Role synchronized. Access Protocol Updated.");
                                  else alert("IAM sync failed.");
                                } catch (e) {
                                  alert("Network handshake failure");
                                } finally {
                                  setIsSubmitting(false);
                                }
                              }
                            }}
                            className="h-10 w-10 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-500 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                            title="Sync IAM Custom Claims"
                         >
                            <Lock size={16} />
                         </button>
                         <button 
                            onClick={() => setUserToDelete({ id: u.id, orgId: u.organizationId, email: u.email, name: u.name || "Unknown", role: u.role, data: u })}
                            className="h-10 w-10 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                         >
                            <Trash2 size={16} />
                         </button>
                      </div>
                    </div>
                  ))}
                  {filteredUsers.length === 0 && (
                    <div className="py-20 text-center bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-100">
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Zero Nodes in Category</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
                <Trash2 size={32} className="text-red-500" />
              </div>
            </div>
            
            <h2 className="text-xl font-bold text-center text-slate-900 mb-2">Delete User Permanently</h2>
            
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6">
              <div className="flex justify-between py-2 border-b border-slate-200">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Name</span>
                <span className="text-sm font-semibold text-slate-900">{userToDelete.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-200">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Email</span>
                <span className="text-sm font-semibold text-slate-900">{userToDelete.email}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Role</span>
                <span className="text-sm font-semibold text-slate-900">{getRoleLabel(userToDelete.role)}</span>
              </div>
            </div>
            
            <p className="text-center text-sm font-semibold text-red-600 mb-6 px-4">
              ⚠️ This action cannot be undone. It is highly recommended to export their data before permanent deletion.
            </p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(userToDelete.data || userToDelete, null, 2));
                  const dlAnchorElem = document.createElement('a');
                  dlAnchorElem.setAttribute("href", dataStr);
                  dlAnchorElem.setAttribute("download", `user_export_${userToDelete.email}.json`);
                  dlAnchorElem.click();
                }}
                className="w-full py-3 px-4 rounded-xl border-2 border-indigo-100 bg-indigo-50 text-indigo-700 font-black tracking-widest uppercase text-[10px] hover:bg-indigo-100 transition-colors"
                disabled={isSubmitting}
              >
                Export Data (JSON)
              </button>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => setUserToDelete(null)}
                  className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button 
                  onClick={executeDeleteUser}
                  disabled={isSubmitting}
                  className="flex-1 py-3 px-4 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Deleting..." : "Delete Permanently"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Tracking Modal */}
      {selectedUserForTracking && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
            
            <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-xl font-black text-slate-900 lowercase italic">identity telemetry</h2>
              <span className={cn(
                "px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest",
                selectedUserForTracking.isOnline ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
              )}>
                {selectedUserForTracking.isOnline ? "Active Session" : "Offline"}
              </span>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                <div className={cn(
                  "h-12 w-12 rounded-2xl flex items-center justify-center font-black text-xl text-white",
                  getRoleCategory(selectedUserForTracking.role) === 'GOVERNANCE' ? 'bg-slate-900' :
                  getRoleCategory(selectedUserForTracking.role) === 'DEMAND' ? 'bg-indigo-600' : 'bg-amber-500'
                )}>
                  {safeInitial(selectedUserForTracking.email || selectedUserForTracking.displayName || selectedUserForTracking.name, 'U')}
                </div>
                <div>
                  <div className="font-black text-slate-900 lowercase text-lg">{selectedUserForTracking.email || selectedUserForTracking.displayName || selectedUserForTracking.name || 'User'}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    {getRoleLabel(selectedUserForTracking.role)} Node
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-100">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Last Login</div>
                  <div className="font-bold text-slate-700 text-sm">
                    {selectedUserForTracking.lastLoginAt ? new Date(selectedUserForTracking.lastLoginAt).toLocaleString() : 'Never'}
                  </div>
                </div>
                <div className="p-4 rounded-2xl border border-slate-100">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Created At</div>
                  <div className="font-bold text-slate-700 text-sm">
                    {selectedUserForTracking.createdAt ? new Date(selectedUserForTracking.createdAt).toLocaleString() : 'Unknown'}
                  </div>
                </div>
                <div className="p-4 rounded-2xl border border-slate-100">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Organization</div>
                  <div className="font-bold text-slate-700 text-sm">
                    {selectedUserForTracking.org?.companyName || 'Unmapped'}
                  </div>
                </div>
                <div className="p-4 rounded-2xl border border-slate-100">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">UID</div>
                  <div className="font-mono text-slate-700 text-[10px] truncate">
                    {selectedUserForTracking.uid || selectedUserForTracking.id}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-8 flex justify-end">
              <button 
                onClick={() => setSelectedUserForTracking(null)}
                className="py-3 px-8 rounded-xl bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-colors"
              >
                Close Telemetry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

