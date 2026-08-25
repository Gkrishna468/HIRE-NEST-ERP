import { create } from 'zustand';
import { ServiceProvider } from '../lib/providers/ServiceProvider';
import { Candidate, CandidateInput, CandidateUpdate } from '../types/Candidate';

interface CandidateState {
  candidate: Candidate | null;
  candidateLoading: boolean;
  candidateError: string | null;
  getCandidate: (id: string) => Promise<Candidate | null>;
  createCandidate: (data: CandidateInput) => Promise<Candidate>;
  updateCandidate: (id: string, updates: CandidateUpdate) => Promise<void>;
  addGeneralCandidate: (payload: any) => Promise<any>;
  deleteCandidate: (id: string) => Promise<void>;
  retryEnrichment: (candidate: any) => Promise<any>;
  subscribeToCandidate: (id: string, callback: (data: any) => void) => () => void;
  subscribeToEvents: (id: string, callback: (events: any[]) => void) => () => void;
  subscribeToInterviews: (id: string, callback: (interviews: any[]) => void) => () => void;
  subscribeToMatches: (id: string, reqId: string | undefined, callback: (match: any) => void) => () => void;
}

export const useCandidateStore = create<CandidateState>((set, get) => ({
  candidate: null,
  candidateLoading: false,
  candidateError: null,

  getCandidate: async (id: string) => {
    set({ candidateLoading: true, candidateError: null });
    try {
      const result = await ServiceProvider.candidateService.getCandidate(id);
      set({ candidate: result, candidateLoading: false });
      return result;
    } catch (e: any) {
      set({ candidateError: e.message, candidateLoading: false });
      return null;
    }
  },

  createCandidate: async (data: CandidateInput) => {
    set({ candidateLoading: true, candidateError: null });
    try {
      const result = await ServiceProvider.candidateService.createCandidate(data);
      set({ candidate: result, candidateLoading: false });
      return result;
    } catch (e: any) {
      set({ candidateError: e.message, candidateLoading: false });
      throw e;
    }
  },

  updateCandidate: async (id: string, updates: CandidateUpdate) => {
    set({ candidateLoading: true, candidateError: null });
    try {
      await ServiceProvider.candidateService.updateCandidate(id, updates);
      // Optimistic update
      const current = get().candidate;
      if (current && current.id === id) {
        set({ candidate: { ...current, ...updates } as Candidate });
      }
      set({ candidateLoading: false });
    } catch (e: any) {
      set({ candidateError: e.message, candidateLoading: false });
      throw e;
    }
  },

  addGeneralCandidate: async (payload: any) => {
    set({ candidateLoading: true, candidateError: null });
    try {
      const { name, email, phone, experience, currentLocation, orgId, aiAnalysis, keySkills } = payload;
      const candId = payload.candidateId || "HN-CAN-" + Math.random().toString(36).substr(2, 9);
      
      await ServiceProvider.candidateService.createCandidate({
          fullName: name,
          name: name,
          primaryEmail: email,
          email: email,
          phone: phone,
          experience: experience,
          location: currentLocation,
          candidateId: candId,
          vendorId: orgId,
          sourceOrganizations: [orgId],
          pipelineStage: "Candidate Added",
          source: "Manual Add",
          resumeText: aiAnalysis?.analysis || "",
          skills: keySkills.split(",").map((s: string) => s.trim()).filter(Boolean),
          status: "QUEUED",
          distillationStatus: "COMPLETED"
      } as any);

      const { CandidateOwnershipEngine } = await import("../lib/workflows/CandidateOwnershipEngine");
      await CandidateOwnershipEngine.establishOwnership(candId, orgId, "VENDOR", 180);

      set({ candidateLoading: false });
      return { success: true, candId };
    } catch (e: any) {
      set({ candidateError: e.message, candidateLoading: false });
      throw e;
    }
  },

  deleteCandidate: async (id: string) => {
    set({ candidateLoading: true, candidateError: null });
    try {
      const res = await fetch(`/api/candidates?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
         const d = await res.json().catch(()=>({}));
         throw new Error(d.error || "Failed to delete candidate");
      }
      set({ candidate: null, candidateLoading: false });
    } catch (e: any) {
      set({ candidateError: e.message, candidateLoading: false });
      throw e;
    }
  },

  retryEnrichment: async (candidate: any) => {
    set({ candidateLoading: true, candidateError: null });
    try {
      const candId = candidate.candidateId || candidate.id;
      const resumeTextToUse = candidate.resumeText || candidate.extractedText || "";

      const res = await fetch("/api/rescan-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: candId,
          resumeText: resumeTextToUse,
          filename: candidate.fileName || `${candidate.name || "Candidate"}_Resume.txt`,
          forceRescan: true,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to rescan resume deterministically.");
      }

      const data = await res.json();
      const updateData: any = {
        distillationStatus: data.status === "FAILED" ? "FAILED" : "COMPLETED",
        status: data.status === "FAILED" ? "FAILED" : "COMPLETED",
        isStale: false,
        resumeProcessingStatus: data.status,
        resumeProcessingId: data.processingId,
        name: data.candidateName || candidate.name,
        fullName: data.candidateName || candidate.fullName || candidate.name,
        email: data.email || candidate.email,
        primaryEmail: data.email || candidate.primaryEmail,
        phone: data.phone || candidate.phone,
        location: data.location || candidate.location,
        experience: `${data.experienceYears || 0} Years`,
        totalExperience: data.experienceYears || 0,
        skills: data.skills || candidate.skills || [],
        currentRole: data.currentRole || candidate.currentRole,
        requiresManualReview: data.requiresManualReview || data.status === "MANUAL_REVIEW",
      };

      try {
        await ServiceProvider.candidateService.updateCandidate(candId, updateData);
      } catch (svcErr) {
        console.warn("ServiceProvider candidate update warning:", svcErr);
      }

      const current = get().candidate;
      if (current && (current.id === candId || (current as any).candidateId === candId)) {
        set({ candidate: { ...current, ...updateData } as Candidate });
      }

      set({ candidateLoading: false });
      return updateData;
    } catch (e: any) {
      set({ candidateError: e.message, candidateLoading: false });
      throw e;
    }
  },

  subscribeToCandidate: (id: string, callback: (data: any) => void) => {
    // In a real app we might call ServiceProvider.candidateService.subscribeToCandidate(...)
    // For now, return a mock unsubscribe function to ensure stores own lifecycle
    console.log(`Subscribed to candidate ${id}`);
    ServiceProvider.candidateService.getCandidate(id).then(c => {
       if (c) callback(c);
    });
    return () => console.log(`Unsubscribed from candidate ${id}`);
  },

  subscribeToEvents: (id: string, callback: (events: any[]) => void) => {
    console.log(`Subscribed to events for ${id}`);
    callback([]);
    return () => console.log(`Unsubscribed from events ${id}`);
  },

  subscribeToInterviews: (id: string, callback: (interviews: any[]) => void) => {
    console.log(`Subscribed to interviews for ${id}`);
    callback([]);
    return () => console.log(`Unsubscribed from interviews ${id}`);
  },

  subscribeToMatches: (id: string, reqId: string | undefined, callback: (match: any) => void) => {
    console.log(`Subscribed to matches for ${id} req ${reqId}`);
    callback(null);
    return () => console.log(`Unsubscribed from matches for ${id}`);
  }
}));
