import { db } from "../lib/firebase";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
  limit
} from "firebase/firestore";
import { SkillNormalizer } from "../resume-engine/matching/skill-normalizer";
import { formatBudget } from "../lib/currency";

export interface CandidateMatchResult {
  requirementId: string;
  jobTitle: string;
  companyName?: string;
  jobType: "Full-Time" | "C2H" | "Contract" | "Hybrid" | "Onsite";
  workMode: string;
  location: string;
  experienceRequired: string;
  budget?: string;
  fitmentScore: number;
  matchTier: "STRONG" | "VALIDATABLE" | "GAP" | "HARD_GATE_FAIL";
  skillsOverlap: string[];
  missingSkills: string[];
  hardGateVerdict: "PASS" | "FAIL";
  hardGateReason?: string;
  isApplied?: boolean;
  notificationRecordId?: string;
}

export interface JobMatchNotificationRecord {
  id: string; // `${candidateId}_${requirementId}`
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  requirementId: string;
  requirementTitle: string;
  jobType: string;
  workMode: string;
  location: string;
  fitmentScore: number;
  matchTier: "STRONG" | "VALIDATABLE" | "GAP";
  matchVersion: string;
  emailSent: boolean;
  emailSentAt: string | null;
  osNotificationCreated: boolean;
  osNotificationId: string | null;
  viewedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
}

export class CandidateMatchingService {
  private static MATCH_VERSION = "v1.4-FITMENT-ENGINE";

  /**
   * Evaluates deterministic skill overlap, hard gates (experience & location),
   * and computes a score from 0-100%.
   */
  public static evaluateFitment(
    candidate: {
      skills: string[];
      experienceYears?: number;
      location?: string;
      preferredWorkMode?: string;
    },
    requirement: {
      skills?: string[];
      experience?: string;
      minExperience?: string;
      location?: string;
      workMode?: string;
      jobType?: string;
      mandatorySkills?: string[];
    }
  ): {
    score: number;
    tier: "STRONG" | "VALIDATABLE" | "GAP" | "HARD_GATE_FAIL";
    skillsOverlap: string[];
    missingSkills: string[];
    hardGateVerdict: "PASS" | "FAIL";
    hardGateReason?: string;
  } {
    const candSkills = (candidate.skills || []).map(s => s.toLowerCase().trim());
    const reqSkills = (requirement.skills || []).map(s => s.toLowerCase().trim());
    const mandatorySkills = (requirement.mandatorySkills || []).map(s => s.toLowerCase().trim());

    // Normalize synonyms using controlled taxonomy (e.g. C++ with C++17, React with ReactJS)
    const normalizeSkill = (s: string) => SkillNormalizer.normalize(s).toLowerCase();

    const candNormalized = candSkills.map(normalizeSkill);
    const reqNormalized = reqSkills.map(normalizeSkill);

    // Identify overlap
    const skillsOverlap: string[] = [];
    const missingSkills: string[] = [];

    (requirement.skills || []).forEach((origSkill, idx) => {
      const norm = reqNormalized[idx];
      if (candNormalized.includes(norm) || candSkills.some(cs => cs.includes(origSkill.toLowerCase()))) {
        skillsOverlap.push(origSkill);
      } else {
        missingSkills.push(origSkill);
      }
    });

    // Check mandatory skills hard gate
    let missingMandatoryCount = 0;
    if (mandatorySkills.length > 0) {
      mandatorySkills.forEach(ms => {
        const norm = normalizeSkill(ms);
        if (!candNormalized.includes(norm)) {
          missingMandatoryCount++;
        }
      });
    }

    // Check experience hard gate
    const minExpReq = parseInt(requirement.minExperience || requirement.experience || "0", 10) || 0;
    const candExp = candidate.experienceYears || 0;

    let hardGateVerdict: "PASS" | "FAIL" = "PASS";
    let hardGateReason: string | undefined = undefined;

    if (minExpReq > 0 && candExp > 0 && candExp < minExpReq - 2) {
      hardGateVerdict = "FAIL";
      hardGateReason = `Experience requirement (${minExpReq}+ years) exceeds candidate profile (${candExp} years)`;
    } else if (missingMandatoryCount > 1) {
      hardGateVerdict = "FAIL";
      hardGateReason = `Missing critical mandatory core skills (${missingMandatoryCount} missing)`;
    }

    // Score calculation
    let calculatedScore = 50;
    if (reqSkills.length > 0) {
      const overlapRatio = skillsOverlap.length / reqSkills.length;
      calculatedScore = Math.round(45 + overlapRatio * 50);
    } else {
      calculatedScore = 75;
    }

    // Work Mode & Location Bonus / Penalty
    const candLoc = (candidate.location || "").toLowerCase();
    const reqLoc = (requirement.location || "").toLowerCase();
    if (candLoc && reqLoc && (candLoc.includes(reqLoc) || reqLoc.includes(candLoc))) {
      calculatedScore = Math.min(99, calculatedScore + 5);
    }

    // Assign Match Tier
    let tier: "STRONG" | "VALIDATABLE" | "GAP" | "HARD_GATE_FAIL" = "GAP";
    if (hardGateVerdict === "FAIL") {
      tier = "HARD_GATE_FAIL";
      calculatedScore = Math.min(50, calculatedScore);
    } else if (calculatedScore >= 80) {
      tier = "STRONG";
    } else if (calculatedScore >= 65) {
      tier = "VALIDATABLE";
    } else {
      tier = "GAP";
    }

    return {
      score: calculatedScore,
      tier,
      skillsOverlap,
      missingSkills,
      hardGateVerdict,
      hardGateReason
    };
  }

