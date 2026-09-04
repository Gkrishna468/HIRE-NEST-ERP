import React, { useState, useCallback } from "react";
import { 
  Upload, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Trash2, 
  Bot, 
  FileText, 
  Clock, 
  Sparkles, 
  ChevronRight, 
  Cpu, 
  ShieldCheck, 
  RefreshCw 
} from "lucide-react";
import { Button } from "../lib/Button";
import { auth } from "../lib/firebase";

interface BulkUploadProps {
  onClose: () => void;
  onImport: (candidates: any[]) => void;
  userOrgId: string;
}

export interface ProcessingResultItem {
  id: number;
  originalFile: File;
  fileName: string;
  fileSize: number;
  processingId?: string;
  candidateId?: string;
  status: "QUEUED" | "EXTRACTING" | "OCR" | "PARSING" | "PERSISTING" | "COMPLETED" | "FAILED" | "MANUAL_REVIEW" | "DUPLICATE";
  stage: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  skills: string[];
  experienceYears: number;
  currentRole: string;
  extractionMethod: string;
  ocrUsed: boolean;
  textLength: number;
  parserVersion: string;
  startedAt?: string;
  completedAt?: string;
  timeline: Array<{ stage: string; status: string; timestamp: string; message: string }>;
  error?: string;
  missingName?: boolean;
  candidateProfile?: any;
}

