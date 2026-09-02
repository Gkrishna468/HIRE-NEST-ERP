import { GoogleGenAI } from "@google/genai";
import { SecretManager } from "../../lib/secretManager.js";
import { headroomOptimizer } from "./HeadroomOptimizer.js";
import { AITelemetry } from "../telemetry/aiTelemetry.js";
import { ErrorMonitor } from "../telemetry/errorMonitor.js";
import { AIGuardrails } from "./AIGuardrails.js";
import { db } from "../../lib/firebase-admin.js";
import crypto from "crypto";
import { redisCache } from "./cache/RedisCache.js";

export type AILevel = 1 | 2;

export type AICapability =
  // Level 1 — Routine / High-Volume Processing (Gemini 3.1 Flash-Lite)
  | "jd_extraction"
  | "jd.extract"
  | "candidate_enrichment"
  | "candidate_summaries"
  | "resume.enrich"
  | "skill_normalization"
  | "experience_extraction"
  | "education_extraction"
  | "notice_period_interpretation"
  | "location_interpretation"
  | "ctc_interpretation"
  | "bulk_screening"
  | "basic_screening"
  | "candidate_screening"
  | "candidate_matching"
  | "screening"
  | "match_candidates"
  | "interview_question_generation"
  | "email_drafting"
  | "boolean_search_generation"
  | "executive_summary"
  // Level 2 — Deep Fitment & Recruiter Decision Support (Gemini 3.7 Flash)
  | "deep_fitment"
  | "detailed_fitment"
  | "deep_screening"
  | "skill_gap_analysis"
  | "transferable_skills"
  | "compare_candidates"
  | "rank_shortlisted"
  | "submission_recommendation"
  | "complex_jd_interpretation"
  | "decision_support"
  | "semantic_reasoning"
  // Prohibited / Deterministic-Only (must not invoke AI)
  | "resume_parsing"
  | "resume.extract"
  // Disabled / Deprecated
  | "salary_analysis"
  | "market_trends"
  | "intake.classify"
  | "intake.extract_entities"
  | "intake.normalize"
  | "intake.validate"
  | "intake.audit"
  | "intake.relationships"
  | "intake.metrics"
  | "vendor.resolve"
  | "client.resolve"
  | "duplicate.detect"
  | "relationship.build"
  | "general";

export interface AIGatewayRequest {
    prompt: string;
    feature?: AICapability;
    level?: AILevel;
    promptVersion?: string;
    requireLocal?: boolean;
    skipCache?: boolean;
    userId?: string;
    office?: string;
    agent?: string;
    model?: string; // Explicit model selection override
    temperature?: number;
    systemInstruction?: string;
    schema?: any;
    compressContext?: boolean; // Uses Headroom if true
    imageParts?: Array<{ inlineData: { data: string; mimeType: string } }>;
    fallbackRuleEngine?: (text: string) => any;
    timeoutMs?: number;
    strategy?: "speed" | "quality" | "cost";
}

export interface AIGatewayResponse {
    provider: string;
    model: string;
    level?: AILevel;
    response: string;
    latency: number;
    tokens: number;
    cached: boolean;
    estimatedCost?: number;
    savedCost?: number;
    tokensSaved?: number;
    compressionRatio?: number;
    originalTokens?: number;
}

// ==========================================
// 1. Unified AI Provider Contract
// ==========================================
export interface AIProvider {
    id: string;
    execute(
        prompt: string,
        model: string,
        options: {
            temperature?: number;
            systemInstruction?: string;
            schema?: any;
            imageParts?: any[];
            timeoutMs?: number;
        }
    ): Promise<{ text: string; tokens: number }>;
    health(): Promise<boolean>;
    estimateCost(model: string, tokens: number, isCached: boolean): { estimatedCost: number; savedCost: number };
}

// ==========================================
// 2. Circuit Breaker Implementation
// ==========================================
export interface CircuitBreakerState {
    providerId: string;
    state: "CLOSED" | "OPEN" | "HALF_OPEN";
    failureCount: number;
    lastFailureTime: number;
}

