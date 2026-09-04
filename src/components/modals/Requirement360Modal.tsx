import React, { useState, useEffect } from "react";
import {
  X,
  Briefcase,
  Target,
  FileText,
  Users,
  Activity,
  ShieldCheck,
  BarChart3,
  MessageSquare,
  Sparkles,
  Search,
  CheckCircle2,
  Clock,
  MapPin,
  TrendingUp,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { JDIntelligence } from "../JDIntelligence";
import { AIMatching } from "../AIMatching";
import { db } from "../../lib/firebase";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { Badge } from "../../lib/Badge";

interface Requirement360ModalProps {
  job: any;
  onClose: () => void;
  isAdmin: boolean;
  userRole: string;
  userOrgId: string;
}

type TabType = "SUMMARY" | "MATCHES" | "SUBMISSIONS" | "TIMELINE" | "ANALYTICS";

export default function Requirement360Modal({
  job,
  onClose,
  isAdmin,
  userRole,
  userOrgId,
}: Requirement360ModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("SUMMARY");
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!job?.id) return;

    const subQ = query(
      collection(db, "submissions"),
      where("requirementId", "==", job.id)
    );

    const unsubSubs = onSnapshot(
      subQ, 
      (snap) => {
        setSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.warn("[Requirement360Modal] Submissions listener note:", err?.message);
      }
    );

    // Query canonical candidate_matches without compound orderBy to avoid requiring an unbuilt composite index
    const matchQ = query(
      collection(db, "candidate_matches"),
      where("requirementId", "==", job.id)
    );

    const unsubMatches = onSnapshot(
      matchQ, 
      (snap) => {
        const sorted = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => {
            const scoreA = Number(a.matchScore ?? a.score ?? 0);
            const scoreB = Number(b.matchScore ?? b.score ?? 0);
            return scoreB - scoreA;
          })
          .slice(0, 20);
        setMatches(sorted);
      },
      (err) => {
        console.warn("[Requirement360Modal] candidate_matches listener note:", err?.message);
      }
    );

    // Query operationalEvents by entityId without compound orderBy to eliminate composite index requirement
    const eventQ = query(
      collection(db, "operationalEvents"),
      where("entityId", "==", job.id)
    );

    const unsubEvents = onSnapshot(
      eventQ, 
      (snap) => {
        const sorted = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => {
            const tA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : new Date(a.timestamp || 0).getTime();
            const tB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : new Date(b.timestamp || 0).getTime();
            return tB - tA;
          })
          .slice(0, 20);
        setEvents(sorted);
        setLoading(false);
      }, 
      (err) => {
        console.warn("[Requirement360Modal] operationalEvents listener note:", err?.message);
        setLoading(false);
      }
    );

    return () => {
      unsubSubs();
      unsubMatches();
      unsubEvents();
    };
  }, [job?.id]);

  const tabs = [
    { id: "SUMMARY", label: "Intelligence", icon: <FileText size={16} /> },
    { id: "MATCHES", label: "AI Matches", icon: <Target size={16} /> },
    { id: "SUBMISSIONS", label: "Submissions", icon: <Users size={16} /> },
    { id: "TIMELINE", label: "Lifecycle", icon: <Activity size={16} /> },
    { id: "ANALYTICS", label: "Analytics", icon: <BarChart3 size={16} /> },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden border border-slate-200"
      >
        {/* Header */}
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Briefcase size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 uppercase font-black text-[10px]">
                  Requirement 360
                </Badge>
                <span className="text-[10px] font-mono text-slate-400 font-bold tracking-widest">
                  ID: {job.id}
                </span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none uppercase">
                {job.title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600 border border-slate-100 shadow-sm"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-8 bg-white border-b border-slate-100">
          <div className="flex gap-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={cn(
                  "py-4 flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all relative",
                  activeTab === tab.id
                    ? "text-indigo-600"
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                {tab.icon}
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTabRequirement"
                    className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-full"
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/30">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === "SUMMARY" && (
                <div className="space-y-8">
                  {/* UOP v2.0 Platform Integration Dashboard */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Column 1: Provenance & Metadata */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck size={18} className="text-indigo-600" />
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-700">Unified Operations Provenance</h4>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-medium">Created From:</span>
                          <Badge className="bg-amber-100 text-amber-700 font-black border-none uppercase text-[9px] tracking-widest">
                            {job.createdFrom || "RECRUITER"}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-medium">Created Via:</span>
                          <Badge className="bg-blue-100 text-blue-700 font-black border-none uppercase text-[9px] tracking-widest">
                            {job.createdVia || "OS"}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-medium">Created By Role:</span>
                          <Badge className="bg-indigo-100 text-indigo-700 font-black border-none uppercase text-[9px] tracking-widest">
                            {job.createdByRole || "RECRUITER"}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-medium">Platform Mode:</span>
                          <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                            Single SSOT
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Column 2: Assignment Control Room */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Users size={18} className="text-indigo-600" />
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-700">Assignment Control Room</h4>
                      </div>
                      <div className="space-y-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Assigned BDM</span>
                          <select
                            defaultValue={job.assignedBDM || ""}
                            onChange={async (e) => {
                              try {
                                const { doc, updateDoc } = await import("firebase/firestore");
                                await updateDoc(doc(db, "requirements_public", job.id), {
                                  assignedBDM: e.target.value
                                });
                              } catch (err) {
                                console.error("Failed to update BDM", err);
                              }
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="">Unassigned</option>
                            <option value="BDM-Amit Kumar">BDM-Amit Kumar</option>
                            <option value="BDM-Neha Sharma">BDM-Neha Sharma</option>
                            <option value="BDM-Vikram Singh">BDM-Vikram Singh</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Assigned Recruiter</span>
                          <select
                            defaultValue={job.assignedRecruiter || ""}
                            onChange={async (e) => {
                              try {
                                const { doc, updateDoc } = await import("firebase/firestore");
                                await updateDoc(doc(db, "requirements_public", job.id), {
                                  assignedRecruiter: e.target.value
                                });
                              } catch (err) {
                                console.error("Failed to update Recruiter", err);
                              }
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="">Unassigned</option>
                            <option value="REC-Priya Sharma">REC-Priya Sharma</option>
                            <option value="REC-Michael Chang">REC-Michael Chang</option>
                            <option value="REC-Elena Rostova">REC-Elena Rostova</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Column 3: Platform Deal Room Linkage */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <MessageSquare size={18} className="text-indigo-600" />
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-700">Requirement Deal Room</h4>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                          This requirement owns a dedicated real-time Deal Room in the unified operations platform. No duplication or lag.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          onClose();
                          window.location.hash = "#/deal-rooms"; // Redirect to Deal Rooms view
                        }}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-md shadow-indigo-100 hover:scale-[1.02]"
                      >
                        Launch Unified Deal Room
                      </button>
                    </div>
                  </div>

                  <JDIntelligence job={job} />
                </div>
              )}

              {activeTab === "MATCHES" && (
                <div className="space-y-6">
                   {matches.length > 0 ? (
                     matches.map(match => (
                       <AIMatching 
                          key={match.id}
                          result={match}
                          candidateName={match.candidateName || match.name || "Candidate"}
                       />
                     ))
                   ) : (
                     <div className="py-20 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-[32px] bg-white">
                        <Sparkles size={48} className="mx-auto mb-4 opacity-20 text-indigo-400" />
                        <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-700">No AI Matches Mapped</p>
                        <p className="text-xs font-medium text-slate-500 mt-2 italic px-8 max-w-md mx-auto leading-relaxed">
                          Neural mapping engine is currently scanning the federated network. 
                          Fresh talent signals will appear here automatically.
                        </p>
                     </div>
                   )}
                </div>
              )}

              {activeTab === "SUBMISSIONS" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {submissions.length > 0 ? submissions.map(sub => (
                      <div key={sub.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all group">
                         <div className="flex justify-between items-start mb-3">
                            <div className="h-10 w-10 bg-indigo-50 rounded-full flex items-center justify-center font-bold text-indigo-700">
                               {sub.candidateName?.[0] || "C"}
                            </div>
                            <Badge variant={sub.status === "HIRED" ? "success" : "default"} className="text-[10px] uppercase font-bold">
                               {sub.status}
                            </Badge>
                         </div>
                         <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{sub.candidateName}</h4>
                         <p className="text-xs text-slate-500 mt-1">{sub.vendorName || sub.vendorId}</p>
                         <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                               {sub.matchScore}% Align
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                               {new Date(sub.createdAt?.toMillis ? sub.createdAt.toMillis() : sub.createdAt).toLocaleDateString()}
                            </span>
                         </div>
                      </div>
                    )) : (
                      <div className="col-span-full py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-sm bg-white rounded-2xl border-2 border-dashed border-slate-200">
                        No submissions yet
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "TIMELINE" && (
                <div className="max-w-2xl mx-auto space-y-8 py-4">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Activity size={16} /> Requirement Lifecycle Events
                  </h3>
                  <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-0 before:w-0.5 before:bg-slate-100">
                    {events.map((event, i) => (
                      <div key={i} className="relative pl-10">
                        <div className="absolute left-0 top-1.5 h-6 w-6 rounded-full bg-white border-2 border-indigo-600 flex items-center justify-center z-10 shadow-sm">
                           <div className="h-2 w-2 rounded-full bg-indigo-600" />
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                           <div className="flex justify-between items-start mb-1">
                              <p className="text-sm font-bold text-slate-900 capitalize">{event.type?.replace(/_/g, ' ') || "System Action"}</p>
                              <span className="text-[10px] text-slate-400 font-medium">
                                 {new Date(event.timestamp?.toMillis ? event.timestamp.toMillis() : event.timestamp).toLocaleString()}
                              </span>
                           </div>
                           <p className="text-xs text-slate-500 leading-relaxed">{event.message || event.description}</p>
                        </div>
                      </div>
                    ))}
                    {events.length === 0 && (
                      <div className="text-center py-12 text-slate-400">No events found for this lifecycle.</div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "ANALYTICS" && (
                <div className="space-y-8">
                   <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                      <AnalyticsCard 
                        label="Sourcing Efficiency" 
                        value="94%" 
                        trend="+12%" 
                        icon={<TrendingUp size={16} />}
                        color="text-emerald-600" 
                        bgColor="bg-emerald-50"
                      />
                      <AnalyticsCard 
                        label="Avg Submission Match" 
                        value={`${submissions.length > 0 ? Math.round(submissions.reduce((acc, s) => acc + (s.matchScore || 0), 0) / submissions.length) : 0}%`} 
                        trend="+4%" 
                        icon={<Sparkles size={16} />}
                        color="text-indigo-600" 
                        bgColor="bg-indigo-50"
                      />
                      <AnalyticsCard 
                        label="Time to Match" 
                        value="2.4 Days" 
                        trend="-1.2d" 
                        icon={<Clock size={16} />}
                        color="text-sky-600" 
                        bgColor="bg-sky-50"
                      />
                      <AnalyticsCard 
                        label="Interview Conversion" 
                        value="28%" 
                        trend="+5%" 
                        icon={<TrendingUp size={16} />}
                        color="text-purple-600" 
                        bgColor="bg-purple-50"
                      />
                   </div>
                   
                   <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                      <h3 className="text-sm font-bold text-slate-900 mb-6 uppercase tracking-wider">Demand Forecasting & Market Intelligence</h3>
                      <div className="space-y-6">
                         <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="flex items-center gap-4">
                               <div className="h-10 w-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400"><MapPin size={20} /></div>
                               <div>
                                  <p className="text-xs font-bold text-slate-900">Local Talent Density</p>
                                  <p className="text-[10px] text-slate-500 font-medium">Matching vs available in Bangalore region</p>
                               </div>
                            </div>
                            <div className="text-right">
                               <p className="text-sm font-black text-slate-900 tracking-tight">HIGH</p>
                               <div className="w-20 h-1.5 bg-slate-200 rounded-full mt-1"><div className="w-3/4 h-full bg-emerald-500 rounded-full" /></div>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 bg-white flex justify-between items-center px-10">
          <div className="flex items-center gap-3">
             <div className="flex -space-x-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-8 w-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">V{i}</div>
                ))}
             </div>
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">3 Vendors Active</p>
          </div>
          <div className="flex gap-3">
             <button className="px-6 py-2.5 rounded-xl border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all">Download JD</button>
             <button className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">AI Rescan Matches</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function AnalyticsCard({ label, value, trend, icon, color, bgColor }: any) {
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
       <div className={cn("h-10 w-10 rounded-2xl flex items-center justify-center mb-4", bgColor, color)}>
          {icon}
       </div>
       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
       <div className="flex items-end gap-2">
          <span className="text-2xl font-black text-slate-900 tracking-tighter">{value}</span>
          <span className={cn("text-[10px] font-bold mb-1", trend.startsWith('+') ? "text-emerald-500" : "text-rose-500")}>
             {trend}
          </span>
       </div>
    </div>
  );
}
