import React, { useState, useCallback } from "react";
import { Upload, X, CheckCircle, AlertCircle, Trash2, Bot } from "lucide-react";
import { Button } from "../lib/Button";
import { auth } from "../lib/firebase";
import { parseBulkResumes } from "../services/aiService";

interface BulkUploadProps {
  onClose: () => void;
  onImport: (candidates: any[]) => void;
  userOrgId: string;
}

export function BulkUploadProcess({ onClose, onImport, userOrgId }: BulkUploadProps) {
  const [step, setStep] = useState<"UPLOAD" | "PARSE" | "REVIEW" | "CONFIRM">("UPLOAD");
  const [files, setFiles] = useState<File[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const startParsing = async () => {
    setStep("PARSE");
    setProcessing(true);
    const parsedCandidates: any[] = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);
        
        let extText = "";
        let extractionSucceeded = false;
        try {
            const token = await auth.currentUser?.getIdToken();
            const headers: Record<string, string> = {};
            if (token) {
              headers["Authorization"] = `Bearer ${token}`;
            }
            const res = await fetch("/api/extract-text", {
              method: "POST",
              headers,
              body: formData,
            });
            if (res.ok) {
              const data = await res.json();
              if (data.text && data.text.trim().length >= 40) {
                extText = data.text;
                extractionSucceeded = true;
              }
            }
        } catch (e) {
            console.warn("Extraction failed for file " + file.name, e);
        }

        let parsedProfile: any = null;
        let distilledName = "";
        let parseStatus = "FAILED";

        if (extractionSucceeded && extText && extText.trim()) {
            try {
                // Call the real AI parser
                const results = await parseBulkResumes([extText]);
                if (results && results.length > 0) {
                    const profile = results[0];
                    parsedProfile = profile;
                    const isSynthetic = !profile?.name || 
                      profile.name === "Parsing Pending" || 
                      profile.name === "Needs Manual Review" || 
                      profile.name === "Unnamed Candidate" || 
                      profile.name === "Local Mock Generated" ||
                      profile.name === "Candidate Missing Skill" ||
                      profile.name === "Unknown Candidate" ||
                      profile.name === "Candidate Unknown" ||
                      profile.name.startsWith("CAND_P6D_FAIL");
                    
                    if (!isSynthetic) {
                        distilledName = profile.name;
                    }
                    parseStatus = "COMPLETED";
                } else {
                    parsedProfile = {
                        name: "",
                        email: "",
                        phone: "",
                        skills: [],
                        experience: "",
                        currentRole: "",
                        summary: ""
                    };
                    parseStatus = "COMPLETED";
                }
            } catch (err) {
                console.error("AI parsing failed in bulk upload component:", err);
                parsedProfile = {
                    name: "",
                    email: "",
                    phone: "",
                    skills: [],
                    experience: "",
                    currentRole: "",
                    summary: ""
                };
                parseStatus = "COMPLETED";
            }
        }

        parsedCandidates.push({
            id: i,
            originalFile: file,
            fileName: file.name,
            extractedText: extText,
            name: distilledName || "",
            missingName: !distilledName,
            status: parseStatus === "COMPLETED" ? "Parsed" : "FAILED",
            parsedProfile: parsedProfile ? {
                ...parsedProfile,
                status: "COMPLETED"
            } : null
        });
    }

    setCandidates(parsedCandidates);
    setProcessing(false);
    setStep("REVIEW");
  };

  const updateCandidateName = (id: number, newName: string) => {
      setCandidates(prev => prev.map(c => c.id === id ? { ...c, name: newName, missingName: newName.trim() === "" } : c));
  };

  const hasMissingNames = candidates.some(c => c.status === "Parsed" && c.missingName);
  const hasSuccessful = candidates.some(c => c.status === "Parsed" && c.parsedProfile);

  const confirmImport = () => {
      const successful = candidates.filter(c => c.status === "Parsed" && c.parsedProfile && c.name && c.name !== "Failed to Parse");
      onImport(successful);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-3xl w-full flex flex-col shadow-2xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-600" /> Bulk Import
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {step === "UPLOAD" && (
            <div className="space-y-6">
              <div 
                className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:bg-slate-50 hover:border-indigo-400 transition-colors cursor-pointer"
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <input type="file" id="file-upload" className="hidden" multiple accept=".pdf,.doc,.docx,.txt" onChange={handleFileSelect} />
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1">Drag & drop resumes here</h3>
                <p className="text-sm text-slate-500 mb-4">PDF, DOCX, or TXT up to 10MB each</p>
                <Button variant="outline" className="pointer-events-none">Browse Files</Button>
              </div>

              {files.length > 0 && (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-sm text-slate-700">{files.length} files selected</h4>
                    <button onClick={() => setFiles([])} className="text-xs text-red-500 hover:text-red-700 font-medium">Clear All</button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center justify-between bg-white p-2 px-3 rounded-lg border border-slate-200 text-sm">
                        <span className="truncate text-slate-700">{f.name}</span>
                        <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "PARSE" && (
            <div className="py-24 flex flex-col items-center justify-center text-center">
               <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
               <h3 className="text-xl font-bold text-slate-900 mb-2">Processing {files.length} resumes...</h3>
               <p className="text-slate-500">Extracting text and running initial identity resolution logic via AI.</p>
            </div>
          )}

          {step === "REVIEW" && (
            <div className="space-y-6">
              <div className="bg-indigo-50 text-indigo-700 p-4 rounded-xl border border-indigo-100 flex items-start gap-3">
                 <Bot className="w-5 h-5 shrink-0 mt-0.5" />
                 <div>
                   <p className="font-semibold text-sm mb-1">AI Distillation Complete</p>
                   <p className="text-sm opacity-90">Please verify names before importing. Files where a candidate name could not be confidently determined require manual entry.</p>
                 </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Source File</th>
                      <th className="px-4 py-3 font-semibold w-1/2">Deduced Name</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {candidates.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-slate-500 truncate max-w-[150px]" title={c.fileName}>{c.fileName}</td>
                        <td className="px-4 py-3">
                          {c.status === "FAILED" ? (
                            <span className="text-rose-500 font-medium italic">Unparseable (Skipped)</span>
                          ) : c.missingName ? (
                            <div className="flex items-center gap-2">
                               <input 
                                 type="text" 
                                 placeholder="Enter real name..."
                                 className="w-full bg-red-50 border border-red-200 rounded px-2 py-1.5 focus:ring-red-500 focus:border-red-500 text-red-900 placeholder:text-red-300"
                                 value={c.name}
                                 onChange={(e) => updateCandidateName(c.id, e.target.value)}
                               />
                               <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                            </div>
                          ) : (
                            <div className="flex items-center justify-between group">
                               <span className="font-medium text-slate-900">{c.name}</span>
                               <button 
                                 onClick={() => updateCandidateName(c.id, "")}
                                 className="text-xs text-indigo-600 opacity-0 group-hover:opacity-100 hover:underline px-2"
                               >Edit</button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                           {c.status === "FAILED" ? (
                             <span className="inline-flex items-center px-2 py-1 rounded bg-rose-100 text-rose-700 text-xs font-semibold">Failed</span>
                           ) : c.missingName ? (
                             <span className="inline-flex items-center px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-semibold">Missing Name</span>
                           ) : (
                             <span className="inline-flex items-center px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-semibold">Ready</span>
                           )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === "CONFIRM" && (
             <div className="py-24 flex flex-col items-center justify-center text-center">
                 <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle className="w-10 h-10" />
                 </div>
                 <h3 className="text-2xl font-bold text-slate-900 mb-2">Import Successful</h3>
                 <p className="text-slate-500 border-b border-slate-100 pb-6 mb-6">
                   {candidates.filter(c => c.status === "Parsed").length} candidate profiles have been added to the CandidatePool.
                 </p>
                 <Button onClick={onClose} variant="default" className="px-8">View Candidates</Button>
             </div>
          )}
        </div>

        {step !== "CONFIRM" && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3 shrink-0">
             <Button variant="outline" onClick={onClose}>Cancel</Button>
             
             {step === "UPLOAD" && (
               <Button onClick={startParsing} disabled={files.length === 0} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                 Upload & Parse
               </Button>
             )}
             
             {step === "REVIEW" && (
               <Button onClick={confirmImport} disabled={!hasSuccessful || hasMissingNames} className={(!hasSuccessful || hasMissingNames) ? "opacity-50" : "bg-emerald-600 hover:bg-emerald-700 text-white"}>
                 Complete Import
               </Button>
             )}
          </div>
        )}
      </div>
    </div>
  );
}
