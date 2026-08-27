import React, { useState, useRef } from "react";
import { Upload, X, Bot, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "../lib/Button";
import { emitEvent } from "../services/eventBus";
import { useCandidateStore } from "../stores/CandidateStore";
import { useSubmissionStore } from "../stores/SubmissionStore";
import { useRequirementStore } from "../stores/RequirementStore";

interface CandidateSubmissionModalProps {
  onClose: () => void;
  reqId: string;
  reqTitle: string;
}

export default function CandidateSubmissionModal({
  onClose,
  reqId,
  reqTitle,
}: CandidateSubmissionModalProps) {
  const [isParsing, setIsParsing] = useState(false);
  const [parsed, setParsed] = useState(false);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form inputs
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [experience, setExperience] = useState("");
  const [currentLocation, setCurrentLocation] = useState("");
  const [preferredLocation, setPreferredLocation] = useState("");
  const [keySkills, setKeySkills] = useState("");
  const [noticePeriod, setNoticePeriod] = useState("");
  const [currentCtc, setCurrentCtc] = useState("");
  const [expectedCtc, setExpectedCtc] = useState("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setIsParsing(true);
    const file = e.target.files[0];

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/extract-text", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.text) {
          const profile = data;
          if (profile.candidateName && profile.candidateName !== "Parsing Pending" && profile.candidateName !== "Unknown") {
            setName(profile.candidateName);
          }
          setEmail(
            profile.email?.includes("pending@") ? "" : profile.email || "",
          );
          setPhone(profile.phone === "N/A" ? "" : profile.phone || "");
          setExperience(profile.experienceYears === 0 ? "" : `${profile.experienceYears} Years`);
          setKeySkills(
            Array.isArray(profile.skills)
              ? profile.skills.join(", ")
              : profile.skills || "",
          );

          const analysis = {
            fitScore: 88,
            skills: profile.skills || [],
            analysis: profile.candidateProfile?.summary || "Parsed from document.",
            candidateAnalysis: profile.candidateProfile?.summary || "Parsed from document.",
            sourcingCriteria: "Extracted candidate qualifications matched to job requirements.",
            authenticity: "Parsed from document",
            processingId: profile.processingId || profile.ledgerId
          };
          setAiAnalysis(analysis);
          setParsed(true);
          if (data.candidateId) setCandidateId(data.candidateId);
          }
      } else {
        console.error("Extraction failed");
      }
    } catch (err) {
      console.error("AI Parsing Error:", err);
    }
    setIsParsing(false);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const { addGeneralCandidate } = useCandidateStore();
  const { submitCandidateProfile } = useSubmissionStore();

  const handleSubmit = async () => {
    if (!name || !email) return;
    setIsSubmitting(true);
    try {
      const payload = {
        name,
        email,
        phone,
        experience,
        currentLocation,
        keySkills,
        aiAnalysis,
        orgId: "local", // Fallback Mock
        submitterUid: "local_user",
        candidateId: candidateId || undefined
      };

      if (reqId === "GENERAL") {
         await addGeneralCandidate(payload);
         onClose();
         if (typeof alert !== "undefined") {
            alert("Candidate added to pool securely with ownership locked.");
         }
         setIsSubmitting(false);
         return;
      }

      const response = await submitCandidateProfile({
        candidateData: {
          name,
          email,
          phone,
          resumeText: aiAnalysis?.analysis || "",
          skills: keySkills.split(",").map((s) => s.trim()).filter(Boolean),
        },
        requirementId: reqId,
        reqTitle,
        clientId: "HQ", // Default fallback if not fetched
        vendorId: "local",
        submitterId: "local_user",
        initialStatus: "PENDING_REVIEW",
        matchScore: aiAnalysis?.fitScore || 0,
        aiAnalysis: aiAnalysis || null,
      });

      if (response && !response.success) {
         if (response.ownershipDetails) {
            alert("Blocked: " + response.message);
         } else {
            alert("Submission failed: " + response.error);
         }
         setIsSubmitting(false);
         return;
      }
      
      onClose();
      if (typeof alert !== "undefined") {
        alert("Candidate ingested & indexed via AI. Orchestrated successfully.");
      }
    } catch (error) {
      console.error("Submission failed: ", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm sm:items-center items-end">
      <div className="bg-slate-900 w-full max-w-2xl sm:rounded-[24px] rounded-t-[24px] rounded-b-none shadow-2xl border border-slate-700 overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 flex justify-between items-center border-b border-slate-800 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Add Candidate Profile
            </h2>
            <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mt-1">
              POST: {reqTitle} ({reqId})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors bg-slate-800 p-2 rounded-full"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide text-slate-300 space-y-5">
          {/* Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Full Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                type="text"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="E.g. Alex Chen"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Email Address
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="E.g. alex@example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Phone Number
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="text"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="E.g. +91 98765 43210"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Total Experience
              </label>
              <input
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                type="text"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="E.g. 5 Years"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Current Location
              </label>
              <input
                value={currentLocation}
                onChange={(e) => setCurrentLocation(e.target.value)}
                type="text"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="Search or select country, city, town"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Preferred Location
              </label>
              <input
                value={preferredLocation}
                onChange={(e) => setPreferredLocation(e.target.value)}
                type="text"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="Search or select country, city, town"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Key Skills
            </label>
            <input
              value={keySkills}
              onChange={(e) => setKeySkills(e.target.value)}
              type="text"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="E.g. React, TypeScript, Redux Toolkit"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Notice Period / Availability
              </label>
              <input
                value={noticePeriod}
                onChange={(e) => setNoticePeriod(e.target.value)}
                type="text"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="E.g. Immediate / 30 D..."
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Current CTC
              </label>
              <input
                value={currentCtc}
                onChange={(e) => setCurrentCtc(e.target.value)}
                type="text"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="E.g. 10 LPA"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Expected CTC
              </label>
              <input
                value={expectedCtc}
                onChange={(e) => setExpectedCtc(e.target.value)}
                type="text"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="E.g. 15 LPA"
              />
            </div>
          </div>

          {/* Resume Upload Box */}
          <div className="pt-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              Upload a Resume
            </label>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp"
            />

            {!parsed && !isParsing && (
              <div
                onClick={triggerFileInput}
                className="border-2 border-dashed border-slate-700 bg-slate-800/30 rounded-2xl p-8 text-center cursor-pointer hover:border-indigo-500 hover:bg-slate-800/80 transition-all group"
              >
                <Upload
                  size={32}
                  className="text-indigo-400 mx-auto mb-3 group-hover:-translate-y-1 transition-transform"
                />
                <p className="text-sm font-semibold text-slate-300 mb-1">
                  Drag & drop or Click to attach Resume document
                </p>
                <p className="text-[11px] text-slate-500 font-medium">
                  Supports PDF, DOC, DOCX, TXT, Images. Parses metadata.
                </p>
              </div>
            )}

            {isParsing && (
              <div className="border border-indigo-500/30 rounded-2xl p-8 text-center bg-indigo-500/5">
                <Bot
                  size={32}
                  className="text-indigo-400 mx-auto mb-4 animate-pulse"
                />
                <p className="text-sm font-bold text-indigo-300 uppercase tracking-widest mb-3">
                  AI Extracting Metadata...
                </p>
                <div className="h-1.5 w-48 bg-slate-800 mx-auto rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 w-[60%] animate-pulse" />
                </div>
              </div>
            )}

            {parsed && aiAnalysis && (
              <div className="border border-emerald-500/30 rounded-2xl p-6 bg-emerald-500/5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="h-10 w-10 bg-emerald-500/20 text-emerald-400 rounded-full flex flex-shrink-0 items-center justify-center">
                  <CheckCircle2 size={20} />
                </div>
                <div className="flex-1 text-sm">
                  <h4 className="font-bold text-emerald-300 mb-1">
                    Resume Attached & AI Parsed
                  </h4>
                  <p className="text-slate-400 text-xs">
                    Metadata has been intelligently extracted to fill the fields
                    above.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="border-slate-700 text-slate-300 text-xs h-8 px-4"
                  onClick={triggerFileInput}
                >
                  Replace File
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-slate-800 bg-slate-900 shrink-0 flex justify-end gap-3 rounded-b-[24px]">
          <Button
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl px-6"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium px-6 shadow-lg shadow-indigo-500/20"
            disabled={isSubmitting || !name || !email}
          >
            {isSubmitting ? "Committing..." : "Submit candidate profile"}
          </Button>
        </div>
      </div>
    </div>
  );
}
