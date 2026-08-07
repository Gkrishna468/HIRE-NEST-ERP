# Platform Standards (Constitution)

This document serves as the constitution of the HireNest Enterprise AI Platform. It contains strict, non-negotiable rules for all development across the platform.

## Engineering Standards

*   **Dependency Direction**: Dependencies must strictly flow downwards. No upward dependencies are allowed.
    ```text
    Presentation
         ↓
    Application
         ↓
    MCP
         ↓
    Business Domain
         ↓
    Infrastructure
    ```
*   **Naming Conventions**: Use clear, domain-driven names for all variables, functions, and services.
*   **Package Layout**: Strict adherence to the package structure defined in the architecture documentation.
*   **Folder Ownership**: Clear boundaries for domain ownership.
*   **Import Restrictions**: Domains may not import from each other directly; they must communicate via events or defined interfaces.

## Design Standards

Every component must adhere to:

*   **Single Responsibility Principle**: One reason to change.
*   **Dependency Injection**: Inject external services, do not instantiate them internally.
*   **Interface-First Design**: Define the contract before writing the implementation.
*   **Immutable Contracts**: Once a contract is published, it cannot be changed without versioning.
*   **Semantic Versioning**: Follow SemVer strictly.

## Tool Standards

Every MCP tool must:

*   Implement the standard `MCPTool` interface.
*   Include a comprehensive manifest.
*   Emit standard telemetry envelopes.
*   Emit immutable audit records.
*   Support versioning.
*   Support health checks.
*   Support dynamic discovery via the Registry.

## Agent Standards

Every agent must explicitly declare:

*   Persona
*   Permissions
*   Memory
*   Capabilities
*   Token Budget
*   Allowed Models
*   Fallback Strategy

**No exceptions.** Agent logic must not be hardcoded.

## Workflow Standards

Every workflow must be:

*   **Declarative**: Defined by a schema, not imperative code.
*   **Versioned**: Workflow definitions can evolve over time.
*   **Idempotent**: Safe to retry.
*   **Observable**: Emits telemetry at each step.
*   **Retry-Aware**: Handles failures gracefully.

## Event Standards

Every domain event must include:

*   Immutable Payload
*   Version
*   Correlation ID
*   Workspace ID
*   Timestamp
*   Source
*   Type

## Coding Standards

**No business logic** is permitted inside:

*   MCP tools (they orchestrate and delegate)
*   Controllers / API Handlers
*   ADK Agents
*   UI Components

Business logic belongs **only** in Domain Services.

## AI Standards

No component should ever instantiate a model directly:

```typescript
// ❌ FORBIDDEN
new Gemini()
new OpenAI()
new Ollama()
```

Only the **AI Gateway** can communicate with providers. Other components request capabilities from the Gateway.

## Firestore Standards

Every write to Firestore must include:

*   Audit metadata
*   User ID
*   Workspace ID
*   Timestamp
*   Correlation ID

**No direct writes from UI components.** All database interactions must go through the appropriate service layer.

## Platform Standards

Everything in the platform should be:

*   Discoverable
*   Versioned
*   Observable
*   Auditable
*   Governed
*   Testable
