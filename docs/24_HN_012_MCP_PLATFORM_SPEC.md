# Phase HN-012: Enterprise MCP Tool Platform Specification

## Goal
> **Create the Enterprise MCP Platform that standardizes how every business capability is discovered, authorized, executed, audited, observed, and versioned.**

HN-012 focuses on building the **operating system** for tools, establishing the enterprise contract that all future tools must follow.

---

## 9 Core Workstreams

### 1. MCP Tool SDK
Every tool must implement a standardized interface to ensure consistent validation, authorization, execution, and auditing.

```typescript
interface MCPTool<TInput, TOutput> {
  metadata: ToolMetadata;
  validate(input: TInput): Promise<void>;
  authorize(context: ToolContext): Promise<void>;
  execute(input: TInput): Promise<TOutput>;
  audit(result: TOutput): Promise<void>;
}
```

### 2. Tool Manifest
Each tool is described by declarative metadata.
```yaml
id: candidate.search
version: 1.0.0
owner: Candidate Domain
category: Candidate
permissions:
  - recruiter
  - founder
audit: HIGH
timeout: 10s
retry: 2
visibility: internal
```

### 3. Registry Service
The Registry acts as the central directory for all tools. Agents must consult the registry rather than hardcoding references. It tracks:
* Tool existence and active versions
* Ownership and permissions
* Health and deprecation status

### 4. Policy Integration
Centralized enforcement pipeline for execution:
`Request → Tool Lookup → Policy Engine → Input Validation → Execution → Audit → Telemetry`

### 5. Tool Discovery
Dynamic discovery capabilities based on metadata filters (Domain, Category, Permission, Version, Status, Tags).

### 6. Tool Lifecycle
Explicit, enforced states for every tool:
`Draft → Experimental → Internal → Production → Deprecated → Archived`

### 7. Observability
Standardized telemetry emitted for every execution:
```json
{
  "tool": "candidate.search",
  "version": "1.0.0",
  "requestId": "...",
  "workspace": "...",
  "latency": 120,
  "success": true,
  "auditLevel": "HIGH"
}
```

### 8. Versioning
Semantic versioning from day one, with registry support for running multiple versions concurrently during migrations (e.g., 1.0.0, 1.1.0, 2.0.0).

### 9. Platform SDK
A unified package structure to guarantee consistency across new developments.
```text
/packages/platform-sdk
├── mcp/        # tool.ts, registry.ts, manifest.ts
├── policy/     # engine.ts, permissions.ts
├── telemetry/  # logger.ts, metrics.ts
├── audit/      # ledger.ts
├── workflow/   # workflow.ts
└── memory/     # memory.ts
```

---

## Initial Tool Scope
To validate the platform, the initial implementation will be restricted to stable, deterministic services:

* **Candidate**: `candidate.search`, `candidate.360`, `candidate.ownership.validate`
* **Requirement**: `requirement.search`, `requirement.match.index`
* **Vendor**: `vendor.search`, `vendor.trust.score`
* **Executive**: `executive.kpi.summary`

---

## Definition of Done (DoD)
HN-012 is not complete until **ALL** of the following criteria are met:

- [ ] Every MCP tool is described by a manifest.
- [ ] Every tool implements the common SDK.
- [ ] Every execution passes through the Policy Engine.
- [ ] Every execution is audited.
- [ ] Every execution emits telemetry.
- [ ] The Registry supports discovery and versioning.
- [ ] Tool lifecycle states are enforced.
- [ ] **No business service is invoked directly by agents.**

### Success Metric
**Architectural Consistency**: A developer can add a new business capability simply by implementing the SDK, writing a manifest, and registering the tool—automatically inheriting authorization, auditing, observability, versioning, and discovery.
