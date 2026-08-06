import { NextBestActionResult } from '../models/HIEModels';

export interface DecisionEngine {
  evaluateNextAction(triggerEventType: string, eventPayload: Record<string, any>): Promise<NextBestActionResult | null>;
  executeDecisionRule(ruleId: string, context: Record<string, any>): Promise<{ executed: boolean; actionsTaken: string[]; details: Record<string, any> }>;
}
