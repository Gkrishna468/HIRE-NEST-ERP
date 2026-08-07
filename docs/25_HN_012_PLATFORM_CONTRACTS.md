# Phase HN-012: Enterprise Platform Contracts

To establish a durable foundation where new tools, agents, workflows, and providers can be added consistently without changing the core architecture, Sprint HN-012 will produce exactly **10 foundational artifacts** and codify **6 non-negotiable engineering rules**.

---

## 10 Foundational Artifacts

### 1. Platform SDK
A purely infrastructural package with zero business logic.
```text
packages/
└── platform-sdk/
    ├── mcp/
    ├── policy/
    ├── telemetry/
    ├── audit/
    ├── registry/
    ├── workflow/
    ├── memory/
    ├── capability/
    ├── events/
    └── shared/
```

### 2. MCP Base Interface
Defines the complete lifecycle of a tool.
```typescript
export interface MCPTool<TInput, TOutput> {
  readonly manifest: MCPToolManifest;

  validate(input: TInput): Promise<ValidationResult>;
  authorize(context: ToolContext): Promise<AuthorizationResult>;
  execute(input: TInput, context: ToolContext): Promise<TOutput>;
  audit(execution: ToolExecution): Promise<void>;
  telemetry(execution: ToolExecution): Promise<void>;
}
```

### 3. Tool Manifest
Comprehensive metadata to support discovery, governance, and operations.
```typescript
interface MCPToolManifest {
  id: string;
  name: string;
  version: string;
  domain: string;
  owner: string;
  description: string;
  permissions: string[];
  capabilities: string[];
  auditLevel: string;
  timeout: string;
  retryPolicy: string;
  visibility: string;
  status: string;
  tags: string[];
}
```

### 4. Registry API
A stable interface for discovering and managing tools without instantiating them directly.
```typescript
interface RegistryAPI {
  register(manifest: MCPToolManifest): void;
  discover(query: any): MCPToolManifest[];
  resolve(id: string, version?: string): MCPTool<any, any>;
  health(): any;
  versions(id: string): string[];
  deprecate(id: string, version: string): void;
  remove(id: string, version: string): void;
}
```

### 5. Policy Contract
A reusable policy API for authorization instead of embedding it inside tools.
```typescript
type PolicyDecision = Allow | Deny | ConstrainedAllow;
// Each decision carries structured reasons and optional constraints.
```

### 6. Telemetry Contract
A standard envelope emitted by every tool execution.
```json
{
  "requestId": "...",
  "workflowId": "...",
  "tool": "...",
  "version": "...",
  "workspace": "...",
  "agent": "...",
  "latency": 123,
  "success": true
}
```

### 7. Audit Contract
Immutable audit records for compliance and traceability.
```typescript
interface AuditRecord {
  actor: string;
  agent: string;
  tool: string;
  action: string;
  entity: string;
  before: any;
  after: any;
  timestamp: string;
  correlationId: string;
}
```

### 8. Event Contract
Event schema definitions for the future event bus to prevent incompatible formats.
```typescript
interface PlatformEvent {
  id: string;
  type: string;
  version: string;
  source: string;
  workspace: string;
  timestamp: string;
  payload: any;
  correlationId: string;
}
```

### 9. Capability Contract
Provider-independent capability registry for agents to request capabilities, not models.
```typescript
interface CapabilityDefinition {
  name: string;
  category: string;
  input: any;
  output: any;
  preferredProvider: string;
  fallbackProviders: string[];
  sla: string;
}
```

### 10. Workflow Contract
Declarative schema for workflows before implementing a workflow engine.
```yaml
workflow:
  steps:
    - tool: ...
      inputs: ...
      outputs: ...
      retry: ...
      timeout: ...
      conditions: ...
```

---

## 6 Non-Negotiable Engineering Rules

### Rule 1: Business services never call AI providers.
Only the AI Gateway communicates with model providers.
`Business Service ✖ Gemini`

### Rule 2: Agents never invoke business services directly.
This preserves governance and observability.
`Agent → MCP Tool → Business Service`

### Rule 3: Business services never know about ADK.
Business logic remains independent of orchestration.
`CandidateService ✖ Google ADK`

### Rule 4: MCP tools never contain business rules.
They orchestrate, validate, authorize, and delegate to domain services.

### Rule 5: The Policy Engine is the single enforcement point.
Permissions, ownership, workspace isolation, PII handling, and compliance checks must flow through it.

### Rule 6: Everything is versioned.
Version MCP tools, Workflows, Events, Capabilities, Policies, Agent definitions, and Memory schemas.

---

## Sprint Goal
> **Establish the permanent platform contracts that every future AI capability, workflow, and business domain must implement.**
