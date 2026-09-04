import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Briefcase, 
  Mail, 
  MessageCircle, 
  Search, 
  Globe,
  Building,
  UserCircle,
  FileText,
  Bot,
  TrendingUp,
  IndianRupee,
  ShieldCheck,
  Cpu,
  Activity,
  ArrowRight,
  Target
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { formatCompactINR } from '../lib/currency';

export default function NetworkTab() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    requirements: 0,
    candidates: 0,
    vendors: 0,
    clients: 0,
    placements: 0,
    revenue: 0
  });
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGlobalStats = async () => {
      try {
        const [reqs, cands, vends, clis, subs] = await Promise.all([
          getDocs(query(collection(db, 'jobs'), limit(1))),
          getDocs(query(collection(db, 'candidates'), limit(1))),
          getDocs(query(collection(db, 'vendors'), limit(1))),
          getDocs(query(collection(db, 'clients'), limit(1))),
          getDocs(query(collection(db, 'submissions'), limit(1)))
        ]);

        // In a real app, these would be cached counts or aggregate docs
        setStats({
          requirements: 1243, // Mocked for scale demonstration as requested
          candidates: 98122,
          vendors: 412,
          clients: 86,
          placements: 3284,
          revenue: 14250000
        });

        const eventsSnap = await getDocs(query(
          collection(db, 'operationalEvents'),
          orderBy('timestamp', 'desc'),
          limit(5)
        ));
        setRecentEvents(eventsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Global HQ Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchGlobalStats();
  }, []);

  const kpis = [
    { label: "Global Requirements", value: stats.requirements.toLocaleString(), icon: Briefcase, color: "text-blue-500", bg: "bg-blue-50", trend: "+12%" },
    { label: "Global Candidates", value: stats.candidates.toLocaleString(), icon: Users, color: "text-emerald-500", bg: "bg-emerald-50", trend: "+8%" },
    { label: "Global Vendors", value: stats.vendors.toLocaleString(), icon: Globe, color: "text-indigo-500", bg: "bg-indigo-50", trend: "+3%" },
    { label: "Global Clients", value: stats.clients.toLocaleString(), icon: Building, color: "text-amber-500", bg: "bg-amber-50", trend: "+5%" },
    { label: "Global Placements", value: stats.placements.toLocaleString(), icon: ShieldCheck, color: "text-purple-500", bg: "bg-purple-50", trend: "+15%" },
    { label: "Global Revenue", value: formatCompactINR(stats.revenue), icon: IndianRupee, color: "text-rose-500", bg: "bg-rose-50", trend: "+22%" },
  ];

  const quickActions = [
    { title: "Client 360", path: "/client-360", icon: Building },
    { title: "Vendor 360", path: "/vendor-360", icon: Globe },
    { title: "Candidate 360", path: "/candidates", icon: UserCircle },
    { title: "Requirement 360", path: "/jobs", icon: FileText },
  ];

  return (
    <div className="flex-1 overflow-auto bg-[#F8FAFC] p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-indigo-600 mb-1">
              <Cpu size={16} className="animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Enterprise OS Core</span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              Global HQ
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-widest border border-indigo-200">Live</span>
            </h1>
            <p className="text-slate-500 font-medium text-sm">Federated talent network & operational intelligence.</p>
          </div>

          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors">
              <Activity size={14} className="text-indigo-500" />
              System Status: Optimal
            </button>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {kpis.map((kpi, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={kpi.label}
              className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm hover:shadow-md transition-all group cursor-pointer"
            >
              <div className={`p-2.5 rounded-xl ${kpi.bg} ${kpi.color} w-fit mb-4 group-hover:scale-110 transition-transform`}>
                <kpi.icon size={20} />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{kpi.label}</p>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">{kpi.value}</h3>
                  <span className="text-[10px] font-bold text-emerald-500">{kpi.trend}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Controls */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <Cpu size={18} className="text-indigo-500" />
                  Neural Intake Engine (MailOS 2.0)
                </h2>
                <button 
                  onClick={() => navigate('/emails')}
                  className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline flex items-center gap-1"
                >
                  Enter MailOS <ArrowRight size={12} />
                </button>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                      <Mail size={18} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Automated</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Requirement Intake</h4>
                    <p className="text-[11px] text-slate-500 mt-1 font-medium">Auto-parsing JD attachments and creating requirements in real-time.</p>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">Active Scan</span>
                  </div>
                </div>
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                      <Users size={18} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Automated</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Resume Processing</h4>
                    <p className="text-[11px] text-slate-500 mt-1 font-medium">Extracting vendor profiles and mapping to active candidate pool.</p>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">Syncing 412 Vendors</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <Bot size={18} className="text-indigo-500" />
                  Autonomous AI Workforce Status
                </h2>
                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">6 Offices Live</span>
                   </div>
                </div>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { name: "Matching Office", role: "Calculating proprietary scores", load: 82, icon: Target, color: "text-indigo-500" },
                  { name: "Vendor Office", role: "Harnessing agency benches", load: 45, icon: Globe, color: "text-blue-500" },
                  { name: "Client Office", role: "Enforcing SLA & Compliance", load: 21, icon: ShieldCheck, color: "text-emerald-500" },
                ].map((office) => (
                   <div key={office.name} className="p-5 rounded-2xl border border-slate-100 bg-white shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                         <div className={`p-2 rounded-lg bg-slate-50 ${office.color}`}>
                            <office.icon size={20} />
                         </div>
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active</span>
                      </div>
                      <div>
                         <h4 className="text-sm font-bold text-slate-900">{office.name}</h4>
                         <p className="text-[10px] text-slate-500 mt-1 font-medium leading-tight">{office.role}</p>
                      </div>
                      <div className="space-y-2">
                         <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-tight">
                            <span className="text-slate-400">Utilization</span>
                            <span className="text-slate-900">{office.load}%</span>
                         </div>
                         <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${office.load > 80 ? 'bg-indigo-500' : 'bg-slate-300'} transition-all`} style={{ width: `${office.load}%` }} />
                         </div>
                      </div>
                   </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-8 flex items-center justify-between group cursor-pointer hover:border-indigo-200 transition-all">
                  <div className="space-y-2">
                     <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Matching Throughput</h3>
                     <p className="text-3xl font-black text-slate-900 tracking-tighter">
                        2,412 <span className="text-sm font-medium text-slate-400 tracking-normal ml-1">Daily Alignments</span>
                     </p>
                  </div>
                  <div className="h-16 w-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                     <TrendingUp size={32} />
                  </div>
               </div>
               <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-8 flex items-center justify-between group cursor-pointer hover:border-emerald-200 transition-all">
                  <div className="space-y-2">
                     <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Net Intake Velocity</h3>
                     <p className="text-3xl font-black text-slate-900 tracking-tighter">
                        14s <span className="text-sm font-medium text-slate-400 tracking-normal ml-1">Email-to-Requirement</span>
                     </p>
                  </div>
                  <div className="h-16 w-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                     <Cpu size={32} />
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {quickActions.map((action) => (
                <button
                  key={action.title}
                  onClick={() => navigate(action.path)}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all group flex flex-col items-center gap-3"
                >
                  <div className="p-3 bg-slate-50 text-slate-600 rounded-xl group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                    <action.icon size={24} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">{action.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sidebar - Intelligence Feed */}
          <div className="space-y-6">
            <div className="bg-slate-900 rounded-[32px] p-6 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Bot size={120} />
              </div>
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400 mb-4 flex items-center gap-2">
                <TrendingUp size={14} />
                Strategic Intel
              </h3>
              <div className="space-y-4 relative z-10">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Current Velocity</p>
                  <p className="text-2xl font-black">1.2s <span className="text-xs font-medium text-slate-400">avg. match time</span></p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Market Sentiment</p>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 w-[78%]" />
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400">Bullish</span>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-800">
                  <p className="text-[11px] text-slate-300 leading-relaxed italic font-medium">
                    "AI Workforce is currently prioritizing backend Java roles for 3 tier-1 clients. Vendor coverage is at peak efficiency."
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-6">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Activity size={14} className="text-rose-500" />
                Live Network Feed
              </h3>
              <div className="space-y-6">
                {recentEvents.length > 0 ? (
                  recentEvents.map((event) => (
                    <div key={event.id} className="flex gap-4 group cursor-pointer">
                      <div className="mt-1">
                        <div className="h-2 w-2 rounded-full bg-indigo-500" />
                        <div className="w-[1px] h-full bg-slate-100 mx-auto my-1" />
                      </div>
                      <div className="space-y-1 pb-4">
                        <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{event.title || event.action}</p>
                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed">{event.description || event.message}</p>
                        <p className="text-[9px] text-slate-400 font-mono">
                          {event.timestamp?.toDate ? event.timestamp.toDate().toLocaleTimeString() : 'Recently'}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-10 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Synchronizing Nodes...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
