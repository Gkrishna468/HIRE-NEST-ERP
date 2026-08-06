import { ForecastResult, SubmissionEvaluationResult } from '../models/HIEModels';

export interface ForecastEngine {
  forecastRevenue(timeframe: '30_DAYS' | '60_DAYS' | '90_DAYS' | 'QUARTER'): Promise<ForecastResult>;
  evaluateSubmissionProbabilities(submissionId: string): Promise<SubmissionEvaluationResult>;
}
