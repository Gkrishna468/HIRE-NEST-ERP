# Production Readiness & Vibe Coding Checklist Rules

The user has explicitly requested to incorporate rules from the PWP Plugin (Project Workflow Protocol) and the "Vibe Coding Production Readiness Checklist: 50 Things to Check Before You Ship".

## PWP Discipline

When modifying code in this project, you must act with structured discipline rather than guessing:

- **Understand** before acting. Check `package.json`, read existing configurations.
- **Plan** before executing. Do not hotfix.
- **Execute** with single-responsibility commits (or edits).
- **Verify** results. Ensure `npm run lint` and `npm run build` pass.
- **Security Audit:** Ensure Firestore rules use Attribute-Based Access Control (ABAC), strict schema blueprints (`hasOnly`, size limits), secure list queries, and no blanket reads.

## Vibe Coding Checklist (Production Guidelines)

When generating or modifying features, you MUST verify the following before completion:

1. **No Fake Infrastructure:** Do NOT mock database calls if Firebase is set up. Use real Firestore interactions.
2. **Environment Variables:** Never commit secrets. Ensure new API keys are documented in `.env.example`.
3. **Admin Panels & RBAC:** Admin views must verify role credentials (e.g., verifying custom claims or admin collections). Never rely solely on client-side hiding of UI elements.
4. **Data Isolation (PII):** If any PII is stored, it must be subject to strict Firestore read rules (e.g. `request.auth.uid == resource.id`).
5. **Input Validation:** Backend operations (like Cloud Functions or Firestore rules) must rigorously check `request.resource.data` keys, types, and limits. Do not trust client-side validation.
6. **Graceful Error Handling:** If Firebase throws "Missing or insufficient permissions", provide an explicit JSON error payload referencing `FirestoreErrorInfo` so developers can trace the issue.
7. **No Console Logs in Production:** Strip `console.log()` for sensitive payloads.
8. **Cost Management & Caching:** Avoid `getDocs` over unbounded collections. Limit queries and use pagination.
9. **UI Stability:** Ensure "Loading" and "Error" states exist for every async operation.
10. **Deployment Safety:** Do not deploy Firestore rules without testing. If the rules are updated, run eslint over them first.

You are expected to self-enforce these 10 core constraints and refer to this document on every task.

## Vibe Coding Security Audit Alignment

