import { AIGateway } from "../../services/AIGateway.js";

export interface ModelRequest {
  prompt: string;
  modelAlias?: "flash" | "pro";
  temperature?: number;
  systemInstruction?: string;
  schema?: any;
  compressContext?: boolean; // Uses Headroom if true
}

export interface ModelResponse {
  text: string;
  tokensUsed: number;
  model: string;
  estimatedCost: number;
  tokensSaved?: number; // Headroom metrics
}

export class ModelGateway {
  /**
   * Centralized gateway for AI models.
   * All requests route through the unified AIGateway.
   */
  static async generate(request: ModelRequest): Promise<ModelResponse> {
    const modelName = request.modelAlias === "pro" ? "gemini-2.5-pro" : "gemini-2.5-flash";

    const gatewayRes = await AIGateway.processChat({
        prompt: request.prompt,
        feature: "general",
        model: modelName,
        temperature: request.temperature,
        systemInstruction: request.systemInstruction,
        schema: request.schema,
        compressContext: request.compressContext,
        skipCache: true // Offices typically manage their own execution layers
    });

    return {
        text: gatewayRes.response,
        tokensUsed: gatewayRes.tokens,
        model: gatewayRes.model,
        estimatedCost: gatewayRes.estimatedCost || 0,
        tokensSaved: gatewayRes.tokensSaved || 0
    };
  }
}
