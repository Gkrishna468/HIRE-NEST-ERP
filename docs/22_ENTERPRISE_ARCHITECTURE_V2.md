# HireNest Enterprise AI Reference Architecture v2.2

## Architecture Principles

Every layer should have exactly one responsibility.

```
Presentation Layer
        │
Identity & Policy
        │
AI Gateway
        │
Capability Router
        │
Google ADK Runtime
        │
MCP Tool Platform
        │
Workflow Engine
        │
Business Services
        │
Event Platform
        │
Memory Platform
        │
Data Platform (Firestore SSOT)
```

**Capability Router**
This is the intelligence layer inside the AI Gateway that handles capability-based routing.

---

# AI Gateway v2.2

Instead of simply routing to providers, introduce capability-based routing.

```
Request
  ↓
Capability
  ↓
Policy Check
  ↓
Capability Router
  ↓
Provider Selection
  ↓
Provider Adapter
  ↓
Normalized Response
```

### Capability Registry

Define a capability registry to map tasks to models.

| Capability      | Default       | Backup        | SLA    |
| --------------- | ------------- | ------------- | ------ |
| Chat            | Gemini        | Ollama        | High   |
| Resume Parsing  | Gemini        | NVIDIA        | High   |
| Embeddings      | NVIDIA        | Gemini        | High   |
| Image OCR       | Gemini Vision | NVIDIA Vision | Medium |
| Speech          | Google        | Browser       | Medium |
| Code Generation | NVIDIA Coding | Gemini        | Medium |

---

# Workflow Engine

Rather than agents containing business logic, they orchestrate workflows.

```
Requirement Created
  ↓
Workflow
  ↓
JD Parser
  ↓
Skill Normalizer
  ↓
Candidate Search
  ↓
Deterministic Match
  ↓
Semantic Match
  ↓
Ownership Validation
  ↓
Vendor Ranking
  ↓
Submission Generator
  ↓
Email Generator
  ↓
Notify Recruiter
```
Each node invokes an MCP tool. No node should directly invoke an AI model.

---

# Agent Runtime (Declarative)

Each agent should be defined declaratively (e.g., YAML/JSON) to allow non-code updates.

```yaml
name: Recruiter Agent
role: recruiter
memory:
  - candidate
  - requirement
tools:
  - Candidate Search
  - Resume Parser
  - Submission Generator
models:
  primary: Gemini
  fallback: NVIDIA
permissions:
  recruiter
tokenBudget: 20000
```

---

# MCP Tool Contracts

Every MCP tool exposes a formal contract:
* Tool Name
* Version
* Owner
* Input Schema
* Output Schema
* Permissions
* Rate Limits
* Timeout
* Retry Policy
* Audit Level
* Observability Tags

---

# Event Platform

Core immutable, versioned events:
* `CandidateUploaded`
* `ResumeParsed`
* `CandidateMatched`
* `RequirementIndexed`
* `VendorRanked`
* `SubmissionCreated`
* `SubmissionAccepted`
* `InterviewScheduled`
* `PlacementCompleted`
* `RevenueUpdated`
* `ExecutiveAlertRaised`

---

# Enterprise Memory Platform

Separation of memory domains with clear ownership:
1. **Operational Memory**: temporary workflow state.
2. **Conversation Memory**: active chat context.
3. **Business Memory**: Firestore entities (candidates, requirements, vendors, clients).
4. **Knowledge Memory**: SOPs, policies, documentation.
5. **Executive Memory**: analytics, KPIs, forecasts.
6. **Vector Memory**: semantic retrieval indexes.

---

# Observability

Capture the full lifecycle of a request:
```
Request
  ↓
Workflow
  ↓
Agent
  ↓
Tool
  ↓
Capability
  ↓
Provider
  ↓
Model
  ↓
Latency
  ↓
Token Usage
  ↓
Estimated Cost
  ↓
Business Result
  ↓
Audit Record
```

---

# Release Management

Introduce versioning for:
* AI Gateway
* Capability Registry
* MCP Tool contracts
* Agent definitions
* Workflow definitions
* Policy definitions
* Memory schemas
* Event schemas
