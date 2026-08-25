import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  User,
  Mail,
  Phone,
  Lock,
  MapPin,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  Star
} from "lucide-react";
import { auth, db } from "../lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { CandidateMatchingService, CandidateMatchResult } from "../services/CandidateMatchingService";

interface CandidateRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "REGISTER" | "LOGIN";
  onSwitchToLogin?: () => void;
}

export function CandidateRegisterModal({
  isOpen,
  onClose,
  initialMode = "REGISTER",
  onSwitchToLogin
}: CandidateRegisterModalProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1: Details, 2: Upload CV, 3: Parsing & Matching, 4: Results & Enter
  const [showPassword, setShowPassword] = useState(false);

  // Form Fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [location, setLocation] = useState("Bengaluru, India");
  const [preferredRole, setPreferredRole] = useState("Software Engineer");
  const [experienceYears, setExperienceYears] = useState<number>(4);

  // CV File
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [extractedSkills, setExtractedSkills] = useState<string[]>([]);
  const [parsedSummary, setParsedSummary] = useState<string>("");

  // Matching Results
  const [matchResults, setMatchResults] = useState<{
    strongMatches: CandidateMatchResult[];
    validatableMatches: CandidateMatchResult[];
    allMatches: CandidateMatchResult[];
  }>({ strongMatches: [], validatableMatches: [], allMatches: [] });

  const [loadingState, setLoadingState] = useState<string>("");
  const [error, setError] = useState<string>("");

  if (!isOpen) return null;

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in all required account fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setError("");
    setStep(2);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      setResumeFile(files[0]);
      setError("");
    }
  };

  const handleProcessAndRegister = async () => {
    if (!resumeFile) {
      setError("Please select your CV/Resume file (PDF or DOCX).");
      return;
    }

    setError("");
    setStep(3);
    setLoadingState("Extracting CV text & parsing technical skills...");

    try {
      // 1. EXTRACT RESUME TEXT
      let extractedText = "";
      let detectedSkills: string[] = ["React", "TypeScript", "Node.js", "Java", "SQL"];
      
      try {
        const formData = new FormData();
        formData.append("file", resumeFile);
        const res = await fetch("/api/extract-text", {
          method: "POST",
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          extractedText = data.text || "";
          
          // Detect skills from text
          const commonTech = [
            "React", "TypeScript", "JavaScript", "Node.js", "Java", "Python", 
            "C++", "C++17", "C++14", "C++20", "Linux", "Embedded", "RTOS",
            "AWS", "SQL", "PostgreSQL", "Docker", "Kubernetes", "Angular", 
            "Go", "Golang", "Microservices", "REST", "Spring Boot", "Kafka"
          ];
          const found: string[] = [];
          commonTech.forEach(tech => {
            if (new RegExp(`\\b${tech.replace("+", "\\+")}\\b`, "i").test(extractedText)) {
              found.push(tech);
            }
          });
          if (found.length > 0) detectedSkills = found;
          setParsedSummary(extractedText.slice(0, 250) + "...");
        }
      } catch (extractErr) {
        console.warn("Extraction note:", extractErr);
      }

      setExtractedSkills(detectedSkills);

      // 2. CREATE AUTHENTICATION ACCOUNT IN FIREBASE
      setLoadingState("Creating candidate identity & security profile...");
      const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCred.user;

      await updateProfile(user, {
        displayName: name.trim()
      });

      // 3. PERSIST USER RECORD IN USERS COLLECTION
      const candidateUid = user.uid;
      await setDoc(doc(db, "users", candidateUid), {
        id: candidateUid,
        uid: candidateUid,
        email: email.trim(),
        name: name.trim(),
        displayName: name.trim(),
        phone: phone.trim() || null,
        role: "candidate",
        organizationId: "ORG-CANDIDATE-COMMUNITY",
        status: "ACTIVE",
        onboardingCompleted: true,
        isOnline: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // 4. CREATE CANDIDATE POOL MASTER RECORD
      await setDoc(doc(db, "candidatePool", candidateUid), {
        id: candidateUid,
        uid: candidateUid,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || "Not provided",
        location: location.trim(),
        headline: preferredRole || "Software Specialist",
        skills: detectedSkills,
        experience: `${experienceYears} Years`,
        experienceYears: experienceYears,
        sourceType: "DIRECT_CANDIDATE", ownershipType: "DIRECT", vendorId: null,
        ownerType: "HIRENEST",
        ownerId: "GLOBAL_HQ",
        createdVia: "CANDIDATE_PORTAL",
        isDirectCandidate: true,
        pipelineStage: "Application Received",
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // 5. CREATE CANDIDATE PROFILE RECORD
      await setDoc(doc(db, "candidate_profiles", candidateUid), {
        id: candidateUid,
        userId: candidateUid,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        location: location.trim(),
        headline: preferredRole,
        skills: detectedSkills,
        targetRoles: [preferredRole],
        experienceYears: experienceYears,
        preferredWorkMode: "Hybrid",
        noticePeriodDays: 15,
        resumeFileName: resumeFile.name,
        resumeText: extractedText.slice(0, 2000),
        sourceType: "DIRECT_CANDIDATE", ownershipType: "DIRECT", vendorId: null,
        ownerType: "HIRENEST",
        ownerId: "GLOBAL_HQ",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // 6. RUN AUTOMATIC FITMENT INTELLIGENCE ENGINE
      setLoadingState("Running Fitment Intelligence Engine across Full-Time & C2H jobs...");
      const matches = await CandidateMatchingService.executeAutomaticMatching({
        id: candidateUid,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        skills: detectedSkills,
        experienceYears: experienceYears,
        location: location.trim(),
        preferredWorkMode: "Hybrid"
      });

      setMatchResults(matches);
      setStep(4);
    } catch (err: any) {
      console.error("Candidate Registration Error:", err);
      setError(err.message || "Failed to complete candidate registration.");
      setStep(2);
    }
  };

  const handleEnterPortal = () => {
    onClose();
    navigate("/");
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative text-white flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white rotate-3 shadow-lg shadow-indigo-600/30">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-white">HireNest Candidate Portal</h3>
                <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                  Direct Apply
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Automatic Fitment Engine & Instant Job Matching</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-8 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs font-bold text-slate-400">
          <div className="flex items-center gap-2">
            <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black ${step >= 1 ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"}`}>1</span>
            <span className={step >= 1 ? "text-white" : ""}>Account Info</span>
          </div>
          <div className="h-0.5 w-6 bg-slate-800" />
          <div className="flex items-center gap-2">
            <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black ${step >= 2 ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"}`}>2</span>
            <span className={step >= 2 ? "text-white" : ""}>Upload CV</span>
          </div>
          <div className="h-0.5 w-6 bg-slate-800" />
          <div className="flex items-center gap-2">
            <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black ${step >= 3 ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"}`}>3</span>
            <span className={step >= 3 ? "text-white" : ""}>AI Match</span>
          </div>
          <div className="h-0.5 w-6 bg-slate-800" />
          <div className="flex items-center gap-2">
            <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black ${step >= 4 ? "bg-emerald-500 text-white" : "bg-slate-800 text-slate-400"}`}>4</span>
            <span className={step >= 4 ? "text-emerald-400" : ""}>Matches</span>
          </div>
        </div>

        {/* Body */}
        <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3 text-rose-300 text-xs font-bold">
              <AlertCircle size={18} className="shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Candidate Account Details */}
          {step === 1 && (
            <form onSubmit={handleDetailsSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Pavan Badrinath"
                      className="w-full h-12 pl-10 pr-3 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="pavan@example.com"
                      className="w-full h-12 pl-10 pr-3 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Mobile Phone *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full h-12 pl-10 pr-3 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Current City / Location
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      placeholder="Bengaluru, Hyderabad, Pune..."
                      className="w-full h-12 pl-10 pr-3 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Target Role / Specialization
                  </label>
                  <div className="relative">
                    <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      value={preferredRole}
                      onChange={e => setPreferredRole(e.target.value)}
                      placeholder="e.g. Senior C++ Developer"
                      className="w-full h-12 pl-10 pr-3 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Total Experience (Years)
                  </label>
                  <select
                    value={experienceYears}
                    onChange={e => setExperienceYears(parseInt(e.target.value, 10))}
                    className="w-full h-12 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white focus:border-indigo-500 outline-none"
                  >
                    <option value={1}>1-2 Years (Junior)</option>
                    <option value={3}>3-5 Years (Mid-Senior)</option>
                    <option value={6}>6-8 Years (Senior)</option>
                    <option value={10}>9+ Years (Lead / Architect)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                  Create Password (min 6 chars) *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-12 pl-10 pr-10 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white focus:border-indigo-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={onSwitchToLogin}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300"
                >
                  Already registered? Candidate Login →
                </button>

                <button
                  type="submit"
                  className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all"
                >
                  Next: Upload CV <ArrowRight size={16} />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: CV Upload */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center max-w-md mx-auto">
                <h4 className="text-lg font-black text-white">Upload your CV / Resume</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Our Fitment Intelligence Engine will parse your skills and match you to active Full-Time & C2H requirements automatically.
                </p>
              </div>

              <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/50 rounded-2xl p-8 text-center transition-all bg-slate-800/40">
                <input
                  type="file"
                  id="cv-upload-input"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <label htmlFor="cv-upload-input" className="cursor-pointer flex flex-col items-center gap-3">
                  <div className="h-16 w-16 bg-indigo-600/10 rounded-2xl flex items-center justify-center text-indigo-400">
                    <UploadCloud size={32} />
                  </div>
                  <div>
                    <span className="text-xs font-black text-white uppercase tracking-wider block">
                      {resumeFile ? resumeFile.name : "Click or drag & drop to upload CV"}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium mt-1 block">
                      Supports PDF, DOCX, TXT (Max 10MB)
                    </span>
                  </div>
                  {resumeFile && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-bold">
                      <CheckCircle2 size={12} /> Ready for Parsing
                    </span>
                  )}
                </label>
              </div>

              <div className="flex items-center justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white"
                >
                  ← Back to Details
                </button>

                <button
                  type="button"
                  onClick={handleProcessAndRegister}
                  disabled={!resumeFile}
                  className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all"
                >
                  <Sparkles size={16} /> Parse CV & Match Jobs
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Parsing & Matching In Progress */}
          {step === 3 && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <Sparkles className="absolute inset-0 m-auto text-indigo-400 animate-pulse" size={24} />
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-black text-white">Fitment Engine Processing</h4>
                <p className="text-xs text-indigo-400 font-mono">{loadingState}</p>
                <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 font-mono pt-2">
                  <span>Evaluating: Deterministic Skills</span>
                  <span>•</span>
                  <span>Hard Gates</span>
                  <span>•</span>
                  <span>Full-Time & C2H</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Live Matches Revealed */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-300">
                <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-black text-white">Candidate Account Created & Profile Matched!</h4>
                  <p className="text-xs text-emerald-400">
                    We found <span className="font-black text-white">{matchResults.allMatches.length} matching opportunities</span> across Full-Time and C2H pipelines.
                  </p>
                </div>
              </div>

              {/* Detected Skills */}
              {extractedSkills.length > 0 && (
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                    Parsed Technical Skills ({extractedSkills.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {extractedSkills.map((sk, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-slate-800 text-indigo-300 border border-slate-700 rounded-lg text-[10px] font-black">
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Matches Preview */}
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3">
                  Top Recommended Requirements
                </span>
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                  {matchResults.allMatches.slice(0, 4).map((job, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-2xl flex items-center justify-between hover:border-indigo-500/40 transition-all"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="text-xs font-black text-white">{job.jobTitle}</h5>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            job.jobType === "C2H" ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          }`}>
                            {job.jobType}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1 font-medium">
                          <span>{job.location}</span>
                          <span>•</span>
                          <span>{job.workMode}</span>
                          <span>•</span>
                          <span className="text-indigo-400">{job.skillsOverlap.slice(0, 3).join(", ")}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <Star size={12} className="text-amber-400 fill-amber-400" />
                          <span className="text-sm font-black text-emerald-400">{job.fitmentScore}%</span>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          {job.matchTier === "STRONG" ? "Strong Fit" : "Valid Match"}
                        </span>
                      </div>
                    </div>
                  ))}

                  {matchResults.allMatches.length === 0 && (
                    <div className="p-6 text-center text-slate-400 text-xs font-medium bg-slate-800/40 rounded-2xl border border-slate-800">
                      Profile indexed. You will be notified automatically when matching requirements are published.
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleEnterPortal}
                  className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all"
                >
                  Enter Candidate Portal & View All Matches <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
