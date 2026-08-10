# HN-SEC-002 — Adversarial Security Validation Specification

## Executive Summary & Objective

Having established the runtime security baseline under **HN-SEC-001**, HireNestOS progresses to **HN-SEC-002 — Adversarial Security Validation**. The primary objective of HN-SEC-002 is to actively attempt to bypass, breach, or compromise the defensive boundaries established in HN-SEC-001 through automated adversarial testing across 6 key attack vectors:

1. **Authorization Fuzzing Matrix**
2. **IDOR Cross-Tenant Matrix**
3. **AI Adversarial Corpus & Prompt Injection**
4. **Independent Server-Side AI Tool Policy Enforcement**
5. **Advanced Webhook Tampering & Event Integrity Verification**
6. **Supply Chain & Dependency Vulnerability Auditing**

---

## 1. Security Maturity Progression Model

HireNestOS tracks its security posture along a formal enterprise maturity lifecycle:

```text
  [1] 🟠 Architecture-Defined
       └─ Security controls specified in documentation but awaiting implementation verification.

  [2] 🟢 Security Baseline Implemented & Regression Verified (HN-SEC-001)  <-- CURRENT MILESTONE
       └─ Deterministic acceptance gate passing 11 core P0 security controls.

  [3] 🔵 Adversarially Validated (HN-SEC-002)                              <-- TARGET MILESTONE
       └─ System controls survive active fuzzing, IDOR matrices, prompt injection corpora, and webhook tampering.

  [4] 🟣 Production Security Certified (HN-SEC-003 / HN-SEC-004)
       └─ Validated via isolated staging DAST / autonomous pentesting (Strix) with synthetic data.
```

---

## 2. Six Pillars of Adversarial Validation

### Pillar 1 — Authorization Fuzzing
Fuzzes combination parameters across protected Express API routes:
`{ role, tenantId, organizationId, vendorId, candidateId, requirementId, ownershipId }`

- **Invariant Tested:** `authenticated + valid_resource_id + wrong_tenant == 403_FORBIDDEN`
- **Assertion:** No combinations of mismatched parameters produce unauthorized 200 OK responses.

### Pillar 2 — IDOR Cross-Tenant Regression Matrix
Simulates hostile cross-entity access attempts across all HTTP verbs (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `EXPORT`, `DOWNLOAD`):

| Actor | Target Asset | Expected Behavior |
| :--- | :--- | :--- |
| **Vendor A** | Vendor A Candidate | 🟢 **ALLOW** |
| **Vendor A** | Vendor B Candidate | 🔴 **DENY (403)** |
| **Vendor B** | Vendor A Candidate | 🔴 **DENY (403)** |
| **Client A** | Client A Requirement | 🟢 **ALLOW** |
| **Client A** | Client B Requirement | 🔴 **DENY (403)** |
| **Recruiter A** | Recruiter B Private Notes | 🔴 **DENY (403)** |

### Pillar 3 — AI Adversarial Prompt Corpus
Tests the AI Gateway and Resume Extractor against multi-vector prompt injection attempts embedded in:
- Resumes / CVs (PDF, DOCX, Raw Text)
- Job Descriptions
- Inbound Vendor / Client Emails
- Webhook JSON payloads
- Candidate Notes

**Injections Tested:** System instruction overrides, score inflation, forced candidate shortlisting, secrets exfiltration, ownership takeover, and approval bypass.
**Core Invariant:**
```text
UNTRUSTED CONTENT ──> AI May Interpret ──> AI May NOT Elevate Privileges ──> Server Blocks Violation
```

### Pillar 4 — Independent Server-Side AI Tool Policy Enforcement
Enforces action limits server-side regardless of whether an AI model attempts to invoke a tool:

| Action | Risk Tier | Server Policy Decision for AI Execution |
| :--- | :--- | :---: |
| Search Candidates / Parse CV | Level 0 (Read-Only) | 🟢 **ALLOW** |
| Summarize Resume / Draft Email | Level 0 (Read-Only) | 🟢 **ALLOW** |
| Create Task / Add Internal Note | Level 1 (Low-Risk) | 🟢 **ALLOW** |
| Change Candidate Stage / Submit | Level 2 (Business-Impacting) | 🟡 **REQUIRES HUMAN APPROVAL** |
| Transfer Candidate Ownership | Level 3 (Restricted) | 🔴 **STRICTLY DENIED** |
| Delete Candidate Record | Level 3 (Restricted) | 🔴 **STRICTLY DENIED** |
| Export Candidate Database | Level 3 (Restricted) | 🔴 **STRICTLY DENIED** |
| Modify Security Rules / RBAC | Level 3 (Restricted) | 🔴 **STRICTLY DENIED** |

### Pillar 5 — Webhook Payload Tampering & Event Integrity
Validates edge cases in inbound webhook processing:
- Missing `X-HireNest-Signature` -> **401 Unauthorized**
- Invalid `X-HireNest-Signature` -> **403 Forbidden**
- Stale Timestamp (> 300s old) -> **401 Unauthorized**
- Future Timestamp (> 60s in future) -> **401 Unauthorized**
- Duplicate Event ID (`eventId = ABC`, `payload = X`) -> **200 OK (DUPLICATE_IGNORED)**
- Same Event ID with modified payload (`eventId = ABC`, `payload = Y`) -> **REJECTED (PAYLOAD_MUTATION_MUTATION_ATTEMPT)**

### Pillar 6 — Supply Chain & Dependency Auditing
Audits external packages and document parser dependencies (`pdf-parse`, `mammoth`, `@google/genai`, `firebase-admin`):
- `npm audit` scanning for known CVEs
- Lockfile integrity check
- Verification that zero private secrets exist in client bundles
- Strict file upload MIME-type validation (`application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`)

---

## 3. Security Roadmap Strategy

```text
HN-SEC-001 — Security Hardening & Acceptance Gate (PASS)
      │
      ▼
HN-SEC-002 — Adversarial Security Validation (ACTIVE)
      │
      ▼
HN-SEC-003 — Staging DAST / Autonomous Pentest (Strix)
      │
      ▼
HN-SEC-004 — Production Security Readiness Certification
      │
      ▼
HN-SEC-005 — Continuous Security Monitoring (CI/CD Pipeline)
```

---

## 4. Continuous Integration Security Pipeline (HN-SEC-005)

Every pull request and build must execute the automated security pipeline:

```text
Pull Request Trigger
      │
      ├── 1. Secret Scanning (Zero secrets in frontend build)
      ├── 2. Dependency Vulnerability Audit (`npm audit`)
      ├── 3. SAST / Linter Static Security Check (`npm run lint`)
      ├── 4. HN-SEC-001 Baseline Security Gate (`test-hn-sec-001-gate.ts`)
      └── 5. HN-SEC-002 Adversarial Validation Suite (`test-hn-sec-002-adversarial.ts`)
```
