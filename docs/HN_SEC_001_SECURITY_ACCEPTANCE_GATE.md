# HN-SEC-001 — HireNestOS Security Hardening & Acceptance Gate v1.0

## Executive Summary & Security Philosophy

HireNestOS is an AI-Native Staffing Operating System serving multi-tenant recruitment agencies, enterprise clients, and candidate pipelines. As an autonomous platform handling Sensitive Personal Data (PII), proprietary vendor benches, and high-value hiring agreements, **HireNestOS enforces server-side Attribute-Based Access Control (ABAC), tenant isolation, strict AI execution guardrails, and cryptographic webhook verification.**

The **HireNestOS Security Gate v1.0** establishes a non-negotiable certification framework that every pull request, system modification, and service integration must satisfy prior to production deployment.

### Security Assurance Boundary Notice
> **Security Assurance Boundary:** HN-SEC-001 establishes the HireNestOS runtime security baseline and verifies defined security invariants through automated regression testing. A passing HN-SEC-001 gate confirms that the specified controls are implemented and functioning under the tested scenarios. It does not constitute a comprehensive penetration test, vulnerability-free certification, or guarantee against previously unidentified attack classes. Continuous adversarial testing is enforced under **HN-SEC-002**.

---

## 1. HireNestOS Security Gate v1.0 — Acceptance Matrix

| Control ID | Security Dimension | Verification Standard | Implementation Mechanism | Status |
| :--- | :--- | :--- | :--- | :---: |
| **SEC-001** | 🔴 Tenant Isolation | Vendor A cannot read, query, or mutate Vendor B candidates | Backend tenant query filtering & Firestore security rules | **PASS** |
| **SEC-002** | 🔴 Candidate Ownership | Candidate ownership cannot be changed via crafted API payloads | `CandidateOwnershipEngine` server-side lock validation | **PASS** |
| **SEC-003** | 🔴 Server-Side RBAC | Every API endpoint checks actor roles on the server | `verifyAuth` & `requireRole` middleware on Express routes | **PASS** |
| **SEC-004** | 🔴 Firestore Rules | Direct client SDK calls cannot bypass multi-tenant boundaries | ABAC Firestore rules (`request.auth.uid == resource.data.ownerId`) | **PASS** |
| **SEC-005** | 🔴 AI Prompt Isolation | Resumes, JDs, and external text cannot hijack system instructions | System prompt framing boundary & untrusted context isolation | **PASS** |
| **SEC-006** | 🔴 AI Tool Permissions | AI agents cannot directly perform unauthorized state changes | Action Level classification & deterministic approval gates | **PASS** |
| **SEC-007** | 🔴 Secret Isolation | Zero private credentials or API keys exposed to browser bundles | Server-side proxying via `/api/*` and `.env.example` declaration | **PASS** |
| **SEC-008** | 🔴 Admin SDK Safety | Firebase Admin SDK credentials reside strictly server-side | `firebase-admin` initialized only in server context | **PASS** |
| **SEC-009** | 🔴 Webhook Security | External events require HMAC signature, timestamp & replay checks | `X-HireNest-Signature`, `X-HireNest-Timestamp`, Event ID lookup | **PASS** |
| **SEC-010** | 🔴 File Security | Uploaded resumes/documents cannot be executable or public | MIME type validation, storage bucket path isolation, signed URLs | **PASS** |
| **SEC-011** | 🔴 Immutable Audit Trail | Sensitive mutations emit append-only immutable security ledger events | `operationalEvents` & `business_events` read-only log | **PASS** |

---

## 2. Untrusted Data Boundary Model

To protect Gemini and LLM reasoning engines from prompt injection attacks embedded inside user-uploaded resumes, job descriptions, or external emails, HireNestOS strictly enforces an **Untrusted Data Boundary**:

```text
                        TRUSTED BOUNDARY (Server Controlled)
                         │
                1. System Instructions (Immutable)
                         │
                2. Application Security Policy
                         │
                3. Authenticated Identity & Claims (RBAC/ABAC)
                         │
─────────────────────────┼──────────────────────────────────────────────────────────
                         │
                       UNTRUSTED BOUNDARY (Data to Analyze, NEVER Instructions to Obey)
                         │
                4. Resume Content / Candidate CV / Text Uploads
                         │
                5. Job Description Specs / Client Emails / Inbound Webhooks
                         │
                6. Web Scraped Profile Content / External Vendor Payloads
```

