import { PolicyEvaluationResult } from '../models/HIEModels';

export interface PolicyAdapter {
  evaluateCandidateOwnership(candidateId: string, recruiterId: string): Promise<PolicyEvaluationResult>;
  evaluateVendorOwnership(vendorId: string, requirementId: string): Promise<PolicyEvaluationResult>;
  evaluateSLACompliance(requirementId: string): Promise<PolicyEvaluationResult>;
  evaluateDuplicateSubmission(candidateId: string, requirementId: string): Promise<PolicyEvaluationResult>;
}
