import React, { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { User as UserIcon, Building, Bell, Shield, LogOut, Moon, Sun, Monitor, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

export default function SettingsTab() {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [workspaceDetails, setWorkspaceDetails] = useState<any>(null);
  const [rufloHealth, setRufloHealth] = useState<any>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!auth.currentUser) return;
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }

        const token = await auth.currentUser.getIdToken();
        const res = await fetch('/api/workspace/status', {
           headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setIsGoogleConnected(data.connected);
        if (data.connected) {
        try {
          const rufloRes = await fetch("/api/ruflo/health", {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (rufloRes.ok) {
            setRufloHealth(await rufloRes.json());
          }
        } catch (e) {
          console.warn("Ruflo health fetch failed", e);
        }
           setWorkspaceDetails(data);
        try {
          const rufloRes = await fetch("/api/ruflo/health", {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (rufloRes.ok) {
            setRufloHealth(await rufloRes.json());
          }
        } catch (e) {
          console.warn("Ruflo health fetch failed", e);
        }
        }
        try {
          const rufloRes = await fetch("/api/ruflo/health", {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (rufloRes.ok) {
            setRufloHealth(await rufloRes.json());
          }
        } catch (e) {
          console.warn("Ruflo health fetch failed", e);
        }
      } catch (err) {
        console.error("Failed to load user profile:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      window.location.href = "/";
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center justify-center text-slate-400 gap-4">
          <div className="w-8 h-8 rounded-full border-t-2 border-indigo-600 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Settings</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Manage your account preferences and operational settings.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-6 md:col-span-1">
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
               <div className="h-20 w-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-sm">
                 <UserIcon size={32} />
               </div>
               <div className="text-center">
                 <h2 className="text-lg font-bold text-slate-900">{userData?.name || auth.currentUser?.email?.split('@')[0] || "User Profile"}</h2>
                 <p className="text-sm text-slate-500">{auth.currentUser?.email}</p>
                 <div className="mt-4 flex justify-center">
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest">{userData?.role || "GUEST"}</span>
                 </div>
               </div>
             </div>

             <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
               <button onClick={handleSignOut} className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors text-rose-600 font-bold group">
                 <div className="p-2 bg-rose-50 rounded-lg group-hover:bg-rose-100 transition-colors">
                   <LogOut size={16} />
                 </div>
                 Sign Out
               </button>
             </div>
          </div>

          <div className="space-y-6 md:col-span-2">
            
            {/* Context & Organization */}
            <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-6">
                <Building className="text-indigo-600" size={20} />
                <h3 className="font-bold text-slate-800 uppercase tracking-widest text-xs">Organization Profile</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Company Name</label>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700">{userData?.companyName || "N/A"}</div>
                 </div>
                 <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Organization ID</label>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-500">{userData?.organizationId || "N/A"}</div>
                 </div>
                 <div className="sm:col-span-2">
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Workspace Type</label>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 capitalize">{userData?.type || userData?.role || "Standard"}</div>
                 </div>
              </div>
            </section>

            {/* Integrations */}
            <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-6">
                <Monitor className="text-indigo-600" size={20} />
                <h3 className="font-bold text-slate-800 uppercase tracking-widest text-xs">Integrations</h3>
              </div>
              <div className="space-y-4">
                 <div className="flex flex-col gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center">
                       <div>
                          <p className="font-bold text-sm text-slate-800">Google Workspace</p>
                          <p className="text-xs text-slate-500 mt-1">Connect your Google account to enable email sync and calendar integrations within Client360 and Vendor360.</p>
                       </div>
                       <div className="mt-4 sm:mt-0">
                         {isGoogleConnected ? (
                           <span className="px-2 py-1 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 w-max">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Connected
                           </span>
                         ) : (
                           <span className="px-2 py-1 bg-slate-200 text-slate-600 border border-slate-300 rounded text-[10px] font-bold uppercase tracking-widest w-max">
                              Not Connected
                           </span>
                         )}
                       </div>
                    </div>

                    {isGoogleConnected && workspaceDetails && (
                      <div className="bg-white border border-slate-200 rounded-lg p-4 mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Account</p>
                            <p className="text-sm font-mono text-slate-700">{workspaceDetails.emailAddress || 'Unknown'}</p>
                         </div>
                         <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Services</p>
                            <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                               <span className="flex items-center gap-1"><span className="text-emerald-500">✓</span> Gmail</span>
                               {workspaceDetails.calendar && <span className="flex items-center gap-1"><span className="text-emerald-500">✓</span> Calendar</span>}
                               {workspaceDetails.watchStatus && <span className="flex items-center gap-1"><span className="text-emerald-500">✓</span> Pub/Sub</span>}
                               <span className="flex items-center gap-1"><span className="text-emerald-500">✓</span> MailOS</span>
                            </div>
                         </div>
                         <div className="sm:col-span-2 flex items-center justify-between border-t border-slate-100 pt-3 mt-1">
                            <p className="text-[10px] text-slate-500">
                               Watch expires: {workspaceDetails.watchStatus && workspaceDetails.watchExpiration ? new Date(workspaceDetails.watchExpiration).toLocaleString() : 'N/A'}
                            </p>
                            {workspaceDetails.watchStatus === false && workspaceDetails.watchError && (
                               <p className="text-[10px] text-rose-500 max-w-sm truncate" title={typeof workspaceDetails.watchError === 'object' ? JSON.stringify(workspaceDetails.watchError) : workspaceDetails.watchError}>
                                  Watch Error: {typeof workspaceDetails.watchError === 'object' ? 'Permission Denied or Config Error' : workspaceDetails.watchError}
                               </p>
                            )}
                            <p className="text-[10px] text-slate-500">
                               Last Sync: {workspaceDetails.lastRefresh ? new Date(workspaceDetails.lastRefresh._seconds ? workspaceDetails.lastRefresh._seconds * 1000 : workspaceDetails.lastRefresh).toLocaleTimeString() : 'N/A'}
                            </p>
                         </div>
                      </div>
                    )}

                    <div className="flex gap-3 justify-end mt-2">
                      {isGoogleConnected && (
                         <button 
                            onClick={async () => {
                              try {
                                const token = await auth.currentUser?.getIdToken();
                                const res = await fetch(`/api/oauth/url?uid=${auth.currentUser?.uid}&redirectTo=/app`, {
                                  headers: { 'Authorization': `Bearer ${token}` }
                                });
                                const data = await res.json();
                                if (data.url) window.location.href = data.url;
                              } catch (e) { console.error(e); }
                            }}
                            className="px-4 py-2 font-bold text-xs uppercase tracking-widest rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                         >
                            Reconnect
                         </button>
                      )}
                      <button 
                         onClick={async () => {
                           try {
                             const token = await auth.currentUser?.getIdToken();
                             const uid = auth.currentUser?.uid;
                             if (isGoogleConnected) {
                                await fetch('/api/oauth/disconnect', {
                                  method: 'POST',
                                  headers: { 'Authorization': `Bearer ${token}` }
                                });
                                setIsGoogleConnected(false);
                                setWorkspaceDetails(null);
                                return;
                             }
                             const res = await fetch(`/api/oauth/url?uid=${uid}&redirectTo=/app`, {
                               headers: { 'Authorization': `Bearer ${token}` }
                             });
                             const data = await res.json();
                             if (data.url) {
                               window.location.href = data.url;
                             } else {
                               alert("Failed to get OAuth URL");
                             }
                           } catch (e) {
                             console.error(e);
                           }
                         }}
                         className={cn(
                           "px-4 py-2 font-bold text-xs uppercase tracking-widest rounded-lg whitespace-nowrap shrink-0 transition-colors",
                           isGoogleConnected 
                             ? "bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100"
                             : "bg-indigo-600 border border-indigo-700 text-white hover:bg-indigo-700"
                         )}
                      >
                         {isGoogleConnected ? "Disconnect" : "Connect Google"}
                      </button>
                    </div>
                 </div>
                 {/* Ruflo Integration */}
                 <div className="flex flex-col gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 mt-4">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center">
                       <div>
                          <p className="font-bold text-sm text-slate-800">Ruflo Agent Harness</p>
                          <p className="text-xs text-slate-500 mt-1">Enterprise AI agent orchestration platform (L1 Capability).</p>
                       </div>
                       <div className="mt-4 sm:mt-0">
                         {rufloHealth && rufloHealth.status === 'OK' ? (
                           <span className="px-2 py-1 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 w-max">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Online (L1)
                           </span>
                         ) : (
                           <span className="px-2 py-1 bg-slate-200 text-slate-600 border border-slate-300 rounded text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 w-max">
                              <span className="w-1.5 h-1.5 bg-slate-500 rounded-full"></span> Offline
                           </span>
                         )}
                       </div>
                    </div>
                    
                    {rufloHealth && rufloHealth.status === 'OK' && (
                       <div className="bg-white border border-slate-200 rounded-lg p-4 mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                             <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Latency</p>
                             <p className="text-sm font-mono text-slate-700">{rufloHealth.latency}ms</p>
                          </div>
                          <div>
                             <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Provider</p>
                             <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                                <span className="flex items-center gap-1"><span className="text-emerald-500">✓</span> @claude-flow/cli</span>
                             </div>
                          </div>
                       </div>
                    )}
                    
                    <div className="flex gap-3 justify-end mt-2">
                       <button
                          onClick={async () => {
                             try {
                               const token = await auth.currentUser?.getIdToken();
                               const res = await fetch('/api/ruflo/init', {
                                 method: 'POST',
                                 headers: { 'Authorization': `Bearer ${token}` }
                               });
                               if (res.ok) {
                                  const hRes = await fetch('/api/ruflo/health', {
                                    headers: { 'Authorization': `Bearer ${token}` }
                                  });
                                  setRufloHealth(await hRes.json());
                               } else {
                                  alert("Failed to initialize Ruflo Integration.");
                               }
                             } catch (e) {
                               console.error(e);
                             }
                          }}
                          className={cn(
                             "px-4 py-2 font-bold text-xs uppercase tracking-widest rounded-lg whitespace-nowrap shrink-0 transition-colors",
                             rufloHealth && rufloHealth.status === 'OK'
                               ? "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                               : "bg-indigo-600 border border-indigo-700 text-white hover:bg-indigo-700"
                          )}
                       >
                          {rufloHealth && rufloHealth.status === 'OK' ? 'Re-Initialize' : 'Initialize Ruflo'}
                       </button>
                    </div>
                 </div>

              </div>
            </section>

            {/* Notification Preferences */}
            <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-6">
                <Bell className="text-indigo-600" size={20} />
                <h3 className="font-bold text-slate-800 uppercase tracking-widest text-xs">Notification Preferences</h3>
              </div>
              <div className="space-y-4">
                 <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                       <p className="font-bold text-sm text-slate-800">Email Notifications</p>
                       <p className="text-xs text-slate-500 mt-1">Receive daily pipeline digests and placement alerts.</p>
                    </div>
                    <div className="w-12 h-6 bg-indigo-500 rounded-full relative cursor-pointer">
                       <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>
                    </div>
                 </div>
                 <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                       <p className="font-bold text-sm text-slate-800">In-App Alerts</p>
                       <p className="text-xs text-slate-500 mt-1">Real-time alerts for workflow changes and interview actions.</p>
                    </div>
                    <div className="w-12 h-6 bg-indigo-500 rounded-full relative cursor-pointer">
                       <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>
                    </div>
                 </div>
              </div>
            </section>

            {/* Security & Data Erasure */}
            <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="text-slate-600" size={20} />
                <h3 className="font-bold text-slate-800 uppercase tracking-widest text-xs">Data & Security</h3>
              </div>
              <div className="space-y-4">
                 <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center p-4 border border-rose-100 bg-rose-50/30 rounded-xl">
                    <div className="flex gap-3">
                       <div className="mt-0.5">
                         <AlertTriangle className="text-rose-500" size={16} />
                       </div>
                       <div>
                          <p className="font-bold text-sm text-slate-800">Data Erasure Request</p>
                          <p className="text-xs text-slate-500 mt-1 max-w-sm">Initiate a formal request to purge all associated operational data from the global matrix.</p>
                       </div>
                    </div>
                    <button className="px-4 py-2 bg-white border border-rose-200 text-rose-600 font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-rose-50 whitespace-nowrap shrink-0 transition-colors">
                       Request Erasure
                    </button>
                 </div>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
