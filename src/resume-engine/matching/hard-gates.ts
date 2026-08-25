/**
 * HireNestOS Deterministic Hard Gates Evaluator
 * Verifies non-negotiable job constraints without AI.
 */

import { HardGateEvaluation } from "../types.js";
import { SkillNormalizer } from "./skill-normalizer.js";

export interface HardGateInputCandidate {
  totalExperience?: number;
  skills: string[];
  location?: string;
  noticePeriod?: string;
  employmentType?: string;
}

export interface HardGateInputRequirement {
  minExperience?: number | string;
  mandatorySkills?: string[];
  location?: string;
  workMode?: string;
  maxNoticePeriodDays?: number;
  employmentType?: string;
}

export class HardGateEvaluator {
  public static evaluate(
    candidate: HardGateInputCandidate,
    requirement: HardGateInputRequirement
  ): HardGateEvaluation {
    const failedGates: string[] = [];
    const reasons: string[] = [];

    // 1. Minimum Experience Gate
    const minExpReq = typeof requirement.minExperience === "string" 
      ? parseInt(requirement.minExperience, 10) || 0 
      : (requirement.minExperience || 0);

    const candExp = candidate.totalExperience || 0;

    // Tolerance: Allow up to 1.5 years below if minExpReq is high, otherwise strict
    if (minExpReq > 0 && candExp < (minExpReq > 5 ? minExpReq - 1.5 : minExpReq - 0.5)) {
      failedGates.push("EXPERIENCE_GATE");
      reasons.push(`Minimum experience required is ${minExpReq} years, but candidate has ${candExp} years.`);
    }

    // 2. Mandatory Skills Gate
    if (requirement.mandatorySkills && requirement.mandatorySkills.length > 0) {
      const { missing } = SkillNormalizer.calculateSkillOverlap(
        candidate.skills,
        requirement.mandatorySkills
      );

      // If missing more than 1 mandatory core skill -> Hard Gate Failure
      if (missing.length > 1 || (requirement.mandatorySkills.length === 1 && missing.length === 1)) {
        failedGates.push("MANDATORY_SKILLS_GATE");
        reasons.push(`Missing mandatory core skills: ${missing.join(", ")}`);
      }
    }

    // 3. Notice Period Gate
    if (requirement.maxNoticePeriodDays && requirement.maxNoticePeriodDays > 0) {
      const noticeStr = candidate.noticePeriod || "30 Days";
      let candDays = 30;
      if (/immediate/i.test(noticeStr)) candDays = 0;
      else {
        const match = noticeStr.match(/(\d+)/);
        if (match) candDays = parseInt(match[1], 10);
      }

      if (candDays > requirement.maxNoticePeriodDays + 15) {
        failedGates.push("NOTICE_PERIOD_GATE");
        reasons.push(`Candidate notice period (${candDays} days) exceeds maximum allowed (${requirement.maxNoticePeriodDays} days).`);
      }
    }

    return {
      passed: failedGates.length === 0,
      failedGates,
      reasons,
    };
  }
}