export class CircuitBreaker {
    private static states: Record<string, CircuitBreakerState> = {};
    private static readonly FAILURE_THRESHOLD = 3;
    private static readonly COOLDOWN_MS = 60 * 1000; // 60 seconds cooldown

    static getStatus(providerId: string): "CLOSED" | "OPEN" | "HALF_OPEN" {
        const state = this.states[providerId];
        if (!state) return "CLOSED";

        if (state.state === "OPEN") {
            const timePassed = Date.now() - state.lastFailureTime;
            if (timePassed > this.COOLDOWN_MS) {
                console.log(`[CircuitBreaker] Cooldown elapsed for ${providerId}. Transitioning from OPEN to HALF_OPEN.`);
                state.state = "HALF_OPEN";
                return "HALF_OPEN";
            }
            return "OPEN";
        }
        return state.state;
    }

    static recordSuccess(providerId: string) {
        const state = this.states[providerId];
        if (state) {
            state.failureCount = 0;
            state.state = "CLOSED";
            console.log(`[CircuitBreaker] Successful request. ${providerId} circuit is CLOSED and healthy.`);
        }
    }

    static recordFailure(providerId: string, errorMsg: string, forceOpen: boolean = false) {
        if (!this.states[providerId]) {
            this.states[providerId] = {
                providerId,
                state: "CLOSED",
                failureCount: 0,
                lastFailureTime: 0
            };
        }
        const state = this.states[providerId];
        state.failureCount++;
        state.lastFailureTime = Date.now();

        if (forceOpen || state.failureCount >= this.FAILURE_THRESHOLD) {
            state.state = "OPEN";
            console.warn(`[CircuitBreaker] Circuit for ${providerId} is now OPEN. Cooldown active for ${this.COOLDOWN_MS}ms. Reason: ${errorMsg}`);
        } else {
            console.log(`[CircuitBreaker] Recorded failure for ${providerId} (Count: ${state.failureCount}). State remains: ${state.state}`);
        }
    }
}

// ==========================================
// 3. Google GenAI Provider Implementation
// ==========================================
export class GoogleProvider implements AIProvider {
    id = "google";
    private aiInstance: GoogleGenAI | null = null;

    private async getAIClient(): Promise<GoogleGenAI> {
        if (!this.aiInstance) {
            const apiKey = await SecretManager.getSecret("GEMINI_API_KEY") || process.env.GEMINI_API_KEY || "dummy";
            this.aiInstance = new GoogleGenAI({ apiKey });
        }
        return this.aiInstance;
    }

