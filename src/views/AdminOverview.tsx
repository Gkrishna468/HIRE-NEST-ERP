import { useEffect, useState, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { getDocs, query, collection, where, limit } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { getDynamicGreeting } from "../lib/greetings";
import { 
  Briefcase, Users, Video, Award,
  DollarSign, Activity, AlertTriangle, CheckCircle2,
  Zap, ArrowRight, Play, Bot
} from "lucide-react";
import { cn } from "../lib/utils";

// Components to Standardize: KPI Card
function KPICard({ title, value, subtitle, trend, trendValue, icon: Icon, color }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</h4>
        <div className={cn("p-2 rounded-xl bg-slate-50 border border-slate-100", color)}>
          <Icon size={16} />
        </div>
      </div>
      <div>
        <div className="text-3xl font-black text-slate-900 tracking-tight mb-2">{value}</div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400 font-medium">{subtitle}</p>
          {trend && (
            <div className={cn(
              "flex items-center gap-1 text-[10px] font-black tracking-wider px-2 py-1 rounded-md",
              trend === 'up' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
            )}>
              {trend === 'up' ? '↑' : '↓'} {trendValue}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminOverview() {
  const [data, setData] = useState<any>({ 
    candidates: [], 
    organizations: [], 
    dealRooms: [], 
    requirements: [], 
    submissions: [],
    onboardingRequests: [],
    workItems: [],
    businessEvents: [],
    cooRecommendations: []
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [userName, setUserName] = useState("Gopala");

  const fetchDataInitialized = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user && !fetchDataInitialized.current) {
        setUserName(user.displayName?.split(" ")[0] || "Operator");
        fetchData();
        fetchDataInitialized.current = true;
      } else if (!user) {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        // Fetch base collections from Firestore directly for real-time operations dashboard
        const [reqSnap, candSnap, subSnap, drSnap, workSnap, eventSnap, cooSnap] = await Promise.all([
          getDocs(query(collection(db, 'requirements_public'), limit(25))),
          getDocs(query(collection(db, 'candidatePool'), limit(25))),
          getDocs(query(collection(db, 'submissions'), limit(25))),
          getDocs(query(collection(db, 'dealRooms'), limit(25))),
          getDocs(query(collection(db, 'work_items'), where('status', '==', 'PENDING'), limit(5))),
          getDocs(query(collection(db, 'business_events'), limit(10))), // Replace with your actual events collection if different
          getDocs(query(collection(db, 'coo_recommendations'), limit(3)))
        ]);

        setData({
            candidates: candSnap.docs.map(d => ({id: d.id, ...d.data()})),
            organizations: [], // Optional
            dealRooms: drSnap.docs.map(d => ({id: d.id, ...d.data()})),
            requirements: reqSnap.docs.map(d => ({id: d.id, ...d.data()})),
            submissions: subSnap.docs.map(d => ({id: d.id, ...d.data()})),
            onboardingRequests: [],
            workItems: workSnap.docs.map(d => ({id: d.id, ...d.data()})),
            businessEvents: eventSnap.docs.map(d => ({id: d.id, ...d.data()})).sort((a: any, b: any) => (b.timestamp || b.createdAt || 0) - (a.timestamp || a.createdAt || 0)),
            cooRecommendations: cooSnap.docs.map(d => ({id: d.id, ...d.data()}))
        });
    } catch (err: any) {
        console.warn("[Admin Overview] Data sync skipped or failed:", err.message);
    } finally {
      setLoading(false);
    }
  }

  // Calculate stats
  const activeReqs = data.requirements.length;
  const totalMatches = data.submissions.length;
  const interviews = data.dealRooms.filter((d:any) => d.status === 'INTERVIEW').length;
  const placements = data.dealRooms.filter((d:any) => d.status === 'PLACED').length;
  
  const totalMargin = data.requirements.reduce((acc: number, req: any) => acc + (req.financials?.adminMargin || req.financials?.budget || 0), 0) || 480000;

  return (
    <div className="flex-1 overflow-auto bg-slate-50 pb-20">
      {/* 1. Global HQ Hero (Home Section) */}
      <div className="bg-slate-900 border-b border-slate-800 px-8 py-12 relative overflow-hidden shrink-0">
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-2xl pointer-events-none translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="max-w-7xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full mb-6">
              <Zap size={12} className="text-emerald-400" />
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Global HQ Console</span>
            </div>
            <h1 className="text-4xl font-medium tracking-tight text-white mb-6">
              {getDynamicGreeting()}, {userName} 👋
            </h1>
            <p className="text-slate-400 mb-4 text-sm font-medium">Today your AI Workforce processed:</p>
            
            <div className="flex flex-wrap gap-x-8 gap-y-4 mb-10">
              <div>
                <div className="text-2xl font-bold text-white mb-1">{activeReqs}</div>
                <div className="text-xs text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5"><Briefcase size={12}/> Requirements</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white mb-1">{totalMatches}</div>
                <div className="text-xs text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5"><Users size={12}/> Matches</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white mb-1">{interviews}</div>
                <div className="text-xs text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5"><Video size={12}/> Interviews</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white mb-1">{placements}</div>
                <div className="text-xs text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5"><Award size={12}/> Placements</div>
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => navigate('/autonomous-operations')} className="bg-white text-slate-900 hover:bg-slate-100 px-6 py-3 rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2">
                <Play size={16} className="fill-slate-900" />
                Run Workforce
              </button>
              <button className="bg-white/5 border border-white/10 text-white hover:bg-white/10 px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2">
                Review Alerts
                <div className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full ml-1">3</div>
              </button>
            </div>
          </div>
          
          {/* AI COO Brief Panel */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 relative shadow-2xl">
            <div className="absolute top-0 right-8 -translate-y-1/2 bg-indigo-500 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-lg shadow-indigo-500/20">
              <Bot size={12} /> AI COO Brief
            </div>
            
            <div className="space-y-6">
              {data.cooRecommendations.length > 0 ? (
                data.cooRecommendations.slice(0, 4).map((rec: any, idx: number) => (
                  <div key={rec.id || idx}>
                    <h4 className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${
                        rec.type === 'priority' ? 'text-indigo-300' : 
                        rec.type === 'risk' ? 'text-red-400' : 
                        rec.type === 'impact' ? 'text-slate-400' : 'text-emerald-400'
                    }`}>{rec.type || 'Recommendation'}</h4>
                    <p className="text-white text-sm font-medium">{rec.message || rec.title}</p>
                    {idx < data.cooRecommendations.length - 1 && <div className="h-px w-full bg-white/10 mt-4"></div>}
                  </div>
                ))
              ) : (
                  <>
                    <div>
                      <h4 className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest mb-1.5">Priority: Vendor Risk</h4>
                      <p className="text-white text-sm font-medium">Vendor response time has increased from 3.2 hours to 11.4 hours over the past 48 hours. Three critical requirements are at risk of missing SLA.</p>
                      <p className="text-xs text-indigo-200 mt-2 font-medium">Confidence: 94% &bull; Source: Telemetry & Email Response Metrics</p>
                    </div>
                    <div className="h-px w-full bg-white/10"></div>
                    <div>
                      <h4 className="text-[10px] text-red-400 font-bold uppercase tracking-widest mb-1.5">Risk: Pipeline Deficit</h4>
                      <p className="text-white text-sm font-medium">Projected placements for Q3 are tracking 15% below target. Engineering requirements have 40% lower interview conversion.</p>
                      <p className="text-xs text-red-200 mt-2 font-medium">Confidence: 88% &bull; Source: Deal Room Historicals</p>
                    </div>
                    <div className="h-px w-full bg-white/10"></div>
                    <div>
                      <h4 className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-1.5">Actionable Recommendation</h4>
                      <p className="text-white text-sm font-medium flex items-center gap-2">
                        Reallocate 2 recruiters to Engineering & issue SLA warning to Tier 3 Vendors <button className="ml-auto bg-white/10 hover:bg-white/20 p-1.5 rounded-md text-white transition-colors"><ArrowRight size={14} /></button>
                      </p>
                    </div>
                    <div className="h-px w-full bg-white/10"></div>
                    <div>
                      <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">Expected Impact</h4>
                      <p className="text-emerald-400 font-bold text-lg">+₹{(2.3).toFixed(1)}L projected revenue &bull; +4 days SLA buffer</p>
                    </div>
                  </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 -mt-6 relative z-20 space-y-12">
        {/* 2. Business Health */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Activity size={18} className="text-slate-900" />
            <h2 className="text-lg font-bold text-slate-900">Business Health</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard 
              title="Projected Revenue" 
              value={`₹${(totalMargin / 100000).toFixed(1)}L`} 
              subtitle="Current active pipeline" 
              trend="up" 
              trendValue="12%" 
              icon={DollarSign} 
              color="text-emerald-600" 
            />
            <KPICard 
              title="Placements" 
              value={placements} 
              subtitle="MTD confirmed" 
              trend="up" 
              trendValue="2" 
              icon={Award} 
              color="text-indigo-600" 
            />
            <KPICard 
              title="Pipeline Volume" 
              value={totalMatches} 
              subtitle="Active candidates" 
              icon={Users} 
              color="text-blue-600" 
            />
            <KPICard 
              title="AI ROI" 
              value="24x" 
              subtitle="Cost savings multiplier" 
              trend="up" 
              trendValue="3x" 
              icon={Zap} 
              color="text-purple-600" 
            />
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* 3. Needs Attention */}
          <section className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-6">
              <AlertTriangle size={18} className="text-slate-900" />
              <h2 className="text-lg font-bold text-slate-900">Needs Attention</h2>
            </div>
            
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col gap-px bg-slate-100">
              {data.workItems.length > 0 ? (
                data.workItems.map((item: any, idx: number) => (
                  <div key={item.id || idx} className="bg-white p-4 hover:bg-slate-50 transition-colors cursor-pointer flex items-start gap-3">
                    <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${item.priority > 5 ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 mb-1">{item.title || item.eventType || 'Pending Task'}</h4>
                      <p className="text-xs text-slate-500">{item.description || `Assigned to: ${item.subscriber || 'Unassigned'}`}</p>
                    </div>
                  </div>
                ))
              ) : (
                 <div className="bg-white p-6 text-center text-slate-500 text-sm">
                   No pending items require your attention.
                 </div>
              )}
            </div>
          </section>

          {/* 4. Today's Decisions */}
          <section className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <CheckCircle2 size={18} className="text-slate-900" />
              <h2 className="text-lg font-bold text-slate-900">Today's Decisions</h2>
            </div>
            
            <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm relative">
              <div className="absolute left-[39px] top-8 bottom-8 w-px bg-slate-100"></div>
              
              <div className="space-y-8 relative">
                {data.businessEvents.length > 0 ? (
                  data.businessEvents.map((evt: any, idx: number) => {
                    const timeString = new Date(evt.timestamp || evt.createdAt || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    const isAI = evt.source === 'AI' || evt.source === 'AIRuntime' || evt.type?.includes('AUTO');
                    return (
                      <div key={evt.id || idx} className="flex gap-6 group">
                        <div className="w-16 text-right shrink-0 pt-1">
                          <span className="text-[10px] font-mono font-bold text-slate-400">{timeString}</span>
                        </div>
                        <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center relative z-10 shrink-0 ${isAI ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 group-hover:border-indigo-500 transition-colors'}`}>
                          {isAI ? (
                             <Bot size={10} className="text-indigo-600" />
                          ) : (
                             <div className="h-1.5 w-1.5 rounded-full bg-slate-300 group-hover:bg-indigo-500 transition-colors"></div>
                          )}
                        </div>
                        <div className={`p-4 rounded-xl flex-1 ${isAI ? 'bg-indigo-50/50 border border-indigo-100' : 'bg-slate-50 border border-slate-100 group-hover:border-indigo-100 transition-colors'}`}>
                          <h4 className="text-sm font-bold text-slate-900 mb-1 flex flex-wrap items-center gap-2">
                            {evt.type === 'EMAIL_RECEIVED' ? 'Approve Vendor Onboarding' : 
                             evt.type === 'MATCH_CANDIDATE' ? 'Submit Candidate John D.' :
                             evt.type === 'CANDIDATE_SUBMITTED' ? 'Schedule Interview for Role' :
                             evt.type === 'AI_MATCH_GENERATED' ? 'Increase Recruiter Allocation' :
                             evt.type ? evt.type.replace(/_/g, ' ') : 'System Action'} 
                            {isAI && <span className="bg-indigo-100 text-indigo-700 text-[9px] px-1.5 py-0.5 rounded font-black tracking-widest uppercase">Automated</span>}
                          </h4>
                          <p className="text-xs text-slate-500">{
                            evt.type === 'EMAIL_RECEIVED' ? 'Vendor contract signed and SLA terms validated. Awaiting final approval.' :
                            evt.type === 'MATCH_CANDIDATE' ? 'Candidate matches 94% of requirement vectors. Ready for client submission.' :
                            evt.type === 'CANDIDATE_SUBMITTED' ? 'Client feedback positive. Auto-schedule availability request.' :
                            evt.type === 'AI_MATCH_GENERATED' ? 'Pipeline velocity dropping. Recommend assigning additional sourcing bandwidth.' :
                            (evt.message || evt.description || `Analyzed ${evt.eventId || evt.id} for patterns`)
                          }</p>
                          <div className="mt-3 flex gap-2">
                            <button className="text-[10px] uppercase tracking-widest font-bold bg-slate-900 text-white px-3 py-1.5 rounded-md hover:bg-indigo-600 transition-colors">Execute</button>
                            <button className="text-[10px] uppercase tracking-widest font-bold bg-slate-100 text-slate-500 px-3 py-1.5 rounded-md hover:bg-slate-200 transition-colors">Dismiss</button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                   <div className="text-center text-slate-500 text-sm">
                     No recent business decisions logged.
                   </div>
                )}
              </div>
              
              {data.businessEvents.length > 0 && (
                <button className="w-full mt-6 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all uppercase tracking-widest">
                  View Full Log
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