  /**
   * Executes automatic matching for a candidate upon registration, CV upload, or manual refresh.
   * Creates JobMatchNotification records, candidate emails, and OS notifications.
   */
  public static async executeAutomaticMatching(candidateData: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    skills: string[];
    experienceYears?: number;
    location?: string;
    preferredWorkMode?: string;
  }): Promise<{
    strongMatches: CandidateMatchResult[];
    validatableMatches: CandidateMatchResult[];
    allMatches: CandidateMatchResult[];
  }> {
    if (!candidateData.id || !candidateData.email) {
      return { strongMatches: [], validatableMatches: [], allMatches: [] };
    }

    try {
      // 1. Fetch public requirements where status is OPEN/ACTIVE/PUBLISHED and directApply is not false
      const qReqs = collection(db, "requirements_public");
      const reqSnap = await getDocs(qReqs);
      const openReqs: any[] = reqSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((r: any) => {
          const isOpen = !r.status || ["OPEN", "ACTIVE", "PUBLISHED"].includes(r.status.toUpperCase());
          const isDirect = r.directApplyEnabled !== false;
          return isOpen && isDirect;
        });

      // 2. Fetch candidate's existing applications to mark `isApplied`
      const appliedReqIds = new Set<string>();
      try {
        const qApps = query(
          collection(db, "applications"),
          where("candidateEmail", "==", candidateData.email),
          limit(50)
        );
        const appSnap = await getDocs(qApps);
        appSnap.docs.forEach(d => {
          const reqId = d.data().requirementId;
          if (reqId) appliedReqIds.add(reqId);
        });
      } catch (appErr) {
        console.warn("[CandidateMatchingService] Application check note:", appErr);
      }

      const strongMatches: CandidateMatchResult[] = [];
      const validatableMatches: CandidateMatchResult[] = [];
      const allMatches: CandidateMatchResult[] = [];

      for (const req of openReqs) {
        const evaluation = this.evaluateFitment(candidateData, req);

        // Ignore hard gate failures from recommendations
        if (evaluation.tier === "HARD_GATE_FAIL") {
          continue;
        }

        const jobTypeNormalized: "Full-Time" | "C2H" | "Contract" | "Hybrid" | "Onsite" = 
          (req.workMode?.includes("C2H") || req.jobType?.includes("C2H"))
            ? "C2H"
            : (req.jobType || req.workMode || "Full-Time") as any;

        const matchResult: CandidateMatchResult = {
          requirementId: req.id,
          jobTitle: req.title || req.role || "Software Specialist",
          companyName: req.clientName || "HireNest Global Partner",
          jobType: jobTypeNormalized,
          workMode: req.workMode || "Onsite",
          location: req.location || "Bengaluru",
          experienceRequired: req.experience || req.minExperience || "3-5 Years",
          budget: formatBudget(req.budget || req.rate, "Market Standard"),
          fitmentScore: evaluation.score,
          matchTier: evaluation.tier,
          skillsOverlap: evaluation.skillsOverlap,
          missingSkills: evaluation.missingSkills,
          hardGateVerdict: evaluation.hardGateVerdict,
          hardGateReason: evaluation.hardGateReason,
          isApplied: appliedReqIds.has(req.id),
          notificationRecordId: `${candidateData.id}_${req.id}`
        };

        allMatches.push(matchResult);

        if (evaluation.tier === "STRONG") {
          strongMatches.push(matchResult);
        } else if (evaluation.tier === "VALIDATABLE") {
          validatableMatches.push(matchResult);
        }

        // 3. IDEMPOTENT NOTIFICATION DISPATCH (JobMatchNotification)
        // Check / Set the JobMatchNotification record
        const notifDocId = `${candidateData.id}_${req.id}`;
        const notifDocRef = doc(db, "job_match_notifications", notifDocId);
        
        try {
          const existingNotifSnap = await getDoc(notifDocRef);
          
          if (!existingNotifSnap.exists() && (evaluation.tier === "STRONG" || evaluation.tier === "VALIDATABLE")) {
            const isStrong = evaluation.tier === "STRONG";
            
            // Create the OS Notification for Global HQ if Strong match
            let osNotifId: string | null = null;
            if (isStrong) {
              const osNotifRef = await addDoc(collection(db, "notifications"), {
                type: "CANDIDATE_JOB_MATCH",
                title: "🔔 Candidate Job Match",
                candidateName: candidateData.name,
                candidateId: candidateData.id,
                requirementId: req.id,
                requirementTitle: matchResult.jobTitle,
                fitmentScore: matchResult.fitmentScore,
                employmentType: `${matchResult.location} • ${matchResult.jobType}`,
                message: `>${candidateData.name}'s profile matches a new requirement`,
                detail: `${matchResult.jobTitle}\nFitment: ${matchResult.fitmentScore}%\nEmployment: ${matchResult.jobType}`,
                actionUrl: "/candidates",
                actionLabel: "View Candidate →",
                createdAt: new Date().toISOString(),
                status: "UNREAD"
              });
              osNotifId = osNotifRef.id;

              // Log Candidate-facing in-app message
              await addDoc(collection(db, "candidate_notifications"), {
                candidateId: candidateData.id,
                candidateEmail: candidateData.email,
                requirementId: req.id,
                title: "New Job Match Found",
                message: `A job requirement matching your resume has been identified.\n\n${matchResult.jobTitle}\n${matchResult.location} • ${matchResult.jobType}\nMatch: ${matchResult.fitmentScore}%`,
                jobTitle: matchResult.jobTitle,
                location: matchResult.location,
                jobType: matchResult.jobType,
                fitmentScore: matchResult.fitmentScore,
                status: "UNREAD",
                createdAt: new Date().toISOString()
              });
            }

            // Record in job_match_notifications to prevent duplicates
            const jobNotifData: JobMatchNotificationRecord = {
              id: notifDocId,
              candidateId: candidateData.id,
              candidateName: candidateData.name,
              candidateEmail: candidateData.email,
              candidatePhone: candidateData.phone || "",
              requirementId: req.id,
              requirementTitle: matchResult.jobTitle,
              jobType: matchResult.jobType,
              workMode: matchResult.workMode,
              location: matchResult.location,
              fitmentScore: matchResult.fitmentScore,
              matchTier: evaluation.tier,
              matchVersion: this.MATCH_VERSION,
              emailSent: isStrong,
              emailSentAt: isStrong ? new Date().toISOString() : null,
              osNotificationCreated: isStrong,
              osNotificationId: osNotifId,
              viewedAt: null,
              appliedAt: appliedReqIds.has(req.id) ? new Date().toISOString() : null,
              createdAt: new Date().toISOString()
            };

            await setDoc(notifDocRef, jobNotifData);
          }
        } catch (notifErr) {
          console.warn(`[CandidateMatchingService] Notification sync note for ${req.id}:`, notifErr);
        }
      }

      // Sort matches by fitment score descending
      allMatches.sort((a, b) => b.fitmentScore - a.fitmentScore);
      strongMatches.sort((a, b) => b.fitmentScore - a.fitmentScore);
      validatableMatches.sort((a, b) => b.fitmentScore - a.fitmentScore);

      return {
        strongMatches,
        validatableMatches,
        allMatches
      };
    } catch (err) {
      console.error("[CandidateMatchingService] executeAutomaticMatching error:", err);
      return { strongMatches: [], validatableMatches: [], allMatches: [] };
    }
  }
}
