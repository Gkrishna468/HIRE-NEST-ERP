# HireNest Cost Architecture & Optimization Strategy

This document maps out the Google Cloud and AI infrastructure costs for HireNest CRM and HireNest OS, identifying current patterns, projected scaling costs, and concrete optimizations.

## 1. Google Cloud Architecture & Projected Costs

### A. App Engine (or Cloud Run) Services
**Current Pattern:** 
- Frontend SPA served statically (Vite).
- Node.js/Express Backend (or full-stack endpoints) handling API requests.
- Synchronous processing of heavy tasks.

**Optimization:**
- **Scale-to-Zero:** Ensure the service can scale down to 0 instances when idle to eliminate baseline costs.
- **Background Workers:** Shift heavy workloads (resume parsing, matching) to background tasks (e.g., using Cloud Tasks or Pub/Sub) to avoid tying up HTTP request handlers, which requires more concurrent instances.

### B. Firestore Collections & Patterns
**Core Collections:**
- `candidates`: Profile data, parsed resumes.
- `requirements`: Job descriptions, parsing data.
- `submissions`: Connects candidates to requirements.
- `users`: App users (recruiters, admins).
- `organizations`: Tenant data.

**Current Cost Drivers:**
- Fetching large lists of candidates or requirements without strict pagination.
- Re-aggregating dashboard metrics directly from raw collections on load.
- Real-time listeners on collections that don't need instant updates.

**Optimizations:**
- **Pagination & Cursors:** Use `limit()` and cursor-based pagination (`startAfter`) for candidate/job lists. Never fetch unbounded collections.
- **Dashboard Aggregations:** Use Cloud Functions to maintain aggregate counters/stats in a dedicated `metrics` collection. Dashboards read 1 doc instead of 1000s.
- **Listener Pruning:** Restrict Firestore real-time listeners (`onSnapshot`) to only collaborative features (e.g., live deal rooms or active chat). Use standard `get()` for static tables.
- **Targeted Reads (Admin SDK):** In backend processes, use `.select('id', 'name')` to avoid pulling heavy document payloads (like raw resume text) into memory unless required.

### C. AI Gateway & LLM Usage (Gemini/OpenAI/LiteLLM/OmniRoute)
**Current Pattern:**
- Calling LLMs for resume parsing, JD extraction, candidate matching, and email drafting.
- Repeatedly summarizing the same candidates.

**Optimizations:**
- **Caching Layer:** Hash inputs (e.g., resume text) and store the AI response in Firestore or Redis. If a candidate's resume hasn't changed, reuse the extracted structured data.
- **Model Routing by Task:** Use smaller, faster models (e.g., Gemini 2.5 Flash, GPT-4o-mini, local Ollama) for simple extraction and summarization. Reserve advanced models (e.g., Gemini 2.5 Pro, Claude 3.5 Sonnet) only for complex semantic reasoning.
- **Batch Processing:** When matching a job against 100 candidates, use embeddings or a vector search approach (Layer 2) rather than generating 100 separate LLM calls.

## 2. Projected Monthly Costs (Estimates)

| Resource | 100 Users | 1,000 Users | 10,000 Users |
| :--- | :--- | :--- | :--- |
| **App Engine / Cloud Run** | ~$5 - $10 | ~$20 - $50 | ~$150 - $300 |
| **Firestore (Reads/Writes)** | ~$1 - $5 | ~$15 - $40 | ~$150 - $400 |
| **Cloud Storage** | ~$1 - $2 | ~$5 - $15 | ~$50 - $100 |
| **AI Gateway (API Costs)** | ~$10 - $20 | ~$50 - $150 | ~$400 - $1000 |
| **Total Estimated** | **$17 - $37** | **$90 - $255** | **$750 - $1800** |

*(Assumes heavy caching, standard B2B SaaS usage patterns, and optimized Firestore querying).*

## 3. Immediate Action Plan

1. **Dashboard Caching:** Implement a backend aggregation system for executive and recruiter dashboards.
2. **Review Firestore Queries:** Audit the frontend for any `getDocs` calls lacking a `.limit()`.
3. **AI Caching:** Implement the caching mechanism in the `AIGateway` to skip duplicate LLM queries.
4. **Move to Background Tasks:** Implement a queue (bullmq or Cloud Tasks) for heavy document parsing.
