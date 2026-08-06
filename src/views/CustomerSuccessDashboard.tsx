import React, { useState, useEffect } from "react";
import { Users, TrendingUp, BarChart, MousePointerClick, HeartHandshake, Briefcase, UserCheck, HelpCircle, Compass, ShieldAlert, CheckCircle } from "lucide-react";
import { cn } from "../lib/utils";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function CustomerSuccessDashboard() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    clients: 0,
    vendors: 0,
    recruiters: 0,
    placements: 0,
    loginEvents: 0,
    totalEvents: 0,
    onboardingUsers: 0,
    completedOnboardings: 0,
    totalHelpClicks: 0,
    totalToursCompleted: 0,
    averageHealthScore: 0,
    userProgressList: [] as any[]
  });

  useEffect(() => {
    const fetchAdoption = async () => {
      try {
        const orgsSnap = await getDocs(query(collection(db, "organizations"), limit(25)));
        let clients = 0;
        let vendors = 0;
        orgsSnap.docs.forEach(d => {
          if (d.data().type === 'client') clients++;
          if (d.data().type === 'vendor') vendors++;
        });

        const usersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "recruiter"), limit(50)));
        let recruiters = usersSnap.size;

        const subsSnap = await getDocs(query(collection(db, "submissions"), where("status", "in", ["PLACED", "HIRED"]), limit(50)));
        let placements = subsSnap.size;

        const eventsSnap = await getDocs(query(collection(db, "eventLedger"), limit(25)));
        let totalEvents = eventsSnap.size;
        let loginEvents = eventsSnap.docs.filter(e => e.data().type === 'UserLoggedIn').length;

        // Experience Engine Onboarding & Telemetry Adoption
        const onboardingSnap = await getDocs(query(collection(db, "user_onboarding"), limit(25)));
        let onboardingUsers = onboardingSnap.size;
        let completedOnboardings = 0;
        let totalHelpClicks = 0;
        let totalToursCompleted = 0;
        let totalScoreSum = 0;
        const userProgressList: any[] = [];

        onboardingSnap.docs.forEach(d => {
          const data = d.data();
          const stepsCount = data.completedSteps?.length || 0;
          const weeksCount = data.completedWeeks?.length || 0;
          
          // Total items is 4 steps + 4 weeks = 8 total items
          const healthScore = Math.round(((stepsCount + weeksCount) / 8) * 100);
          totalScoreSum += healthScore;

          if (data.hasCompletedOnboarding === true || stepsCount >= 4) {
            completedOnboardings++;
          }

          totalHelpClicks += data.telemetry?.helpClicks || 0;
          totalToursCompleted += data.telemetry?.toursCompleted || 0;

          userProgressList.push({
            id: d.id,
            email: data.email || "unknown@node.os",
            role: data.role || "guest",
            healthScore,
            stepsCompleted: stepsCount,
            weeksCompleted: weeksCount,
            helpClicks: data.telemetry?.helpClicks || 0,
            toursCompleted: data.telemetry?.toursCompleted || 0,
            updatedAt: data.updatedAt || new Date().toISOString()
          });
        });

        const averageHealthScore = onboardingUsers > 0 ? Math.round(totalScoreSum / onboardingUsers) : 0;

        setMetrics({
          clients,
          vendors,
          recruiters,
          placements,
          loginEvents,
          totalEvents,
          onboardingUsers,
          completedOnboardings,
          totalHelpClicks,
          totalToursCompleted,
          averageHealthScore,
          userProgressList: userProgressList.sort((a, b) => b.healthScore - a.healthScore)
        });

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAdoption();
  }, []);

  if (loading) {
    return <div className="p-8 flex items-center justify-center font-bold text-slate-400 uppercase tracking-widest animate-pulse">Loading Growth Metrics...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 border-b border-emerald-500 pb-2 inline-block shadow-[inset_0_-2px_0_rgba(16,185,129,1)]">
            Customer Success & Growth
          </h1>
          <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-2">
            <HeartHandshake size={14} className="text-emerald-500" /> Experience Engine & Adoption Monitor
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         {/* Adoption Funnel Cards */}
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 col-span-1">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl inline-block mb-4">
               <Briefcase size={24} />
            </div>
            <p className="text-3xl font-black text-slate-900">{metrics.clients}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Active Clients</p>
         </div>

         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 col-span-1">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl inline-block mb-4">
               <Users size={24} />
            </div>
            <p className="text-3xl font-black text-slate-900">{metrics.vendors}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Active Vendors</p>
         </div>

         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 col-span-1">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl inline-block mb-4">
               <UserCheck size={24} />
            </div>
            <p className="text-3xl font-black text-slate-900">{metrics.recruiters}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Total Recruiters</p>
         </div>

         <div className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800 col-span-1 text-white">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl inline-block mb-4">
               <BarChart size={24} />
            </div>
            <p className="text-3xl font-black text-white">{metrics.placements}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Placements YTD</p>
         </div>

         {/* EXPERIENCE ENGINE TELEMETRY */}
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="col-span-full border-b border-slate-100 pb-3 flex justify-between items-center">
              <h3 className="font-bold text-slate-850 uppercase tracking-widest text-xs flex items-center gap-2">
                <Compass className="text-indigo-600" size={16} /> Experience Engine Telemetry Dashboard
              </h3>
              <span className="text-[10px] font-mono font-black text-slate-400 uppercase">Live telemetry aggregate</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-150">
              <p className="text-2xl font-black text-slate-900">{metrics.onboardingUsers}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">Active Users in Engine</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-150">
              <p className="text-2xl font-black text-indigo-600">{metrics.averageHealthScore}%</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">Avg Product Health Score</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-150">
              <p className="text-2xl font-black text-emerald-600">{metrics.totalToursCompleted}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">Guided Tours Completed</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-150">
              <p className="text-2xl font-black text-amber-600">{metrics.totalHelpClicks}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">Help Center Clicks</p>
            </div>
         </div>

         {/* USER ONBOARDING PIPELINE MONITOR */}
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-4">
            <div className="border-b border-slate-100 pb-4 mb-4 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 uppercase tracking-widest text-xs">User Activation & Compliance List</h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-1">Observe real-time activation rates and direct follow-ups</p>
              </div>
              <span className="text-[10px] bg-indigo-50 text-indigo-600 font-bold px-3 py-1 rounded-full">{metrics.completedOnboardings} completed</span>
            </div>

            {metrics.userProgressList.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-semibold">
                No user onboarding records registered in Experience Engine yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      <th className="py-3 px-4">Node Account</th>
                      <th className="py-3 px-4">Role Archetype</th>
                      <th className="py-3 px-4">Activation Score</th>
                      <th className="py-3 px-4">Help Usage</th>
                      <th className="py-3 px-4">Tours Completed</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {metrics.userProgressList.map((usr: any) => (
                      <tr key={usr.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="text-xs font-bold text-slate-800">{usr.email}</span>
                          <span className="text-[9px] font-mono text-slate-400 block mt-0.5">UID: {usr.id.substring(0, 10).toUpperCase()}</span>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-bold text-slate-600 uppercase tracking-wider font-mono">
                          {usr.role}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 max-w-[120px] bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${usr.healthScore}%` }} />
                            </div>
                            <span className="text-xs font-black text-slate-800">{usr.healthScore}%</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-bold text-slate-500 font-mono">
                          {usr.helpClicks} clicks
                        </td>
                        <td className="py-3.5 px-4 text-xs font-bold text-slate-500 font-mono">
                          {usr.toursCompleted}
                        </td>
                        <td className="py-3.5 px-4">
                          {usr.healthScore >= 50 ? (
                            <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                              <CheckCircle size={10} /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                              <ShieldAlert size={10} /> Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
         </div>

         {/* Event Ledger Stats */}
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-4">
            <h3 className="font-bold text-slate-800 uppercase tracking-widest text-xs mb-6 border-b border-slate-100 pb-2">Platform Activity Matrix</h3>
            <div className="space-y-4">
                  <div className="flex items-center gap-4">
                     <span className="text-xs font-bold text-slate-600 w-48 truncate">Total System Events Authenticated</span>
                     <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: '100%'}}/>
                     </div>
                     <span className="text-[10px] font-mono font-black text-slate-400 w-16 text-right">{metrics.totalEvents}</span>
                  </div>
                  <div className="flex items-center gap-4">
                     <span className="text-xs font-bold text-slate-600 w-48 truncate">Recorded Logins & Sessions</span>
                     <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500" style={{ width: `${metrics.totalEvents ? Math.min((metrics.loginEvents / metrics.totalEvents) * 100, 100) : 0}%`}}/>
                     </div>
                     <span className="text-[10px] font-mono font-black text-slate-400 w-16 text-right">{metrics.loginEvents}</span>
                  </div>
            </div>
         </div>
      </div>
    </div>
  );
}

