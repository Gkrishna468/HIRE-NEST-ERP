# HN-SEC-003: Controlled Dynamic Security Assessment Specification

## Executive Overview & Architectural Isolation

The **HN-SEC-003** phase establishes a controlled, evidence-driven dynamic security assessment framework for HireNestOS using autonomous dynamic scanners and security agents (Strix) operating strictly within a non-production, preventive-isolated staging environment.

```
                    PRODUCTION ENVIRONMENT
                              🚫
               [COMPLETELY ISOLATED / UNREACHABLE]
                              │
                              ▼
                   DEDICATED SECURITY BRANCH
                              │
                              ▼
                     STAGING ENVIRONMENT
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
     Test Firebase       Test Storage        Test APIs
      (Isolated)         (Isolated)         (Isolated)
            │                 │                 │
            └─────────────────┼─────────────────┘
                              ▼
                   SYNTHETIC DATA PIPELINE
              (Zero PII / Zero Production Hashes)
                              │
                              ▼
                     STRIX ASSESSMENT ENGINE
                              │
                              ▼
                    SECURITY FINDINGS LEDGER
                              │
                              ▼
                   REMEDIATION & RE-TEST LOOP
```

---

## 1. Preventive Isolation & Credential Policy

To guarantee zero production exposure or contamination, Strix and the staging environment are configured with **preventive network and authentication isolation**. Staging is technically incapable of authenticating to Production endpoints.

### Prohibited Credentials (Hard Blocklist)
Strix and the dynamic assessment suite are strictly forbidden from receiving:
- ❌ Production Firebase credentials
- ❌ Firebase Admin credentials
- ❌ Real candidate resumes or real candidate PII
- ❌ Production API keys (Gemini, Stripe, OpenAI, SendGrid)
- ❌ Production service-account credentials
- ❌ Unrestricted network or production VPC access

---

## 2. Synthetic Data Policy Invariants (Hard Release Gates)

The staging test environment must satisfy five zero-trust data invariants before any assessment begins:

| Data Invariant | Mandatory Value | Verification Status |
| :--- | :--- | :--- |
| **Production PII Records** | `0` | 🟢 ENFORCED |
| **Production Resume Hashes** | `0` | 🟢 ENFORCED |
| **Production Candidate Documents** | `0` | 🟢 ENFORCED |
| **Production Credentials** | `0` | 🟢 ENFORCED |
| **Production API Tokens** | `0` | 🟢 ENFORCED |

---

## 3. SEC-017: Privileged Identity Authorization Control

All hardcoded email allowlists for `super_admin` or `admin` status have been eradicated. Authorization is governed strictly by authoritative, server-verified identity records and custom claims (`users/{uid}`).

```
Firebase Auth UID
       ↓
Server-Side Identity Record (users/{uid})
       ↓
Verified Role & Organization (ORG-GLOBAL-HQ)
       ↓
Authorization Policy Enforcement
```

### SEC-017 Acceptance Suite Results

| Test ID | Scenario | Expected Behavior | Status |
| :--- | :--- | :--- | :--- |
| **TEST_I** | Known UID + `super_admin` claim/record | ALLOW access | 🟢 PASS |
| **TEST_J** | Known email + wrong UID / wrong claim | DENY access | 🟢 PASS |
| **TEST_K** | Normal user mutates client role state | DENY access | 🟢 PASS |
| **TEST_L** | Normal user mutates client `organizationId` | DENY access | 🟢 PASS |
| **TEST_M** | User changes email to privileged address | DENY access | 🟢 PASS |
| **TEST_N** | Disabled privileged account (`status: disabled`) | DENY access | 🟢 PASS |
| **TEST_O** | Privileged account without `ORG-GLOBAL-HQ` | DENY access | 🟢 PASS |

---

## 4. HN-SEC-003 Severity Thresholds & Acceptance Criteria

### P0 Severity (0 Unresolved Required for Release)
- Authentication bypass
- Authorization bypass
- Cross-tenant data access
- Candidate IDOR / ownership bypass
- Admin privilege escalation
- Secret exposure
- Arbitrary server-side execution
- Critical SSRF / Injection

### P1 Severity (0 Unresolved or Formally Risk-Accepted Required)
- High-impact API abuse
- File upload vulnerabilities
- Sensitive information disclosure
- Weak rate limiting / session weaknesses
- Webhook tampering weaknesses
- AI tool authorization bypass

### P2 / P3 Severity
- Documented in Remediation Queue, prioritized for standard engineering sprints.

---

## 5. Strix Evidence Classification Schema

Every finding produced during HN-SEC-003 dynamic scans is structured according to the following schema:

```json
{
  "findingId": "HNSEC3-001",
  "severity": "P0",
  "target": "/api/candidates/SEC_CAND_101",
  "endpoint": "GET /api/candidates/:id",
  "attackClass": "Cross-Tenant Authorization / IDOR",
  "observedBehavior": "Tenant B received candidate metadata owned by Tenant A",
  "expectedBehavior": "403 Forbidden with zero metadata payload",
  "evidence": "HTTP 200 OK returned with payload {\"candidateId\":\"SEC_CAND_101\"}",
  "affectedComponent": "Candidate API Handler",
  "tenantContext": "VENDOR_BETA_CORP",
  "authContext": "Bearer token user_vendor_b",
  "reproductionReference": "scripts/reproduce-hnsec3-001.ts",
  "remediation": "Apply ABAC filter validating resource.vendorId == req.user.vendorId",
  "regressionTest": "scripts/test-hn-sec-001-gate.ts",
  "status": "OPEN"
}
```

---

## 6. Remediation & Validation Loop Workflow

```
Dynamic Strix Scan
        │
        ▼
Engineering Validation
        │
  ┌─────┴─────┐
  ▼           ▼
Confirmed?  False Positive
  │           │
  ▼           ▼
Fix Code    Document Justification
  │           │
  ▼           └────────┐
Regression Test        │
  │                    │
  ▼                    │
Re-Run Assessment      │
  │                    │
  └──────────┬─────────┘
             ▼
      Close Finding
```

---

## 7. Final Release Gate Equation

HireNestOS achieves **Production Security Readiness** when and only when:

$$\text{Release Gate} = (\text{P0} = 0) \land (\text{P1} = 0) \land (\text{ProdPII} = 0) \land (\text{ProdCreds} = 0) \land (\text{Cleanup} = \text{PASS}) \land (\text{Regression} = \text{PASS})$$

```
                            ┌────────────────────────┐
                            │ FINAL SECURITY GATE    │
                            └───────────┬────────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
      P0 Unresolved = 0            P1 Unresolved = 0         Prod Exposure = 0
           │                            │                            │
           └────────────────────────────┼────────────────────────────┘
                                        ▼
                           🟢 SECURITY PASS CERTIFIED
```

---

## 8. Current Security Certification Status

- **HN-SEC-001 Security Hardening & Acceptance Gate:** 🟢 PASS (8/8)
- **HN-SEC-002 Adversarial Security Validation Suite:** 🟢 PASS (6/6)
- **SEC-017 Privileged Identity Authorization Suite:** 🟢 PASS (7/7)
- **Browser Compatibility & Runtime Integrity:** 🟢 RESOLVED (`node-domexception` browser shim applied)
- **Test-Data Isolation & Fail-Closed Cleanup:** 🟢 IMPLEMENTED
- **HN-SEC-003 Controlled Dynamic Assessment Architecture:** 🟢 APPROVED & SPECIFIED
- **Production Security Certification:** ⏳ Ready for Controlled Dynamic Assessment Execution
