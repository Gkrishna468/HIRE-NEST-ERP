# Security & Access Document

> **Authoritative Specification:** This document is governed by the [HN-SEC-001 Security Acceptance Gate Specification](./HN_SEC_001_SECURITY_ACCEPTANCE_GATE.md) and [HN-SEC-002 Adversarial Security Validation](./HN_SEC_002_ADVERSARIAL_SECURITY_VALIDATION.md). All code changes and feature additions must satisfy the 11 P0 Security Gate controls defined in HN-SEC-001 and pass adversarial validation in HN-SEC-002.

> **Security Assurance Boundary Notice:** HN-SEC-001 establishes the HireNestOS runtime security baseline and verifies defined security invariants through automated regression testing. A passing HN-SEC-001 gate confirms that specified controls are implemented and functioning under tested scenarios. It does not constitute a comprehensive penetration test or guarantee against previously unidentified attack vectors. Adversarial testing is continuously conducted under HN-SEC-002.

## Role Matrix
| Role | Read | Write | Delete |
|---|---|---|---|
| Admin | All | All | Limited (Super Admin) |
| Recruiter | Assigned Data | Assigned Data | No |
| Vendor | Own Data (Submissions, Candidates) | Own Data | No |
| Client | Submitted Candidates to their Jobs | Feedback/Stage Update Only | No |

## Multi-Layer Security Architecture
HireNestOS enforces security across 5 distinct runtime layers:
1. **Layer 1 — Firebase Auth**: Token verification and identity resolution.
2. **Layer 2 — Firestore Security Rules**: Attribute-Based Access Control (ABAC) at the database layer.
3. **Layer 3 — Express API Middleware**: Server-side `verifyAuth` and `requireRole` checks.
4. **Layer 4 — Candidate Ownership Engine**: Ownership vault locking and collision prevention (`CandidateOwnershipEngine`).
5. **Layer 5 — Audit Ledger**: Immutable audit trail logging to `operationalEvents` and `business_events`.

## Dangerous AI Action Policy
All AI operations are classified into 4 risk levels (Level 0: Read-Only, Level 1: Low-Risk, Level 2: Business-Impacting, Level 3: Restricted). Level 3 actions (ownership changes, database exports, candidate deletion) are **strictly forbidden** for autonomous AI execution.

## Webhook Security
Inbound webhooks require HMAC-SHA256 signature verification (`X-HireNest-Signature`), timestamp freshness checks (`X-HireNest-Timestamp`), and event idempotency checks (`X-HireNest-Event-Id`).