### Prompt Framing Rule
> **Rule:** All untrusted input passed to AI models is encapsulated within explicit structural tags (`<untrusted_document_content>...</untrusted_document_content>`). System instructions explicitly instruct the model to treat content within these tags as raw string data to analyze, parse, or summarize, and **never** as actionable system instructions.

---

## 3. AI Authorization & Non-Bypass Architecture

**AI models in HireNestOS are decision-support and recommendation engines, NEVER authorization enforcers or direct state mutation handlers.**

### Correct Request Flow:
```text
User / Agent Trigger
      │
      ▼
Express API Route
      │
      ▼
verifyAuth Middleware (Verify Firebase Token / API Key)
      │
      ▼
requireRole Middleware (Verify Role Claims)
      │
      ▼
CandidateOwnershipEngine (Server-side Lock Verification)
      │
      ▼
Business Logic / AI Gateway Execution
      │
      ▼
Action Policy Validation (Verify Action Level & Limits)
      │
      ▼
Firestore State Mutation
      │
      ▼
Immutable Audit Ledger Event (`operationalEvents`)
```

---

## 4. Candidate Ownership Engine as a Hard Security Boundary

The `CandidateOwnershipEngine` operates as a central server-side gatekeeper for agency candidate protection and candidate poaching prevention.

### Core Security Verification Methods:
- `establishOwnership(candidateId, ownerId, ownerType, lockDays)`: Registers an immutable ownership lock (default 90 days) in `candidateOwnership` and records an operational audit event.
- `verifyOwnership(candidateId, vendorId)`: Confirms if the requesting vendor holds active, non-expired ownership.
- `verifyOwnershipAndCheckConflicts(candidateId, requestingOrgId)`: Scans for active locks held by other organizations and rejects unauthorized access or duplicate submissions.

---

## 5. Webhook Security Architecture (HMAC + Timestamp + Idempotency)

Inbound webhooks (e.g., from n8n, WhatsApp, CRM connectors, or payment gateways) are validated through a 3-layer cryptographic gate:

```text
Inbound Webhook
      │
      ├── 1. Signature Verification: HMAC-SHA256 signature match against X-HireNest-Signature
      │
      ├── 2. Timestamp Freshness Check: Current time - X-HireNest-Timestamp <= 300 seconds (5 mins)
      │
      └── 3. Idempotency Lookup: Verify X-HireNest-Event-Id against business_events ledger
            │
            ├─► If Exists: Return 200 OK (DUPLICATE_IGNORED)
            └─► If New: Process Event & Write to Ledger
```

---

## 6. Dangerous AI Action Policy Matrix

HireNestOS classifies all AI-initiated operations into 4 distinct risk tiers:

| Action Level | Risk Profile | Example Operations | Execution Authorization Policy |
| :--- | :--- | :--- | :--- |
| **Level 0** | Read-Only | Search candidate pool, summarize job description, extract resume skills | Fully Automated |
| **Level 1** | Low-Risk Mutation | Generate task reminders, create internal candidate notes, tag skills | Automated with RBAC context |
| **Level 2** | Business-Impacting | Submit candidate to job, move candidate stage, dispatch recruiter email | Requires RBAC validation & explicit human confirmation |
| **Level 3** | Restricted (Restricted) | Change candidate ownership, modify rate card, delete candidate, export candidate database | **STRICTLY FORBIDDEN FOR AI AGENTS** (Human Super-Admin Only) |

---

## 7. Automated Workstream Reference (SEC-001 to SEC-016)

```text
HN-SEC-001
│
├── SEC-001 Firebase Rules Multi-Tenant Verification
├── SEC-002 RBAC & ABAC Server Enforcement
├── SEC-003 Candidate IDOR Security Audit
├── SEC-004 Candidate Ownership Vault Hard Boundary
├── SEC-005 Express API Middleware Security Pipelines
├── SEC-006 AI Prompt Framing & Injection Isolation
├── SEC-007 AI Tool Authorization & Level 3 Restriction
├── SEC-008 Webhook HMAC & Replay Prevention
├── SEC-009 Secret Exposure & Client Bundle Audit
├── SEC-010 File Upload Validation & Path Safety
├── SEC-011 Express Rate Limiting & Egress Guard
├── SEC-012 Audit Ledger Event Immutability
├── SEC-013 Dependency & Supply Chain Security
├── SEC-014 OWASP Security Headers (Helmet)
├── SEC-015 Staging DAST Automation
└── SEC-016 Controlled Penetration Test Verification
```
