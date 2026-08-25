import { db } from '../../lib/firebase-admin.js';
import { parseResumeDeterministically } from '../../resume-engine/parser/resume-parser.js';

export interface ResumeScreeningOutput {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  totalExperienceYears: number | null;
  currentCompany: string | null;
  currentTitle: string | null;
  skills: string[];
  primarySkills: string[];
  secondarySkills: string[];
  certifications: string[];
  education: Array<{ degree?: string; institution?: string; year?: number }> | string[];
  projects: Array<{ name?: string; description?: string; techStack?: string[] }> | string[];
  domainExperience: string[];
  noticePeriodDays: number | null;
  availability: string | null;
  preferredLocations: string[];
  remotePreference: string | null;
  strengths: string[];
  potentialConcerns: string[];
  resumeQualityScore: number;
  aiConfidence: number;
  aiSummary: string;
}

export class ResumeScreeningService {
  static async screenAndEnrichCandidate(candidateId: string, resumeText: string): Promise<ResumeScreeningOutput> {
    if (!db) throw new Error("Database not initialized");

    const candRef = db.collection('candidatePool').doc(candidateId);
    const candDoc = await candRef.get();
    if (!candDoc.exists) {
      throw new Error(`Candidate ${candidateId} not found`);
    }

    const parsedData = parseResumeDeterministically({ text: resumeText, filename: "resume.txt" });

    const screeningData: ResumeScreeningOutput = {
      fullName: parsedData.name || null,
      email: parsedData.email || null,
      phone: parsedData.phone || null,
      location: parsedData.location || null,
      totalExperienceYears: parsedData.totalExperience || null,
      currentCompany: parsedData.currentCompany || null,
      currentTitle: parsedData.currentRole || null,
      skills: parsedData.skills || [],
      primarySkills: (parsedData.skills || []).slice(0, 5),
      secondarySkills: (parsedData.skills || []).slice(5),
      certifications: (parsedData.certifications || []).map(c => typeof c === 'string' ? c : (c as any).name),
      education: parsedData.education || [],
      projects: [],
      domainExperience: [],
      noticePeriodDays: 30,
      availability: parsedData.noticePeriod || "30 Days",
      preferredLocations: parsedData.location ? [parsedData.location] : [],
      remotePreference: "Hybrid",
      strengths: ["Strong experience based on deterministic matching"],
      potentialConcerns: [],
      resumeQualityScore: resumeText.length > 500 ? 85 : 50,
      aiConfidence: 100,
      aiSummary: "Profile structured via deterministic extraction engine."
    };

    const currentCandData = candDoc.data() || {};
    const updatedPayload = {
      ...currentCandData,
      name: screeningData.fullName || currentCandData.name || currentCandData.fullName || "Candidate",
      email: screeningData.email || currentCandData.email || "",
      phone: screeningData.phone || currentCandData.phone || "",
      location: screeningData.location || currentCandData.location || "",
      skills: Array.from(new Set([...(currentCandData.skills || []), ...screeningData.skills])),
      experienceYears: screeningData.totalExperienceYears ?? currentCandData.experienceYears ?? 0,
      title: screeningData.currentTitle || currentCandData.title || currentCandData.role || "",
      parsedData: {
        ...(currentCandData.parsedData || {}),
        rawText: resumeText,
        extractedAt: new Date().toISOString()
      },
      aiIntelligence: {
        ...(currentCandData.aiIntelligence || {}),
        ...screeningData,
        lastAnalyzedAt: new Date().toISOString()
      },
      updatedAt: new Date().toISOString()
    };
    await candRef.set(updatedPayload, { merge: true });
    return screeningData;
  }
}
