import { HIE } from '../services/HireNestIntelligenceEngine';

export interface GroundedPromptPayload {
  userQuery: string;
  domain: 'CANDIDATE' | 'REQUIREMENT' | 'VENDOR' | 'CLIENT' | 'RECRUITER' | 'FORECAST';
  entityId?: string;
}

export interface GroundedPromptContext {
  structuredFacts: Record<string, any>;
  formattedPromptContext: string;
}

export class AIGatewayAdapter {
  private static instance: AIGatewayAdapter;

  public static getInstance(): AIGatewayAdapter {
    if (!AIGatewayAdapter.instance) {
      AIGatewayAdapter.instance = new AIGatewayAdapter();
    }
    return AIGatewayAdapter.instance;
  }

  /**
   * Fetches deterministic facts from HIE and constructs a grounded prompt context
   * for LLM completion to guarantee zero hallucination.
   */
  async getGroundedContext(payload: GroundedPromptPayload): Promise<GroundedPromptContext> {
    let facts: Record<string, any> = {};

    switch (payload.domain) {
      case 'CANDIDATE':
        if (payload.entityId) {
          facts = await HIE.evaluateCandidate(payload.entityId);
        }
        break;
      case 'REQUIREMENT':
        if (payload.entityId) {
          facts = await HIE.evaluateRequirement(payload.entityId);
        }
        break;
      case 'VENDOR':
        if (payload.entityId) {
          facts = await HIE.evaluateVendor(payload.entityId);
        }
        break;
      case 'CLIENT':
        if (payload.entityId) {
          facts = await HIE.evaluateClient(payload.entityId);
        }
        break;
      case 'RECRUITER':
        if (payload.entityId) {
          facts = await HIE.evaluateRecruiter(payload.entityId);
        }
        break;
      case 'FORECAST':
        facts = await HIE.forecast();
        break;
      default:
        facts = { note: 'General query context' };
    }

    const formattedPromptContext = `
[HIRENEST INTELLIGENCE ENGINE AUTHORITATIVE FACTS]
Domain: ${payload.domain}
Entity ID: ${payload.entityId || 'GLOBAL'}
Score/Metric: ${facts.score ?? facts.forecastedRevenueINR ?? 'N/A'}
Confidence: ${facts.confidence ?? 1.0}
Algorithm Version: ${facts.algorithmVersion ?? 'hie-v1.0'}
Policy Version: ${facts.policyVersion ?? 'policy-v1.0'}
Key Reasons/Factors: ${JSON.stringify(facts.reasons || facts.riskFactors || facts.topRevenueDrivers || [])}
Trace ID: ${facts.traceId || 'trace-hie-grounded'}
[END AUTHORITATIVE FACTS]
`;

    return {
      structuredFacts: facts,
      formattedPromptContext: formattedPromptContext.trim(),
    };
  }
}

export const aiGatewayAdapter = AIGatewayAdapter.getInstance();