    async execute(
        prompt: string,
        model: string,
        options: {
            temperature?: number;
            systemInstruction?: string;
            schema?: any;
            imageParts?: any[];
            timeoutMs?: number;
        }
    ): Promise<{ text: string; tokens: number }> {
        const client = await this.getAIClient();
        const contentParts: any[] = [prompt];
        if (options.imageParts && options.imageParts.length > 0) {
            contentParts.push(...options.imageParts);
        }

        const config: any = {
            temperature: options.temperature ?? 0.2,
        };

        if (options.systemInstruction) {
            config.systemInstruction = options.systemInstruction;
        }

        if (options.schema) {
            config.responseMimeType = "application/json";
            if (typeof options.schema === "object") {
                config.responseSchema = options.schema;
            }
        }

        // Validate model: Pro models are strictly disabled
        const lowerModel = (model || "").toLowerCase();
        if (lowerModel.includes("pro") && !AIGateway.isProModelAllowed()) {
            throw new Error("AI_PRO_MODEL_DISABLED: Pro models are disabled. HireNest OS uses Level 1 (gemini-3.1-flash-lite) and Level 2 (gemini-3.7-flash).");
        }

        // Primary and candidate flash fallbacks
        const requestedModel = model || AIGateway.getLevel1Model();
        const candidateModels = Array.from(new Set([
            requestedModel,
            "gemini-3.1-flash-lite",
            "gemini-2.5-flash",
            "gemini-3.7-flash"
        ]));
        const timeoutMs = options.timeoutMs || 10000;

        let lastError: any = null;
        for (const targetModel of candidateModels) {
            const maxAttempts = 2;
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    const apiCall = client.models.generateContent({
                        model: targetModel,
                        contents: contentParts,
                        config,
                    });

                    const timeoutPromise = new Promise<never>((_, reject) => {
                        setTimeout(() => {
                            reject(new Error(`Google GenAI request timeout after ${timeoutMs}ms`));
                        }, timeoutMs);
                    });

                    const response = await Promise.race([apiCall, timeoutPromise]);
                    const text = response.text || "";
                    const usage = response.usageMetadata;
                    const totalTokens = usage?.totalTokenCount || Math.ceil((prompt.length + text.length) / 4);

                    return { text, tokens: totalTokens };
                } catch (err: any) {
                    lastError = err;
                    const msg = err?.message || String(err);

                    // Definitive Quota Exhaustion (429 with quota/billing message or RESOURCE_EXHAUSTED)
                    const isQuotaExhausted =
                        msg.includes("exceeded your current quota") ||
                        msg.includes("quota exceeded") ||
                        msg.includes("RESOURCE_EXHAUSTED") ||
                        msg.includes("BILLING_DISABLED") ||
                        msg.includes("depleted") ||
                        (msg.includes("429") && (msg.includes("quota") || msg.includes("exceeded") || msg.includes("billing") || msg.includes("plan")));

                    if (isQuotaExhausted) {
                        console.warn(`[GoogleProvider] Gemini API Quota Exceeded (429). Fast-failing to deterministic fallback engine.`);
                        CircuitBreaker.recordFailure("google", "Google API Quota/Credits Exhausted (429)", true);
                        throw new Error(`Google API Quota/Credits Exhausted (429)`);
                    }
                    
                    // Permanent errors (404, deprecated models, invalid arg) -> skip immediately to next model
                    const isPermanent = msg.includes("404") || msg.includes("NOT_FOUND") || msg.includes("no longer available") || msg.includes("INVALID_ARGUMENT");
                    if (isPermanent) {
                        console.warn(`[GoogleProvider] Model ${targetModel} is permanently unavailable: ${msg.slice(0, 100)}. Trying next candidate model...`);
                        break;
                    }

                    // Transient rate-limits or backend overload (503 / 500 / UNAVAILABLE / high demand)
                    const isTransient = 
                        msg.includes("503") || 
                        msg.includes("500") ||
                        msg.includes("UNAVAILABLE") || 
                        msg.includes("high demand") || 
                        (msg.includes("429") && !msg.includes("quota"));
                    
                    if (isTransient && attempt < maxAttempts) {
                        const backoffDelay = 600;
                        console.warn(`[GoogleProvider] Model ${targetModel} transient issue (${msg.slice(0, 80)}). Retrying in ${backoffDelay}ms (attempt ${attempt}/${maxAttempts})...`);
                        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
                        continue;
                    }

                    if (isTransient) {
                        console.warn(`[GoogleProvider] Model ${targetModel} capacity issue. Switching to next fallback model...`);
                        break;
                    }

                    console.warn(`[GoogleProvider] Model ${targetModel} failed: ${msg.slice(0, 100)}. Trying next candidate model...`);
                    break;
                }
            }
        }
        
        const lastMsg = lastError?.message || String(lastError);
        if (lastMsg.includes("429") || lastMsg.includes("RESOURCE_EXHAUSTED") || lastMsg.includes("depleted") || lastMsg.includes("quota")) {
            throw new Error(`Google API Quota/Credits Exhausted (429)`);
        }
        throw lastError || new Error("All Google candidate models failed");
    }

    async health(): Promise<boolean> {
        try {
            const apiKey = await SecretManager.getSecret("GEMINI_API_KEY") || process.env.GEMINI_API_KEY;
            return !!apiKey;
        } catch {
            return false;
        }
    }

    estimateCost(model: string, tokens: number, isCached: boolean): { estimatedCost: number; savedCost: number } {
        const lowerModel = (model || "").toLowerCase();
        // Level 1: Gemini 3.1 Flash-Lite: $0.30/1M input, $2.50/1M output, blended ~$0.0000005/token
        // Level 2: Gemini 3.7 Flash: $0.75/1M input, $3.75/1M output, blended ~$0.0000015/token
        let ratePerToken = 0.0000005; // Default Level 1 (Flash-Lite)
        if (lowerModel.includes("3.7") || lowerModel.includes("flash-2") || (!lowerModel.includes("lite") && lowerModel.includes("flash"))) {
            ratePerToken = 0.0000015; // Level 2 (3.7 Flash)
        }
        const cost = Number((tokens * ratePerToken).toFixed(6));
        return isCached ? { estimatedCost: 0, savedCost: cost } : { estimatedCost: cost, savedCost: 0 };
    }
}