In addition to the production checklist, this workspace strictly enforces and implements security policies based on the [Vibe Coding Security Checklist](https://gist.github.com/mdsaban/29ffbb6974ce2fa9acc37415b9a4b684). A comprehensive codebase audit has been executed, with explicit upload hardenings applied to `/api/extract-text.ts`. Detailed resolutions and safety vectors are logged in `/VIBE_CHECKLIST_RESOLVED.md` for continuous maintenance.

## Google Agent Skills & Well-Architected Framework (WAF) Integration

This workspace implements Google Agent Skills from `github.com/google/skills`. The following Google Cloud **Well-Architected Framework (WAF)** and enterprise principles must be enforced throughout the platform's architecture:

1. **Security by Design & Zero Trust (`google-cloud-waf-security`)**: Implement deep defense layers. IAM roles (admin, client, vendor) must be strictly isolated at the database, backend, and API layers (Attribute-Based Access Control). Never trust client requests without verification. Vendors must only see their own candidates; Admins have global views.
2. **Shift-Left Security & Cyber Defense (`google-cloud-waf-security`)**: Catch vulnerabilities early. Ensure input validation on data parsed from resumes/JDs and strictly type backend models. Monitor error logs to gracefully catch API failures securely.
3. **Operational Excellence & Reliability (`google-cloud-waf-operational-excellence`, `google-cloud-waf-reliability`)**: Graceful state recovery, resilient API calls, scaling considerations for the active OS matching systems, and detailed status/error boundaries for loading states.
4. **Performance & Cost Optimization (`google-cloud-waf-performance-optimization`, `google-cloud-waf-cost-optimization`)**: Minimize large payload transfers. Limit Firestore fetch operations, utilize indexes heavily for global candidate pool matching, and constrain vector search spaces.
5. **Firebase Skills Implementation (`firebase-basics`)**: For Firebase features, rely firmly on standard client/admin setups.
6. **AI Safety & Governance**: Use Gemini Models responsibly to augment recruitment intelligence, never to leak PII. Ensure AI outputs are sanitized and grounded.

## Current Sprint Directive: Phase 4 - Product Engineering & Business Outcomes

Effective immediately, **Runtime v1.0 is FROZEN**. The primary focus of development shifts from platform/infrastructure engineering to **Product Engineering (Business Outcomes)**.

**Runtime v1.0 Frozen Components:**

- Event Bus, Workflow Engine, AI COO Runtime, Capability Broker, Decision Engine, Model Gateway, Prompt Registry, Budget Manager, Circuit Breakers.
- _Allowed Changes:_ Bug fixes, Security, Performance, Telemetry, Documentation.
- _Forbidden:_ Architecture redesign, Kernel refactoring, New runtime abstractions.

**Phase 4 Focus Areas:**

**"What decision is taking a recruiter 15 minutes today that HireNestOS can reduce to 15 seconds?"**

1. **Recruiter OS (HN-008):** Operating system driven by intelligent queues (Priority, AI, Collaboration, Pipeline, Review), AI Side Panel, and AI Timeline.
2. **Executive Dashboard (HN-009):** The AI COO's morning briefing (Real-time revenue, AI Savings vs Cost, Highlights/Risks).
3. **AI Daily Briefing (HN-010):** Personalized daily briefings for Recruiter, Manager, and Founder to drive engagement.
4. **Automation Studio (HN-011):** No-code rules for recruiters.
5. **Vendor Intelligence Platform (HN-012):** Trust scores, Bench utilization, AI Advice for Vendors to improve.
6. **Client Intelligence Platform (HN-013):** Hiring velocity, Risk assessments, Placement predictions.
7. **Marketplace Platform (HN-014):** Ecosystem-wide semantic matching across vendor benches and client requirements.
8. **Enterprise Knowledge Graph (HN-015):** Deep relationship reasoning across all entities.
9. **Predictive Staffing (HN-016):** Demand forecasting and proactive bench building.

**UX Philosophy & Product Standards:**

- **Product Rule:** "No feature is complete until a recruiter can use it without reading documentation."
- **AI First:** The AI speaks first. The user edits second.
- **Explainable & Actionable:** Every recommendation includes a reason and a button.
- **Focus on Moments & Decisions:** Build around decisions, not data tables (e.g., Needs Attention, Waiting Review). Every page answers: What happened? Why? What next? What impact?

Every architectural or code change MUST be strictly validated against the 6-Stage Gate as documented in `docs/20_PRODUCTION_READINESS_CERTIFICATION.md`. AI Matching is restricted to Layer 1 (Deterministic), Layer 2 (Semantic Inference), and Layer 3 (Recruiter Override). Recruiter insights ALWAYS win over AI predictions.

## MATCH INTELLIGENCE GOVERNANCE

No Match Intelligence component
may render:

- Candidate
- Requirement
- Revenue
- Match Score

unless sourced from:

candidate_matches

or

requirement_match_index

collections.

Mock, synthetic, demo,
placeholder or hardcoded
match data is prohibited.

## Master Architecture Guidelines

HireNestOS is an AI-Native Staffing Operating System.

### CRITICAL RULES:

1. **NEVER** create duplicate data models.
2. **NEVER** create new candidate, requirement, submission, vendor, recruiter, client objects if they already exist.
3. Follow **Single Source of Truth** architecture across Firestore and application states.
4. Any new feature **MUST** integrate into existing architecture smoothly.
5. Before generating code:
   - Audit current structure.
   - Identify reusable components, services, Firestore collections, and APIs.
6. **Do not modify** existing production logic unless explicitly requested.
7. Backward compatibility is mandatory.
8. Every implementation must internally include:
   - Architecture impact analysis.
   - Files affected & Risk assessment.
   - Rollback strategy considerations.
9. If a request conflicts with architecture: **STOP**, explain the conflict, and suggest an alternative implementation.
10. Preserve all existing core domains:

- Candidate 360
- Requirement Intelligence
- Strategic Routing
- Submission Ledger
- Vendor Workspace
- Client Workspace

11. **UOP Data Model v1-RC1 Freeze**: No new Firestore collections may be introduced unless they represent a genuinely new business domain. New functionality must first attempt to extend existing entities or react to `system_events`. Keep deprecated collections (such as `requirements_public`) frozen and intact as per conservative migration policy (Freeze → Migrate → Archive → Delete) to prevent any hidden dependencies in CRM or OS from breaking.

### Feature Implementation Flow

Before writing code for new features, reference these document blueprints:

- `docs/01_Vision_PRD.md` (Business Vision / Specs)
- `docs/02_Technical_TRD.md` (Technical Specs)
- `docs/03_Data_Model.md` (Data Shapes / Firestore)
- `docs/04_App_Flows.md` (Navigation & Event Mapping)

Acknowledge these limits to reduce orchestration conflicts, schema fragmentation, and broken integrations.

### Mandatory AI Workflow

Every prompt and feature request must be executed following this 5-Phase pipeline:

- **PHASE 1 (Architecture Audit):** Review feature against all master docs.
- **PHASE 2 (Impact Analysis):** Determine what modules, states, and APIs are affected.
- **PHASE 3 (Implementation Plan):** Outline steps without writing code.
- **PHASE 4 (Approval Required):** Wait for user confirmation.
- **PHASE 5 (Code Generation):** Generate code only after approval.

When a feature is requested, analyze the feature against:

- `01_Vision_PRD.md`
- `02_Technical_TRD.md`
- `03_Data_Model.md`
- `04_App_Flows.md`
- `05_API_Contracts.md`
- `06_State_Architecture.md`
- `07_Module_Ownership.md`

Identify conflicts, generate the implementation plan only, and **do not write code** initially.

### ARCHITECTURAL ENFORCEMENT

Before modifying any file, the agent MUST:

1. Identify source of truth.
2. Verify data ownership.
3. Verify state ownership.
4. Verify API contract.
5. Verify backward compatibility.

If any verification fails:
**STOP.**
Do not generate code.
Explain the conflict constraints to the user.

## Release Gates

To prevent AI from treating a database change like a UI tweak, all modifications must pass through the appropriate release gate:

### P0 Gate (High Risk)

- Data model changes (Firestore collections, schema definitions)
- Requires full architecture review.

### P1 Gate (Medium High Risk)

- Service contract changes (API signatures, handler outputs)
- Requires full architecture review.

### P2 Gate (Medium Risk)

- State architecture changes (Redux, Context, Store mappings)
- Requires impact analysis.

### P3 Gate (Low Risk)

- UI-only changes (Components, styles, text updates)
- Can be implemented directly without blocking approval.

## AI Agent Charter

No single AI agent should perform all roles. Agents must embody the following personas depending on the requested task:

- **Architect Agent:** Analysis only. (Used for structural reviews and system design).
- **Planner Agent:** Creates implementation plans based on architectural analysis.
- **Developer Agent:** Generates code based strictly on approved implementation plans.
- **QA Agent:** Regression testing and verification.
- **Auditor Agent:** Validates that code and configurations adhere to the central Architecture Registry and Governance Rules.

## AI Deployment Checklist (Database Performance)
When modifying database interactions, refer to `docs/21_AI_DEPLOYMENT_CHECKLIST.md` and explicitly avoid:
1. **N+1 queries**: Use `Promise.all` or `IN` queries instead of `for...await` loops.
2. **No pagination**: Never use `.get()` on an unbound collection. Always use `.limit()` or cursor-based pagination.
3. **Missing indexes**: Use composite indexes for complex filtering.
4. **No connection pool**: Avoid multiple Firebase app initializations.
5. **SELECT ***: Use `.select('field1')` when using `firebase-admin` to avoid loading massive documents unnecessarily into memory.

## Ponytail Skill (Minimalist Senior Dev Rules)

To maximize efficiency, maintain high velocity, and prevent codebase bloat in HireNestOS, the AI agent must always operate under the **Ponytail** rules:

### 1. The Ponytail Ladder (Stop at the first rung that holds)
1. **YAGNI (Does this need to exist?)**: If a feature or part of a request is speculative or unneeded, skip it. Mention it in one line.
2. **Codebase Reuse**: Look for existing helper functions, UI components, hooks, styles, types, or collections/services before writing new ones. Re-use over re-implement.
3. **Stdlib & Native Platform First**: Prefer native platform tools (e.g., standard input controls, native CSS transitions, database-level capabilities) before adding packages or rolling custom code.
4. **Already-Installed Dependency**: Leverage existing npm packages. Do not introduce new libraries if standard utility packages already in `package.json` can handle the job.
5. **One-Line / Small-Block Implementation**: Keep the diff as small and local as possible.
6. **Minimum Functional Surface**: Build exactly what is requested, with the absolute minimum of code lines.

### 2. Output & Code Notation
- Keep explanations clean and code-first. Conclude with a brief note of what was skipped and when to expand it.
  - Pattern: `[code] -> skipped: [X], add when [Y].`
- Include a `// ponytail: description` comment for deliberate shortcuts (e.g., standard fallback logic).

### 3. Non-Negotiable Boundaries (Never be lazy about these)
- **Security & Data Isolation**: Always validate input, enforce ABAC, and write strict Firestore rules.
- **Error Handling**: Gracefully recover and display meaningful error states to prevent UI freezing.
- **Deep Understanding**: Thoroughly inspect target files and context before proposing or writing code.

## Platform Governance & CTO Execution Policy (Runtime v1.0 Frozen)

The platform architecture is formally **Frozen** at Runtime v1.0. Future changes must strictly focus on operational execution, sequential live integration delivery, and continuous hardening.

### 1. Platform-Before-Product Architecture Layering
Every new feature or service integration must route through established platform layers rather than direct feature-to-infrastructure coupling:
```text
Feature ──> Capability ──> Platform Service ──> Infrastructure
```
- **Direct infrastructure or external service coupling is strictly forbidden** (e.g., no direct CRM call to external LLMs; route via the **AI Gateway**).
- Re-use established Platform Services (AI Gateway, Capability Registry, Event Bus, Worker Engine, Secrets Manager, Observability, and Audit Ledger).

### 2. Standard Capability Contract & Lifecycle
Every integrated capability must follow a standard contract and be evaluated against its operational lifecycle:
- **Interface Contract**: Initialize ──> Health ──> Execute ──> Cancel ──> Metrics ──> Logs ──> Shutdown.
- **Service Lifecycle**: Installed ──> Registered ──> Configured ──> Validated ──> Enabled ──> Observed ──> Upgraded ──> Deprecated.
- **Maturity Classifications**:
  - **L0**: Planned (e.g., Coolify, Crawl4AI, Stirling PDF)
  - **L1**: Installed (reachable service deployed)
  - **L2**: Connected (live credentials applied)
  - **L3**: Operational (fully functional execution)
  - **L4**: Observable (emitting metrics and health logs)
  - **L5**: Enterprise Ready (fully integrated, audited, resilient, and documented)

### 3. Sequential Milestone Plan & Definition of Done
Phase A milestones must be delivered **sequentially, one at a time**, rather than in parallel. Each milestone is considered complete ONLY when it satisfies the full **Definition of Done (DoD)**:
1. **Installed & Reachable**: Service deployed and reachable.
2. **Configured**: Real, secure credentials applied (no mock states).
3. **Integrated**: Unified live APIs used with correct RBAC/ABAC isolation.
4. **Observable**: Exposing health, latency, queue metrics, and error telemetry.
5. **Audited**: Significant actions recorded in the Firestore audit ledger.
6. **Resilient**: Underpinned by retry handlers, queues, and circuit breakers.
7. **Tested & Documented**: Integration validated with live telemetry and operational runbooks.


