import { AIGateway, AICapability } from "./AIGateway.js";

export type { AICapability };

export interface AIRuntimeRequest {
    prompt: string;
    capability?: AICapability;
    schema?: any;
    modelPreference?: "fast" | "accurate" | "large_context";
    cacheKeyStr?: string;
    imageParts?: Array<{ inlineData: { data: string; mimeType: string } }>;
    fallbackRuleEngine?: (text: string) => any;
    compressContext?: boolean;
}

export interface AIRuntimeResponse {
    provider: string;
    model: string;
    confidence: number;
    data: any;
    latency: number;
    cacheHit: boolean;
    outcome: "success" | "failed";
    retryCount: number;
    tokensSaved?: number;
    compressionRatio?: number;
    originalTokens?: number;
    errorMessage?: string;
    // True when this response came from AIGateway's deterministic rule-engine
    // fallback (e.g. the model tier requested via modelPreference is
    // disabled, or the live model call failed and a fallbackRuleEngine ran
    // instead) rather than a real model call. `outcome` alone can't signal
    // this — it stays "success" either way so existing callers that just
    // check `outcome === "success"` keep working — but callers that care
    // about response quality (e.g. anything shown to a human as an
    // AI-generated analysis) should check this before treating the response
    // as a real model output.
    degraded?: boolean;
}

export class AIRuntime {
    /**
     * Backward-compatible AIRuntime.analyze method.
     * All calls are proxied through the unified AIGateway.
     */
    static async analyze(request: AIRuntimeRequest): Promise<AIRuntimeResponse> {
        const startTime = Date.now();
        try {
            let preferredModel = "gemini-3.7-flash";
            if (request.modelPreference === "accurate" || request.modelPreference === "large_context") {
                preferredModel = "gemini-3.1-pro-preview";
            }

            const gatewayRes = await AIGateway.processChat({
                prompt: request.prompt,
                feature: request.capability || "general",
                skipCache: !request.cacheKeyStr,
                model: preferredModel,
                schema: request.schema,
                compressContext: request.compressContext,
                imageParts: request.imageParts,
                fallbackRuleEngine: request.fallbackRuleEngine
            });

            let parsedData;
            const responseText = gatewayRes.response;
            if (request.schema || responseText.trim().startsWith("{")) {
                try {
                    parsedData = JSON.parse(responseText);
                } catch (e) {
                    const jsonMatch = responseText.match(/```json([\s\S]*?)```/);
                    if (jsonMatch) {
                        try {
                            parsedData = JSON.parse(jsonMatch[1]);
                        } catch (innerErr) {
                            parsedData = { text: responseText };
                        }
                    } else {
                        parsedData = { text: responseText };
                    }
                }
            } else {
                parsedData = { text: responseText };
            }

            return {
                provider: gatewayRes.provider,
                model: gatewayRes.model,
                // NOTE: this used to be `parsedData?.confidence || 95`, which
                // silently replaced an explicit confidence of 0 (e.g. the
                // fallback executive_summary response, which sets
                // confidence: 0 specifically to signal "don't trust this")
                // with a falsely-reassuring 95, since 0 is falsy in JS.
                confidence: parsedData?.confidence ?? 95,
                data: parsedData,
                latency: Date.now() - startTime,
                cacheHit: gatewayRes.cached,
                outcome: "success",
                retryCount: 0,
                tokensSaved: gatewayRes.tokensSaved || 0,
                compressionRatio: gatewayRes.compressionRatio || 1.0,
                originalTokens: gatewayRes.originalTokens || 0,
                degraded: gatewayRes.provider === "RuleEngine",
            };
        } catch (error: any) {
            console.error("[AIRuntime] Gateway analysis failed:", error);
            return {
                provider: "None",
                model: "None",
                confidence: 0,
                data: null,
                latency: Date.now() - startTime,
                cacheHit: false,
                outcome: "failed",
                retryCount: 0,
                errorMessage: error?.message || String(error)
            };
        }
    }
}