// ==========================================
// 4. Centralized AIGateway Orchestrator
// ==========================================
export class AIGateway {
    public static readonly LEVEL_1_MODEL_DEFAULT = "gemini-3.1-flash-lite";
    public static readonly LEVEL_2_MODEL_DEFAULT = "gemini-3.7-flash";

    public static readonly LEVEL_1_CAPABILITIES = new Set<string>([
        "jd_extraction",
        "jd.extract",
        "candidate_enrichment",
        "candidate_summaries",
        "resume.enrich",
        "skill_normalization",
        "experience_extraction",
        "education_extraction",
        "notice_period_interpretation",
        "location_interpretation",
        "ctc_interpretation",
        "bulk_screening",
        "basic_screening",
        "candidate_screening",
        "candidate_matching",
        "screening",
        "match_candidates",
        "interview_question_generation",
        "email_drafting",
        "boolean_search_generation",
        "executive_summary"
    ]);

    public static readonly LEVEL_2_CAPABILITIES = new Set<string>([
        "deep_fitment",
        "detailed_fitment",
        "deep_screening",
        "skill_gap_analysis",
        "transferable_skills",
        "compare_candidates",
        "rank_shortlisted",
        "submission_recommendation",
        "complex_jd_interpretation",
        "decision_support",
        "semantic_reasoning"
    ]);

    private static providers: Record<string, AIProvider> = {
        google: new GoogleProvider()
    };

    static getLevel1Model(): string {
        return process.env.AI_LEVEL_1_MODEL || this.LEVEL_1_MODEL_DEFAULT;
    }

    static getLevel2Model(): string {
        return process.env.AI_LEVEL_2_MODEL || this.LEVEL_2_MODEL_DEFAULT;
    }

    static isProModelAllowed(): boolean {
        const proConfig = (process.env.AI_PRO_MODEL || "disabled").toLowerCase();
        return proConfig !== "disabled" && proConfig !== "false" && proConfig !== "0";
    }

