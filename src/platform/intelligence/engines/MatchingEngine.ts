import { CandidateEvaluationResult, ConfidenceScore } from '../models/HIEModels';

export interface MatchingEngine {
  evaluateCandidateMatch(candidateId: string, requirementId: string): Promise<CandidateEvaluationResult>;
  calculateSkillSimilarity(candidateSkills: string[], requiredSkills: string[]): ConfidenceScore;
  calculateDomainMatch(candidateDomain: string, requirementDomain: string): ConfidenceScore;
}
