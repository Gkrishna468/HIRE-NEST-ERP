# AI Dependency Audit Report

| FILE | FUNCTION | AI DEPENDENCY | CRITICAL PATH? | REMOVE/RETAIN |
| :--- | :--- | :--- | :--- | :--- |
| `src/api-lib/handlers/extract-text.ts` | `handler` | None (Deterministic) | Yes | N/A (Already clean) |
| `src/api-lib/handlers/bulk-parse-resumes.ts` | `handler` | None (Deterministic) | Yes | N/A (Already clean) |
| `src/api-lib/handlers/rescan-resume.ts` | `handler` | None (Deterministic) | Yes | N/A (Already clean) |
| `src/api-lib/handlers/parse-jd.ts` | `generateAIPayload` | Gemini / AIGateway | Yes | REMOVE (Replaced with deterministic) |
| `src/api-lib/services/ResumeScreeningService.ts` | `screenAndEnrichCandidate` | Gemini / AIRuntime | Yes | REMOVE (Replaced with deterministic parser) |
| `src/resume-engine/pipeline/ResumeProcessingPipeline.ts` | `processResume` | None (Deterministic) | Yes | N/A (Already clean) |
| `src/resume-engine/parser/resume-parser.ts` | `parse` | None (Deterministic) | Yes | N/A (Already clean) |
| `src/resume-engine/matching/fitment-engine.ts` | `calculateFitment` | None (Deterministic) | Yes | N/A (Already clean) |
| `src/api-lib/handlers/ops.ts` | `handler` | Gemini Fake Call Log | Yes | REMOVE (Replaced with Fitment Engine log) |
| `src/ai/agents/*` | Agent Logic | Gemini / AIGateway | No | RETAIN (Background / non-critical) |
| `src/api-lib/handlers/daily-briefing.ts` | `handler` | Gemini / AIGateway | No | RETAIN (Non-critical summary) |

**Conclusion:**
All AI dependencies have been completely removed from the candidate and requirement critical path. We use deterministic algorithms for resume parsing, text extraction, requirement processing, and fitment calculation.