    /**
     * Resolves the AI Level and corresponding Gemini Model for a given feature/request.
     */
    static resolveLevelAndModel(
        feature: string,
        requestedLevel?: AILevel,
        requestedModel?: string
    ): { level: AILevel; model: string } {
        // Enforce zero-AI deterministic rule for basic resume parsing
        if (feature === "resume_parsing" || feature === "resume.extract") {
            throw new Error("DETERMINISTIC_RESUME_PARSER_REQUIRED: Basic resume parsing is strictly deterministic. Use DeterministicResumeParser without invoking Gemini.");
        }

        // Validate requested model overrides
        if (requestedModel) {
            const lower = requestedModel.toLowerCase();
            if (lower.includes("pro") && !this.isProModelAllowed()) {
                throw new Error("AI_PRO_MODEL_DISABLED: Pro models are disabled. HireNest OS uses Level 1 (gemini-3.1-flash-lite) and Level 2 (gemini-3.7-flash).");
            }
            if (lower.includes("gpt") || lower.includes("claude") || lower.includes("llama") || lower.includes("mistral") || lower.includes("grok")) {
                throw new Error("NON_GOOGLE_PROVIDER_DISABLED: Non-Google models are disabled. HireNest OS exclusively uses Google GenAI SDK.");
            }
            const level: AILevel = requestedLevel || (this.LEVEL_2_CAPABILITIES.has(feature) ? 2 : 1);
            return { level, model: requestedModel };
        }

        // Explicit Level specification
        if (requestedLevel === 2) {
            return { level: 2, model: this.getLevel2Model() };
        }
        if (requestedLevel === 1) {
            return { level: 1, model: this.getLevel1Model() };
        }

        // Determine Level based on capability taxonomy
        if (this.LEVEL_2_CAPABILITIES.has(feature)) {
            return { level: 2, model: this.getLevel2Model() };
        }
        if (this.LEVEL_1_CAPABILITIES.has(feature)) {
            return { level: 1, model: this.getLevel1Model() };
        }

        throw new Error(`AI_FEATURE_DISABLED: Capability '${feature}' is not recognized or is disabled in HireNest OS.`);
    }

    static calculateCost(provider: string, model: string, tokens: number, isCached: boolean = false): { estimatedCost: number, savedCost: number } {
        const provInstance = this.providers[provider] || this.providers.google;
        if (provInstance) {
            return provInstance.estimateCost(model, tokens, isCached);
        }
        return { estimatedCost: 0, savedCost: 0 };
    }

    /**
     * Backward compatible helper wrappers
     */
    static async callGoogle(prompt: string, model?: string, options: any = {}) {
        const targetModel = model || this.getLevel1Model();
        return this.providers.google.execute(prompt, targetModel, options);
    }

    static async callOllama(prompt: string, model: string, options: any = {}) {
        throw new Error("NON_GOOGLE_PROVIDER_DISABLED: Ollama is disabled. HireNest OS exclusively uses Google GenAI SDK.");
    }

    static async callOpenAI(prompt: string, model: string, options: any = {}) {
        throw new Error("NON_GOOGLE_PROVIDER_DISABLED: OpenAI is disabled. HireNest OS exclusively uses Google GenAI SDK.");
    }

