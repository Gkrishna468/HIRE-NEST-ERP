/**
 * HireNestOS Deterministic Fitment Intelligence Engine
 * Computes explainable fitment scores, matrix breakdowns, and tiering with 0 AI/LLM dependencies.
 */

import {
  FitmentResult,
  FitmentTier,
  FitmentScoreBreakdown,
  FitmentMatrixRow,
  CandidateProfile,
} from "../types.js";
import { SkillNormalizer } from "./skill-normalizer.js";
import { HardGateEvaluator } from "./hard-gates.js";

export interface RequirementProfile {
  id: string;
  title: string;
  skills: string[];
  mandatorySkills?: string[];
  secondarySkills?: string[];
  experience?: string | number;
  minExperience?: string | number;
  location?: string;
  workMode?: string;
  domain?: string;
  maxNoticePeriodDays?: number;
  employmentType?: string;
  budget?: string;
}

export class FitmentEngine {
  public static readonly ENGINE_VERSION = "v2.5.0-DETERMINISTIC";

  /**
   * Evaluates a candidate against a requirement completely deterministically.
   */
  public static evaluate(
    candidate: CandidateProfile | {
      id?: string;
      candidateName?: string;
      skills: string[];
      totalExperience?: number;
      experienceYears?: number;
      location?: string;
      currentLocation?: string;
      noticePeriod?: string;
      education?: any[];
      currentRole?: string;
      currentCompany?: string;
    },
    requirement: RequirementProfile
  ): FitmentResult {
    const candidateId = (candidate as any).id || (candidate as any).candidateId || "CAND-PROFILE";
    const requirementId = requirement.id || "REQ-PROFILE";

    const candSkills = candidate.skills || [];
    const candExp = (candidate as any).totalExperience ?? (candidate as any).experienceYears ?? 0;
    const candLoc = candidate.location || candidate.currentLocation || "Flexible";
    const candNotice = candidate.noticePeriod || "30 Days";

    // 1. Evaluate Hard Gates
    const hardGateDetails = HardGateEvaluator.evaluate(
      {
        totalExperience: candExp,
        skills: candSkills,
        location: candLoc,
        noticePeriod: candNotice,
      },
      {
        minExperience: requirement.minExperience || requirement.experience,
        mandatorySkills: requirement.mandatorySkills || requirement.skills.slice(0, 3),
        location: requirement.location,
        workMode: requirement.workMode,
        maxNoticePeriodDays: requirement.maxNoticePeriodDays,
      }
    );

    const hardGatesPassed = hardGateDetails.passed;

    // 2. Compute Core Skills Score (30% weight)
    const coreReqSkills = requirement.mandatorySkills && requirement.mandatorySkills.length > 0
      ? requirement.mandatorySkills
      : requirement.skills.slice(0, Math.min(requirement.skills.length, 5));

    const coreOverlap = SkillNormalizer.calculateSkillOverlap(candSkills, coreReqSkills);
    const coreSkillsScore = Math.round(coreOverlap.overlapRatio * 100);

    // 3. Compute Secondary Skills Score (15% weight)
    const secReqSkills = requirement.secondarySkills && requirement.secondarySkills.length > 0
      ? requirement.secondarySkills
      : requirement.skills.slice(coreReqSkills.length);

    const secOverlap = SkillNormalizer.calculateSkillOverlap(candSkills, secReqSkills);
    const secondarySkillsScore = secReqSkills.length > 0
      ? Math.round(secOverlap.overlapRatio * 100)
      : (coreSkillsScore >= 80 ? 90 : 75);

    // 4. Compute Experience Score (20% weight)
    const minExpReq = typeof requirement.minExperience === "string"
      ? parseInt(requirement.minExperience, 10) || 0
      : (requirement.minExperience || (typeof requirement.experience === "string" ? parseInt(requirement.experience, 10) || 0 : requirement.experience || 0));

    let experienceScore = 80;
    if (minExpReq > 0) {
      if (candExp >= minExpReq) {
        // Full score, slight bonus for ideal experience band
        const diff = candExp - minExpReq;
        experienceScore = diff <= 4 ? 100 : Math.max(80, 100 - (diff - 4) * 5);
      } else {
        const gap = minExpReq - candExp;
        experienceScore = Math.max(20, Math.round(100 - (gap / minExpReq) * 80));
      }
    }

    // 5. Compute Domain Score (10% weight)
    let domainScore = 85;
    if (requirement.domain) {
      const domLower = requirement.domain.toLowerCase();
      const hasDomain = (candidate as any).resumeText 
        ? (candidate as any).resumeText.toLowerCase().includes(domLower)
        : candSkills.some(s => s.toLowerCase().includes(domLower));
      domainScore = hasDomain ? 100 : 70;
    }

    // 6. Compute Location Score (10% weight)
    let locationScore = 85;
    const reqLoc = (requirement.location || "").toLowerCase();
    const cLoc = candLoc.toLowerCase();
    const isRemote = (requirement.workMode || "").toLowerCase().includes("remote") || reqLoc.includes("remote");

    if (isRemote || cLoc.includes("remote") || cLoc.includes("flexible")) {
      locationScore = 100;
    } else if (reqLoc && (cLoc.includes(reqLoc) || reqLoc.includes(cLoc))) {
      locationScore = 100;
    } else if (reqLoc && cLoc.includes("india") && reqLoc.includes("india")) {
      locationScore = 80;
    } else {
      locationScore = 65;
    }

    // 7. Notice Period Score (5% weight)
    let noticePeriodScore = 90;
    if (/immediate/i.test(candNotice)) noticePeriodScore = 100;
    else if (/15\s*days/i.test(candNotice)) noticePeriodScore = 95;
    else if (/30\s*days/i.test(candNotice)) noticePeriodScore = 85;
    else if (/60\s*days/i.test(candNotice)) noticePeriodScore = 70;
    else if (/90\s*days/i.test(candNotice)) noticePeriodScore = 55;

    // 8. Education & Other Scores (5% + 5% = 10% weight)
    const educationScore = (candidate.education && candidate.education.length > 0) ? 95 : 80;
    const otherScore = 90;

    // 9. Total Weighted Score (0-100)
    const rawTotal = (
      experienceScore * 0.20 +
      coreSkillsScore * 0.30 +
      secondarySkillsScore * 0.15 +
      domainScore * 0.10 +
      locationScore * 0.10 +
      noticePeriodScore * 0.05 +
      educationScore * 0.05 +
      otherScore * 0.05
    );

    let totalScore = Math.round(rawTotal);

    // 10. Fitment Matrix Rows
    const matrix: FitmentMatrixRow[] = [];

    // Experience Matrix Row
    matrix.push({
      requirement: `Experience: ${minExpReq > 0 ? `${minExpReq}+ years` : "Open"}`,
      resumeEvidence: `${candExp} years total experience`,
      result: experienceScore >= 80 ? "STRONG" : experienceScore >= 60 ? "VALIDATE" : "GAP",
      category: "EXPERIENCE",
      weight: 0.20,
      scoreContribution: Math.round(experienceScore * 0.20),
    });

    // Core Skills Matrix Rows
    for (const coreSkill of coreReqSkills) {
      const isMatched = coreOverlap.matched.includes(coreSkill);
      matrix.push({
        requirement: `Core Skill: ${coreSkill}`,
        resumeEvidence: isMatched ? `Demonstrated proficiency in ${coreSkill}` : `Skill not explicitly listed`,
        result: isMatched ? "STRONG" : "GAP",
        category: "CORE_SKILL",
        weight: 0.30 / Math.max(1, coreReqSkills.length),
        scoreContribution: isMatched ? Math.round((0.30 / Math.max(1, coreReqSkills.length)) * 100) : 0,
      });
    }

    // Secondary Skills Matrix Row
    if (secReqSkills.length > 0) {
      matrix.push({
        requirement: `Secondary Skills: ${secReqSkills.join(", ")}`,
        resumeEvidence: `Matched ${secOverlap.matched.length}/${secReqSkills.length} skills (${secOverlap.matched.join(", ") || "None"})`,
        result: secOverlap.overlapRatio >= 0.6 ? "STRONG" : secOverlap.overlapRatio >= 0.3 ? "VALIDATE" : "GAP",
        category: "SECONDARY_SKILL",
        weight: 0.15,
        scoreContribution: Math.round(secondarySkillsScore * 0.15),
      });
    }

    // Location & Work Mode Row
    matrix.push({
      requirement: `Location / Mode: ${requirement.location || "Flexible"} (${requirement.workMode || "Hybrid/Onsite"})`,
      resumeEvidence: `Candidate location: ${candLoc}`,
      result: locationScore >= 85 ? "STRONG" : locationScore >= 70 ? "VALIDATE" : "GAP",
      category: "LOCATION",
      weight: 0.10,
      scoreContribution: Math.round(locationScore * 0.10),
    });

    // Notice Period Row
    matrix.push({
      requirement: `Notice Period: ${requirement.maxNoticePeriodDays ? `<= ${requirement.maxNoticePeriodDays} days` : "Standard"}`,
      resumeEvidence: `Availability: ${candNotice}`,
      result: noticePeriodScore >= 80 ? "STRONG" : "VALIDATE",
      category: "NOTICE_PERIOD",
      weight: 0.05,
      scoreContribution: Math.round(noticePeriodScore * 0.05),
    });

    // 11. Determine Fitment Tier
    let tier: FitmentTier = "GAP";
    if (!hardGatesPassed) {
      tier = "HARD_GATE_FAIL";
      totalScore = Math.min(48, totalScore);
    } else if (totalScore >= 90) {
      tier = "PRIMARY";
    } else if (totalScore >= 75) {
      tier = "PRIMARY/BACKUP";
    } else if (totalScore >= 60) {
      tier = "BACKUP";
    } else if (totalScore >= 40) {
      tier = "HOLD";
    } else {
      tier = "GAP";
    }

    // 12. Strengths and Gaps
    const strengths: string[] = [];
    const gaps: string[] = [];

    if (coreOverlap.matched.length > 0) {
      strengths.push(`Strong alignment on core technologies: ${coreOverlap.matched.slice(0, 4).join(", ")}`);
    }
    if (candExp >= minExpReq) {
      strengths.push(`Meets experience threshold (${candExp} yrs vs ${minExpReq} yrs required)`);
    }
    if (locationScore >= 90) {
      strengths.push(`Location is fully compatible (${candLoc})`);
    }

    if (coreOverlap.missing.length > 0) {
      gaps.push(`Missing core skills: ${coreOverlap.missing.join(", ")}`);
    }
    if (candExp < minExpReq) {
      gaps.push(`Experience is below stated minimum (${candExp} yrs vs ${minExpReq} yrs)`);
    }
    if (!hardGatesPassed) {
      gaps.push(...hardGateDetails.reasons);
    }

    const recommendation: "STRONG_FIT" | "CONSIDER" | "BACKUP" | "NOT_SUITABLE" = 
      tier === "PRIMARY" ? "STRONG_FIT" :
      tier === "PRIMARY/BACKUP" ? "CONSIDER" :
      tier === "BACKUP" ? "BACKUP" : "NOT_SUITABLE";

    const nextAction = tier === "PRIMARY" 
      ? "Directly forward for Client Shortlist & Technical Round 1" 
      : tier === "PRIMARY/BACKUP" 
      ? "Queue for Recruiter Quick Screen & Skill Validation"
      : tier === "BACKUP"
      ? "Retain in Talent Pool as Qualified Backup"
      : "Archive submission or match to alternate requirements";

    const evidenceSummary = `Candidate scored ${totalScore}% with ${coreOverlap.matched.length}/${coreReqSkills.length} core skills matched (${tier} tier). ${strengths[0] || ""}`;

    const breakdown: FitmentScoreBreakdown = {
      experienceScore,
      coreSkillsScore,
      secondarySkillsScore,
      domainScore,
      locationScore,
      noticePeriodScore,
      educationScore,
      otherScore,
      totalScore,
    };

    return {
      candidateId,
      requirementId,
      fitmentScore: totalScore,
      tier,
      hardGatesPassed,
      hardGateDetails,
      breakdown,
      matrix,
      skillsMatched: Array.from(new Set([...coreOverlap.matched, ...secOverlap.matched])),
      skillsMissing: Array.from(new Set([...coreOverlap.missing, ...secOverlap.missing])),
      evidenceSummary,
      explanation: {
        strengths,
        gaps,
        recommendation,
        nextAction,
      },
      calculatedAt: new Date().toISOString(),
      engineVersion: this.ENGINE_VERSION,
    };
  }
}
