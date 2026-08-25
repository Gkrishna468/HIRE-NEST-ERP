import { useState, useEffect, useRef } from "react";
import {
  Briefcase,
  User,
  FileText,
  CheckCircle2,
  AlertCircle,
  Bot,
  Send,
  UploadCloud,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  Star,
  Zap,
  Trash2,
  CheckCircle,
  Clock,
  Calendar,
  Sparkles,
  Plus,
  RefreshCw,
  X,
  Search,
  MapPin,
  Building2,
  Filter,
  DollarSign,
  ChevronRight,
  ShieldCheck,
  Award,
  Eye,
  FileCheck,
  CheckSquare,
  AlertTriangle,
  ArrowRight,
  Layers,
  Flame,
  Check,
  Crosshair,
  Bell
} from "lucide-react";
import { Badge } from "../../lib/Badge";
import { Button } from "../../lib/Button";
import { auth, db } from "../../lib/firebase";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  serverTimestamp,
  orderBy,
  limit
} from "firebase/firestore";
import { CandidateMatchingService, CandidateMatchResult } from "../../services/CandidateMatchingService";

interface CandidatePortalProps {
  userName: string;
  orgId?: string;
  metrics?: any;
}

export default function CandidatePortalWorkspace({
  userName,
  orgId,
  metrics
}: CandidatePortalProps) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"MATCHES" | "JOBS" | "APPLICATIONS" | "PROFILE" | "SCREENING" | "COACH">("MATCHES");

  // AI Matching Engine State
  const [matchResults, setMatchResults] = useState<{
    strongMatches: CandidateMatchResult[];
    validatableMatches: CandidateMatchResult[];
    allMatches: CandidateMatchResult[];
  }>({ strongMatches: [], validatableMatches: [], allMatches: [] });
  const [isMatching, setIsMatching] = useState<boolean>(false);
  const [matchTypeFilter, setMatchTypeFilter] = useState<"ALL" | "FULL_TIME" | "C2H" | "STRONG">("ALL");
  const [candidateNotifications, setCandidateNotifications] = useState<any[]>([]);

  // Public Direct-Apply Jobs
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedWorkMode, setSelectedWorkMode] = useState<string>("ALL");
  const [selectedExpFilter, setSelectedExpFilter] = useState<string>("ALL");
  const [locationFilter, setLocationFilter] = useState<string>("");
  const [selectedJobForDetail, setSelectedJobForDetail] = useState<any | null>(null);

  // Application Modal Flow
  const [applyingJob, setApplyingJob] = useState<any | null>(null);
  const [applyStep, setApplyStep] = useState<number>(1); // 1: Resume, 2: Info & Screening, 3: Success
  const [applyResumeFile, setApplyResumeFile] = useState<File | null>(null);
  const [isExtractingResume, setIsExtractingResume] = useState<boolean>(false);
  const [extractedResumeData, setExtractedResumeData] = useState<any | null>(null);
  const [isSubmittingApplication, setIsSubmittingApplication] = useState<boolean>(false);
  const [applicationSuccessData, setApplicationSuccessData] = useState<any | null>(null);

  // Candidate Screening Answers during Application
  const [screenAvailability, setScreenAvailability] = useState<string>("Immediate (within 15 days)");
  const [screenOnsiteReady, setScreenOnsiteReady] = useState<string>("Yes, fully available for Onsite/Hybrid as required");
  const [screenCurrentCTC, setScreenCurrentCTC] = useState<string>("");
  const [screenExpectedCTC, setScreenExpectedCTC] = useState<string>("");
  const [screenExperienceYears, setScreenExperienceYears] = useState<number>(4);
  const [screenNotes, setScreenNotes] = useState<string>("");

  // Candidate DB Applications & Progress
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedApplicationDetail, setSelectedApplicationDetail] = useState<any | null>(null);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [activationScore, setActivationScore] = useState<number>(45);

  // Profile State
  const [profile, setProfile] = useState({
    name: userName,
    email: "",
    phone: "",
    location: "Bengaluru, India",
    headline: "Full Stack Developer",
    skills: ["React", "TypeScript", "Node.js", "Java", "SQL"],
    targetRoles: ["Full Stack Engineer", "Frontend Specialist"],
    experienceYears: 4,
    preferredWorkMode: "Hybrid",
    noticePeriodDays: 15,
    resumeText: "",
    resumeFileName: ""
  });
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [newSkill, setNewSkill] = useState<string>("");
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

  // AI Coach Chat State
  const [chatMessages, setChatMessages] = useState<any[]>([
    {
      id: "welcome",
      sender: "coach",
      text: `Hello ${userName}! I'm your HireNest AI Career Coach. I can help optimize your resume for Onsite & C2H roles, prepare for technical screenings, or answer questions about open positions. How can I help you today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isCoachTyping, setIsCoachTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 1. Trigger AI Matching for Candidate
  const runCandidateMatching = async (candProfile: any = profile, userId = currentUser?.uid) => {
    if (!userId) return;
    setIsMatching(true);
    try {
      const res = await CandidateMatchingService.executeAutomaticMatching({
        id: userId,
        name: candProfile.name || userName,
        email: candProfile.email || currentUser?.email || "",
        phone: candProfile.phone,
        skills: candProfile.skills || [],
        experienceYears: candProfile.experienceYears || 4,
        location: candProfile.location,
        preferredWorkMode: candProfile.preferredWorkMode
      });
      setMatchResults(res);
    } catch (err) {
      console.error("Match calculation error:", err);
    } finally {
      setIsMatching(false);
    }
  };

  // 1. Initialize Auth & Sync DB Profile
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setCurrentUser(user);
      setProfile(prev => ({
        ...prev,
        name: user.displayName || userName,
        email: user.email || ""
      }));

      // Fetch or initialize Candidate Profile
      const profileRef = doc(db, "candidate_profiles", user.uid);
      getDoc(profileRef).then(snap => {
        if (snap.exists()) {
          const profileData = snap.data() as any;
          setProfile(profileData);
          runCandidateMatching(profileData, user.uid);
        } else {
          const initData = {
            id: user.uid,
            userId: user.uid,
            name: user.displayName || userName,
            email: user.email || "",
            location: "Bengaluru, India",
            headline: "Software Engineer",
            skills: ["React", "TypeScript", "Node.js", "Java", "SQL"],
            targetRoles: ["Full Stack Engineer", "Software Developer"],
            experienceYears: 4,
            preferredWorkMode: "Hybrid",
            noticePeriodDays: 15,
            sourceType: "DIRECT_CANDIDATE", ownershipType: "DIRECT", vendorId: null,
            ownerType: "HIRENEST",
            ownerId: "GLOBAL_HQ",
            createdVia: "CANDIDATE_PORTAL",
            createdAt: new Date().toISOString()
          };
          setDoc(profileRef, initData, { merge: true });
          runCandidateMatching(initData, user.uid);
        }
      });

      // Listen to In-App Candidate Notifications
      const qNotif = query(
        collection(db, "candidate_notifications"),
        where("candidateId", "==", user.uid)
      );
      const unsubNotif = onSnapshot(qNotif, snap => {
        const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setCandidateNotifications(notifs);
      }, err => {
        console.warn("Candidate notifications listener note:", err);
      });

      // Listen to Applications for this candidate (Listening directly to `applications` & `submissions`)
      const qApps = query(
        collection(db, "applications"),
        where("candidateUid", "==", user.uid)
      );
      const unsubApps = onSnapshot(qApps, snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (list.length > 0) {
          setApplications(list);
        } else {
          // Fallback check in submissions collection if applications collection was empty
          const qSubFallback = query(
            collection(db, "submissions"),
            where("candidateUid", "==", user.uid)
          );
          getDocs(qSubFallback).then(subSnap => {
            const subList = subSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            if (subList.length > 0) setApplications(subList);
          });
        }
      }, err => {
        console.warn("Application query restricted or offline:", err);
      });

      // Listen to Interviews
      const qInt = query(
        collection(db, "interviews"),
        where("candidateId", "==", user.uid)
      );
      const unsubInt = onSnapshot(qInt, snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setInterviews(list);
      }, err => {
        console.warn("Interviews query restricted or offline:", err);
      });

      return () => {
        unsubApps();
        unsubInt();
        unsubNotif();
      };
    }
  }, [userName]);

  // 2. Fetch Open Requirements for Direct Apply
  useEffect(() => {
    setIsLoadingJobs(true);
    const qReqs = collection(db, "requirements_public");
    const unsubReqs = onSnapshot(qReqs, snap => {
      const allJobs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Filter only open jobs where directApplyEnabled is not explicitly false
      const openJobs = allJobs.filter((job: any) => {
        const isStatusOpen = !job.status || job.status === "OPEN" || job.status === "ACTIVE";
        const isDirectEnabled = job.directApplyEnabled !== false;
        return isStatusOpen && isDirectEnabled;
      });
      setJobs(openJobs);
      setIsLoadingJobs(false);
    }, err => {
      console.warn("Error loading direct apply jobs:", err);
      setIsLoadingJobs(false);
    });

    return () => unsubReqs();
  }, []);

  // Filter Jobs
  const filteredJobs = jobs.filter(job => {
    const titleMatch = (job.title || job.role || "").toLowerCase().includes(searchQuery.toLowerCase());
    const skillsMatch = (job.skills || []).some((s: string) => s.toLowerCase().includes(searchQuery.toLowerCase()));
    const textMatch = (job.description || "").toLowerCase().includes(searchQuery.toLowerCase());
    const searchPass = !searchQuery.trim() || titleMatch || skillsMatch || textMatch;

    const workMode = (job.workMode || "").toUpperCase();
    const modePass = selectedWorkMode === "ALL" || 
      (selectedWorkMode === "ONSITE" && workMode.includes("ONSITE")) ||
      (selectedWorkMode === "C2H" && (workMode.includes("C2H") || (job.jobType || "").toUpperCase().includes("C2H"))) ||
      (selectedWorkMode === "HYBRID" && workMode.includes("HYBRID")) ||
      (selectedWorkMode === "REMOTE" && workMode.includes("REMOTE"));

    const locPass = !locationFilter.trim() || 
      (job.location || "").toLowerCase().includes(locationFilter.toLowerCase());

    const exp = parseInt(job.experience || job.minExperience || "0", 10);
    const expPass = selectedExpFilter === "ALL" ||
      (selectedExpFilter === "0-3" && exp <= 3) ||
      (selectedExpFilter === "3-6" && exp >= 3 && exp <= 6) ||
      (selectedExpFilter === "6-9" && exp >= 6 && exp <= 9) ||
      (selectedExpFilter === "9+" && exp >= 9);

    return searchPass && modePass && locPass && expPass;
  });

  // Handle Resume File Extraction during Application
  const handleProcessResume = async (file: File) => {
    setApplyResumeFile(file);
    setIsExtractingResume(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Extract text via API
      const res = await fetch("/api/extract-text", {
        method: "POST",
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        const extractedText = data.text || "";

        // Parse extracted skills & attributes
        const skillsFound: string[] = [];
        const commonTech = ["React", "TypeScript", "Node.js", "Java", "Python", "C++", "AWS", "SQL", "Docker", "Kubernetes", "Angular", "Go", "Embedded", "Linux", "REST", "Microservices"];
        commonTech.forEach(tech => {
          if (new RegExp(`\\b${tech}\\b`, "i").test(extractedText)) {
            skillsFound.push(tech);
          }
        });

        setExtractedResumeData({
          fileName: file.name,
          rawText: extractedText,
          detectedSkills: skillsFound.length > 0 ? skillsFound : profile.skills,
          extractedSummary: extractedText.slice(0, 300) + "..."
        });
      } else {
        // Fallback simulated parsing
        setExtractedResumeData({
          fileName: file.name,
          rawText: `Resume of ${profile.name}. Skills: ${profile.skills.join(", ")}`,
          detectedSkills: profile.skills,
          extractedSummary: `Resume successfully loaded for ${profile.name}.`
        });
      }
    } catch (err) {
      console.warn("Resume extraction fallback:", err);
      setExtractedResumeData({
        fileName: file.name,
        rawText: `Resume of ${profile.name}`,
        detectedSkills: profile.skills,
        extractedSummary: `Resume loaded.`
      });
    } finally {
      setIsExtractingResume(false);
    }
  };

  // Submit Direct Application & Invoke Fitment Engine
  const handleSubmitDirectApplication = async () => {
    if (!applyingJob || !currentUser) return;
    setIsSubmittingApplication(true);

    try {
      const candEmail = currentUser.email || profile.email;
      const candPhone = profile.phone || "Not provided";
      const candName = currentUser.displayName || profile.name || "Candidate";
      const appId = `HN-APP-${Date.now().toString(36).toUpperCase()}`;

      // 1. DUPLICATE & VENDOR OWNERSHIP PROTECTION
      // Check if this candidate already exists under a vendor
      let ownershipConflictDetected = false;
      let existingVendorOwnerId = "";
      let realCandidateId = currentUser.uid;

      try {
        const poolCheckQ = query(
          collection(db, "candidatePool"),
          where("email", "==", candEmail),
          limit(5)
        );
        const poolSnap = await getDocs(poolCheckQ);
        if (!poolSnap.empty) {
          const existingCand = poolSnap.docs[0].data();
          if (existingCand.ownerType === "VENDOR" || existingCand.vendorId) {
            ownershipConflictDetected = true;
            existingVendorOwnerId = existingCand.vendorId || existingCand.ownerId || "VENDOR_NETWORK";
          }
        }
      } catch (checkErr) {
        console.warn("Ownership check query note:", checkErr);
      }

      // 2. COMPUTE FITMENT SCORE VIA UNIFIED FITMENT ENGINE
      const candSkills = extractedResumeData?.detectedSkills || profile.skills || [];
      const evaluated = CandidateMatchingService.evaluateFitment(
        {
          skills: candSkills,
          experienceYears: screenExperienceYears,
          location: profile.location,
          preferredWorkMode: screenOnsiteReady.includes("Yes") ? "ONSITE" : profile.preferredWorkMode
        },
        applyingJob
      );

      const calculatedFitment = evaluated.score;
      const fitmentEvaluationSnapshot = {
        score: evaluated.score,
        tier: evaluated.tier,
        evaluatedAt: new Date().toISOString(),
        skillsOverlap: evaluated.skillsOverlap,
        missingSkills: evaluated.missingSkills,
        requiredSkills: applyingJob.skills || [],
        onsiteFitment: screenOnsiteReady.includes("Yes") ? "PASS" : "REQUIRES_REVIEW",
        experienceFitment: evaluated.hardGateVerdict === "PASS" ? "PASS" : "MARGINAL",
        recommendation: evaluated.tier === "STRONG" ? "STRONG_CANDIDATE" : "POTENTIAL_MATCH"
      };

      // 3. CREATE / UPDATE IMMUTABLE CANDIDATE MASTER RECORD
      const candidateMasterDocRef = doc(db, "candidatePool", realCandidateId);
      await setDoc(candidateMasterDocRef, {
        id: realCandidateId,
        uid: currentUser.uid,
        name: candName,
        email: candEmail,
        phone: candPhone,
        skills: extractedResumeData?.detectedSkills || profile.skills,
        experience: `${screenExperienceYears} Years`,
        location: profile.location,
        headline: profile.headline,
        sourceType: "DIRECT_CANDIDATE", ownershipType: "DIRECT", vendorId: null,
        ownerType: "HIRENEST",
        ownerId: "GLOBAL_HQ",
        createdVia: "CANDIDATE_PORTAL",
        isDirectCandidate: true,
        ownershipConflict: ownershipConflictDetected,
        conflictingVendorId: existingVendorOwnerId || null,
        conflictEscalationStatus: ownershipConflictDetected ? "PENDING_ADMIN_RESOLUTION" : "CLEAN",
        status: "ACTIVE",
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // 4. CREATE SEPARATE DIRECT APPLICATION ENTITY (HN-APP-...)
      const applicationDoc = {
        id: appId,
        applicationId: appId,
        candidateId: realCandidateId,
        candidateUid: currentUser.uid,
        candidateName: candName,
        candidateEmail: candEmail,
        candidatePhone: candPhone,
        requirementId: applyingJob.id,
        jobTitle: applyingJob.title || applyingJob.role || "Software Role",
        jobLocation: applyingJob.location || applyingJob.workMode || "Onsite",
        workMode: applyingJob.workMode || "Onsite",
        
        // Consumer-facing status
        status: "UNDER_REVIEW",
        applicationStatus: "UNDER_REVIEW", // Pipeline stage for Candidate UI
        
        // Ownership & Governance
        sourceType: "DIRECT_CANDIDATE", ownershipType: "DIRECT", vendorId: null,
        ownerType: "HIRENEST",
        ownerId: "GLOBAL_HQ",
        createdVia: "CANDIDATE_PORTAL",
        ownershipConflict: ownershipConflictDetected,
        conflictingVendorId: existingVendorOwnerId || null,

        // Immutable Snapshots
        requirementSnapshot: {
          id: applyingJob.id,
          title: applyingJob.title || applyingJob.role,
          workMode: applyingJob.workMode,
          location: applyingJob.location,
          skills: applyingJob.skills || [],
          experience: applyingJob.experience || "3-6 Years",
          budget: applyingJob.budget || applyingJob.rate || "Industry Standard",
          description: (applyingJob.description || "").slice(0, 500)
        },
        candidateSnapshot: {
          name: candName,
          email: candEmail,
          phone: candPhone,
          location: profile.location,
          experienceYears: screenExperienceYears,
          skills: extractedResumeData?.detectedSkills || profile.skills,
          headline: profile.headline
        },
        fitmentScore: calculatedFitment,
        fitmentEvaluation: fitmentEvaluationSnapshot,
        screeningAnswers: {
          availability: screenAvailability,
          onsiteReadiness: screenOnsiteReady,
          currentCTC: screenCurrentCTC || "Disclosed in discussion",
          expectedCTC: screenExpectedCTC || "Competitive",
          experienceYears: screenExperienceYears,
          notes: screenNotes || "Direct Portal Submission"
        },
        resumeVersion: {
          fileName: extractedResumeData?.fileName || profile.resumeFileName || "Direct_Resume.pdf",
          submittedAt: new Date().toISOString()
        },
        submittedAt: new Date().toISOString(),
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, "applications", appId), applicationDoc);

      // 5. MIRROR RECORD IN SUBMISSIONS FOR GLOBAL HQ RECRUITER & MATCH QUEUES
      const submissionDoc = {
        id: appId,
        submissionId: appId,
        candidateId: realCandidateId,
        candidateUid: currentUser.uid,
        candidateName: candName,
        candidateEmail: candEmail,
        candidateSkills: extractedResumeData?.detectedSkills || profile.skills,
        requirementId: applyingJob.id,
        requirementTitle: applyingJob.title || applyingJob.role,
        status: "UNDER_REVIEW",
        pipelineStage: "Application Received",
        sourceType: "DIRECT_CANDIDATE", ownershipType: "DIRECT", vendorId: null,
        ownerType: "HIRENEST",
        ownerId: "GLOBAL_HQ",
        createdVia: "CANDIDATE_PORTAL",
        fitmentScore: calculatedFitment,
        matchScore: calculatedFitment,
        aiMatchScore: calculatedFitment,
        ownershipConflict: ownershipConflictDetected,
        conflictingVendorId: existingVendorOwnerId || null,
        submittedAt: new Date().toISOString()
      };
      await setDoc(doc(db, "submissions", appId), submissionDoc);

      // Log notification for Global HQ Ops
      try {
        await addDoc(collection(db, "notifications"), {
          type: "DIRECT_CANDIDATE_APPLICATION",
          title: `New Direct Application: ${candName}`,
          message: `${candName} applied directly for ${applyingJob.title || applyingJob.role} (${applyingJob.workMode}) with ${calculatedFitment}% fitment.`,
          applicationId: appId,
          candidateId: realCandidateId,
          requirementId: applyingJob.id,
          sourceType: "DIRECT_CANDIDATE", ownershipType: "DIRECT", vendorId: null,
          ownershipConflict: ownershipConflictDetected,
          createdAt: serverTimestamp()
        });
      } catch (notifErr) {
        console.warn("Notification logging non-blocking error:", notifErr);
      }

      setApplicationSuccessData({
        appId,
        jobTitle: applyingJob.title || applyingJob.role,
        fitmentScore: calculatedFitment,
        conflict: ownershipConflictDetected
      });
      setApplyStep(3);

    } catch (err: any) {
      console.error("Direct application submission failed:", err);
      alert("Application could not be saved. Please try again.");
    } finally {
      setIsSubmittingApplication(false);
    }
  };

  // Helper to map status to 6-Step Visual Pipeline
  const getStageIndex = (statusStr?: string) => {
    const s = (statusStr || "").toUpperCase();
    if (s.includes("SELECT") || s.includes("HIRED") || s.includes("OFFER")) return 5;
    if (s.includes("INTERVIEW")) return 4;
    if (s.includes("SHORTLIST")) return 3;
    if (s.includes("SCREEN") || s.includes("ASSESS")) return 2;
    if (s.includes("REVIEW") || s.includes("EVAL")) return 1;
    return 0; // Application Received
  };

  const STAGES = [
    { title: "Application received", desc: "Submitted to HireNest Global HQ" },
    { title: "Profile under review", desc: "Recruiter screening & skill alignment" },
    { title: "Screening required", desc: "Technical & availability verification" },
    { title: "Shortlisted", desc: "Selected for client presentation" },
    { title: "Interview", desc: "Client interview rounds in progress" },
    { title: "Selected", desc: "Offer & onboarding finalization" }
  ];

  // AI Career Coach Message Sender
  const handleSendCoachMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg = {
      id: Date.now().toString(),
      sender: "user",
      text: chatInput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsCoachTyping(true);

    setTimeout(() => {
      let replyText = `That's a great question regarding your career profile. For Onsite & C2H roles in your domain, highlighting hands-on architecture experience and verifying your notice period (currently ${profile.noticePeriodDays} days) helps expedite recruiter review. Make sure your resume explicitly lists ${profile.skills.slice(0, 3).join(", ")}.`;
      if (chatInput.toLowerCase().includes("interview")) {
        replyText = `For technical interviews in ${profile.targetRoles[0] || "Engineering"}, practice articulating how you design modular components, optimize state, and handle production edge cases. Would you like me to generate 3 mock screening questions?`;
      } else if (chatInput.toLowerCase().includes("resume") || chatInput.toLowerCase().includes("fitment")) {
        replyText = `Your current profile has strong alignment in ${profile.skills.join(", ")}. To score 90%+ on Onsite positions, ensure you highlight location flexibility and key production deliverables.`;
      }

      setChatMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "coach",
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setIsCoachTyping(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* 1. TOP CANDIDATE NAVIGATION BAR ("HireNest Workforce") */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md font-bold tracking-wider">
              HW
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-slate-900">HireNest</span>
                <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full border border-indigo-200">Workforce</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Direct Opportunity & Career Portal</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveTab("MATCHES")}
              className={`px-3 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 relative whitespace-nowrap ${
                activeTab === "MATCHES"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>My Job Matches</span>
              {(matchResults.strongMatches.length + matchResults.validatableMatches.length) > 0 && (
                <span className="ml-1 bg-emerald-400 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                  {matchResults.strongMatches.length + matchResults.validatableMatches.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("JOBS")}
              className={`px-3 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === "JOBS"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Find Jobs</span>
            </button>

            <button
              onClick={() => setActiveTab("APPLICATIONS")}
              className={`px-3 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 relative whitespace-nowrap ${
                activeTab === "APPLICATIONS"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <FileCheck className="w-4 h-4" />
              <span>My Applications</span>
              {applications.length > 0 && (
                <span className="ml-1 bg-amber-400 text-slate-900 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                  {applications.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("PROFILE")}
              className={`px-3 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === "PROFILE"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <User className="w-4 h-4" />
              <span>My Profile & Resume</span>
            </button>

            <button
              onClick={() => setActiveTab("SCREENING")}
              className={`px-3 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === "SCREENING"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              <span>Screening</span>
            </button>

            <button
              onClick={() => setActiveTab("COACH")}
              className={`px-3 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === "COACH"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>AI Coach</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* ========================================================================= */}
        {/* TAB 0: MY JOB MATCHES (AI FITMENT ENGINE RESULTS)                         */}
        {/* ========================================================================= */}
        {activeTab === "MATCHES" && (
          <div className="space-y-6">
            {/* AI Match Intelligence Hero Banner */}
            <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-indigo-900/40">
              <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 blur-3xl rounded-full" />
              
              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="space-y-3 max-w-2xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-black uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>AI Fitment Intelligence Engine</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    Recommended Opportunities For You
                  </h1>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    Matched automatically against active Full-Time & C2H requirements using skills, experience, and location fitment.
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs font-black text-emerald-400 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-emerald-400" />
                      {matchResults.strongMatches.length} Strong Matches (80%+)
                    </span>
                    <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs font-black text-indigo-300 flex items-center gap-1.5">
                      <Crosshair className="w-3.5 h-3.5 text-indigo-400" />
                      {matchResults.validatableMatches.length} Potential Matches
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    onClick={() => runCandidateMatching()}
                    disabled={isMatching}
                    className="px-4 py-3 bg-white/10 hover:bg-white/15 active:bg-white/20 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 border border-white/10 transition-all shadow-sm"
                  >
                    <RefreshCw className={`w-4 h-4 ${isMatching ? "animate-spin text-indigo-400" : "text-white"}`} />
                    {isMatching ? "Scanning Requirements..." : "Rescan Profile with AI"}
                  </button>

                  <button
                    onClick={() => setActiveTab("PROFILE")}
                    className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30"
                  >
                    <User className="w-4 h-4" />
                    Update Skills & Resume
                  </button>
                </div>
              </div>
            </div>

            {/* Notification Banner if new matches */}
            {candidateNotifications.length > 0 && (
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-indigo-950 uppercase tracking-tight">New Match Notifications</h4>
                    <p className="text-xs text-indigo-700 font-medium">{candidateNotifications[0]?.title || "New matching requirement active in your domain"}</p>
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 px-2.5 py-1 bg-white rounded-lg border border-indigo-100">
                  {candidateNotifications.length} Alert{candidateNotifications.length > 1 ? "s" : ""}
                </span>
              </div>
            )}

            {/* Filter Tabs for Matches */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {[
                  { id: "ALL", label: `All Recommendations (${matchResults.allMatches.length})` },
                  { id: "STRONG", label: `Strong Fit 80%+ (${matchResults.strongMatches.length})` },
                  { id: "FULL_TIME", label: "Full-Time Roles" },
                  { id: "C2H", label: "C2H / Contract Roles" }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setMatchTypeFilter(tab.id as any)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                      matchTypeFilter === tab.id
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="text-xs font-bold text-slate-500 flex items-center gap-2">
                <span>Direct Apply Gateway</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            </div>

            {/* Matches Content Grid */}
            {isMatching ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-black text-slate-900">Evaluating Profile Against Active Requirements...</h3>
                <p className="text-xs text-slate-500 font-medium mt-1 max-w-md mx-auto">
                  Running skill overlap matrix, hard-gate checks, and location calibration to deliver high-confidence matches.
                </p>
              </div>
            ) : matchResults.allMatches.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-black text-slate-900">No Direct Matches Found Yet</h3>
                <p className="text-xs text-slate-500 font-medium mt-2 max-w-md mx-auto">
                  Make sure your profile has your core skills, work location, and years of experience filled out so our AI Fitment Engine can find the best roles.
                </p>
                <div className="mt-6 flex justify-center gap-3">
                  <button
                    onClick={() => setActiveTab("PROFILE")}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider"
                  >
                    Complete Profile
                  </button>
                  <button
                    onClick={() => setActiveTab("JOBS")}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider"
                  >
                    Browse All Jobs
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matchResults.allMatches
                  .filter(m => {
                    if (matchTypeFilter === "STRONG") return m.matchTier === "STRONG";
                    if (matchTypeFilter === "FULL_TIME") {
                      const mode = (m.workMode || "").toUpperCase();
                      const type = (m.jobType || "").toUpperCase();
                      return !mode.includes("C2H") && !type.includes("C2H");
                    }
                    if (matchTypeFilter === "C2H") {
                      const mode = (m.workMode || "").toUpperCase();
                      const type = (m.jobType || "").toUpperCase();
                      return mode.includes("C2H") || type.includes("C2H") || mode.includes("CONTRACT");
                    }
                    return true;
                  })
                  .map(match => {
                    const isStrong = match.matchTier === "STRONG";
                    const isC2H = (match.workMode || "").toUpperCase().includes("C2H") || (match.jobType || "").toUpperCase().includes("C2H");
                    const foundJob = jobs.find(j => j.id === match.requirementId);
                    const targetJob = foundJob || {
                      id: match.requirementId,
                      title: match.jobTitle,
                      skills: match.skillsOverlap,
                      workMode: match.workMode,
                      location: match.location,
                      experience: match.experienceRequired,
                      budget: match.budget,
                      clientName: match.companyName,
                      description: "Direct verified opportunity matched to your verified profile."
                    };

                    return (
                      <div
                        key={match.requirementId}
                        className="bg-white rounded-2xl border border-slate-200 hover:border-indigo-400 transition-all p-5 shadow-xs flex flex-col justify-between group"
                      >
                        <div className="space-y-3">
                          {/* Top Tag & Score Badge */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                isC2H 
                                  ? "bg-purple-50 text-purple-700 border border-purple-200" 
                                  : "bg-blue-50 text-blue-700 border border-blue-200"
                              }`}>
                                {isC2H ? "C2H / Contract" : "Full-Time"}
                              </span>
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                {match.location || "Bengaluru / Hybrid"}
                              </span>
                            </div>

                            <div className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-black text-xs shrink-0 ${
                              isStrong
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                            }`}>
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>{match.fitmentScore}% Match</span>
                            </div>
                          </div>

                          {/* Role Title */}
                          <div>
                            <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {match.jobTitle || "Software Engineer"}
                            </h3>
                            <p className="text-xs text-slate-500 font-medium mt-1 line-clamp-2">
                              {targetJob.description || "Direct opportunity with competitive package and accelerated hiring cycle."}
                            </p>
                          </div>

                          {/* Skill Match Pills */}
                          <div className="space-y-1.5 pt-1">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Skills Alignment ({match.skillsOverlap.length} matched)
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {match.skillsOverlap.map((skill: string, i: number) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200"
                                >
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  {skill}
                                </span>
                              ))}
                              {match.missingSkills.slice(0, 3).map((skill: string, i: number) => (
                                <span
                                  key={`m-${i}`}
                                  className="px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 bg-slate-100 text-slate-500 border border-slate-200"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Gates Verification Summary */}
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Exp: {match.experienceRequired} ({match.hardGateVerdict})</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Work Mode: {match.workMode}</span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2">
                          <button
                            onClick={() => {
                              setApplyingJob(targetJob);
                              setApplyStep(1);
                            }}
                            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-all"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>1-Click Apply</span>
                          </button>

                          <button
                            onClick={() => setSelectedJobForDetail(targetJob)}
                            className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                          >
                            Details
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: FIND OPPORTUNITIES (BROWSE DIRECT-APPLY JOBS)                      */}
        {/* ========================================================================= */}
        {activeTab === "JOBS" && (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
              <div className="relative z-10 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold mb-3">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Direct-to-Client Applications • Verified Roles</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Find Your Next Opportunity
                </h1>
                <p className="text-slate-300 text-sm mt-2 leading-relaxed">
                  Browse high-priority Onsite, C2H, and Hybrid positions. Apply directly with your verified profile—no agency intermediaries or undisclosed markups.
                </p>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                {/* Search Input */}
                <div className="md:col-span-6 relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by role title, skill (e.g. React, C++, Java, AWS)..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Location Filter */}
                <div className="md:col-span-3 relative">
                  <MapPin className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Location (e.g. Bengaluru, Hyderabad)..."
                    value={locationFilter}
                    onChange={e => setLocationFilter(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                {/* Experience Dropdown */}
                <div className="md:col-span-3">
                  <select
                    value={selectedExpFilter}
                    onChange={e => setSelectedExpFilter(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="ALL">All Experience Levels</option>
                    <option value="0-3">0–3 Years (Entry/Junior)</option>
                    <option value="3-6">3–6 Years (Mid Level)</option>
                    <option value="6-9">6–9 Years (Senior)</option>
                    <option value="9+">9+ Years (Staff/Lead)</option>
                  </select>
                </div>
              </div>

              {/* Work Mode Filter Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-500 mr-2 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> Work Mode:
                </span>
                {[
                  { id: "ALL", label: "All Modes" },
                  { id: "ONSITE", label: "🏢 Onsite Only" },
                  { id: "C2H", label: "⏱️ C2H (Contract-to-Hire)" },
                  { id: "HYBRID", label: "⚡ Hybrid" },
                  { id: "REMOTE", label: "🌐 Remote" }
                ].map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setSelectedWorkMode(mode.id)}
                    className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                      selectedWorkMode === mode.id
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Results Count & Grid */}
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
              <span>Showing {filteredJobs.length} Open Direct-Apply Positions</span>
              <span>Direct Applications reviewed directly by HireNest Global HQ</span>
            </div>

            {isLoadingJobs ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <div className="h-8 w-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mx-auto mb-3" />
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Loading Available Opportunities...</p>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
                <Briefcase className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="font-bold text-slate-800 text-base">No Matching Positions Found</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Try adjusting your search keywords, location filter, or work mode settings to view other open direct requirements.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setLocationFilter("");
                    setSelectedWorkMode("ALL");
                    setSelectedExpFilter("ALL");
                  }}
                >
                  Reset Filters
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredJobs.map(job => {
                  const jobSkills = job.skills || [];
                  const isAlreadyApplied = applications.some(a => a.requirementId === job.id);

                  return (
                    <div
                      key={job.id}
                      className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between hover:border-indigo-200"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-bold text-slate-900 text-base line-clamp-1">
                              {job.title || job.role || "Software Engineering Role"}
                            </h3>
                            <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              <span>{job.clientName || "Enterprise Partner"}</span>
                            </p>
                          </div>
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                            (job.workMode || "").toUpperCase().includes("ONSITE")
                              ? "bg-amber-100 text-amber-800"
                              : (job.workMode || "").toUpperCase().includes("C2H")
                              ? "bg-purple-100 text-purple-800"
                              : "bg-blue-100 text-blue-800"
                          }`}>
                            {job.workMode || "Onsite"}
                          </span>
                        </div>

                        {/* Location & Experience Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {job.location || "Bengaluru, India"}
                          </span>
                          <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {job.experience || "4–7 Years"}
                          </span>
                          {job.budget && (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[11px] font-semibold">
                              {job.budget}
                            </span>
                          )}
                        </div>

                        {/* Description Snippet */}
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {job.description || "Join our high-impact engineering team to deliver scalable enterprise systems."}
                        </p>

                        {/* Skills Chips */}
                        <div className="flex flex-wrap gap-1 pt-1">
                          {jobSkills.slice(0, 4).map((skill: string, idx: number) => {
                            const isMatched = profile.skills.some(
                              ps => ps.toLowerCase() === skill.toLowerCase()
                            );
                            return (
                              <span
                                key={idx}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isMatched
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {skill} {isMatched && "✓"}
                              </span>
                            );
                          })}
                          {jobSkills.length > 4 && (
                            <span className="text-[10px] text-slate-400 font-bold px-1 py-0.5">
                              +{jobSkills.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-4 mt-4 border-t border-slate-100">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 text-xs text-slate-600 hover:text-slate-900"
                          onClick={() => setSelectedJobForDetail(job)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> View Details
                        </Button>

                        {isAlreadyApplied ? (
                          <span className="flex-1 py-1.5 px-3 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg text-center flex items-center justify-center gap-1 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Applied
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-700 font-bold"
                            onClick={() => {
                              setApplyingJob(job);
                              setApplyStep(1);
                            }}
                          >
                            Apply Now
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: MY APPLICATIONS (LIVE 6-STEP TRACKER)                               */}
        {/* ========================================================================= */}
        {activeTab === "APPLICATIONS" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">My Direct Applications</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Track real-time progress across all your direct-apply submissions with HireNest Global HQ.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("JOBS")}
                className="text-xs font-bold"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Browse More Jobs
              </Button>
            </div>

            {applications.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
                <FileText className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="font-bold text-slate-800 text-base">No Applications Yet</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  You haven't submitted any direct applications yet. Browse open Onsite and C2H opportunities and apply in seconds.
                </p>
                <Button
                  className="bg-indigo-600 hover:bg-indigo-700 text-xs font-bold"
                  onClick={() => setActiveTab("JOBS")}
                >
                  <Search className="w-3.5 h-3.5 mr-1.5" /> Find Open Positions
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {applications.map(app => {
                  const stageIdx = getStageIndex(app.applicationStatus || app.status);
                  const isScreeningRequired = stageIdx === 2;

                  return (
                    <div
                      key={app.id}
                      className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6 hover:border-indigo-200 transition-all"
                    >
                      {/* Top Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-900 text-lg">
                              {app.jobTitle || app.requirementTitle || "Software Engineer"}
                            </h3>
                            <span className="bg-indigo-50 text-indigo-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-indigo-200">
                              {app.workMode || "Onsite"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                            <span>Location: {app.jobLocation || "Bengaluru, India"}</span>
                            <span>•</span>
                            <span>Applied: {new Date(app.submittedAt || Date.now()).toLocaleDateString()}</span>
                            <span>•</span>
                            <span className="font-mono text-[11px] text-slate-400">ID: {app.id}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            Status: {STAGES[stageIdx]?.title || "Under Review"}
                          </span>
                          {isScreeningRequired && (
                            <Button
                              size="sm"
                              className="text-xs bg-amber-500 hover:bg-amber-600 font-bold"
                              onClick={() => setActiveTab("SCREENING")}
                            >
                              Continue Screening ⚠️
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* 6-Step Visual Progress Stepper */}
                      <div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                          {STAGES.map((st, idx) => {
                            const isCompleted = idx < stageIdx;
                            const isCurrent = idx === stageIdx;

                            return (
                              <div
                                key={idx}
                                className={`p-3 rounded-xl border text-center transition-all ${
                                  isCurrent
                                    ? "bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20"
                                    : isCompleted
                                    ? "bg-emerald-50/50 border-emerald-200"
                                    : "bg-slate-50 border-slate-200 opacity-60"
                                }`}
                              >
                                <div className="flex justify-center mb-1.5">
                                  {isCompleted ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                  ) : isCurrent ? (
                                    <Clock className="w-5 h-5 text-indigo-600 animate-pulse" />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-400">
                                      {idx + 1}
                                    </div>
                                  )}
                                </div>
                                <p className={`text-xs font-bold ${
                                  isCurrent ? "text-indigo-900" : isCompleted ? "text-emerald-900" : "text-slate-600"
                                }`}>
                                  {st.title}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{st.desc}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Application Snapshot & Summary */}
                      <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-600 space-y-2 border border-slate-100">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-slate-700">Submitted Resume:</span>
                          <span className="font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                            📄 {app.resumeVersion?.fileName || "Candidate_Resume.pdf"}
                          </span>
                        </div>
                        {app.screeningAnswers && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200/60">
                            <div>
                              <span className="font-medium text-slate-500">Availability:</span>{" "}
                              <span className="font-semibold text-slate-800">{app.screeningAnswers.availability}</span>
                            </div>
                            <div>
                              <span className="font-medium text-slate-500">Onsite Readiness:</span>{" "}
                              <span className="font-semibold text-slate-800">{app.screeningAnswers.onsiteReadiness}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: MY PROFILE & RESUME                                                */}
        {/* ========================================================================= */}
        {activeTab === "PROFILE" && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">Direct Candidate Profile</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Your verified professional profile used for direct client matching.
                  </p>
                </div>
                {!isEditingProfile ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditingProfile(true)}
                    className="text-xs font-bold"
                  >
                    Edit Profile
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEditingProfile(false)}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (!currentUser) return;
                        setIsSavingProfile(true);
                        try {
                          await setDoc(doc(db, "candidate_profiles", currentUser.uid), {
                            ...profile,
                            updatedAt: new Date().toISOString()
                          }, { merge: true });
                          setIsEditingProfile(false);
                        } finally {
                          setIsSavingProfile(false);
                        }
                      }}
                      disabled={isSavingProfile}
                      className="text-xs bg-indigo-600 hover:bg-indigo-700 font-bold"
                    >
                      {isSavingProfile ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                )}
              </div>

              {/* Profile Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Full Name</label>
                  <input
                    type="text"
                    disabled={!isEditingProfile}
                    value={profile.name}
                    onChange={e => setProfile({ ...profile, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium disabled:opacity-75"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Email Address</label>
                  <input
                    type="email"
                    disabled
                    value={profile.email}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Phone Number</label>
                  <input
                    type="tel"
                    disabled={!isEditingProfile}
                    value={profile.phone}
                    onChange={e => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium disabled:opacity-75"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Current Location</label>
                  <input
                    type="text"
                    disabled={!isEditingProfile}
                    value={profile.location}
                    onChange={e => setProfile({ ...profile, location: e.target.value })}
                    placeholder="Bengaluru, Karnataka, India"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium disabled:opacity-75"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Total Relevant Experience (Years)</label>
                  <input
                    type="number"
                    disabled={!isEditingProfile}
                    value={profile.experienceYears}
                    onChange={e => setProfile({ ...profile, experienceYears: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium disabled:opacity-75"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Notice Period (Days)</label>
                  <input
                    type="number"
                    disabled={!isEditingProfile}
                    value={profile.noticePeriodDays}
                    onChange={e => setProfile({ ...profile, noticePeriodDays: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium disabled:opacity-75"
                  />
                </div>
              </div>

              {/* Verified Skills */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-600 block">Verified Technical Skills</label>
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5"
                    >
                      {skill}
                      {isEditingProfile && (
                        <button
                          onClick={() => setProfile({ ...profile, skills: profile.skills.filter(s => s !== skill) })}
                          className="text-indigo-400 hover:text-indigo-700"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>

                {isEditingProfile && (
                  <div className="flex items-center gap-2 pt-2 max-w-sm">
                    <input
                      type="text"
                      placeholder="Add a new skill..."
                      value={newSkill}
                      onChange={e => setNewSkill(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        if (newSkill.trim() && !profile.skills.includes(newSkill.trim())) {
                          setProfile({ ...profile, skills: [...profile.skills, newSkill.trim()] });
                          setNewSkill("");
                        }
                      }}
                      className="text-xs bg-slate-800 text-white"
                    >
                      Add
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Resume Upload Box */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <span>Default Candidate Resume</span>
              </h3>
              <p className="text-xs text-slate-500">
                Upload your latest resume (PDF/DOCX). Our AI will parse your technical stack for direct client matching.
              </p>

              <div className="border-2 border-dashed border-slate-200 hover:border-indigo-300 rounded-xl p-6 text-center space-y-3 bg-slate-50/50">
                <UploadCloud className="w-8 h-8 text-indigo-500 mx-auto" />
                <div>
                  <label className="cursor-pointer text-xs font-bold text-indigo-600 hover:text-indigo-700">
                    <span>Click to upload resume</span>
                    <input
                      type="file"
                      accept=".pdf,.docx,.doc,.txt"
                      className="hidden"
                      onChange={e => {
                        if (e.target.files && e.target.files[0]) {
                          handleProcessResume(e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                  <p className="text-[11px] text-slate-400 mt-1">PDF or DOCX up to 10MB</p>
                </div>

                {isExtractingResume && (
                  <div className="flex items-center justify-center gap-2 text-xs text-indigo-600 font-bold">
                    <div className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                    <span>Extracting skills & text...</span>
                  </div>
                )}

                {extractedResumeData && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-left text-xs text-emerald-900 space-y-1">
                    <div className="font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>{extractedResumeData.fileName} Successfully Parsed</span>
                    </div>
                    <p className="text-[11px] text-emerald-700">
                      Detected Skills: {extractedResumeData.detectedSkills.join(", ")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: SCREENING & ASSESSMENTS                                            */}
        {/* ========================================================================= */}
        {activeTab === "SCREENING" && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">Screening & Verification</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pre-screening questionnaires to fast-track your applications to client interview stage.
                  </p>
                </div>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold">
                  Verified Node
                </Badge>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-3">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                    <span>General Deployment Readiness Checklist</span>
                  </h4>
                  <ul className="space-y-2 text-xs text-slate-600">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Identity & Right-to-Work verified for Indian / Global clients</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Onsite availability preference registered ({profile.preferredWorkMode})</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Notice period recorded ({profile.noticePeriodDays} Days)</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-indigo-50/50 rounded-xl p-5 border border-indigo-100 text-xs text-indigo-900 space-y-2">
                  <p className="font-bold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>AI Screening Verification</span>
                  </p>
                  <p className="text-indigo-700 leading-relaxed">
                    When applying for Onsite or C2H roles, your answers are matched directly with client hard-gate constraints (location readiness, notice period, and core frameworks).
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: AI CAREER COACH                                                    */}
        {/* ========================================================================= */}
        {activeTab === "COACH" && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col h-[650px] overflow-hidden">
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">HireNest AI Career Coach</h3>
                    <p className="text-[10px] text-slate-300">Interview prep • Onsite role optimization</p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-indigo-950 text-indigo-300 border-indigo-800 text-[10px]">
                  Online
                </Badge>
              </div>

              {/* Chat Message Stream */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50">
                {chatMessages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-lg p-3.5 rounded-2xl text-xs leading-relaxed ${
                        msg.sender === "user"
                          ? "bg-indigo-600 text-white rounded-tr-none shadow-xs"
                          : "bg-white text-slate-800 border border-slate-200 rounded-tl-none shadow-xs"
                      }`}
                    >
                      <p>{msg.text}</p>
                      <span className={`text-[9px] mt-1.5 block text-right ${msg.sender === "user" ? "text-indigo-200" : "text-slate-400"}`}>
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                ))}
                {isCoachTyping && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                    <Bot className="w-4 h-4 text-indigo-500 animate-spin" />
                    <span>AI Coach is analyzing...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ask for interview questions, resume tips, or role fitment..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSendCoachMessage()}
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <Button
                  onClick={handleSendCoachMessage}
                  disabled={!chatInput.trim() || isCoachTyping}
                  className="bg-indigo-600 hover:bg-indigo-700 text-xs font-bold"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* JOB DETAIL DRAWER / MODAL                                                 */}
      {/* ========================================================================= */}
      {selectedJobForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {selectedJobForDetail.workMode || "Onsite"}
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-1">
                  {selectedJobForDetail.title || selectedJobForDetail.role}
                </h2>
                <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedJobForDetail.location || "Bengaluru, India"}</span>
                  <span>•</span>
                  <span>Exp: {selectedJobForDetail.experience || "3-6 Years"}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedJobForDetail(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-700">
              <div>
                <h4 className="font-bold text-slate-900 mb-1">Role Description</h4>
                <p className="leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 whitespace-pre-wrap">
                  {selectedJobForDetail.description || "Detailed requirement description."}
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-1.5">Required Technical Stack</h4>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedJobForDetail.skills || []).map((skill: string, i: number) => (
                    <span key={i} className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md font-bold text-[11px] border border-indigo-200">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {selectedJobForDetail.budget && (
                <div>
                  <h4 className="font-bold text-slate-900 mb-1">Compensation / Budget</h4>
                  <p className="font-bold text-emerald-700 text-sm">{selectedJobForDetail.budget}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={() => setSelectedJobForDetail(null)}>
                Close
              </Button>
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 font-bold text-xs"
                onClick={() => {
                  const targetJob = selectedJobForDetail;
                  setSelectedJobForDetail(null);
                  setApplyingJob(targetJob);
                  setApplyStep(1);
                }}
              >
                Proceed to Apply
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DIRECT APPLICATION MODAL (3-STEP FAST FLOW)                               */}
      {/* ========================================================================= */}
      {applyingJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Step {applyStep} of 3 • Direct Application
                </span>
                <h2 className="text-xl font-black text-slate-900 mt-1">
                  Apply for {applyingJob.title || applyingJob.role}
                </h2>
                <p className="text-xs text-slate-500">
                  {applyingJob.workMode} • {applyingJob.location || "Bengaluru, India"}
                </p>
              </div>
              <button
                onClick={() => {
                  setApplyingJob(null);
                  setApplyStep(1);
                }}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* STEP 1: RESUME CONFIRMATION / UPLOAD */}
            {applyStep === 1 && (
              <div className="space-y-4">
                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 text-xs text-indigo-900">
                  <p className="font-bold flex items-center gap-1.5 mb-1">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <span>Direct Submission Integrity</span>
                  </p>
                  <p className="text-indigo-700">
                    Your application creates an immutable candidate record under HireNest Global HQ. Your profile is automatically evaluated against the client's fitment criteria.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">Select or Upload Resume</label>
                  <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-6 text-center space-y-3 bg-slate-50/50">
                    <UploadCloud className="w-8 h-8 text-indigo-500 mx-auto" />
                    <div>
                      <label className="cursor-pointer text-xs font-bold text-indigo-600 hover:text-indigo-700">
                        <span>Upload New Resume</span>
                        <input
                          type="file"
                          accept=".pdf,.docx,.doc,.txt"
                          className="hidden"
                          onChange={e => {
                            if (e.target.files && e.target.files[0]) {
                              handleProcessResume(e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                      <p className="text-[11px] text-slate-400 mt-1">PDF or DOCX</p>
                    </div>

                    {isExtractingResume && (
                      <div className="flex items-center justify-center gap-2 text-xs text-indigo-600 font-bold">
                        <div className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                        <span>AI Parsing Resume & Skills...</span>
                      </div>
                    )}

                    {extractedResumeData ? (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-left text-xs text-emerald-900">
                        <span className="font-bold">✓ Attached: {extractedResumeData.fileName}</span>
                        <p className="text-[11px] text-emerald-700 mt-1">
                          Skills detected: {extractedResumeData.detectedSkills.join(", ")}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-slate-100 p-2.5 rounded-lg text-xs text-slate-600 text-left">
                        <span className="font-bold">Using Profile Default:</span> {profile.name}'s verified profile ({profile.skills.join(", ")})
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <Button variant="ghost" size="sm" onClick={() => setApplyingJob(null)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 font-bold text-xs"
                    onClick={() => setApplyStep(2)}
                  >
                    Next: Screening Questions <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: SCREENING & AVAILABILITY CONFIRMATION */}
            {applyStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Are you available for {applyingJob.workMode || "Onsite"} work at {applyingJob.location || "Bengaluru, India"}?
                    </label>
                    <select
                      value={screenOnsiteReady}
                      onChange={e => setScreenOnsiteReady(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Yes, fully available for Onsite/Hybrid as required">Yes, fully available for Onsite / Hybrid as required</option>
                      <option value="Available with 1-2 weeks relocation notice">Available with 1-2 weeks relocation notice</option>
                      <option value="Remote only preferred">Remote only preferred</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Joining Availability / Notice Period</label>
                    <select
                      value={screenAvailability}
                      onChange={e => setScreenAvailability(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Immediate (0-7 days)">Immediate (0–7 days)</option>
                      <option value="15 Days">15 Days</option>
                      <option value="30 Days">30 Days</option>
                      <option value="45-60 Days">45–60 Days</option>
                      <option value="90 Days">90 Days</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Current CTC / Rate</label>
                      <input
                        type="text"
                        placeholder="e.g. ₹18 LPA / Disclose in call"
                        value={screenCurrentCTC}
                        onChange={e => setScreenCurrentCTC(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Expected CTC / Rate</label>
                      <input
                        type="text"
                        placeholder="e.g. ₹24 LPA / Negotiable"
                        value={screenExpectedCTC}
                        onChange={e => setScreenExpectedCTC(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Additional Notes for Global HQ Recruiter</label>
                    <textarea
                      rows={2}
                      placeholder="Brief note on relevant projects or domain experience..."
                      value={screenNotes}
                      onChange={e => setScreenNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <Button variant="ghost" size="sm" onClick={() => setApplyStep(1)}>
                    Back
                  </Button>
                  <Button
                    size="sm"
                    disabled={isSubmittingApplication}
                    onClick={handleSubmitDirectApplication}
                    className="bg-indigo-600 hover:bg-indigo-700 font-bold text-xs"
                  >
                    {isSubmittingApplication ? (
                      <div className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        <span>Submitting Application...</span>
                      </div>
                    ) : (
                      <span>Submit Application ✓</span>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: APPLICATION SUCCESS */}
            {applyStep === 3 && applicationSuccessData && (
              <div className="text-center py-6 space-y-4">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Application Submitted!</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Your direct application for <strong className="text-slate-800">{applicationSuccessData.jobTitle}</strong> has been logged with ID: <span className="font-mono font-bold text-indigo-600">{applicationSuccessData.appId}</span>.
                  </p>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 max-w-md mx-auto text-left text-xs space-y-2 border border-slate-200">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Initial Fitment Alignment:</span>
                    <span className="font-bold text-emerald-700">{applicationSuccessData.fitmentScore}% Match</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Routing Authority:</span>
                    <span className="font-bold text-slate-800">HireNest Global HQ</span>
                  </div>
                  {applicationSuccessData.conflict && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                      ℹ️ Note: Existing profile found under vendor network. Direct application logged and queued for Admin resolution.
                    </p>
                  )}
                </div>

                <div className="pt-4 flex justify-center gap-3">
                  <Button
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 font-bold text-xs"
                    onClick={() => {
                      setApplyingJob(null);
                      setApplyStep(1);
                      setActiveTab("APPLICATIONS");
                    }}
                  >
                    View My Applications
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
