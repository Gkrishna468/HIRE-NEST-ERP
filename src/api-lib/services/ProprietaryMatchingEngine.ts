import { db } from '../../lib/firebase-admin.js';
import { AIRuntime } from './AIRuntime.js';

export interface MatchResult {
  candidateId: string;
  requirementId: string;
  compositeScore: number;
  deterministicScore: number;
  semanticScore: number;
  businessScore: number;
  tier: "STRONG_MATCH" | "GOOD_MATCH" | "PARTIAL_MATCH" | "WEAK_MATCH";
  reasoning: string;
  suggestedAction: string;
  matchedSkills?: string[];
  missingMandatorySkills?: string[];
  missingPreferredSkills?: string[];
  experienceGaps?: string[];
  riskFlags?: string[];
  aiScreeningStatus?: "COMPLETED" | "AI_SCREENING_UNAVAILABLE" | "PENDING_RE-SCORE";
}

export class ProprietaryMatchingEngine {
  
  /**
   * Primary entry point for matching a candidate against a requirement.
   */
  static async calculateMatch(candidateId: string, requirementId: string, orgId: string): Promise<MatchResult> {
    if (!db) throw new Error("Database not initialized");

    const [candDoc, reqDoc] = await Promise.all([
      db.collection('candidatePool').doc(candidateId).get(),
      db.collection('requirements_public').doc(requirementId).get()
    ]);

    if (!candDoc.exists || !reqDoc.exists) {
      throw new Error("Candidate or Requirement not found");
    }

    const candidate = candDoc.data() || {};
    const requirement = reqDoc.data() || {};

    // 1. Layer 1: Deterministic Scoring (Binary & Weighted)
    const detScore = this.calculateDeterministicScore(candidate, requirement);

    // 2. Layer 2: Semantic Scoring (AI-powered alignment)
    const semScoreResult = await this.calculateSemanticScore(candidate, requirement);
    
    let semScore = -1;
    let aiScreeningStatus: "COMPLETED" | "AI_SCREENING_UNAVAILABLE" | "PENDING_RE-SCORE" = "COMPLETED";
    let reasoning = "";

    if (semScoreResult && typeof semScoreResult.score === 'number' && !isNaN(semScoreResult.score) && semScoreResult.score >= 0) {
      semScore = semScoreResult.score;
      reasoning = semScoreResult.reasoning || "Evaluated via 3-Layer Matching Engine with Hard Gates";
    } else {
      aiScreeningStatus = "AI_SCREENING_UNAVAILABLE";
      reasoning = "AI_SCREENING_UNAVAILABLE / PENDING_RE-SCORE: The AI semantic screening service is currently unavailable or returned an invalid result.";
    }

    // 3. Layer 3: Business Rule Scoring (Contextual parameters)
    const bizScore = await this.calculateBusinessScore(candidate, requirement, orgId);

    // Hard Gate Evaluation: Mandatory Skills & Experience Gaps
    const mustHaveSkills: string[] = requirement.mustHaveSkills || requirement.mandatorySkills || [];
    const goodToHaveSkills: string[] = requirement.goodToHaveSkills || requirement.preferredSkills || [];
    const candSkillsLower = (candidate.skills || []).map((s: string) => s.toLowerCase());

    const matchedSkills = (requirement.skills || mustHaveSkills).filter((s: string) => candSkillsLower.includes(s.toLowerCase()));
    const missingMandatorySkills = mustHaveSkills.filter((s: string) => !candSkillsLower.includes(s.toLowerCase()));
    const missingPreferredSkills = goodToHaveSkills.filter((s: string) => !candSkillsLower.includes(s.toLowerCase()));

    const reqExp = requirement.experienceYears || requirement.minExp || 0;
    const candExp = candidate.experienceYears || candidate.totalExperienceYears || 0;
    const experienceGaps: string[] = [];
    if (reqExp > 0 && candExp < reqExp) {
      experienceGaps.push(`Requires ${reqExp} yrs, candidate has ${candExp} yrs`);
    }

    const riskFlags: string[] = [];
    if (missingMandatorySkills.length > 0) {
      riskFlags.push(`Missing mandatory skills: ${missingMandatorySkills.join(', ')}`);
    }

    // 4. Layer 4: Composite Calculation (Proprietary weighting)
    let compositeScore = 0;
    if (aiScreeningStatus === "AI_SCREENING_UNAVAILABLE") {
      // Scale available signals: 2/3 deterministic (scaled 40%), 1/3 business (scaled 20%)
      compositeScore = Math.round((detScore * 0.67) + (bizScore * 0.33));
    } else {
      // Standard Weighting: 40% Semantic, 40% Deterministic, 20% Business
      compositeScore = Math.round((semScore * 0.4) + (detScore * 0.4) + (bizScore * 0.2));
    }

    // HARD GATE: Missing mandatory skills block STRONG_MATCH (capped to max 69)
    if (missingMandatorySkills.length > 0) {
      compositeScore = Math.min(69, compositeScore);
    }

    let tier: "STRONG_MATCH" | "GOOD_MATCH" | "PARTIAL_MATCH" | "WEAK_MATCH" = "WEAK_MATCH";
    if (compositeScore >= 85) tier = "STRONG_MATCH";
    else if (compositeScore >= 70) tier = "GOOD_MATCH";
    else if (compositeScore >= 50) tier = "PARTIAL_MATCH";

    return {
      candidateId,
      requirementId,
      compositeScore,
      deterministicScore: detScore,
      semanticScore: semScore,
      businessScore: bizScore,
      tier,
      reasoning,
      suggestedAction: compositeScore >= 85 ? "SUBMIT_IMMEDIATELY" : compositeScore >= 70 ? "RECRUITER_REVIEW" : "AUTO_ARCHIVE",
      matchedSkills,
      missingMandatorySkills,
      missingPreferredSkills,
      experienceGaps,
      riskFlags,
      aiScreeningStatus
    };
  }

