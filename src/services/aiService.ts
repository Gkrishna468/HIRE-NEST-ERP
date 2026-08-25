import { auth, db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

async function getOrgId() {
  const currentUser = auth.currentUser;
  if (!currentUser) return "system";
  try {
    const d = await getDoc(doc(db, "users", currentUser.uid));
    if (d.exists() && d.data().organizationId) {
      return d.data().organizationId;
    }
  } catch (e) {
    console.warn(e);
  }
  return currentUser.uid;
}

export async function getAuthHeaders() {
  const orgId = await getOrgId();
  const token = await auth.currentUser?.getIdToken();
  const headers: Record<string, string> = { 
    "Content-Type": "application/json", 
    "x-org-id": orgId 
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export interface CandidateMatchResult {
  matchScore: number;
  breakdown?: {
    skillsScore: number;
    experienceScore: number;
    domainScore: number;
    locationScore: number;
    bonusScore: number;
    totalScore: number;
  };
  summary: string;
  strengths: string[];
  gaps: string[];
  missingSkills?: string[];
  recruiterAssessment?: string;
  recommendation?: 'STRONG_FIT' | 'CONSIDER' | 'NOT_SUITABLE';
  nextSteps?: string;
  outreachDrafts: {
    founder: string;
    professional: string;
    executive: string;
    warm: string;
  };
}

export async function analyzeCandidateMatch(jd: string, candidateProfile: string): Promise<CandidateMatchResult> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch("/api/match-candidates-detailed", {
      method: "POST",
      headers,
      body: JSON.stringify({ jd, candidateProfile }),
    });
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("AI Analysis proxy failed:", error);
    return {
      matchScore: 0,
      summary: "AI Analysis currently unavailable. Please check your server connection and GEMINI_API_KEY.",
      strengths: [],
      gaps: [],
      outreachDrafts: { founder: "", professional: "", executive: "", warm: "" }
    };
  }
}

export async function parseBulkResumes(resumeTexts: string[]): Promise<any[]> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch("/api/bulk-parse", {
      method: "POST",
      headers,
      body: JSON.stringify({ resumeTexts }),
    });
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    return await response.json();
  } catch (e) {
    console.error("Bulk parse proxy failed:", e);
    return [];
  }
}

export async function queryAIGateway(prompt: string, feature: string = 'general', promptVersion: string = 'v1.0') {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch("/api/ai", {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt, feature, promptVersion }),
    });
    if (!response.ok) throw new Error(`AI Gateway returned ${response.status}`);
    return await response.json();
  } catch (e) {
    console.error("AI Gateway proxy failed:", e);
    return null;
  }
}
