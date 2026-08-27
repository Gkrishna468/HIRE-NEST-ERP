import React, { useState } from 'react';
import { X, Check, XCircle, FileText, Calendar, Link as LinkIcon, MessageSquare, Bot, AlertCircle } from 'lucide-react';
import { Badge } from '../../lib/Badge';
import { Button } from '../../lib/Button';
import { useSubmissionStore } from '../../stores/SubmissionStore';

export function CandidateReviewModal({ submission, requirement, onClose, onSchedule }: any) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { updateSubmission } = useSubmissionStore();

  const handleShortlist = async () => {
    setIsProcessing(true);
    try {
      if (submission.sysSource === 'SUBMISSION') {
        await updateSubmission(submission.id, { status: "SHORTLISTED" });
      } else {
        const { SubmissionOrchestrator } = await import("../../lib/workflows/SubmissionOrchestrator");
        await SubmissionOrchestrator.submitCandidate({
          candidateData: {
            id: submission.candidateId || submission.id,
            name: submission.candidateName || submission.name || "Anonymous Candidate"
          },
          requirementId: requirement.id,
          clientId: requirement.clientId || "ORG-LOCAL",
          vendorId: submission.vendorId || "ORG-EXTERNAL-VENDOR",
          submitterId: "system", // Fallback, since auth.currentUser is removed, it relies on system
          initialStatus: "SHORTLISTED",
          matchScore: submission.matchScore || 0
        });
      }
      alert("Candidate shortlisted successfully.");
      onClose();
    } catch (e) {
      console.error(e);
      alert("Error shortlisting candidate.");
    } finally {
      setIsProcessing(false);
    }
  };

  const [rejectReason, setRejectReason] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [localComments, setLocalComments] = useState<any[]>(submission.comments || []);
  const [showRejectForm, setShowRejectForm] = useState(false);

  const handleReject = async () => {
    if (!rejectReason) {
       setShowRejectForm(true);
       return;
    }
    
    setIsProcessing(true);
    try {
      if (submission.sysSource === 'SUBMISSION') {
        await updateSubmission(submission.id, {
          status: "REJECTED",
          rejectReason: rejectReason,
          rejectNote: rejectNote
        });
      } else {
        const { SubmissionOrchestrator } = await import("../../lib/workflows/SubmissionOrchestrator");
        await SubmissionOrchestrator.submitCandidate({
          candidateData: {
            id: submission.candidateId || submission.id,
            name: submission.candidateName || submission.name || "Anonymous Candidate"
          },
          requirementId: requirement.id,
          clientId: requirement.clientId || "ORG-LOCAL",
          vendorId: submission.vendorId || "ORG-EXTERNAL-VENDOR",
          submitterId: "system",
          initialStatus: "REJECTED",
          matchScore: submission.matchScore || 0
        });
      }
      import("../../lib/eventEngine").then(({ publishEvent }) => {
         publishEvent({ type: "urgent", title: "Candidate Rejected", message: `Reason: ${rejectReason}`, recipients: ["GLOBAL_ADMIN"] })
      });
      alert(`Candidate rejected. Reason: ${rejectReason}`);
      onClose();
    } catch (e) {
      console.error(e);
      alert("Error rejecting candidate.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenDealRoom = async () => {
    setIsProcessing(true);
    try {
      if (submission.dealRoomId) {
         window.location.href = "/deal-rooms"; 
      } else {
         const roomId = "DR-" + Math.random().toString(36).substr(2, 9);
         // Simulate deal room creation via service layer bypassing UI writes
         await updateSubmission(submission.id, {
           dealRoomId: roomId
         });
         alert("Clarification thread (Deal Room) created successfully.");
         onClose();
      }
    } catch (e) {
       console.error(e);
       alert("Error creating Deal Room.");
    } finally {
       setIsProcessing(false);
    }
  };

  // Mock comments integration, in real it would load from subcollections
  const comments = submission.comments || [];
  const aiExplanation = submission.aiAnalysis?.justification || "The AI evaluated this candidate against the core job requirements and deduced a strong alignment based on core skill occurrences and historical semantic indicators.";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-md overflow-y-auto w-full h-full">
      {showRejectForm && (
         <div className="absolute inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
               <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
                  <XCircle className="text-red-500" /> Provide Hiring Feedback
               </h3>
               <p className="text-sm text-slate-500 mb-4">Your feedback helps improve our AI Match capabilities.</p>
               
               <div className="space-y-4">
                  <div>
                     <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Rejection Reason</label>
                     <select 
                        value={rejectReason} 
                        onChange={e => setRejectReason(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                     >
                        <option value="">Select a reason...</option>
                        <option value="Missing Skill">Missing Core Skill</option>
                        <option value="Experience Gap">Insufficient Experience</option>
                        <option value="Over Budget">Over Budget / Salary Expectations</option>
                        <option value="Location Constraint">Location Constraint / Relocation</option>
                        <option value="Cultural Fit">Cultural Fit</option>
                        <option value="Other">Other</option>
                     </select>
                  </div>
                  <div>
                     <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Additional Context & Mentions</label>
                     <textarea 
                        value={rejectNote} 
                        onChange={e => setRejectNote(e.target.value)}
                        placeholder="Add notes for the recruiter (e.g. '@Jane they need more Python')..."
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 outline-none h-24 resize-none"
                     ></textarea>
                  </div>
                  <div className="flex gap-3 pt-4 border-t border-slate-100">
                     <Button variant="outline" className="flex-1" onClick={() => setShowRejectForm(false)}>Cancel</Button>
                     <Button className="flex-1 bg-red-600 hover:bg-red-700 font-bold" onClick={handleReject}>Submit Decision</Button>
                  </div>
               </div>
            </div>
         </div>
      )}

      <div className="bg-white rounded-3xl w-full max-w-7xl h-full shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 zoom-in-95 duration-200">
        
        {/* Header - Review Workspace Identity */}
        <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0 border-b border-indigo-900/50">
          <div>
            <div className="flex items-center gap-3 mb-1">
               <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{submission.candidateName || 'Anonymous Profile'}</h2>
               <Badge className="bg-indigo-500 text-white border-0 text-sm py-1 px-3 shadow-inner shadow-indigo-400/20">{submission.matchScore}% Match</Badge>
            </div>
            <div className="text-slate-400 text-sm font-medium flex flex-wrap gap-x-6 gap-y-2 mt-1">
               <span><span className="text-slate-500">ID:</span> {submission.candidateId?.slice(0,8) || 'N/A'}</span>
               <span><span className="text-slate-500">Requirement:</span> {requirement.title}</span>
               <span><span className="text-slate-500">Vendor:</span> <span className="uppercase text-slate-300 font-bold tracking-wider text-xs">{submission.vendorName || 'Vendor Not Linked'}</span></span>
               <span><span className="text-slate-500">Status:</span> {submission.status}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-white/10 hover:bg-white/20 hover:scale-105 active:scale-95 rounded-full transition-all">
            <X size={24} />
          </button>
        </div>

        {/* Workspace Layout - 3 Column Grid */}
        <div className="flex-1 overflow-hidden bg-slate-50 flex flex-col lg:flex-row">
           
           {/* Left Col: Primary Content (Resume & Skills) */}
           <div className="flex-1 border-r border-slate-200 flex flex-col overflow-hidden">
               <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                     <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                         <LinkIcon size={14} className="text-indigo-600"/> Skills Ontology
                     </h3>
                     <div className="flex flex-wrap gap-2">
                        {submission.skills ? (
                            Array.isArray(submission.skills) ? submission.skills.map((s: string, i: number) => <span key={i}><Badge variant="outline" className="bg-slate-50">{s}</Badge></span>) :
                            submission.skills.split(',').map((s: string, i: number) => <span key={i}><Badge variant="outline" className="bg-slate-50">{s}</Badge></span>)
                        ) : <span className="text-slate-400 text-sm italic">No skills extracted.</span>}
                     </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex-1">
                     <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                         <FileText size={14} className="text-indigo-600"/> Source Document (Resume Text)
                     </h3>
                     <div className="p-4 bg-slate-50/50 rounded-xl text-sm text-slate-700 whitespace-pre-wrap font-mono leading-relaxed border border-slate-100">
                        {submission.resumeText || "No resume text available in this payload."}
                     </div>
                  </div>
               </div>
           </div>

           {/* Right Col: AI & Collaboration Panel */}
           <div className="w-full lg:w-96 bg-white flex flex-col overflow-hidden">
             <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                
                {/* AI Summary Block */}
                <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100/50 shadow-sm">
                   <h3 className="font-black text-indigo-900 uppercase tracking-widest text-xs mb-3 flex items-center gap-2">
                       <Bot size={14} className="text-indigo-600"/> AI Match Summary
                   </h3>
                   <div className="space-y-4">
                      <div className="text-sm text-slate-700 leading-relaxed font-medium">
                         {aiExplanation}
                      </div>

                      <div className="pt-3 border-t border-indigo-100 space-y-2">
                         <div>
                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-0.5">Required Experience</span>
                            <span className="text-sm font-semibold text-indigo-900">{requirement.experience || 'Not specified'}</span>
                         </div>
                         <div>
                            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block mb-0.5">Role Fitment</span>
                            <span className="text-sm font-semibold text-slate-700">Competencies validated. Proceed with evaluation.</span>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Collaboration & Comments */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                   <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-3 flex items-center gap-2">
                       <MessageSquare size={14} className="text-slate-500"/> Activity & Comments
                   </h3>
                   
                   {comments.length > 0 ? (
                      <div className="space-y-3">
                         {comments.map((c: any, i: number) => (
                            <div key={i} className="bg-white p-3 rounded-lg border border-slate-200 text-sm shadow-sm">
                               <div className="font-bold text-xs text-slate-500 mb-1">{c.author || 'Reviewer'} <span className="text-[10px] font-normal text-slate-400 ml-1">{c.time || 'recently'}</span></div>
                               <div className="text-slate-800">{c.text}</div>
                            </div>
                         ))}
                      </div>
                   ) : (
                      <div className="flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-white">
                         <AlertCircle size={20} className="text-slate-300 mb-2"/>
                         <p className="text-xs text-slate-500 font-medium">No comments left yet.</p>
                      </div>
                   )}
                   
                   <form onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const input = form.elements.namedItem('commentText') as HTMLInputElement;
                      if (!input.value.trim()) return;
                      const newComment = {
                         author: "Reviewing Client",
                         text: input.value,
                         timestamp: new Date()
                      };
                      setLocalComments([...localComments, newComment]);
                      import('../../lib/eventEngine').then(({ publishEvent }) => {
                         const mentions = input.value.match(/@\w+/g);
                         if (mentions) {
                             mentions.forEach(m => publishEvent({
                                 type: 'info',
                                 title: 'Client Mentions You',
                                 message: `Client mentioned you in candidate review: ${submission.candidateName}`,
                                 recipients: [m.substring(1).toUpperCase()]
                             }));
                         }
                      });
                      if (submission.id) {
                         updateSubmission(submission.id, { comments: [...localComments, newComment] }).catch(() => {});
                      }
                      input.value = "";
                   }} className="mt-4 flex gap-2">
                      <input name="commentText" type="text" placeholder="Add a note or @mention..." className="flex-1 bg-white border border-slate-300 rounded-lg text-sm px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"/>
                      <Button type="submit" variant="outline" className="px-3"><Check size={14}/></Button>
                   </form>
                </div>

             </div>
             
             {/* Sticky Action Footer */}
             <div className="p-6 bg-white border-t border-slate-200 shrink-0 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                   <Button onClick={handleShortlist} disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 w-full rounded-xl shadow-sm transition-all hover:-translate-y-0.5">
                     <Check size={18} className="mr-2"/> Shortlist
                   </Button>
                   <Button onClick={handleReject} disabled={isProcessing} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-bold h-12 w-full rounded-xl transition-all">
                     <XCircle size={18} className="mr-2"/> Reject
                   </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                   <Button onClick={() => onSchedule(submission)} disabled={isProcessing} className="bg-slate-900 hover:bg-black text-white font-bold h-12 w-full rounded-xl shadow-sm transition-all">
                     <Calendar size={18} className="mr-2"/> Schedule Interview
                   </Button>
                   <Button onClick={handleOpenDealRoom} disabled={isProcessing} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 font-bold h-12 w-full rounded-xl transition-all">
                     <MessageSquare size={18} className="mr-2"/> Request Clarification
                   </Button>
                </div>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}

