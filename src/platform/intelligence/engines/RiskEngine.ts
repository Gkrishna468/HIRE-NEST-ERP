import { RequirementEvaluationResult, ConfidenceScore } from '../models/HIEModels';

export interface RiskEngine {
  evaluateRequirementRisk(requirementId: string): Promise<RequirementEvaluationResult>;
  evaluateCandidateDropRisk(candidateId: string): Promise<ConfidenceScore>;
  evaluateVendorRisk(vendorId: string): Promise<ConfidenceScore>;
  evaluateClientAttritionRisk(clientId: string): Promise<ConfidenceScore>;
}
