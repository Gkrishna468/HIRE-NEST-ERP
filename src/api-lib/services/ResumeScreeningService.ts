import { db } from '../../lib/firebase-admin.js';
import { AIRuntime } from './AIRuntime.js';

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

  /**
   * Screen candidate resume text using AIGateway and store structured recruitment intelligence.
   */
  static async screenAndEnrichCandidate(candidateId: string, resumeText: string): Promise<ResumeScreeningOutput> {
    if (!db) throw new Error("Database not initialized");

    const candRef = db.collection('candidatePool').doc(candidateId);
    const candDoc = await candRef.get();
    if (!candDoc.exists) {
      throw new Error(`Candidate ${candidateId} not found`);
    }

    const prompt = `
      You are an expert AI Recruitment Intelligence Engine.
      Analyze the provided resume text and extract precise structured information.
      Strict Rule: Do NOT invent or fabricate information. If a field is not present or cannot be confidently inferred, output null or an empty array.

      Resume Text:
      ${resumeText}

      Return a strict JSON object matching this schema:
      {
        "fullName": string or null,
        "email": string or null,
        "phone": string or null,
        "location": string or null,
        "totalExperienceYears": number or null,
        "currentCompany": string or null,
        "currentTitle": string or null,
        "skills": ["string"],
        "primarySkills": ["string"],
        "secondarySkills": ["string"],
        "certifications": ["string"],
        "education": [{"degree": "string", "institution": "string", "year": number}],
        "projects": [{"name": "string", "description": "string", "techStack": ["string"]}],
        "domainExperience": ["string"],
        "noticePeriodDays": number or null,
        "availability": string or null,
        "preferredLocations": ["string"],
        "remotePreference": string or null,
        "strengths": ["string"],
        "potentialConcerns": ["string"],
        "resumeQualityScore": number (0-100),
        "aiConfidence": number (0-100),
        "aiSummary": "2-3 sentence high level executive profile summary"
      }
    `;

    const aiRes = await AIRuntime.analyze({
      prompt,
      modelPreference: 'pro',
      schema: true
    });

    let screeningData: ResumeScreeningOutput;

    if (aiRes.outcome === 'success' && aiRes.data) {
      const d = aiRes.data;
      screeningData = {
        fullName: d.fullName || null,
        email: d.email || null,
        phone: d.phone || null,
        location: d.location || null,
        totalExperienceYears: typeof d.totalExperienceYears === 'number' ? d.totalExperienceYears : null,
        currentCompany: d.currentCompany || null,
        currentTitle: d.currentTitle || null,
        skills: Array.isArray(d.skills) ? d.skills : [],
        primarySkills: Array.isArray(d.primarySkills) ? d.primarySkills : [],
        secondarySkills: Array.isArray(d.secondarySkills) ? d.secondarySkills : [],
        certifications: Array.isArray(d.certifications) ? d.certifications : [],
        education: Array.isArray(d.education) ? d.education : [],
        projects: Array.isArray(d.projects) ? d.projects : [],
        domainExperience: Array.isArray(d.domainExperience) ? d.domainExperience : [],
        noticePeriodDays: typeof d.noticePeriodDays === 'number' ? d.noticePeriodDays : null,
        availability: d.availability || null,
        preferredLocations: Array.isArray(d.preferredLocations) ? d.preferredLocations : [],
        remotePreference: d.remotePreference || null,
        strengths: Array.isArray(d.strengths) ? d.strengths : [],
        potentialConcerns: Array.isArray(d.potentialConcerns) ? d.potentialConcerns : [],
        resumeQualityScore: typeof d.resumeQualityScore === 'number' ? d.resumeQualityScore : 75,
        aiConfidence: typeof d.aiConfidence === 'number' ? d.aiConfidence : 80,
        aiSummary: d.aiSummary || "Candidate resume processed successfully."
      };
    } else {
      // Graceful fallback
      screeningData = {
        fullName: null,
        email: null,
        phone: null,
        location: null,
        totalExperienceYears: null,
        currentCompany: null,
        currentTitle: null,
        skills: [],
        primarySkills: [],
        secondarySkills: [],
        certifications: [],
        education: [],
        projects: [],
        domainExperience: [],
        noticePeriodDays: null,
        availability: null,
        preferredLocations: [],
        remotePreference: null,
        strengths: ["Profile ingested"],
        potentialConcerns: ["Detailed AI analysis pending full resume text parsing"],
        resumeQualityScore: 60,
        aiConfidence: 50,
        aiSummary: "Baseline profile extracted."
      };
    }

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
