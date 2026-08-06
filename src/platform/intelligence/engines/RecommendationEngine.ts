import { RecommendationResult, NextBestActionResult } from '../models/HIEModels';

export interface RecommendationEngine {
  generateRecommendations(domain: string, entityId: string): Promise<RecommendationResult[]>;
  determineNextBestAction(domain: string, entityId: string): Promise<NextBestActionResult>;
}
