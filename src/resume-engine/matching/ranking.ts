/**
 * HireNestOS Deterministic Candidate Ranking & Eligibility Service
 */

import { FitmentResult, CandidateProfile } from "../types.js";
import { FitmentEngine, RequirementProfile } from "./fitment-engine.js";

export interface RankedCandidate {
  rank: number;
  candidate: CandidateProfile | any;
  fitment: FitmentResult;
  isEligibleForDirectSubmission: boolean;
  routingQueue: "PRIORITY_QUEUE" | "AI_VALIDATION_QUEUE" | "BACKUP_POOL" | "GAP_ARCHIVE";
}

export class CandidateRankingService {
  /**
   * Ranks candidates deterministically against a requirement.
   */
  public static rankCandidates(
    candidates: (CandidateProfile | any)[],
    requirement: RequirementProfile
  ): RankedCandidate[] {
    const scoredList = candidates.map(candidate => {
      const fitment = FitmentEngine.evaluate(candidate, requirement);
      return {
        candidate,
        fitment,
      };
    });

    // Sort deterministically:
    // 1. Hard gates passed first
    // 2. Fitment score descending
    // 3. Experience descending
    // 4. Core skill match count descending
    scoredList.sort((a, b) => {
      if (a.fitment.hardGatesPassed !== b.fitment.hardGatesPassed) {
        return a.fitment.hardGatesPassed ? -1 : 1;
      }
      if (b.fitment.fitmentScore !== a.fitment.fitmentScore) {
        return b.fitment.fitmentScore - a.fitment.fitmentScore;
      }
      const expA = a.candidate.totalExperience || 0;
      const expB = b.candidate.totalExperience || 0;
      return expB - expA;
    });

    return scoredList.map((item, idx) => {
      const tier = item.fitment.tier;
      let routingQueue: "PRIORITY_QUEUE" | "AI_VALIDATION_QUEUE" | "BACKUP_POOL" | "GAP_ARCHIVE" = "GAP_ARCHIVE";
      let isEligible = false;

      if (tier === "PRIMARY") {
        routingQueue = "PRIORITY_QUEUE";
        isEligible = true;
      } else if (tier === "PRIMARY/BACKUP") {
        routingQueue = "AI_VALIDATION_QUEUE";
        isEligible = true;
      } else if (tier === "BACKUP") {
        routingQueue = "BACKUP_POOL";
        isEligible = false;
      } else {
        routingQueue = "GAP_ARCHIVE";
        isEligible = false;
      }

      return {
        rank: idx + 1,
        candidate: item.candidate,
        fitment: item.fitment,
        isEligibleForDirectSubmission: isEligible,
        routingQueue,
      };
    });
  }
}
