/**
 * HireNest Intelligence Engine (HIE) - Domain Models & Data Contracts
 * Single source of truth for structured intelligence, metrics, risks, and forecasts.
 */

export interface ConfidenceScore {
  score: number; // 0 - 100
  confidence: number; // 0.0 - 1.0
  reasons: string[];
  algorithmVersion?: string;
  policyVersion?: string;
  traceId?: string;
}

export interface CandidateEvaluationResult extends ConfidenceScore {
  candidateId: string;
  skillSimilarityScore: number;
  experienceMatchScore: number;
  domainMatchScore: number;
  seniorityMatchScore: number;
  dropRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendedActions: string[];
  missingSkills: string[];
  evaluatedAt: string;
}

export interface RequirementEvaluationResult extends ConfidenceScore {
  requirementId: string;
  requirementRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  fulfillmentProbability: number; // 0 - 100
  estimatedTimeToFillDays: number;
  marketBudgetAlignment: 'UNDER_BUDGET' | 'ALIGNED' | 'ABOVE_MARKET';
  riskFactors: string[];
  suggestedBudgetAdjustment?: number;
  evaluatedAt: string;
}

export interface SubmissionEvaluationResult extends ConfidenceScore {
  submissionId: string;
  candidateId: string;
  requirementId: string;
  placementProbability: number;
  interviewProbability: number;
  offerProbability: number;
  riskFlags: string[];
  recommendedFollowupDays: number;
  evaluatedAt: string;
}

export interface VendorEvaluationResult extends ConfidenceScore {
  vendorId: string;
  qualityScore: number;
  benchUtilizationRate: number;
  slaComplianceRate: number;
  trustTier: 'GOLD' | 'SILVER' | 'BRONZE' | 'UNDER_REVIEW';
  vendorRiskScore: number;
  recommendedBenchFocus: string[];
  evaluatedAt: string;
}

export interface RecruiterEvaluationResult extends ConfidenceScore {
  recruiterId: string;
  productivityScore: number;
  avgResponseTimeHours: number;
  candidateSubmissionsCount: number;
  placementConversionRate: number;
  efficiencyRating: 'ELITE' | 'HIGH' | 'STANDARD' | 'NEEDS_SUPPORT';
  evaluatedAt: string;
}

export interface ClientEvaluationResult extends ConfidenceScore {
  clientId: string;
  clientHealthScore: number;
  attritionRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  hiringVelocityIndex: number;
  avgTimeForInterviewFeedbackDays: number;
  evaluatedAt: string;
}

export interface ForecastResult {
  timeframe: '30_DAYS' | '60_DAYS' | '90_DAYS' | 'QUARTER';
  forecastedRevenueINR: number;
  expectedPlacementsCount: number;
  pipelineHealthScore: number;
  riskAdjustedRevenueINR: number;
  topRevenueDrivers: string[];
  generatedAt: string;
}

export interface RecommendationResult {
  id: string;
  targetDomain: 'CANDIDATE' | 'REQUIREMENT' | 'VENDOR' | 'CLIENT' | 'RECRUITER';
  targetId: string;
  title: string;
  description: string;
  actionType: 'CALL_VENDOR' | 'FOLLOW_CANDIDATE' | 'REOPEN_REQUIREMENT' | 'INCREASE_BUDGET' | 'ESCALATE_CLIENT' | 'SCHEDULE_INTERVIEW';
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  impactStatement: string;
  createdAt: string;
}

export interface NextBestActionResult {
  actionId: string;
  domain: string;
  entityId: string;
  primaryActionLabel: string;
  actionCode: string;
  reasoning: string[];
  urgencyScore: number; // 0 - 100
  payload?: Record<string, any>;
  evaluatedAt: string;
}

export interface PolicyEvaluationResult {
  policyId: string;
  policyName: string;
  isCompliant: boolean;
  violations: string[];
  overrideRequired: boolean;
  evaluatedAt: string;
}
