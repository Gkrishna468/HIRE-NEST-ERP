# HireNest Platform Engineering (v2.2) Execution Roadmap

Based on the maturity of Runtime v1.0, the focus has shifted to establishing an enterprise-grade AI-native operating system. The execution order has been explicitly defined to ensure proper dependency management and prevent rework.

## Guiding Principle
> **No AI agent, workflow, or application component calls business services directly. Every business capability is exposed through a versioned MCP tool with permissions, validation, auditing, and telemetry.**

---

## Recommended Execution Order

### Phase HN-012 — MCP Tool Platform ⭐ Highest Priority
This is the foundational layer. Without MCP tools, ADK agents have no standardized targets to call, and workflows become tightly coupled.

**Deliverables:**
* MCP Tool SDK
* Tool Registry
* Tool Manifest schema
* Tool Versioning
* Permission Contracts
* Audit Hooks
* Tool Health Checks

**Initial Tools (Examples):**
* **Candidate Domain**: Candidate Search, Candidate 360, Resume Parser, Ownership Validation
* **Requirement Domain**: Requirement Search, Match Index, JD Parser
* **Vendor Domain**: Vendor Search, Vendor Trust Score
* **Executive Domain**: Executive Dashboard, KPI Summary

---

### Phase HN-013 — Capability Registry & AI Gateway v2.2
The gateway transitions from model-based routing to capability-based routing.

**Flow:**
`Capability → Policy → Capability Registry → Provider Router → Model Adapter → Normalized Response`

**Example Registry:**
| Capability | Primary | Secondary | Local |
| :--- | :--- | :--- | :--- |
| Chat | Gemini | NVIDIA | Ollama |
| Resume Parsing | Gemini | NVIDIA | Ollama |
| Embeddings | NVIDIA | Gemini | Ollama |

---

### Phase HN-014 — Declarative Agent Runtime
Every agent transitions from hardcoded prompts to configuration-driven declarations.

**Example YAML definition:**
```yaml
agent: recruiter
memory: [candidate, requirement]
permissions: recruiter
capabilities: [Candidate Search, Resume Parser, Match Candidates, Submission Generator]
models: [reasoning, embeddings]
```
Agents do not know which specific AI provider implements the capabilities they use.

---

### Phase HN-015 — Workflow Engine
Workflows become straightforward sequences of MCP tool invocations.

**Example:**
`Requirement Created → JD Parser → Normalize Skills → Candidate Search → Deterministic Match → Semantic Match → Ownership Validation → Vendor Rank → Submission → Email`

---

### Phase HN-016 — Immutable Event Platform
Introduce immutable domain events to power asynchronous and reactive logic.

**Core Events:**
* `CandidateUploaded`, `CandidateMatched`
* `RequirementCreated`
* `SubmissionCreated`, `SubmissionAccepted`
* `VendorRanked`
* `InterviewScheduled`
* `PlacementCompleted`, `RevenueUpdated`

**Event Contract:** Event ID, Correlation ID, Workspace, User, Agent, Timestamp, Version.

---

### Phase HN-017 — Enterprise Memory Platform
Introduce separated memory domains to prevent prompt bloat.

**Domains:**
* Operational
* Conversation
* Business
* Knowledge
* Executive
* Vector

**Standard Interfaces:** `Search()`, `Update()`, `Expire()`, `Permissions()`, `Audit()`

---

### Phase HN-018 — Enterprise Observability
Instrument every layer to emit telemetry across the execution lifecycle.

**Lifecycle Tracking:**
`Workflow → Agent → Capability → Tool → Provider → Latency → Tokens → Estimated Cost → Business Result → Audit`

---

## Future Addition: Platform SDK
A unified `platform-sdk` to guarantee consistency across new developments.
* Agent SDK
* MCP Tool SDK
* Workflow SDK
* Memory SDK
* Policy SDK
* Telemetry SDK
* Capability SDK

---

## Summary Timeline
| Sprint | Initiative | Priority |
| :--- | :--- | :--- |
| **HN-012** | MCP Tool Platform | 🔴 Critical |
| **HN-013** | Capability Registry & AI Gateway v2.2 | 🔴 Critical |
| **HN-014** | Declarative ADK Agent Runtime | 🟠 High |
| **HN-015** | Workflow Engine | 🟠 High |
| **HN-016** | Immutable Event Platform | 🟡 Medium |
| **HN-017** | Enterprise Memory Platform | 🟡 Medium |
| **HN-018** | Enterprise Observability | 🟢 Ongoing |
