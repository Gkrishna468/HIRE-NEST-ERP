import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, getDocs, updateDoc, doc, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { Badge } from "../../lib/Badge";
import { CheckCircle, Target, User, Presentation, Activity, Sparkles, X } from "lucide-react";
import Candidate360Modal from "../../components/modals/Candidate360Modal";
import { InterviewSchedulerModal } from "../../components/modals/InterviewSchedulerModal";

import { useSubmissionStore } from "../../stores/SubmissionStore";

export default function ClientCandidateWorkspace({ userOrgId, userRole }: { userOrgId: string; userRole: string }) {
  const [activeTab, setActiveTab] = useState<"MATCHED" | "SUBMITTED" | "SHORTLISTED" | "INTERVIEWS" | "OFFERS" | "PLACED">("SUBMITTED");
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [schedulingSubmission, setSchedulingSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // In-app Rejection Modal state
  const [rejectingCandidate, setRejectingCandidate] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState<string>("Missing required technical skills");
  const [customReason, setCustomReason] = useState<string>("");
  const [isRejecting, setIsRejecting] = useState<boolean>(false);

  const [reqs, setReqs] = useState<Record<string, string>>({});
  const { updateStatus } = useSubmissionStore();

  const handleShortlist = async (candidate: any) => {
    const subId = candidate?.submissionId || candidate?.id;
    if (!subId) return alert("Cannot shortlist - missing submission context. Was this from AI Matches?");
    try {
      await updateStatus(subId, "SHORTLISTED");
      alert("Candidate shortlisted successfully.");
      setSelectedCandidate(null);
    } catch (e) {
      console.error(e);
      alert("Error shortlisting candidate.");
    }
  };

  const handleInitiateReject = (candidate: any) => {
    const subId = candidate?.submissionId || candidate?.id;
    if (!subId) {
      alert("Cannot reject - missing submission context.");
      return;
    }
    setRejectingCandidate(candidate);
    setRejectReason("Missing required technical skills");
    setCustomReason("");
  };

  const handleConfirmReject = async () => {
    if (!rejectingCandidate) return;
    const subId = rejectingCandidate.submissionId || rejectingCandidate.id;
    if (!subId) {
      alert("Cannot reject - missing submission ID.");
      return;
    }

    const finalReason = rejectReason === "Custom Reason" 
      ? (customReason.trim() || "Client declined candidate submission")
      : rejectReason;

    setIsRejecting(true);
    try {
      await updateDoc(doc(db, "submissions", subId), {
         rejectReason: finalReason,
         updatedAt: serverTimestamp()
      });
      await updateStatus(subId, "REJECTED");
      alert("Candidate successfully rejected.");
      setRejectingCandidate(null);
      setSelectedCandidate(null);
    } catch (e: any) {
      console.error("Error rejecting candidate:", e);
      alert("Error rejecting candidate: " + (e.message || "Permission or network error"));
    } finally {
      setIsRejecting(false);
    }
  };

  const handleOpenDealRoom = async (candidate: any) => {
    if (!candidate.submissionId) return alert("Cannot open deal room - missing submission context.");
    try {
      if (candidate.dealRoomId) {
         window.location.href = "/deal-rooms"; 
      } else {
         const roomId = `DR-${candidate.submissionId}`;
         // We also update dealRoomId before status update so projection works
         await updateDoc(doc(db, "submissions", candidate.submissionId), { dealRoomId: roomId });
         await updateStatus(candidate.submissionId, "INTERVIEW_REQUESTED");
         alert("Deal Room request sent. The projection will be built.");
         setSelectedCandidate(null);
      }
    } catch (e) {
       console.error(e);
       alert("Error requesting Deal Room.");
    }
  };

  const handleOffer = async (candidate: any) => {
    if (!candidate.submissionId) return alert("Cannot offer - missing submission context.");
    try {
      await updateDoc(doc(db, "submissions", candidate.submissionId), {
        status: "OFFER_DRAFTED",
        updatedAt: serverTimestamp()
      });
      alert("Candidate moved to Offer stage.");
      setSelectedCandidate(null);
    } catch (e) {
      console.error(e);
      alert("Error offering candidate.");
    }
  };

  useEffect(() => {
    if (!userOrgId) return;

    setLoading(true);

    // Requirements Mapping
    const qReq = query(collection(db, "requirements_public"), where("clientId", "==", userOrgId));
    const unsubReq = onSnapshot(qReq, snap => {
      const map: Record<string, string> = {};
      snap.forEach(d => { map[d.id] = d.data().title || d.data().jobTitle || "Open Requirement"; });
      setReqs(map);
    }, err => {
      console.warn("Client requirements listener:", err.message);
    });

    // Submissions List (Realtime Firestore Query)
    const qSub = query(collection(db, "submissions"), where("clientId", "==", userOrgId));
    const unsubSub = onSnapshot(qSub, snap => {
       const subsRaw = snap.docs.map(d => {
           const data = d.data();
           return { id: d.id, ...data, status: (data.status || 'MATCHED').toUpperCase() };
       });
       const allowedSubs = subsRaw.filter((s: any) => {
          return !['DELETED', 'ARCHIVED', 'PARSING', 'DRAFT', 'ADDED', 'UPLOADED'].includes(s.status);
       });
       setSubmissions(allowedSubs);
    }, err => console.warn("Client submissions listener:", err.message));

    // Interviews List
    fetch(`/api/interviews?clientId=${userOrgId}`)
       .then(res => res.json())
       .then(data => {
          if (data.interviews) {
             setInterviews(data.interviews);
          }
       })
       .catch(err => console.warn("Failed to fetch interviews", err));

    setLoading(false);

    return () => {
      unsubReq();
      if (unsubSub) unsubSub();
    };
  }, [userOrgId]);

  return (
    <div className="flex bg-slate-950 relative min-h-screen text-slate-100 font-sans">
      <div className="p-8 pb-32 flex-1 max-w-7xl mx-auto w-full overflow-y-auto space-y-8">
        
        {/* Flagship OS Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 border-b border-slate-800 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">Client Command OS</span>
              <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">Hiring Command HQ</h1>
            <p className="text-xs text-slate-400 mt-1">Review matches, active placement pipelines, and track organizational budget health.</p>
          </div>
          
          {/* Budget Health & Savings Tracker */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex gap-6 items-center shrink-0">
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Hiring Budget</span>
              <div className="text-sm font-black text-white mt-1">₹45.0L Allocated</div>
            </div>
            <div className="h-6 w-px bg-slate-800"></div>
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-wider">Committed Spent</span>
              <div className="text-xs font-bold text-white mt-1">₹28.5L (63% Utilized)</div>
            </div>
            <div className="h-6 w-px bg-slate-800"></div>
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-indigo-400 uppercase tracking-wider">AI Sourcing Savings</span>
              <div className="text-xs font-black text-emerald-400 mt-0.5">₹3.4L Saved</div>
            </div>
          </div>
        </div>

        {/* Tactical Hiring Summary Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Active Allocations</span>
            <span className="text-3xl font-black text-white mt-2">4 Open Roles</span>
            <p className="text-[10px] text-slate-400 mt-1">Strategic pipelines active</p>
          </div>
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Total Matches Scored</span>
            <span className="text-3xl font-black text-emerald-400 mt-2">12 Shortlisted</span>
            <p className="text-[10px] text-slate-400 mt-1">Awaiting client review rounds</p>
          </div>
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Offers in Negotiation</span>
            <span className="text-3xl font-black text-indigo-400 mt-2">2 Offered</span>
            <p className="text-[10px] text-slate-400 mt-1">Awaiting final candidate signature</p>
          </div>
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Talent Acquisition Cost</span>
            <span className="text-3xl font-black text-white mt-2">18.4% Average</span>
            <p className="text-[10px] text-emerald-400 mt-1">2.4% below industry baseline</p>
          </div>
        </div>

        {/* Workspace OS Tab Pill Controls */}
        <div className="flex space-x-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab("MATCHED")}
            className={`px-4 py-2 rounded-lg font-mono text-xs uppercase font-bold tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "MATCHED" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
          >
            <Sparkles size={14} /> 
            <span>Matches</span>
            <span className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0.5 rounded-md font-sans">
              {submissions.filter(s => s.status === 'MATCHED' || s.status.includes('AI_MATCH')).length}
            </span>
          </button>
          
          <button
            onClick={() => setActiveTab("SUBMITTED")}
            className={`px-4 py-2 rounded-lg font-mono text-xs uppercase font-bold tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "SUBMITTED" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
          >
            <Presentation size={14} /> 
            <span>Submissions</span>
            <span className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0.5 rounded-md font-sans">
              {submissions.filter(s => s.status.includes('SUBMIT') || s.status === 'PENDING_REVIEW' || s.status.includes('DEAL ROOM')).length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("SHORTLISTED")}
            className={`px-4 py-2 rounded-lg font-mono text-xs uppercase font-bold tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "SHORTLISTED" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
          >
            <CheckCircle size={14} /> 
            <span>Shortlist</span>
            <span className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0.5 rounded-md font-sans">
              {submissions.filter(s => s.status.includes('SHORTLIST')).length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("INTERVIEWS")}
            className={`px-4 py-2 rounded-lg font-mono text-xs uppercase font-bold tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "INTERVIEWS" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
          >
            <Activity size={14} /> 
            <span>Interviews</span>
            <span className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0.5 rounded-md font-sans">
              {submissions.filter(s => s.status?.includes('INTERVIEW')).length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("OFFERS")}
            className={`px-4 py-2 rounded-lg font-mono text-xs uppercase font-bold tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "OFFERS" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
          >
            <Target size={14} /> 
            <span>Offers</span>
            <span className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0.5 rounded-md font-sans">
              {submissions.filter(s => s.status?.includes('OFFER')).length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("PLACED")}
            className={`px-4 py-2 rounded-lg font-mono text-xs uppercase font-bold tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "PLACED" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
          >
            <CheckCircle size={14} /> 
            <span>Placed</span>
            <span className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0.5 rounded-md font-sans">
              {submissions.filter(s => s.status === 'PLACED' || s.status === 'JOINED').length}
            </span>
          </button>
        </div>

        {activeTab === "MATCHED" && (() => {
           const list = submissions.filter(s => s.status === 'MATCHED' || s.status.includes('AI_MATCH'));
           return (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {list.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-500 font-mono text-xs">No newly matched candidates scored. Open requirements are actively sourcing.</div>
                ) : (
                  list.map(sub => (
                    <div
                      key={sub.id}
                      className="bg-slate-900 rounded-2xl border border-slate-800 hover:border-indigo-500 transition-all cursor-pointer overflow-hidden flex flex-col justify-between"
                      onClick={() => setSelectedCandidate({ ...sub, id: sub.candidateId, isSubmission: true, submissionId: sub.id })}
                    >
                      <div className="p-5 space-y-4">
                        <div>
                          <span className="text-[8px] font-mono uppercase tracking-widest text-slate-500 block">Matched Target</span>
                          <h4 className="text-sm font-bold text-white line-clamp-1 mt-1">{reqs[sub.requirementId] || sub.reqTitle || "Requirement Context"}</h4>
                        </div>
                        <h3 className="font-black text-lg text-white leading-tight">{sub.candidateName || "Candidate"}</h3>
                        <div className="flex items-center gap-2">
                           <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs">{sub.matchScore || "--"}% Match</Badge>
                           <Badge className="bg-slate-800 text-slate-300 text-xs uppercase tracking-widest font-mono">{sub.status}</Badge>
                        </div>
                      </div>
                      <div className="p-4 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-500 text-[10px]">Vendor: {sub.vendorId || "Direct"}</span>
                        <span className="text-indigo-400 uppercase tracking-wider font-bold">Review Match &rarr;</span>
                      </div>
                    </div>
                  ))
                )}
             </div>
           );
        })()}

        {activeTab === "SUBMITTED" && (() => {
           const list = submissions.filter(s => s.status.includes('SUBMIT') || s.status === 'PENDING_REVIEW' || s.status.includes('DEAL ROOM'));
           return (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {list.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-500 font-mono text-xs">No submitted resumes awaiting verification.</div>
                ) : (
                  list.map(sub => (
                    <div
                      key={sub.id}
                      className="bg-slate-900 rounded-2xl border border-slate-800 hover:border-indigo-500 transition-all cursor-pointer overflow-hidden flex flex-col justify-between"
                      onClick={() => setSelectedCandidate({ ...sub, id: sub.candidateId, isSubmission: true, submissionId: sub.id })}
                    >
                      <div className="p-5 space-y-4">
                        <div>
                          <span className="text-[8px] font-mono uppercase tracking-widest text-slate-500 block">Target Requirement</span>
                          <h4 className="text-sm font-bold text-white line-clamp-1 mt-1">{reqs[sub.requirementId] || sub.reqTitle || "Requirement Context"}</h4>
                        </div>
                        <h3 className="font-black text-lg text-white leading-tight">{sub.candidateName || "Candidate"}</h3>
                        <div className="flex items-center gap-2">
                           <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs">{sub.matchScore || "--"}% Match</Badge>
                           <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs uppercase tracking-widest font-mono">{sub.status || "PENDING"}</Badge>
                        </div>
                      </div>
                      <div className="p-4 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-500 text-[10px]">Vendor: {sub.vendorId || "Direct"}</span>
                        <span className="text-indigo-400 uppercase tracking-wider font-bold">Review Sourcing &rarr;</span>
                      </div>
                    </div>
                  ))
                )}
             </div>
           );
        })()}

        {activeTab === "SHORTLISTED" && (() => {
           const list = submissions.filter(s => s.status.includes('SHORTLIST'));
           return (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {list.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-500 font-mono text-xs">No shortlisted talent. Highlight candidates to move them here.</div>
                ) : (
                  list.map(sub => (
                    <div
                      key={sub.id}
                      className="bg-slate-900 rounded-2xl border border-slate-800 hover:border-emerald-500 transition-all cursor-pointer overflow-hidden flex flex-col justify-between"
                      onClick={() => setSelectedCandidate({ ...sub, id: sub.candidateId, isSubmission: true, submissionId: sub.id })}
                    >
                      <div className="p-5 space-y-4">
                        <div>
                          <span className="text-[8px] font-mono uppercase tracking-widest text-slate-500 block">Open Position</span>
                          <h4 className="text-sm font-bold text-white line-clamp-1 mt-1">{reqs[sub.requirementId] || sub.reqTitle || "Requirement Context"}</h4>
                        </div>
                        <h3 className="font-black text-lg text-white leading-tight">{sub.candidateName || "Candidate"}</h3>
                        <div className="flex items-center gap-2">
                           <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs">Shortlisted</Badge>
                        </div>
                      </div>
                      <div className="p-4 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-500 text-[10px]">Vendor: {sub.vendorId || "Direct"}</span>
                        <span className="text-emerald-400 uppercase tracking-wider font-bold">Request Interview &rarr;</span>
                      </div>
                    </div>
                  ))
                )}
             </div>
           );
        })()}

        {activeTab === "INTERVIEWS" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {interviews.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500 font-mono text-xs">No interviews scheduled. All slot schedules remain clear.</div>
            ) : (
              interviews.map(int => (
                <div
                  key={int.id}
                  className="bg-slate-900 rounded-2xl border border-slate-800 hover:border-indigo-500 transition-all cursor-pointer overflow-hidden flex flex-col justify-between"
                  onClick={() => {
                     const sub = submissions.find(s => s.id === int.submissionId);
                     if (sub) {
                        setSelectedCandidate({ ...sub, id: sub.candidateId, isSubmission: true, submissionId: sub.id });
                     } else {
                        setSelectedCandidate({ ...int, id: int.candidateId, isSubmission: true, submissionId: int.submissionId });
                     }
                  }}
                >
                  <div className="p-5 space-y-4">
                    <div>
                      <span className="text-[8px] font-mono uppercase tracking-widest text-slate-500 block">Open Target</span>
                      <h4 className="text-sm font-bold text-white line-clamp-1 mt-1">{reqs[int.requirementId] || int.reqTitle || "Requirement Context"}</h4>
                    </div>
                    <h3 className="font-black text-lg text-white leading-tight">{int.candidateName || "Candidate"}</h3>
                    <div className="flex items-center gap-2">
                       <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs">Round {int.roundNumber || 1}</Badge>
                       <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs uppercase tracking-widest font-mono">{int.status || "SCHEDULED"}</Badge>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-500 text-[10px]">Vendor: {int.vendorId || "Direct"}</span>
                    <span className="text-indigo-400 uppercase tracking-wider font-bold">Manage Interview &rarr;</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "OFFERS" && (() => {
           const list = submissions.filter(s => s.status?.includes('OFFER'));
           return (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {list.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-500 font-mono text-xs">No active contract proposals under negotiation.</div>
                ) : (
                  list.map(sub => (
                    <div
                      key={sub.id}
                      className="bg-slate-900 rounded-2xl border border-slate-800 hover:border-indigo-500 transition-all cursor-pointer overflow-hidden flex flex-col justify-between"
                      onClick={() => setSelectedCandidate({ ...sub, id: sub.candidateId, isSubmission: true, submissionId: sub.id })}
                    >
                      <div className="p-5 space-y-4">
                        <div>
                          <h4 className="text-sm font-bold text-white line-clamp-1">{reqs[sub.requirementId] || sub.reqTitle || "Requirement Context"}</h4>
                        </div>
                        <h3 className="font-black text-lg text-white leading-tight">{sub.candidateName || "Candidate"}</h3>
                        <div className="flex items-center gap-2">
                           <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs uppercase tracking-widest font-mono">{sub.status || "OFFER"}</Badge>
                        </div>
                      </div>
                      <div className="p-4 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-500 text-[10px]">Vendor: {sub.vendorId || "Direct"}</span>
                        <span className="text-indigo-400 uppercase tracking-wider font-bold">Negotiate Offer &rarr;</span>
                      </div>
                    </div>
                  ))
                )}
             </div>
           );
        })()}

        {activeTab === "PLACED" && (() => {
           const list = submissions.filter(s => s.status === 'PLACED' || s.status === 'JOINED');
           return (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {list.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-500 font-mono text-xs">No placements secured yet. Sourcing pipelines remain active.</div>
                ) : (
                  list.map(sub => (
                    <div
                      key={sub.id}
                      className="bg-slate-900 rounded-2xl border border-slate-800 hover:border-indigo-500 transition-all cursor-pointer overflow-hidden flex flex-col justify-between"
                      onClick={() => setSelectedCandidate({ ...sub, id: sub.candidateId, isSubmission: true, submissionId: sub.id })}
                    >
                      <div className="p-5 space-y-4">
                        <div>
                          <h4 className="text-sm font-bold text-white line-clamp-1">{reqs[sub.requirementId] || sub.reqTitle || "Requirement Context"}</h4>
                        </div>
                        <h3 className="font-black text-lg text-white leading-tight">{sub.candidateName || "Candidate"}</h3>
                        <div className="flex items-center gap-2">
                           <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs uppercase tracking-widest font-mono">{sub.status || "PLACED"}</Badge>
                        </div>
                      </div>
                      <div className="p-4 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-500 text-[10px]">Vendor: {sub.vendorId || "Direct"}</span>
                        <span className="text-indigo-400 uppercase tracking-wider font-bold">Review History &rarr;</span>
                      </div>
                    </div>
                  ))
                )}
             </div>
           );
        })()}

      </div>
      
      {selectedCandidate && (
        <Candidate360Modal
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          isAdmin={false}
          userOrgId={userOrgId}
          userRole={userRole}
          isClientReviewMode={true}
          onShortlist={() => handleShortlist(selectedCandidate)}
          onReject={() => handleInitiateReject(selectedCandidate)}
          onSchedule={() => {
            setSchedulingSubmission(selectedCandidate);
            setSelectedCandidate(null);
          }}
          onRequestClarification={() => handleOpenDealRoom(selectedCandidate)}
          onOffer={() => handleOffer(selectedCandidate)}
        />
      )}

      {schedulingSubmission && (
        <InterviewSchedulerModal
          submission={schedulingSubmission}
          requirement={{ id: schedulingSubmission.requirementId, title: reqs[schedulingSubmission.requirementId] || schedulingSubmission.reqTitle }}
          isClientAction={true}
          onClose={() => setSchedulingSubmission(null)}
        />
      )}

      {rejectingCandidate && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 font-bold text-sm">
                  <X size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Reject Candidate</h3>
                  <p className="text-xs text-slate-400">{rejectingCandidate.candidateName || "Candidate"}</p>
                </div>
              </div>
              <button 
                onClick={() => setRejectingCandidate(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
                Select Rejection Reason
              </label>
              
              <div className="space-y-2">
                {[
                  "Missing required technical skills",
                  "Experience level / seniority mismatch",
                  "Compensation / Rate expectation gap",
                  "Location / Shift / Schedule constraint",
                  "Position filled / Strategy change",
                  "Custom Reason"
                ].map((reason) => (
                  <label 
                    key={reason}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      rejectReason === reason 
                        ? "bg-rose-500/10 border-rose-500/40 text-rose-300 font-medium" 
                        : "bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="rejectReason" 
                      value={reason}
                      checked={rejectReason === reason}
                      onChange={() => setRejectReason(reason)}
                      className="text-rose-500 focus:ring-rose-500 h-4 w-4 bg-slate-900 border-slate-700"
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>

              {rejectReason === "Custom Reason" && (
                <div className="pt-2">
                  <textarea
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Enter specific feedback or rejection notes..."
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors resize-none"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectingCandidate(null)}
                disabled={isRejecting}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-800 text-slate-300 hover:bg-slate-800 text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={isRejecting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isRejecting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Rejecting...</span>
                  </>
                ) : (
                  <span>Confirm Rejection</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
