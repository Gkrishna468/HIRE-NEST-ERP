import {
  CandidateEvaluationResult,
  RequirementEvaluationResult,
  SubmissionEvaluationResult,
  VendorEvaluationResult,
  RecruiterEvaluationResult,
  ClientEvaluationResult,
  ForecastResult,
  RecommendationResult,
  NextBestActionResult
} from '../models/HIEModels';

/**
 * HireNest Intelligence Engine (HIE) Main Service Interface
 * Defines the unified domain intelligence API contract.
 */
export interface IntelligenceEngine {
  evaluateCandidate(candidateId: string, requirementId?: string): Promise<CandidateEvaluationResult>;
  evaluateRequirement(requirementId: string): Promise<RequirementEvaluationResult>;
  evaluateSubmission(submissionId: string): Promise<SubmissionEvaluationResult>;
  evaluateVendor(vendorId: string): Promise<VendorEvaluationResult>;
  evaluateRecruiter(recruiterId: string): Promise<RecruiterEvaluationResult>;
  evaluateClient(clientId: string): Promise<ClientEvaluationResult>;
  forecast(timeframe?: '30_DAYS' | '60_DAYS' | '90_DAYS' | 'QUARTER'): Promise<ForecastResult>;
  recommend(domain: 'CANDIDATE' | 'REQUIREMENT' | 'VENDOR' | 'CLIENT' | 'RECRUITER', targetId: string): Promise<RecommendationResult[]>;
  nextBestAction(domain: string, entityId: string): Promise<NextBestActionResult>;
}