  private static calculateDeterministicScore(candidate: any, requirement: any): number {
    let score = 0;
    
    // Skills match (30%)
    const reqSkills = (requirement.skills || []).map((s: string) => s.toLowerCase());
    const candSkills = (candidate.skills || []).map((s: string) => s.toLowerCase());
    if (reqSkills.length > 0) {
      const matchCount = reqSkills.filter((s: string) => candSkills.includes(s)).length;
      const skillScore = (matchCount / reqSkills.length) * 100;
      score += skillScore * 0.3;
    } else {
      score += 30; // Neutral if no skills listed
    }

    // Experience match (30%)
    const reqExp = requirement.experienceYears || requirement.minExp || 0;
    const candExp = candidate.experienceYears || 0;
    if (candExp >= reqExp) {
      score += 30;
    } else if (candExp >= reqExp * 0.7) {
      score += 15;
    }

    // Location/Model match (20%)
    if (requirement.workModel === 'remote' || candidate.location === requirement.location) {
      score += 20;
    } else if (candidate.isRelocatable) {
      score += 10;
    }

    // Budget match (20%)
    const candExpected = candidate.expectedCtc || 0;
    const reqBudget = requirement.budget?.amount || requirement.clientTargetBudget || 0;
    if (reqBudget > 0) {
        if (candExpected <= reqBudget) {
            score += 20;
        } else if (candExpected <= reqBudget * 1.15) {
            score += 10;
        }
    } else {
        score += 20;
    }

    return Math.round(score);
  }

  private static async calculateSemanticScore(candidate: any, requirement: any) {
    const prompt = `
      Perform a technical semantic match between this candidate and job requirement.
      Candidate:
      - Skills: ${candidate.skills?.join(', ')}
      - Summary: ${candidate.summary}
      
      Requirement:
      - Title: ${requirement.title}
      - Skills: ${requirement.skills?.join(', ')}
      - JD: ${requirement.jdFullProfile || requirement.description}

      Respond with a JSON object:
      {
        "score": number (0-100),
        "reasoning": "Brief explanation of alignment",
        "missingCriticalSkills": ["string"]
      }
    `;

    const response = await AIRuntime.analyze({
      prompt,
      modelPreference: 'fast',
      schema: true
    });

    if (response.outcome === 'failed' || !response.data || typeof response.data.score !== 'number') {
      return null;
    }

    return response.data;
  }

  private static async calculateBusinessScore(candidate: any, requirement: any, orgId: string): Promise<number> {
    let score = 50; // Default baseline

    // Vendor Trust Bonus
    if (candidate.vendorId) {
       const vendorDoc = await db.collection('organizations').doc(candidate.vendorId).get();
       if (vendorDoc.exists) {
          const vData = vendorDoc.data();
          if (vData?.trustScore) score += (vData.trustScore - 50) * 0.4;
       }
    }

    // Client Priority Bonus
    if (requirement.priority === 'HIGH') score += 20;
    if (requirement.priority === 'URGENT') score += 30;

    // Recruiter Capacity Penalty (if many matches pending)
    // ... logic for capacity ...

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * Health Score calculation for a Requirement.
   */
  static async calculateRequirementHealth(requirementId: string): Promise<number> {
    const matchesSnap = await db.collection('candidate_matches')
      .where('requirementId', '==', requirementId)
      .where('matchScore', '>=', 80)
      .get();
    
    const highQualityMatches = matchesSnap.size;
    
    // Health Index = (Matches count / Ideal count) * Weight + (Vendor Coverage) * Weight
    // Ideal: 10 high quality matches
    let health = Math.min(100, (highQualityMatches / 10) * 80);
    
    // Add coverage bonus
    const coverage = 12; // Should be dynamic
    health += (coverage / 15) * 20;

    return Math.round(Math.min(100, health));
  }
}