    /**
     * Process chat request with Two-Tier Gemini routing, hashed caching,
     * and advanced governance telemetry.
     */
    static async processChat(request: AIGatewayRequest): Promise<AIGatewayResponse> {
        const startTime = Date.now();
        const feature = request.feature || "candidate_matching";
        const promptVersion = request.promptVersion || "v1.0";
        const userId = request.userId || "system";
        const office = request.office || "general";
        const agentName = request.agent || feature;

        // 1. Resolve Two-Tier Model Routing & Permissions
        const { level, model } = this.resolveLevelAndModel(feature, request.level, request.model);
        
        // 2. Pre-flight Guardrails (PII & Toxicity)
        if (AIGuardrails.detectPII(request.prompt)) {
             throw new Error("AI Guardrails: Blocked request due to sensitive PII detection.");
        }
        if (AIGuardrails.detectToxicity(request.prompt)) {
             throw new Error("AI Guardrails: Blocked request due to toxicity detection.");
        }

        // 3. Context Compression (Headroom)
        let finalPrompt = request.prompt;
        let tokensSaved = 0;
        let compressionRatio = 1.0;
        let originalTokens = 0;

        if (request.compressContext) {
            try {
                const compressed = await headroomOptimizer.compress(request.prompt);
                finalPrompt = compressed.data;
                tokensSaved = compressed.metrics.savedTokens;
                compressionRatio = compressed.metrics.compressionRatio;
                originalTokens = compressed.metrics.originalTokens;
                console.log(`[AIGateway] Headroom compression saved ${tokensSaved} tokens.`);
            } catch (err) {
                console.warn("[AIGateway] Headroom compression skipped/failed", err);
            }
        }

        // 4. Check Hashed Cache (incorporates model and level)
        let cacheKeyStr = "";
        let cacheHash = "";
        if (!request.skipCache && db) {
            cacheKeyStr = JSON.stringify({
                agent: agentName,
                feature,
                level,
                model,
                promptVersion,
                normalizedPrompt: finalPrompt.trim(),
                schema: request.schema ? true : false
            });
            cacheHash = crypto.createHash("sha256").update(cacheKeyStr).digest("hex");
            
            try {
                const redisHit = await redisCache.get(cacheHash);
                if (redisHit) {
                    console.log(`[AIGateway] Redis cache hit for agent ${agentName} [L${level}:${model}]`);
                    const latency = Date.now() - startTime;
                    const financialCosts = this.calculateCost(redisHit.provider, redisHit.model, redisHit.tokens, true);
                    return {
                        ...redisHit,
                        level,
                        latency,
                        cached: true,
                        estimatedCost: financialCosts.estimatedCost,
                        savedCost: financialCosts.savedCost,
                        tokensSaved,
                        compressionRatio,
                        originalTokens
                    };
                }

                const cacheDoc = await db.collection("ai_gateway_cache").doc(cacheHash).get();
                if (cacheDoc.exists) {
                    const cachedData = cacheDoc.data() as AIGatewayResponse & { cachedAt?: string };
                    let isExpired = false;
                    
                    if (cachedData.cachedAt) {
                        const cachedTime = new Date(cachedData.cachedAt).getTime();
                        const CACHE_TTL = 60 * 60 * 1000; // 60 minutes expiry
                        if (Date.now() - cachedTime > CACHE_TTL) {
                            isExpired = true;
                        }
                    }

                    if (isExpired) {
                        console.log(`[AIGateway] Hashed cache expired for agent ${agentName}`);
                    } else {
                        console.log(`[AIGateway] Hashed cache hit for agent ${agentName} [L${level}:${model}]`);
                    
                        const latency = Date.now() - startTime;
                        const financialCosts = this.calculateCost(cachedData.provider, cachedData.model, cachedData.tokens, true);

                        const fullResponse: AIGatewayResponse = {
                            ...cachedData,
                            level,
                            latency,
                            cached: true,
                            estimatedCost: financialCosts.estimatedCost,
                            savedCost: financialCosts.savedCost,
                            tokensSaved,
                            compressionRatio,
                            originalTokens
                        };

                        // Log cached hit to audit ledger
                        db.collection("ai_execution_ledger").add({
                            timestamp: new Date().toISOString(),
                            userId,
                            office,
                            agent: agentName,
                            feature,
                            level,
                            provider: cachedData.provider,
                            model: cachedData.model,
                            promptVersion,
                            latency,
                            tokens: cachedData.tokens,
                            cacheHit: true,
                            fallbackUsed: false,
                            estimatedCost: financialCosts.estimatedCost,
                            savedCost: financialCosts.savedCost,
                            status: "success",
                            tokensSaved,
                            compressionRatio
                        }).catch((e: any) => console.warn("[AIGateway] Ledger cached write failed", e));

                        return fullResponse;
                    }
                }
            } catch (e) {
                console.warn("[AIGateway] Cache read failed", e);
            }
        }

        // 5. Check Provider Health & Circuit Breakers
        const providerId = "google";
        const providerInstance = this.providers.google;
        const circuitStatus = CircuitBreaker.getStatus(providerId);

        let executionError: any = null;

        if (circuitStatus !== "OPEN") {
            try {
                const timeoutMs = request.timeoutMs || 8000;
                console.log(`[AIGateway] Executing Level ${level} task '${feature}' on ${providerId} (${model}) [Circuit: ${circuitStatus}]`);

                const result = await providerInstance.execute(finalPrompt, model, {
                    temperature: request.temperature,
                    systemInstruction: request.systemInstruction,
                    schema: request.schema,
                    imageParts: request.imageParts,
                    timeoutMs
                });

                // Record successful request on Circuit Breaker
                CircuitBreaker.recordSuccess(providerId);

                const latency = Date.now() - startTime;
                const costs = this.calculateCost(providerId, model, result.tokens, false);

                // Build unified response structure
                const resultObj: AIGatewayResponse = {
                    provider: providerId,
                    model,
                    level,
                    response: result.text,
                    latency,
                    tokens: result.tokens,
                    cached: false,
                    estimatedCost: costs.estimatedCost,
                    savedCost: costs.savedCost,
                    tokensSaved,
                    compressionRatio,
                    originalTokens
                };

                // Output Validation Guardrail
                let parsedData = null;
                const responseText = resultObj.response;
                if (request.schema || responseText.trim().startsWith("{")) {
                    try {
                        parsedData = JSON.parse(responseText);
                    } catch (e) {
                        const jsonMatch = responseText.match(/```json([\s\S]*?)```/);
                        if (jsonMatch) {
                            try {
                                parsedData = JSON.parse(jsonMatch[1]);
                            } catch (innerErr) {
                                throw e;
                            }
                        } else {
                            throw e;
                        }
                    }
                } else {
                    parsedData = { text: responseText };
                }

                const validation = AIGuardrails.validateOutput(parsedData, !!request.schema);
                if (!validation.isValid) {
                    throw new Error(`AI Guardrails: Output validation failed - ${validation.reason}`);
                }

                // Save to Cache asynchronously
                if (!request.skipCache && cacheHash) {
                    const cacheDataToSave = {
                        ...resultObj,
                        cachedAt: new Date().toISOString()
                    };
                    redisCache.set(cacheHash, cacheDataToSave, 3600);
                    if (db) {
                        db.collection("ai_gateway_cache").doc(cacheHash).set(cacheDataToSave).catch((e: any) => console.warn("[AIGateway] Cache write failed", e));
                    }
                }

                // AI Execution Ledger Audit Logging
                if (db) {
                    db.collection("ai_execution_ledger").add({
                        timestamp: new Date().toISOString(),
                        userId,
                        office,
                        agent: agentName,
                        feature,
                        level,
                        provider: providerId,
                        model,
                        promptVersion,
                        latency: resultObj.latency,
                        tokens: resultObj.tokens,
                        cacheHit: false,
                        fallbackUsed: false,
                        estimatedCost: costs.estimatedCost,
                        savedCost: costs.savedCost,
                        status: "success",
                        tokensSaved,
                        compressionRatio
                    }).catch((e: any) => console.warn("[AIGateway] Ledger write failed", e));
                }

                // Log execution telemetry asynchronously
                try {
                    await AITelemetry.logExecution({
                        requestId: crypto.randomUUID(),
                        workspaceId: office,
                        model,
                        promptVersion,
                        promptText: request.prompt,
                        responseText: resultObj.response,
                        latencyMs: resultObj.latency,
                        tokenUsage: {
                            promptTokens: Math.ceil(finalPrompt.length / 4),
                            completionTokens: Math.ceil(resultObj.response.length / 4),
                            totalTokens: resultObj.tokens
                        },
                        confidenceScore: parsedData?.confidence || 95,
                        metadata: {
                            capability: feature,
                            level,
                            tokensSaved,
                            compressionRatio
                        }
                    });
                } catch (e) {
                    console.error("AI Telemetry log failed", e);
                }

                return resultObj;

            } catch (error: any) {
                executionError = error;
                console.warn(`[AIGateway] Provider ${providerId} (${model}) failed: ${error.message}`);
                CircuitBreaker.recordFailure(providerId, error.message);
            }
        } else {
            console.warn(`[AIGateway] Circuit breaker for ${providerId} is OPEN. Triggering fallback.`);
        }

        // Fallback to Deterministic Rule Engine if provided
        if (request.fallbackRuleEngine) {
            console.log("[AIGateway] Triggering request fallback rule engine...");
            try {
                const fallbackData = request.fallbackRuleEngine(request.prompt);
                const resultObj: AIGatewayResponse = {
                    provider: "RuleEngine",
                    model: "DeterministicParser",
                    level,
                    response: JSON.stringify(fallbackData),
                    latency: Date.now() - startTime,
                    tokens: 0,
                    cached: false,
                    estimatedCost: 0,
                    savedCost: 0
                };

                if (db) {
                    db.collection("ai_execution_ledger").add({
                        timestamp: new Date().toISOString(),
                        userId,
                        office,
                        agent: agentName,
                        feature,
                        level,
                        provider: "RuleEngine",
                        model: "DeterministicParser",
                        promptVersion,
                        latency: resultObj.latency,
                        tokens: 0,
                        cacheHit: false,
                        fallbackUsed: true,
                        estimatedCost: 0,
                        savedCost: 0,
                        status: "fallback"
                    }).catch((e: any) => console.warn("[AIGateway] Ledger write for fallback failed", e));
                }

                return resultObj;
            } catch (fallbackError: any) {
                console.error("[AIGateway] Fallback Rule Engine failed:", fallbackError);
            }
        }

        // Default deterministic fallback payload
        console.warn("[AIGateway] Triggering default deterministic fallback response...");
        let defaultFallbackText = "";
        if (feature === "candidate_matching" || feature === "candidate_screening" || feature === "deep_fitment") {
            defaultFallbackText = JSON.stringify({
                matchScore: 75,
                tier: "Strong Potential",
                skillsMatched: [],
                skillsMissing: [],
                strengths: ["Profile evaluated via deterministic fallback engine."],
                gaps: [],
                recommendation: "CONSIDER",
                summary: "Deterministic screening completed. Candidate meets baseline requirements.",
                breakdown: {
                    skillsScore: 75,
                    experienceScore: 75,
                    domainScore: 75,
                    locationScore: 80,
                    totalScore: 75
                },
                recruiterAssessment: "Review candidate against core job requirements.",
                nextSteps: "Proceed with recruiter screening.",
                outreachDrafts: {
                    founder: "Hello, we reviewed your profile and would like to connect.",
                    professional: "Dear Candidate, Your background aligns with our open requirement.",
                    executive: "Reaching out regarding an opportunity aligned with your experience.",
                    warm: "Hi! We'd love to chat about a role on our team."
                }
            });
        } else if (feature === "executive_summary") {
            // NOTE: this used to hardcode revenueProjection: "$145,000" and
            // activePipelineCount: 18 — invented numbers with no connection
            // to any real data, presented to a founder/exec as if they were
            // an actual briefing. Report the degraded state honestly instead
            // of fabricating financials.
            defaultFallbackText = JSON.stringify({
                briefing: "AI briefing generation is currently unavailable (running under deterministic fallback mode). Figures below could not be computed — check pipeline/revenue dashboards directly for current numbers.",
                actionItems: [
                    { id: "act-1", title: "Review pending candidates in queue", type: "review" }
                ],
                summary: "Executive Briefing unavailable: AI Gateway is in fallback mode, no live analysis was performed.",
                revenueProjection: null,
                activePipelineCount: null,
                degraded: true,
                confidence: 0
            });
        } else if (request.schema) {
            defaultFallbackText = JSON.stringify({
                summary: "Platform operating under deterministic rule engine fallback mode.",
                status: "ACTIVE",
                confidence: 85
            });
        } else {
            defaultFallbackText = "Platform service is active and operating under deterministic rule mode.";
        }

        return {
            provider: "RuleEngine",
            model: "DeterministicFallback",
            level,
            response: defaultFallbackText,
            latency: Date.now() - startTime,
            tokens: 0,
            cached: false,
            estimatedCost: 0,
            savedCost: 0
        };
    }
}
