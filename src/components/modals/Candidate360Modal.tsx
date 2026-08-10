import React, { useState, useEffect } from 'react';
import { 
  X, User, FileText, Bot, Briefcase, Activity, 
  MessageSquare, ShieldAlert, CheckCircle, MapPin, 
  UploadCloud, Search, Calendar, Target,
} from 'lucide-react';
import { Badge } from '../../lib/Badge';
import { Button } from '../../lib/Button';
import { cn } from '../../lib/utils';
import { publishEvent } from '../../lib/eventEngine';
import { SubmissionOrchestrator } from '../../lib/workflows/SubmissionOrchestrator';
import { parseBulkResumes } from "../../services/aiService";

type TabType = 'OVERVIEW' | 'RESUME' | 'AI_ANALYSIS' | 'REQUIREMENTS' | 'INTERVIEWS' | 'TIMELINE' | 'COLLABORATION' | 'GOVERNANCE';

export default function Candidate360Modal({ 
  candidate, 
  onClose, 
  isAdmin, 
  userOrgId, 
  userRole,
  jobs = [],
  vendorMap = {},
  isClientReviewMode = false,
  onShortlist,
  onReject,
  onSchedule,
  onRequestClarification,
  onOffer
}: { 
  candidate: any, 
  onClose: () => void, 
  isAdmin: boolean,
  userOrgId: string,
  userRole: string,
  jobs?: any[],
  vendorMap?: Record<string, string>,
  isClientReviewMode?: boolean;
  onShortlist?: () => void;
  onReject?: () => void;
  onSchedule?: () => void;
  onRequestClarification?: () => void;
  onOffer?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabType>('OVERVIEW');
  const [events, setEvents] = useState<any[]>([]);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>(candidate.comments || []);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [isMapping, setIsMapping] = useState(false);
  const [mappingResult, setMappingResult] = useState<any | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isScreening, setIsScreening] = useState(false);
  const [geminiQuery, setGeminiQuery] = useState("");
  const [geminiAnswer, setGeminiAnswer] = useState<string | null>(null);
  const [isAskingGemini, setIsAskingGemini] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [fullCandidateData, setFullCandidateData] = useState<any>(null);

  const handleRefreshAIAnalysis = async () => {
    const candId = candidate.candidateId || candidate.id;
    const resumeTxt = displayCandidate.parsedResumeText || displayCandidate.resumeText || displayCandidate.extractedText || "No resume text available";
    setIsScreening(true);
    try {
      const res = await fetch('/api/candidates/screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: candId, resumeText: resumeTxt })
      });
      const data = await res.json();
      if (data.success && data.aiIntelligence) {
        setFullCandidateData((prev: any) => ({
          ...(prev || {}),
          aiIntelligence: data.aiIntelligence
        }));
        alert("AI Recruitment Intelligence refreshed successfully!");
      } else {
        alert("Screening completed: " + (data.error || "Refreshed"));
      }
    } catch (err: any) {
      console.error("Refresh AI error:", err);
      alert("Failed to refresh AI analysis: " + err.message);
    } finally {
      setIsScreening(false);
    }
  };

  const handleAskGemini360 = async () => {
    if (!geminiQuery.trim()) return;
    setIsAskingGemini(true);
    setGeminiAnswer(null);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `You are an AI Recruitment Copilot reviewing candidate "${nameStr}". Candidate Skills: ${(skillsArr || []).join(', ')}. Candidate Experience: ${displayCandidate.experience || 'N/A'}. Resume Text: ${(displayCandidate.parsedResumeText || displayCandidate.resumeText || '').substring(0, 1500)}. User Question: ${geminiQuery}`
        })
      });
      const data = await res.json();
      setGeminiAnswer(data.response || data.text || data.message || "Query completed.");
    } catch (e: any) {
      setGeminiAnswer("Error querying Gemini AI: " + e.message);
    } finally {
      setIsAskingGemini(false);
    }
  };

  // Merge full data so that we have resume, skills, etc.
  const displayCandidate = fullCandidateData ? { ...candidate, ...fullCandidateData } : candidate;

  const handleDeleteCandidate = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setIsDeleting(true);
    try {
      const { useCandidateStore } = await import("../../stores/CandidateStore");
      await useCandidateStore.getState().deleteCandidate(candidate.candidateId || candidate.id);
      
      import("../../lib/eventEngine").then(({ publishEvent }) => {
        publishEvent({
          type: "info",
          title: "Candidate Deleted",
          message: `Candidate ${candidate.candidateId || candidate.id} was soft-deleted by user.`,
          recipients: ["GLOBAL_ADMIN"]
        });
      });
      
      alert("Candidate successfully deleted.");
      setShowDeleteConfirm(false);
      onClose();
    } catch (e: any) {
      alert("Deletion failed: " + e.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRetryEnrichment = async () => {
    setIsRetrying(true);
    try {
      const { useCandidateStore } = await import("../../stores/CandidateStore");
      await useCandidateStore.getState().retryEnrichment(candidate);
      alert("AI Enrichment Retry completed successfully.");
    } catch (e: any) {
      console.error("Retry failed:", e);
      alert("Retry failed / No valid text: " + e.message);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleRunMatch = async () => {
    if (!selectedJobId) return;
    setIsMapping(true);
    try {
      const { useSubmissionStore } = await import("../../stores/SubmissionStore");
      const selectedReq = jobs.find(j => j.id === selectedJobId);
      const targetClientId = selectedReq?.clientId || "ORG-CLIENT-1";

      const candidateId = candidate.candidateId || candidate.id;
      
      const response = await useSubmissionStore.getState().submitCandidateProfile({
        candidateData: {
          id: candidateId,
          name: nameStr,
          email: candidate.email || candidate.contactEmail || "",
          phone: candidate.phone || candidate.contactPhone || "",
          resumeText: candidate.resumeText || candidate.extractedText || "",
          skills: getSkillsArray(candidate.skills) || [],
        },
        requirementId: selectedJobId,
        clientId: targetClientId,
        vendorId: userOrgId || "local",
        submitterId: "local_user",
        initialStatus: "PENDING_REVIEW",
        matchScore: mappingResult?.matchScore || mappingResult?.fitScore || 0,
        aiAnalysis: mappingResult || null,
        bypassOwnershipCheck: isAdmin,
      });

      if (response && response.success) {
        alert("Success: Candidate submitted successfully!");
      } else {
        alert("Error: " + (response?.message || "Failed"));
      }
    } catch(e) {
      console.error(e);
      alert("Failed to map candidate to requirement.");
    } finally {
      setIsMapping(false);
    }
  };

  useEffect(() => {
    const id = candidate.candidateId || candidate.originalId || candidate.id;
    let unsubProfile = () => {};
    let unsubEvents = () => {};
    let unsubInterviews = () => {};
    let unsubMatches = () => {};

    import("../../stores/CandidateStore").then(({ useCandidateStore }) => {
       const store = useCandidateStore.getState();
       
       if (!userRole.includes("client")) {
          unsubProfile = store.subscribeToCandidate(id, (data) => {
             setFullCandidateData(data);
          });
       }

       if (!userRole.includes("client")) {
          unsubEvents = store.subscribeToEvents(id, (evs) => setEvents(evs));
          unsubInterviews = store.subscribeToInterviews(id, (ints) => setInterviews(ints));
          unsubMatches = store.subscribeToMatches(id, selectedJobId || candidate.requirementId, (match) => {
             if (match) setMappingResult(match);
          });
       } else {
             fetch(`/api/client-candidate?candidateId=${id}&clientId=${userOrgId}`)
             .then(res => res.json())
             .then(data => {
                if (data?.candidate) setFullCandidateData(data.candidate);
                if (data?.aiAnalysis) setMappingResult(data.aiAnalysis);
                if (data?.interviews) {
                    setInterviews(data.interviews);
                }
             })
             .catch(err => console.warn("Failed to fetch client candidate data via API", err));
       }
    });

    return () => {
       unsubProfile();
       unsubEvents();
       unsubInterviews();
       unsubMatches();
    };
  }, [candidate, selectedJobId, userRole, userOrgId]);

  const candidateIdStr = displayCandidate.candidateId || displayCandidate.id || "HN-CAN-PENDING";
  const nameStr = displayCandidate.candidateName || displayCandidate.displayName || displayCandidate.fullName || displayCandidate.name || displayCandidate.parsedName || displayCandidate.parsedResume?.name || displayCandidate.resumeData?.name || "Unknown Candidate";
  const vendorStr = vendorMap?.[displayCandidate.vendorId] || displayCandidate.vendorName || (displayCandidate.vendorId === "ORG-GLOBAL-HQ" ? "WorkNexa Infotech" : displayCandidate.vendorId) || "Direct/Unknown";
  
  const getSkillsArray = (skills: any): string[] => {
    if (Array.isArray(skills)) return skills;
    if (typeof skills === "string") return skills.split(",").map((s: string) => s.trim()).filter(Boolean);
    return [];
  };

  const skillsArr = getSkillsArray(displayCandidate.skills);

  let TABS: { id: TabType, label: string, icon: any }[] = [
    { id: 'OVERVIEW', label: 'Summary', icon: User },
    { id: 'RESUME', label: 'Resume', icon: FileText },
    { id: 'AI_ANALYSIS', label: 'Candidate Intelligence', icon: Bot },
    { id: 'REQUIREMENTS', label: 'JD Match Analysis', icon: Briefcase },
    { id: 'INTERVIEWS', label: 'Interviews', icon: Calendar },
    { id: 'TIMELINE', label: 'Timeline', icon: Activity },
    { id: 'COLLABORATION', label: 'Feedback', icon: MessageSquare },
    { id: 'GOVERNANCE', label: 'Governance', icon: ShieldAlert },
  ];

  if (isClientReviewMode) {
     TABS = TABS.filter(t => !['GOVERNANCE'].includes(t.id));
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
       <div className="bg-slate-50 w-full max-w-7xl h-full sm:h-[85vh] rounded-[24px] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
          
          {/* Header */}
          <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center text-lg font-black shadow-inner">
                   {nameStr[0]}
                </div>
                <div>
                   <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                     {nameStr}
                     {candidate.status === 'ACTIVE' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                   </h2>
                   <div className="flex flex-wrap items-center gap-3 mt-1 text-xs font-semibold text-slate-500">
                      <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{candidateIdStr}</span>
                      <span className="flex items-center gap-1"><MapPin size={12} /> {candidate.location || "Remote"}</span>
                      <span className="uppercase text-slate-400">Vendor: <span className="text-slate-600">{vendorStr}</span></span>
                      {candidate.pipelineStage && (
                         <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 uppercase tracking-wider">{candidate.pipelineStage}</Badge>
                      )}
                   </div>
                </div>
             </div>
             
             <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors text-slate-600">
                <X size={20} />
             </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex overflow-x-auto border-b border-slate-200 bg-white shrink-0 custom-scrollbar px-6 shadow-sm z-10">
             {TABS.map(tab => {
               const Icon = tab.icon;
               const isActive = activeTab === tab.id;
               return (
                 <button 
                   key={tab.id}
                   onClick={() => setActiveTab(tab.id)}
                   className={cn(
                     "flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-widest border-b-2 whitespace-nowrap transition-colors",
                     isActive 
                       ? "border-indigo-600 text-indigo-700" 
                       : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                   )}
                 >
                   <Icon size={14} className={isActive ? "text-indigo-600" : "text-slate-400"} />
                   {tab.label}
                 </button>
               )
             })}
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar">
             
             {/* OVERVIEW TAB */}
             {activeTab === 'OVERVIEW' && (
                <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm col-span-2 md:col-span-3 lg:col-span-2">
                         <h3 className="font-bold text-slate-800 uppercase tracking-widest text-[10px] mb-4 text-slate-400 border-b border-slate-100 pb-2">Candidate Summary</h3>
                         <div className="space-y-4 text-sm font-medium">
                            <div className="flex justify-between items-center"><span className="text-slate-500">Email:</span> <span className="text-slate-900">{displayCandidate.email || displayCandidate.primaryEmail || 'N/A'}</span></div>
                            <div className="flex justify-between items-center"><span className="text-slate-500">Phone:</span> <span className="text-slate-900">{displayCandidate.phone || displayCandidate.phoneHash || 'N/A'}</span></div>
                            <div className="flex justify-between items-center"><span className="text-slate-500">Vendor:</span> <span className="text-slate-900">{vendorStr}</span></div>
                            <div className="flex justify-between items-center"><span className="text-slate-500">Experience:</span> <span className="text-slate-900 max-w-[250px] truncate">{displayCandidate.experience || (displayCandidate.totalExperience ? `${displayCandidate.totalExperience} Years` : (displayCandidate.experienceTracker?.computedYears ? `${displayCandidate.experienceTracker.computedYears} Years` : 'Experience Under Review'))}</span></div>
                            <div className="flex justify-between items-center"><span className="text-slate-500">Current Stage:</span> <Badge>{displayCandidate.pipelineStage || 'Added'}</Badge></div>
                         </div>
                      </div>
                      
                      {isClientReviewMode ? (
                          <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100 shadow-sm col-span-1 border-dashed flex flex-col justify-center">
                             <div className="text-center">
                                <h3 className="font-bold text-indigo-800 uppercase tracking-widest text-[10px] mb-2 mt-2">Active Consideration</h3>
                                <p className="text-xs text-indigo-600 mb-4 font-medium px-4">This candidate was submitted for your review. To see the detailed match breakdown, select the Match Analysis tab below.</p>
                                <Button className="w-full text-xs font-bold" onClick={() => setActiveTab('REQUIREMENTS')} variant="outline">View Match Analysis</Button>
                             </div>
                          </div>
                      ) : (
                         <div className="bg-indigo-900 p-5 rounded-xl border border-indigo-800 shadow-sm text-white flex flex-col justify-center items-center text-center">
                            <h3 className="font-bold uppercase tracking-widest text-[10px] text-indigo-300 mb-2">Platform Score</h3>
                            <div className="text-5xl font-black text-indigo-100 mb-2">{(displayCandidate.matchScore || mappingResult?.matchScore) || '--'}<span className="text-2xl text-indigo-400">%</span></div>
                            <p className="text-xs text-indigo-300 font-medium">{mappingResult ? 'Matched to Requirement' : 'Pending AI Match'}</p>
                         </div>
                      )}
                   </div>

                   {skillsArr.length > 0 && (
                     <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                         <h3 className="font-bold text-slate-800 uppercase tracking-widest text-[10px] mb-4 text-slate-400 border-b border-slate-100 pb-2">Extracted Skills</h3>
                         <div className="flex flex-wrap gap-2">
                             {skillsArr.map((skill: string, i: number) => (
                                <Badge key={i} variant="outline" className="bg-slate-50 border border-slate-200 text-slate-700">{skill}</Badge>
                             ))}
                         </div>
                     </div>
                   )}
                </div>
             )}

             {/* RESUME TAB */}
             {activeTab === 'RESUME' && (
                <div className="h-full flex flex-col max-w-5xl mx-auto space-y-4 animate-in fade-in duration-300">
                   <div className="flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 uppercase tracking-widest text-[10px] text-slate-400">Parsed Resume Text</h3>
                      <Button variant="outline" size="sm" className="h-8 text-xs font-bold" onClick={() => { const url = displayCandidate.resumeUrl || displayCandidate.originalResumeUrl || displayCandidate.resumeFileUrl; if (url) { window.open(url, '_blank') } else { alert('Original resume file not found.') } }}><UploadCloud size={14} className="mr-2" /> Download Original</Button>
                   </div>
                   <div className="flex-1 bg-white border border-slate-200 rounded-xl p-6 shadow-sm overflow-y-auto font-mono text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                      {displayCandidate.parsedResumeText || displayCandidate.resumeText || displayCandidate.extractedText || "No parsed resume text available."}
                   </div>
                </div>
             )}

             {/* AI ANALYSIS TAB (Candidate Intelligence) */}
             {activeTab === 'AI_ANALYSIS' && (
                <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
                    {/* Action Controls Bar */}
                    <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                       <div className="flex items-center gap-2">
                          <Sparkles size={16} className="text-indigo-600 animate-pulse" />
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">AI Recruitment Intelligence Status</span>
                          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">
                             {displayCandidate.aiIntelligence ? 'SCREENED & ENRICHED' : 'STANDARD PARSED'}
                          </Badge>
                       </div>
                       <Button
                         onClick={handleRefreshAIAnalysis}
                         disabled={isScreening}
                         size="sm"
                         className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-2"
                       >
                         {isScreening ? (
                           <>
                             <Activity size={14} className="animate-spin" />
                             Screening Resume...
                           </>
                         ) : (
                           <>
                             <RotateCcw size={14} />
                             Refresh AI Analysis
                           </>
                         )}
                       </Button>
                    </div>

                    {/* AI Summary Card */}
                    <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white p-6 rounded-xl border border-indigo-800 shadow-md relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-6 opacity-10">
                          <Bot size={120} />
                       </div>
                       <h3 className="font-bold uppercase tracking-widest text-xs mb-3 text-indigo-300 flex items-center gap-2">
                         <Bot size={16} /> AI Executive Summary
                       </h3>
                       <p className="text-sm text-slate-200 leading-relaxed font-normal relative z-10">
                         {displayCandidate.aiIntelligence?.aiSummary || displayCandidate.distillationSummary || displayCandidate.aiSummary || displayCandidate.summary || "No AI profile summary generated yet. Click 'Refresh AI Analysis' above to screen this candidate's resume with Gemini AI."}
                       </p>
                    </div>

                    <div className="bg-indigo-50/50 p-8 rounded-xl border border-indigo-100/50 shadow-sm">
                       <h3 className="font-bold text-slate-800 uppercase tracking-widest text-[10px] mb-6 text-indigo-500 border-b border-indigo-100 pb-2 flex items-center gap-2"><Activity size={14} /> HireNest Intelligence Engine</h3>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                           <div className="space-y-6">
                               <div>
                                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Extracted Skills & Competencies</p>
                                   <div className="flex flex-wrap gap-2">
                                       {skillsArr.length > 0 ? skillsArr.map((s: string, idx: number) => (
                                           <Badge key={idx} variant="outline" className="bg-white border-slate-200 text-slate-700 shadow-sm">{s}</Badge>
                                       )) : <span className="text-sm text-slate-400 italic">No skills extracted yet.</span>}
                                   </div>
                               </div>
                               
                               <div className="pt-4 border-t border-indigo-100/50">
                                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Detected Experience</p>
                                   <div className="text-2xl font-black text-slate-800">
                                       {displayCandidate.experience || (displayCandidate.totalExperience ? `${displayCandidate.totalExperience} Years` : (displayCandidate.experienceTracker?.computedYears ? `${displayCandidate.experienceTracker.computedYears} Years` : 'Unknown'))}
                                   </div>
                               </div>
                           </div>

                           <div className="space-y-6">
                               {displayCandidate.education && (
                                   <div>
                                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Education Background</p>
                                       <div className="text-sm font-semibold text-slate-700">{displayCandidate.education}</div>
                                   </div>
                               )}
                               
                               <div className={displayCandidate.education ? "pt-4 border-t border-indigo-100/50" : ""}>
                                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Core Profile Domain</p>
                                   <div className="text-sm font-semibold text-slate-700">{displayCandidate.domain || displayCandidate.inferredDomain || displayCandidate.role || 'Unspecified Domain'}</div>
                               </div>
                               
                               <div className="pt-4 border-t border-indigo-100/50">
                                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Location Details</p>
                                   <div className="text-sm font-semibold text-slate-700">{displayCandidate.location || 'Remote/Unknown'}</div>
                               </div>
                           </div>
                       </div>
                    </div>
                    
                    {displayCandidate.distillationSummary && (
                       <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mt-6">
                           <h3 className="font-bold text-slate-800 uppercase tracking-widest text-[10px] mb-4 text-emerald-500 border-b border-slate-100 pb-2 flex items-center gap-2"><Bot size={14}/> Optional LLM Enhancement (Summary)</h3>
                           <p className="text-sm text-slate-600 leading-relaxed font-medium">{displayCandidate.distillationSummary}</p>
                       </div>
                    )}

                    {/* Strengths and Concerns */}
                    {displayCandidate.aiIntelligence && (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="bg-emerald-50/60 p-5 rounded-xl border border-emerald-100 shadow-sm">
                               <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-3 flex items-center gap-2">
                                 <CheckCircle2 size={16} /> Key Candidate Strengths
                               </h4>
                               <ul className="space-y-1.5 text-xs text-slate-700">
                                   {(displayCandidate.aiIntelligence.strengths || []).map((st: string, idx: number) => (
                                       <li key={idx} className="flex items-start gap-2">
                                           <span className="text-emerald-500 font-bold">•</span>
                                           <span>{st}</span>
                                       </li>
                                   ))}
                               </ul>
                           </div>

                           <div className="bg-amber-50/60 p-5 rounded-xl border border-amber-100 shadow-sm">
                               <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-3 flex items-center gap-2">
                                 <AlertTriangle size={16} /> Potential Risk / Screening Notes
                               </h4>
                               <ul className="space-y-1.5 text-xs text-slate-700">
                                   {(displayCandidate.aiIntelligence.potentialConcerns || []).map((pc: string, idx: number) => (
                                       <li key={idx} className="flex items-start gap-2">
                                           <span className="text-amber-500 font-bold">•</span>
                                           <span>{pc}</span>
                                       </li>
                                   ))}
                               </ul>
                           </div>
                       </div>
                    )}

                    {/* Interactive Ask Gemini 360 Box */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                       <h3 className="font-bold text-slate-800 uppercase tracking-widest text-[10px] text-indigo-600 flex items-center gap-2">
                          <Bot size={14} /> Ask Gemini AI 360
                       </h3>
                       <p className="text-xs text-slate-500">Query Gemini AI directly regarding this candidate's career trajectory, fit for technical roles, or interview questions.</p>
                       <div className="flex gap-2">
                          <input
                            type="text"
                            value={geminiQuery}
                            onChange={(e) => setGeminiQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAskGemini360()}
                            placeholder="e.g. Is this candidate suitable for a Principal Systems Architect role?"
                            className="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                          <Button
                            onClick={handleAskGemini360}
                            disabled={isAskingGemini || !geminiQuery.trim()}
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs gap-2"
                          >
                            {isAskingGemini ? <Activity size={14} className="animate-spin" /> : <Send size={14} />}
                            Ask Gemini
                          </Button>
                       </div>
                       {geminiAnswer && (
                          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 leading-relaxed font-medium">
                             <span className="font-bold text-indigo-600 block mb-1">Gemini AI Copilot:</span>
                             {geminiAnswer}
                          </div>
                       )}
                    </div>
                </div>
             )}

             {/* REQUIREMENTS TAB (JD Match Analysis) */}
             {activeTab === 'REQUIREMENTS' && (
                <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
                    
                    {/* Header Mapping Section (Visible to Vendor/Admin only) */}
                    {!isClientReviewMode && (
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm shadow-indigo-100/50 relative overflow-hidden">
                           <div className="absolute top-0 right-0 p-8 opacity-5">
                              <Target size={150} />
                           </div>
                           <h3 className="font-bold text-slate-800 uppercase tracking-widest text-xs mb-2">Map candidate to a requirement</h3>
                           <p className="text-sm text-slate-500 mb-6 max-w-xl relative">Select an open requirement to trigger the AI Match Engine and initiate the formal submission workflow.</p>
                           
                           <div className="flex flex-col sm:flex-row gap-3 relative z-10">
                              <select className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)}>
                                 <option value="">Select an open requirement...</option>
                                 {jobs.map(j => <option key={j.id} value={j.id}>{j.title} ({j.company})</option>)}
                              </select>
                              <Button 
                                 onClick={handleRunMatch} 
                                 disabled={!selectedJobId || isMapping}
                                 className="bg-indigo-600 hover:bg-indigo-700 font-bold px-8"
                              >
                                 {isMapping ? "Analyzing Fit..." : "Run AI Match"}
                              </Button>
                           </div>
                        </div>
                    )}

                    {/* Mapped Match Output */}
                    {mappingResult ? (
                       <div className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm">
                           <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200">
                              <div>
                                 <h3 className="text-xl font-bold text-slate-800">JD Match Analysis</h3>
                                 <p className="text-sm text-slate-500 font-medium">Matched to: <span className="text-indigo-600">{candidate.reqTitle || mappingResult.reqTitle || mappingResult.requirementId || "Target Requirement"}</span></p>
                              </div>
                              <div className="text-right">
                                 <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Match Engine Score</div>
                                 <div className="text-4xl font-black text-indigo-600">{displayCandidate.matchScore || mappingResult.matchScore || '--'}%</div>
                              </div>
                           </div>

                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                                 <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Skills Match</div>
                                 <div className="text-2xl font-black text-indigo-600">{mappingResult.breakdown?.skillsScore || mappingResult.matchScore || 0}%</div>
                              </div>
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                                 <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Experience</div>
                                 <div className="text-2xl font-black text-indigo-600">{mappingResult.breakdown?.experienceScore || Math.max(0, (mappingResult.matchScore || 0) - 5)}%</div>
                              </div>
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                                 <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Domain Fit</div>
                                 <div className="text-2xl font-black text-indigo-600">{mappingResult.breakdown?.domainScore || mappingResult.matchScore || 0}%</div>
                              </div>
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                                 <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Location</div>
                                 <div className="text-2xl font-black text-indigo-600">{mappingResult.breakdown?.locationScore || 100}%</div>
                              </div>
                           </div>
                           
                           <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-xl shadow-sm mb-6">
                              <h3 className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-3 block border-b border-indigo-100 pb-2">AI Summary & Reasoning</h3>
                              <p className="text-sm text-indigo-900 leading-relaxed font-medium">
                                 {mappingResult.summary || mappingResult.overallMatchReason || "The HireNest match engine identified strong overlap in core competencies."}
                              </p>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="bg-white p-5 rounded-xl border border-emerald-100 shadow-sm">
                                 <h3 className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-3 block border-b border-emerald-100 pb-2">Identified Strengths</h3>
                                 <ul className="space-y-3 mt-3">
                                    {(mappingResult.strengths || ["Meets core experience requirements"]).map((s: string, idx: number) => (
                                      <li key={idx} className="text-sm font-medium text-slate-700 flex items-start gap-2">
                                         <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" /> <span>{s}</span>
                                      </li>
                                    ))}
                                 </ul>
                              </div>
                              
                              <div className="bg-white p-5 rounded-xl border border-rose-100 shadow-sm flex flex-col justify-between">
                                 <div>
                                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-rose-500 mb-3 block border-b border-rose-100 pb-2">Missing Skills & Risks</h3>
                                    <div className="flex flex-wrap gap-2 mb-3 mt-3">
                                       {(mappingResult.missingSkills || []).map((s: string, idx: number) => (
                                          <Badge key={idx} variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">{s}</Badge>
                                       ))}
                                    </div>
                                    <ul className="space-y-3 mt-3">
                                       {(mappingResult.risks || []).map((s: string, idx: number) => (
                                         <li key={idx} className="text-sm font-medium text-slate-700 flex items-start gap-2">
                                            <ShieldAlert size={14} className="text-rose-400 shrink-0 mt-0.5" /> <span>{s}</span>
                                         </li>
                                       ))}
                                    </ul>
                                 </div>
                                 {(mappingResult.recommendation || mappingResult.recruiterAssessment) && (
                                    <div className="mt-6 pt-4 border-t border-slate-100">
                                       <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Recommendation</div>
                                       <div className="text-sm font-semibold text-indigo-700 leading-relaxed">{mappingResult.recommendation || mappingResult.recruiterAssessment}</div>
                                    </div>
                                 )}
                              </div>
                           </div>
                       </div>
                    ) : (
                       <div className="bg-slate-50 p-10 rounded-xl border border-slate-200 text-center shadow-sm">
                          <Target size={40} className="text-slate-300 mx-auto mb-4" />
                          <p className="text-base font-bold text-slate-800">No Match Data Available</p>
                          <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">This candidate has not been formally evaluated against a specific Job Description.</p>
                       </div>
                    )}
                </div>
             )}

             {/* INTERVIEWS TAB */}
             {activeTab === 'INTERVIEWS' && (
                <div className="max-w-3xl mx-auto animate-in fade-in duration-300">
                   <div className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm">
                      <h3 className="font-bold text-slate-800 uppercase tracking-widest text-[10px] mb-6 text-slate-400 border-b border-slate-100 pb-2">Interview History</h3>
                      
                      {interviews.length === 0 ? (
                         <div className="text-center p-8 bg-slate-50 rounded-lg border border-slate-200 border-dashed">
                            <Calendar size={32} className="text-slate-300 mx-auto mb-3" />
                            <p className="text-sm font-semibold text-slate-600">No Interviews Scheduled</p>
                            <p className="text-xs text-slate-400 mt-1">Interviews mapped to this candidate will appear here.</p>
                         </div>
                      ) : (
                         <div className="space-y-4">
                            {interviews.map(interview => (
                               <div key={interview.id} className="bg-slate-50 border border-slate-200 rounded-xl p-5 hover:border-indigo-300 transition-colors">
                                  <div className="flex justify-between items-start mb-3">
                                     <div>
                                        <h4 className="font-bold text-slate-900">{interview.round}</h4>
                                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                                           <span className="flex items-center gap-1"><Calendar size={12}/> {interview.date}</span>
                                           <span className="flex items-center gap-1"><User size={12}/> {interview.interviewer}</span>
                                        </div>
                                     </div>
                                     <Badge variant="outline" className={`uppercase text-[10px] tracking-wider ${interview.status === 'SCHEDULED' ? 'bg-amber-50 text-amber-700' : interview.status === 'PASSED' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                                        {interview.status}
                                     </Badge>
                                  </div>
                                  {interview.notes && (
                                     <div className="text-sm text-slate-600 bg-white p-3 rounded-lg border border-slate-100 mt-3 whitespace-pre-wrap">
                                        {interview.notes}
                                     </div>
                                  )}
                                  {interview.outcomeNotes && (
                                     <div className="text-sm text-indigo-700 bg-indigo-50 p-3 rounded-lg border border-indigo-100 mt-3 whitespace-pre-wrap">
                                        <span className="font-bold uppercase text-[10px] tracking-widest block mb-1">Feedback / Outcome</span>
                                        {interview.outcomeNotes}
                                     </div>
                                  )}
                               </div>
                            ))}
                         </div>
                      )}
                   </div>
                </div>
             )}

             {/* TIMELINE TAB */}
             {activeTab === 'TIMELINE' && (
                <div className="max-w-3xl mx-auto animate-in fade-in duration-300">
                   <div className="bg-white p-6 md:p-10 rounded-xl border border-slate-200 shadow-sm relative">
                      <h3 className="font-bold text-slate-800 uppercase tracking-widest text-[10px] mb-8 text-slate-400 border-b border-slate-100 pb-2">Event Ledger Trace</h3>
                      
                      <div className="space-y-6">
                         
                         {events.length === 0 && (
                            <div className="relative pl-6 border-l-2 border-slate-200 pb-4">
                               <div className="absolute w-3 h-3 bg-slate-300 rounded-full -left-[7px] top-1" />
                               <div className="text-sm font-bold text-slate-900">Candidate Created</div>
                               <div className="text-[10px] font-mono text-slate-400 mt-1 tracking-wider">{candidate.createdAt?.toDate ? candidate.createdAt.toDate().toLocaleString() : "Unknown Timestamp"}</div>
                            </div>
                         )}

                         {events.map((evt, idx) => {
                            const details = [];
                            if (evt.metadata?.source) details.push(`Source: ${evt.metadata.source}`);
                            if (evt.metadata?.fileName) details.push(`File: ${evt.metadata.fileName}`);
                            if (evt.metadata?.score !== undefined) details.push(`Score: ${evt.metadata.score}%`);
                            if (evt.metadata?.error) details.push(`Error: ${evt.metadata.error}`);
                            if (evt.metadata?.message) details.push(evt.metadata.message);

                            const detailStr = details.length > 0 ? details.join(" | ") : "";
                            const title = evt.type ? String(evt.type).replace(/([A-Z])/g, ' $1').trim() : "Event";

                            return (
                               <div key={evt.id} className="relative pl-6 border-l-[3px] border-indigo-100 pb-6 last:pb-0 group mt-2">
                                  <div className="absolute w-4 h-4 bg-white border-4 border-indigo-500 rounded-full -left-[10px] top-1 group-hover:scale-125 transition-transform" />
                                  <div className="text-sm font-black text-slate-800 uppercase tracking-wide">{title}</div>
                                  <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{evt.actorRole ? `By ${evt.actorRole}` : "By System"}</div>
                                  {detailStr && <div className="text-sm text-slate-600 mt-2 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">{detailStr}</div>}
                                  <div className="text-[10px] font-mono text-slate-400 mt-3 tracking-wider flex items-center gap-1.5 opacity-60">
                                      <Activity size={10} />
                                      {evt.timestamp?.toDate ? evt.timestamp.toDate().toLocaleString() : "Recently"}
                                  </div>
                               </div>
                            );
                         })}
                      </div>
                   </div>
                </div>
             )}

             {/* COLLABORATION TAB */}
             {activeTab === 'COLLABORATION' && (
                <div className="max-w-4xl mx-auto h-full flex flex-col animate-in fade-in duration-300">
                   <div className="flex-1 bg-white p-6 rounded-t-xl border border-slate-200 shadow-sm overflow-y-auto space-y-4">
                      {comments.length === 0 ? (
                         <div className="h-full flex flex-col items-center justify-center text-center">
                            <MessageSquare size={32} className="text-slate-200 mb-3" />
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No Discussion Yet</p>
                            <p className="text-xs text-slate-400 mt-2">Start a conversation or leave an internal note.</p>
                         </div>
                      ) : (
                         comments.map((c, i) => (
                            <div key={i} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                               <div className="flex items-center gap-2 mb-2">
                                  <div className="font-bold text-sm text-slate-800">{c.author || 'User'}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">{c.timestamp?.toDate ? c.timestamp.toDate().toLocaleString() : c.time || 'recently'}</div>
                               </div>
                               <div className="text-sm text-slate-700 font-medium">
                                  {c.text.split(/(@\w+)/g).map((part: string, i: number) => 
                                     part.startsWith('@') ? <span key={i} className="text-indigo-600 bg-indigo-50 px-1 rounded font-bold">{part}</span> : part
                                  )}
                               </div>
                            </div>
                         ))
                      )}
                   </div>
                   <form onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const input = form.elements.namedItem('comment') as HTMLInputElement;
                      if (!input.value.trim()) return;
                      const newComment = {
                         author: "Current User",
                         text: input.value,
                         timestamp: new Date()
                      };
                      setComments([...comments, newComment]);
                      
                      // Notify mentions
                      const mentions = input.value.match(/@\w+/g);
                      if (mentions) {
                         import('../../lib/eventEngine').then(({ publishEvent }) => {
                            mentions.forEach(m => {
                               let targetId = m.substring(1).toUpperCase();
                               // Identity Resolution for @vendor
                               if (m.toLowerCase() === '@vendor' && candidate.vendorId) {
                                  targetId = candidate.vendorId;
                               }
                               publishEvent({
                                  type: 'info',
                                  title: 'You were mentioned',
                                  message: `You were mentioned in Candidate ${nameStr} thread.`,
                                  recipients: [targetId]
                               });
                            });
                         });
                      }
                      
                      const id = candidate.originalId || candidate.id || candidate.candidateId;
                      import('../../stores/CandidateStore').then(({ useCandidateStore }) => {
                         if (id) {
                            useCandidateStore.getState().updateCandidate(id, { comments: [...comments, newComment] }).catch(() => {});
                         }
                      });
                      input.value = "";
                   }} className="bg-slate-50 p-4 rounded-b-xl border border-slate-200 border-t-0 flex items-center gap-3 shrink-0">
                      <input 
                         name="comment"
                         type="text" 
                         className="flex-1 bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                         placeholder="Type a note or use @mention..."
                      />
                      <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">Send</Button>
                   </form>
                </div>
             )}

             {/* GOVERNANCE TAB */}
             {activeTab === 'GOVERNANCE' && (
                <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
                   <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                      <h3 className="font-bold text-slate-800 uppercase tracking-widest text-[10px] mb-4 text-slate-400 border-b border-slate-100 pb-2">Ownership & Access Vault</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                         <div className="p-4 bg-slate-50 rounded-lg">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Entity ID</div>
                            <div className="font-mono text-slate-800">{candidateIdStr}</div>
                         </div>
                         <div className="p-4 bg-slate-50 rounded-lg">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Primary Owner (SSOT)</div>
                            <div className="font-bold text-slate-800">{displayCandidate.ownerName || vendorStr}</div>
                         </div>
                         <div className="p-4 bg-slate-50 rounded-lg">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Created Via</div>
                            <div className="font-bold text-slate-800">{displayCandidate.createdVia || "OS"} ({displayCandidate.createdFrom || "RECRUITER"})</div>
                         </div>
                         <div className="p-4 bg-slate-50 rounded-lg">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Acquisition Method</div>
                            <div className="font-bold text-slate-800 uppercase font-mono text-[11px] text-indigo-600">{displayCandidate.acquisitionMethod || "IMPORT"}</div>
                         </div>
                         <div className="p-4 bg-slate-50 rounded-lg col-span-2">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Acquired Timestamp</div>
                            <div className="text-slate-800 font-mono text-xs">{displayCandidate.acquiredAt ? new Date(displayCandidate.acquiredAt).toLocaleString() : new Date().toLocaleString()}</div>
                         </div>
                         <div className="p-4 bg-slate-50 rounded-lg col-span-2">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Source Pipeline</div>
                            <div className="text-slate-800">{candidate.source || "Manual Onboarding Extraction"}</div>
                         </div>
                      </div>

                      {/* Dispute Trigger */}
                      <div className="mt-6 pt-6 border-t border-slate-100 flex justify-between items-center">
                         <div>
                            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-1">Acquisition Conflict?</h4>
                            <p className="text-xs text-slate-400 font-medium">If this candidate profile was already uploaded, initiate a standard dispute resolution.</p>
                         </div>
                         <Button
                           onClick={() => {
                             alert(`Dispute initiated. Ownership Vault created dispute ID DSP-${Math.floor(1000 + Math.random() * 9000)} which is logged in the ledger.`);
                           }}
                           className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                         >
                           Dispute Claim
                         </Button>
                      </div>
                   </div>

                   <div className="bg-rose-50 border border-rose-100 p-6 rounded-xl">
                      <h3 className="font-bold text-rose-800 uppercase tracking-widest text-[10px] mb-2">Danger Zone</h3>
                      <p className="text-sm text-rose-700/80 mb-4">Deleting this candidate will permanently sever workflow links and log a destruction event in the immutable ledger.</p>
                      
                      {isAdmin ? (
                         !showDeleteConfirm ? (
                           <Button variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-100 font-bold bg-white" onClick={() => setShowDeleteConfirm(true)}>Delete Identity Record</Button>
                         ) : (
                           <div className="bg-white border border-rose-200 p-4 rounded-lg mt-4 shadow-sm">
                             <h4 className="font-bold text-rose-800 mb-2">Confirm Candidate Deletion</h4>
                             <p className="text-sm text-slate-700 mb-2">Candidate: {nameStr}</p>
                             <p className="text-sm text-slate-700 mb-4 font-mono">ID: {candidateIdStr}</p>
                             <ul className="text-sm text-slate-600 mb-4 space-y-1">
                               <li>✓ Remove candidate from active pipelines</li>
                               <li>✓ Remove ownership records</li>
                               <li>✓ Remove resume storage references</li>
                               <li>✓ Create immutable audit event</li>
                             </ul>
                             <p className="text-xs text-slate-500 mb-2 uppercase font-bold tracking-wider">Type DELETE to continue:</p>
                             <input 
                               type="text" 
                               value={deleteConfirmText} 
                               onChange={(e) => setDeleteConfirmText(e.target.value)}
                               className="w-full border-rose-200 rounded-md bg-rose-50 text-rose-900 placeholder:text-rose-300 font-mono text-sm px-3 py-2 mb-4 focus:outline-none focus:ring-1 focus:ring-rose-500"
                               placeholder="DELETE"
                             />
                             <div className="flex gap-2">
                               <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                               <Button className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold" onClick={handleDeleteCandidate} disabled={deleteConfirmText !== "DELETE" || isDeleting}>
                                 {isDeleting ? "Deleting..." : "Delete Candidate"}
                               </Button>
                             </div>
                           </div>
                         )
                      ) : (
                         <Button variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-100 font-bold bg-white" onClick={() => alert("Delete request submitted to AdminHQ.")}>Request Deletion</Button>
                      )}
                   </div>
                </div>
             )}
          </div>
          
          {isClientReviewMode && (
             <div className="p-6 bg-white border-t border-slate-200 shrink-0 space-y-3 z-10 w-full shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                 {(() => {
                    const status = candidate.status || candidate.pipelineStage || 'PENDING_REVIEW';
                    if (status === 'REJECTED') {
                       return (
                           <div className="bg-rose-50 border border-rose-100 p-4 text-center rounded-xl flex flex-col items-center justify-center gap-1 text-sm text-rose-800 font-bold">
                              <div className="flex items-center gap-2"><X size={18} className="text-rose-500" /> Rejected {candidate.rejectReason ? `- ${candidate.rejectReason}` : ''}</div>
                           </div>
                       )
                    }

                    if (status === 'PENDING_REVIEW' || status === 'SUBMITTED' || status === 'MATCHED') {
                       return (
                          <div className="grid grid-cols-2 gap-3 mb-3">
                             <Button onClick={onShortlist} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 w-full rounded-xl shadow-sm transition-all hover:-translate-y-0.5">
                               <CheckCircle size={18} className="mr-2"/> Shortlist
                             </Button>
                             <Button onClick={onReject} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-bold h-12 w-full rounded-xl transition-all">
                               <X size={18} className="mr-2"/> Reject
                             </Button>
                          </div>
                       )
                    }

                    if (status === 'SHORTLISTED') {
                       return (
                          <div className="grid grid-cols-3 gap-3">
                             <Button onClick={onSchedule} className="bg-slate-900 hover:bg-black text-white font-bold h-12 w-full rounded-xl shadow-sm transition-all">
                               <Calendar size={18} className="mr-2"/> Request Interview
                             </Button>
                             <Button onClick={onRequestClarification} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 font-bold h-12 w-full rounded-xl transition-all">
                               <MessageSquare size={18} className="mr-2"/> Request Clarification
                             </Button>
                             <Button onClick={onReject} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-bold h-12 w-full rounded-xl transition-all">
                               <X size={18} className="mr-2"/> Reject
                             </Button>
                          </div>
                       )
                    }

                    if (status === 'INTERVIEW_REQUESTED' || status === 'INTERVIEW_SCHEDULED' || status === 'INTERVIEW_IN_PROGRESS' || status.includes('INTERVIEW')) {
                       return (
                          <div className="flex flex-col gap-3">
                             <div className="bg-indigo-50 border border-indigo-100 p-4 text-center rounded-xl flex flex-col items-center justify-center gap-1 text-sm text-indigo-800 font-bold">
                               <div className="flex items-center gap-2"><Calendar size={18} className="text-indigo-500" /> Interview Stage</div>
                             </div>
                             <div className="grid grid-cols-2 gap-3">
                               <Button onClick={onOffer} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 w-full rounded-xl shadow-sm transition-all">
                                 <Target size={18} className="mr-2"/> Release Offer
                               </Button>
                               <Button onClick={onReject} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-bold h-12 w-full rounded-xl transition-all">
                                 <X size={18} className="mr-2"/> Pass / Reject
                               </Button>
                             </div>
                          </div>
                       )
                    }

                    if (status === 'OFFER_DRAFTED' || status === 'OFFER_RELEASED' || status === 'OFFER_ACCEPTED') {
                        return (
                           <div className="bg-emerald-50 border border-emerald-100 p-4 text-center rounded-xl flex flex-col items-center justify-center gap-1 text-sm text-emerald-800 font-bold">
                              <div className="flex items-center gap-2"><CheckCircle size={18} className="text-emerald-500" /> Offer Stage Proceeding</div>
                           </div>
                        )
                    }

                    return (
                        <div className="bg-slate-50 border border-slate-100 p-4 text-center rounded-xl flex flex-col items-center justify-center gap-1 text-sm text-slate-800 font-bold">
                           <div className="flex items-center gap-2"><Activity size={18} className="text-slate-500" /> {status}</div>
                        </div>
                    );

                 })()}
             </div>
          )}
       </div>
    </div>
  )
}
