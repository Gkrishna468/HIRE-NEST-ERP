/**
 * HireNestOS Skill Normalizer & Synonym Resolution
 */

import { normalizeSkillName, CONTROLLED_SKILL_TAXONOMY } from "../parser/skills.js";

export class SkillNormalizer {
  public static normalize(skill: string): string {
    return normalizeSkillName(skill);
  }

  public static normalizeList(skills: string[]): string[] {
    if (!skills || !Array.isArray(skills)) return [];
    const normalized = skills
      .map(s => String(s).trim())
      .filter(s => s.length > 0)
      .map(s => this.normalize(s));

    // Deduplicate
    return Array.from(new Set(normalized));
  }

  /**
   * Compares two skills for semantic equality using taxonomy aliases.
   */
  public static areSkillsEquivalent(skillA: string, skillB: string): boolean {
    const normA = this.normalize(skillA).toLowerCase();
    const normB = this.normalize(skillB).toLowerCase();
    if (normA === normB) return true;

    // Check if one contains the other
    if (normA.includes(normB) || normB.includes(normA)) return true;

    return false;
  }

  /**
   * Calculates deterministic overlap between candidate skills and requirement skills.
   */
  public static calculateSkillOverlap(
    candidateSkills: string[],
    requiredSkills: string[]
  ): {
    matched: string[];
    missing: string[];
    overlapRatio: number;
  } {
    const candNorm = this.normalizeList(candidateSkills);
    const reqNorm = this.normalizeList(requiredSkills);

    if (reqNorm.length === 0) {
      return { matched: candNorm, missing: [], overlapRatio: 1.0 };
    }

    const matched: string[] = [];
    const missing: string[] = [];

    for (const reqSkill of reqNorm) {
      const isPresent = candNorm.some(cs => this.areSkillsEquivalent(cs, reqSkill));
      if (isPresent) {
        matched.push(reqSkill);
      } else {
        missing.push(reqSkill);
      }
    }

    const overlapRatio = matched.length / reqNorm.length;
    return { matched, missing, overlapRatio };
  }
}
