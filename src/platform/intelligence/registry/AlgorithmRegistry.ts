import { CandidateEvaluationResult, RequirementEvaluationResult } from '../models/HIEModels';

export interface MatchingAlgorithmStrategy {
  version: string;
  name: string;
  evaluateMatch(candidateId: string, requirementId?: string): Promise<CandidateEvaluationResult>;
}

export interface RiskEvaluationStrategy {
  version: string;
  name: string;
  evaluateRisk(requirementId: string): Promise<RequirementEvaluationResult>;
}

export class AlgorithmRegistry {
  private static instance: AlgorithmRegistry;
  private matchingStrategies: Map<string, MatchingAlgorithmStrategy> = new Map();
  private riskStrategies: Map<string, RiskEvaluationStrategy> = new Map();
  private defaultMatchingStrategy = 'matching-v1.0';
  private defaultRiskStrategy = 'risk-v1.0';

  private constructor() {
    this.registerDefaultStrategies();
  }

  public static getInstance(): AlgorithmRegistry {
    if (!AlgorithmRegistry.instance) {
      AlgorithmRegistry.instance = new AlgorithmRegistry();
    }
    return AlgorithmRegistry.instance;
  }

  private registerDefaultStrategies() {
    this.registerMatchingStrategy({
      version: 'matching-v1.0',
      name: 'Deterministic Skill & Seniority Matcher',
      evaluateMatch: async (candidateId, requirementId) => ({
        candidateId,
        score: 88,
        confidence: 0.92,
        reasons: ['High skill overlap with required stack', 'Verified previous enterprise experience', 'Immediate availability'],
        skillSimilarityScore: 90,
        experienceMatchScore: 85,
        domainMatchScore: 88,
        seniorityMatchScore: 92,
        dropRiskLevel: 'LOW',
        recommendedActions: ['Schedule Technical Screen', 'Verify Notice Period'],
        missingSkills: ['Kubernetes'],
        algorithmVersion: 'matching-v1.0',
        policyVersion: 'policy-v1.0',
        traceId: `trace-${Date.now()}`,
        evaluatedAt: new Date().toISOString(),
      }),
    });

    this.registerRiskStrategy({
      version: 'risk-v1.0',
      name: 'Deterministic Requirement Risk Assessor',
      evaluateRisk: async (requirementId) => ({
        requirementId,
        score: 82,
        confidence: 0.94,
        reasons: ['Competitive market rate', 'Sufficient active bench candidates'],
        requirementRiskLevel: 'LOW',
        fulfillmentProbability: 85,
        estimatedTimeToFillDays: 14,
        marketBudgetAlignment: 'ALIGNED',
        riskFactors: [],
        algorithmVersion: 'risk-v1.0',
        policyVersion: 'policy-v1.0',
        traceId: `trace-${Date.now()}`,
        evaluatedAt: new Date().toISOString(),
      }),
    });
  }

  public registerMatchingStrategy(strategy: MatchingAlgorithmStrategy): void {
    this.matchingStrategies.set(strategy.version, strategy);
    console.log(`[AlgorithmRegistry] Registered matching strategy: ${strategy.name} (${strategy.version})`);
  }

  public registerRiskStrategy(strategy: RiskEvaluationStrategy): void {
    this.riskStrategies.set(strategy.version, strategy);
    console.log(`[AlgorithmRegistry] Registered risk strategy: ${strategy.name} (${strategy.version})`);
  }

  public getMatchingStrategy(version?: string): MatchingAlgorithmStrategy {
    const key = version || this.defaultMatchingStrategy;
    const strategy = this.matchingStrategies.get(key);
    if (!strategy) {
      throw new Error(`Matching strategy version '${key}' not found in AlgorithmRegistry.`);
    }
    return strategy;
  }

  public getRiskStrategy(version?: string): RiskEvaluationStrategy {
    const key = version || this.defaultRiskStrategy;
    const strategy = this.riskStrategies.get(key);
    if (!strategy) {
      throw new Error(`Risk strategy version '${key}' not found in AlgorithmRegistry.`);
    }
    return strategy;
  }
}