export function BulkUploadProcess({ onClose, onImport, userOrgId }: BulkUploadProps) {
  const [step, setStep] = useState<"UPLOAD" | "PROCESSING" | "RESULTS">("UPLOAD");
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<ProcessingResultItem[]>([]);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number>(0);
  const [selectedResultIndex, setSelectedResultIndex] = useState<number>(0);
  const [forceRescan, setForceRescan] = useState<boolean>(false);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

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

  const processFileItem = async (file: File, index: number, isForce: boolean): Promise<ProcessingResultItem> => {
    // Generate canonical candidateId on frontend
    const candId = "HN-CAN-" + Math.random().toString(36).substr(2, 9);
    
    // Update UI stage to EXTRACTING
    setResults(prev => prev.map((r, idx) => idx === index ? {
      ...r,
      candidateId: candId,
      status: "EXTRACTING",
      stage: "EXTRACTING",
      timeline: [
        ...r.timeline,
        { stage: "EXTRACTING", status: "IN_PROGRESS", timestamp: new Date().toLocaleTimeString(), message: `Uploading & extracting text from ${file.name}...` }
      ]
    } : r));

    // Upload file to Firebase Storage first to preserve physical file and get canonical download URL
    let resumeUrl = "";
    try {
      const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
      const { storage } = await import("../lib/firebase");
      const resolvedOrgId = (userOrgId === "HQ" || !userOrgId) ? "ORG-GLOBAL-HQ" : userOrgId;
      const fileRef = ref(storage, `resumes/${resolvedOrgId}/${candId}/${file.name}`);
      await uploadBytes(fileRef, file);
      resumeUrl = await getDownloadURL(fileRef);
    } catch (storageErr) {
      console.warn("Storage upload failed in bulk import, proceeding with direct file ingestion:", storageErr);
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("candidateId", candId);
    if (resumeUrl) {
      formData.append("resumeUrl", resumeUrl);
    }
    formData.append("resumeFileName", file.name);
    if (isForce) {
      formData.append("forceRescan", "true");
    }
    formData.append("orgId", userOrgId);

    try {
      const token = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/extract-text", {
        method: "POST",
        headers,
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const isManual = data.status === "MANUAL_REVIEW" || data.requiresManualReview || !data.candidateName;

        const itemResult: ProcessingResultItem = {
          id: index,
          originalFile: file,
          fileName: file.name,
          fileSize: file.size,
          processingId: data.processingId || data.ledgerId,
          candidateId: data.candidateId || candId,
          status: isManual ? "MANUAL_REVIEW" : (data.status || "COMPLETED"),
          stage: data.stage || (isManual ? "MANUAL_REVIEW" : "COMPLETED"),
          name: data.candidateName || "",
          email: data.email || "",
          phone: data.phone || "",
          location: data.location || "Remote / Flexible",
          skills: data.skills || [],
          experienceYears: data.experienceYears || 0,
          currentRole: data.currentRole || "Candidate",
          extractionMethod: data.extractionMethod || "TEXT_UTF8",
          ocrUsed: data.ocrUsed || false,
          textLength: data.textLength || 0,
          parserVersion: data.parserVersion || "2.5.0",
          startedAt: data.startedAt,
          completedAt: data.completedAt || new Date().toISOString(),
          timeline: data.timeline || [
            { stage: "COMPLETED", status: "SUCCESS", timestamp: new Date().toLocaleTimeString(), message: "Processed deterministically." }
          ],
          missingName: !data.candidateName,
          candidateProfile: data.candidateProfile,
        };

        setResults(prev => prev.map((r, idx) => idx === index ? itemResult : r));
        return itemResult;
      } else {
        const errData = await res.json().catch(() => ({}));
        const failedItem: ProcessingResultItem = {
          id: index,
          originalFile: file,
          fileName: file.name,
          fileSize: file.size,
          status: "FAILED",
          stage: "FAILED",
          name: "",
          email: "",
          phone: "",
          location: "",
          skills: [],
          experienceYears: 0,
          currentRole: "",
          extractionMethod: "FAILED",
          ocrUsed: false,
          textLength: 0,
          parserVersion: "2.5.0",
          timeline: [
            { stage: "FAILED", status: "FAILED", timestamp: new Date().toLocaleTimeString(), message: errData.message || "Extraction failed." }
          ],
          error: errData.message || "Failed to process resume.",
        };
        setResults(prev => prev.map((r, idx) => idx === index ? failedItem : r));
        return failedItem;
      }
    } catch (err: any) {
      const errorItem: ProcessingResultItem = {
        id: index,
        originalFile: file,
        fileName: file.name,
        fileSize: file.size,
        status: "FAILED",
        stage: "FAILED",
        name: "",
        email: "",
        phone: "",
        location: "",
        skills: [],
        experienceYears: 0,
        currentRole: "",
        extractionMethod: "FAILED",
        ocrUsed: false,
        textLength: 0,
        parserVersion: "2.5.0",
        timeline: [
          { stage: "FAILED", status: "FAILED", timestamp: new Date().toLocaleTimeString(), message: err.message || "Connection error." }
        ],
        error: err.message || "Network or server failure.",
      };
      setResults(prev => prev.map((r, idx) => idx === index ? errorItem : r));
      return errorItem;
    }
  };

  const startPipeline = async () => {
    setStep("PROCESSING");
    const initialResults: ProcessingResultItem[] = files.map((file, idx) => ({
      id: idx,
      originalFile: file,
      fileName: file.name,
      fileSize: file.size,
      status: "QUEUED",
      stage: "QUEUED",
      name: "",
      email: "",
      phone: "",
      location: "",
      skills: [],
      experienceYears: 0,
      currentRole: "",
      extractionMethod: "PENDING",
      ocrUsed: false,
      textLength: 0,
      parserVersion: "2.5.0",
      timeline: [
        { stage: "QUEUED", status: "IN_PROGRESS", timestamp: new Date().toLocaleTimeString(), message: "Queued for deterministic ingestion." }
      ],
    }));

    setResults(initialResults);

    // Controlled concurrent processing with isolated failures (concurrency limit = 4)
    const concurrencyLimit = 4;
    const queue = Array.from({ length: files.length }, (_, i) => i);
    
    const worker = async () => {
      while (queue.length > 0) {
        const nextIdx = queue.shift();
        if (nextIdx === undefined) break;
        setCurrentProcessingIndex(nextIdx);
        await processFileItem(files[nextIdx], nextIdx, forceRescan);
      }
    };

    const workers = Array.from(
      { length: Math.min(concurrencyLimit, files.length) },
      () => worker()
    );
    await Promise.all(workers);

    setStep("RESULTS");
  };

  const retryFailedFiles = async () => {
    setIsRetrying(true);
    const failedIndices = results
      .map((item, idx) => item.status === "FAILED" ? idx : -1)
      .filter(idx => idx !== -1);

    const concurrencyLimit = 4;
    const queue = [...failedIndices];
    
    const worker = async () => {
      while (queue.length > 0) {
        const nextIdx = queue.shift();
        if (nextIdx === undefined) break;
        setCurrentProcessingIndex(nextIdx);
        await processFileItem(files[nextIdx], nextIdx, true); // force fresh retry on failed items
      }
    };

    const workers = Array.from(
      { length: Math.min(concurrencyLimit, failedIndices.length) },
      () => worker()
    );
    await Promise.all(workers);
    setIsRetrying(false);
  };

  const updateCandidateName = (id: number, newName: string) => {
    setResults(prev => prev.map(c => c.id === id ? { 
      ...c, 
      name: newName, 
      missingName: newName.trim() === "",
      status: newName.trim() ? "COMPLETED" : "MANUAL_REVIEW"
    } : c));
  };

  const completedCount = results.filter(r => r.status === "COMPLETED" || r.status === "DUPLICATE").length;
  const manualCount = results.filter(r => r.status === "MANUAL_REVIEW").length;
  const failedCount = results.filter(r => r.status === "FAILED").length;

  const handleConfirmImport = () => {
    const valid = results.filter(r => (r.status === "COMPLETED" || r.status === "DUPLICATE" || (r.status === "MANUAL_REVIEW" && r.name)) && r.name.trim().length > 0);
    onImport(valid.map(v => ({
      ...v,
      status: "Parsed",
      parsedProfile: {
        ...v.candidateProfile,
        name: v.name,
        fullName: v.name,
        skills: v.skills,
        totalExperience: v.experienceYears,
        experience: `${v.experienceYears} Years`,
        location: v.location,
        status: "COMPLETED",
      }
    })));
  };

  const selectedItem = results[selectedResultIndex] || results[0];

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-4xl w-full flex flex-col shadow-2xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Deterministic Resume Ingestion Engine
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Zero-AI Active</span>
              </h2>
              <p className="text-xs text-slate-500">Authoritative OCR, Rule-Based Parser, and Ledger State Machine</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* STEP 1: UPLOAD */}
          {step === "UPLOAD" && (
            <div className="space-y-6">
              <div 
                className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center hover:bg-slate-50 hover:border-indigo-500 transition-all cursor-pointer"
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <input type="file" id="file-upload" className="hidden" multiple accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" onChange={handleFileSelect} />
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Drag & drop candidate resumes</h3>
                <p className="text-sm text-slate-500 mb-4">PDF, DOCX, Scanned PDF, Images, or TXT (Up to 10MB each)</p>
                <Button variant="outline" className="pointer-events-none rounded-xl">Select Documents</Button>
              </div>

              {files.length > 0 && (
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm text-slate-700">{files.length} document{files.length > 1 ? "s" : ""} queued for ingestion</h4>
                    <button onClick={() => setFiles([])} className="text-xs text-rose-500 hover:text-rose-700 font-medium">Clear All</button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center justify-between bg-white p-2.5 px-3.5 rounded-xl border border-slate-200 text-sm">
                        <div className="flex items-center gap-2.5 truncate">
                          <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="truncate font-medium text-slate-700">{f.name}</span>
                          <span className="text-xs text-slate-400">({(f.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-rose-500 p-1 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  {/* Deduplication Cache Option (Default OFF) */}
                  <div className="pt-2 border-t border-slate-200 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="force-rescan-toggle"
                      checked={forceRescan}
                      onChange={(e) => setForceRescan(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="force-rescan-toggle" className="text-xs text-slate-600 cursor-pointer font-medium">
                      Force re-scan (bypass deduplication cache & re-extract existing hashes)
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: PROCESSING (Live Pipeline Stage Tracking) */}
          {step === "PROCESSING" && (
            <div className="py-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex p-3 bg-indigo-50 text-indigo-600 rounded-2xl animate-pulse">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  Processing document {currentProcessingIndex + 1} of {files.length}
                </h3>
                <p className="text-sm text-slate-500">
                  Running deterministic state machine: <span className="font-mono text-indigo-600 font-semibold">QUEUED → EXTRACTING → OCR → PARSING → PERSISTING → COMPLETED</span>
                </p>
              </div>

              {/* Progress items */}
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {results.map((r, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl border bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        r.status === "COMPLETED" ? "bg-emerald-500" :
                        r.status === "FAILED" ? "bg-rose-500" :
                        r.status === "MANUAL_REVIEW" ? "bg-amber-500" :
                        "bg-indigo-500 animate-ping"
                      }`} />
                      <div>
                        <p className="font-semibold text-sm text-slate-800">{r.fileName}</p>
                        <p className="text-xs text-slate-500">
                          {r.name ? `Candidate: ${r.name} • ` : ""}Stage: <span className="font-semibold text-indigo-600">{r.stage}</span>
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white border text-slate-700">
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: RESULTS (Processing Result UI & Timeline) */}
          {step === "RESULTS" && (
            <div className="space-y-6">
              {/* Summary Stats Strip */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-xs text-slate-500 font-medium uppercase">Total Processed</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">{results.length}</p>
                </div>
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <p className="text-xs text-emerald-600 font-medium uppercase">Successfully Parsed</p>
                  <p className="text-xl font-bold text-emerald-700 mt-1">{completedCount}</p>
                </div>
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-xs text-amber-600 font-medium uppercase">Manual Review</p>
                  <p className="text-xl font-bold text-amber-700 mt-1">{manualCount}</p>
                </div>
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
                  <p className="text-xs text-rose-600 font-medium uppercase">Failed</p>
                  <p className="text-xl font-bold text-rose-700 mt-1">{failedCount}</p>
                </div>
              </div>

              {/* Master / Detail View */}
              <div className="grid grid-cols-12 gap-4 border border-slate-200 rounded-2xl overflow-hidden min-h-[380px]">
                {/* Left List */}
                <div className="col-span-5 border-r border-slate-200 bg-slate-50/50 p-2 space-y-1.5 overflow-y-auto max-h-[420px]">
                  {results.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedResultIndex(idx)}
                      className={`w-full text-left p-3 rounded-xl transition-all flex flex-col gap-1 border ${
                        selectedResultIndex === idx 
                          ? "bg-white border-indigo-500 shadow-sm" 
                          : "bg-transparent border-transparent hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-semibold text-sm text-slate-800 truncate max-w-[170px]">
                          {item.name || item.fileName}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
                          item.status === "MANUAL_REVIEW" ? "bg-amber-100 text-amber-700" :
                          item.status === "DUPLICATE" ? "bg-blue-100 text-blue-700" :
                          "bg-rose-100 text-rose-700"
                        }`}>
                          {item.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="truncate">{item.fileName}</span>
                        <span>{item.skills.length} skills</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Right Detail Card */}
                {selectedItem && (
                  <div className="col-span-7 p-5 space-y-4 overflow-y-auto max-h-[420px]">
                    {/* Candidate Identity Block */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Candidate Record</p>
                          {selectedItem.missingName || selectedItem.status === "MANUAL_REVIEW" ? (
                            <div className="mt-1 flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Enter candidate full name..."
                                value={selectedItem.name}
                                onChange={(e) => updateCandidateName(selectedItem.id, e.target.value)}
                                className="text-sm font-semibold bg-white border border-amber-300 rounded px-2.5 py-1 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                              />
                              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                            </div>
                          ) : (
                            <h4 className="text-lg font-bold text-slate-900 mt-0.5">{selectedItem.name}</h4>
                          )}
                          <p className="text-xs text-slate-600 mt-0.5">{selectedItem.currentRole} • {selectedItem.experienceYears} Years Exp</p>
                        </div>
                        <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md font-semibold">
                          {selectedItem.extractionMethod}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-2 border-t border-slate-200">
                        <p><span className="font-semibold text-slate-700">Email:</span> {selectedItem.email || "—"}</p>
                        <p><span className="font-semibold text-slate-700">Phone:</span> {selectedItem.phone || "—"}</p>
                        <p><span className="font-semibold text-slate-700">Location:</span> {selectedItem.location || "Remote"}</p>
                        <p><span className="font-semibold text-slate-700">OCR Used:</span> {selectedItem.ocrUsed ? "Yes (Tesseract)" : "No (Native Text)"}</p>
                      </div>

                      {/* Skills list */}
                      {selectedItem.skills.length > 0 && (
                        <div className="pt-2 border-t border-slate-200">
                          <p className="text-xs font-semibold text-slate-700 mb-1.5">Extracted Skills ({selectedItem.skills.length})</p>
                          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                            {selectedItem.skills.map((s, si) => (
                              <span key={si} className="text-[11px] bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Processing Timeline Block */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-indigo-600" />
                          Authoritative Ledger Timeline
                        </h5>
                        {selectedItem.processingId && (
                          <span className="text-[10px] font-mono text-slate-400">ID: {selectedItem.processingId}</span>
                        )}
                      </div>

                      <div className="space-y-2 pl-2 border-l-2 border-indigo-200">
                        {selectedItem.timeline.map((event, ei) => (
                          <div key={ei} className="relative pl-3 text-xs">
                            <div className={`absolute -left-[13px] top-1 w-2.5 h-2.5 rounded-full ${
                              event.status === "FAILED" ? "bg-rose-500" :
                              event.status === "SUCCESS" ? "bg-emerald-500" :
                              "bg-indigo-500"
                            }`} />
                            <div className="flex items-center justify-between text-slate-500">
                              <span className="font-semibold text-slate-700">{event.stage}</span>
                              <span className="text-[10px]">{event.timestamp}</span>
                            </div>
                            <p className="text-slate-600 mt-0.5">{event.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <Button variant="outline" onClick={onClose}>
            {step === "RESULTS" ? "Dismiss" : "Cancel"}
          </Button>

          {step === "UPLOAD" && (
            <Button 
              onClick={startPipeline} 
              disabled={files.length === 0} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
            >
              Start Zero-AI Ingestion ({files.length})
            </Button>
          )}

          {step === "RESULTS" && (
            <div className="flex items-center gap-2">
              {failedCount > 0 && (
                <Button
                  variant="outline"
                  onClick={retryFailedFiles}
                  disabled={isRetrying}
                  className="border-rose-300 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRetrying ? "animate-spin" : ""}`} />
                  {isRetrying ? "Retrying..." : `Retry Failed (${failedCount})`}
                </Button>
              )}
              <Button 
                onClick={handleConfirmImport}
                disabled={completedCount === 0 && manualCount === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm"
              >
                Complete Import ({completedCount + (manualCount > 0 ? results.filter(r => r.status === "MANUAL_REVIEW" && r.name).length : 0)} Candidates)
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
