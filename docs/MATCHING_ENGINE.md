# HireNestOS Deterministic Fitment Intelligence & Matching Engine

## Architecture Overview

The Fitment Intelligence Engine evaluates candidate suitability against job requirements with mathematical determinism, full explainability, and zero dependency on AI models.

## Scoring Model & Weights
The universal fitment score (0–100%) is calculated across 8 distinct weighted dimensions:
1. **Core Skills (30%)**: Strict overlap ratio against mandatory/primary required skills using the canonical skill taxonomy.
2. **Experience (20%)**: Evaluates total candidate experience against requirement threshold with graceful band scaling.
3. **Secondary Skills (15%)**: Overlap ratio against adjacent/secondary technologies.
4. **Domain Match (10%)**: Industry / sector alignment.
5. **Location / Work Mode (10%)**: Geographic proximity and remote/hybrid work compatibility.
6. **Notice Period (5%)**: Candidate availability relative to role urgency (Immediate, 15d, 30d, 60d, 90d).
7. **Education (5%)**: Degree and institution qualification match.
8. **Credentials / Keywords (5%)**: Relevant certifications and domain keywords.

## Hard Gate Constraints
Hard gates represent non-negotiable boundaries. If a hard gate fails, the candidate is classified as `HARD_GATE_FAIL` regardless of other scores:
- **Minimum Experience Gate**: Candidate experience must not be significantly below the stated minimum.
- **Mandatory Skills Gate**: Candidate must possess critical core skills.
- **Notice Period Gate**: Candidate notice period must not exceed maximum tolerance.

## Classification Tiers & Routing Queues
- **`PRIMARY` (90–100%)**: Routed to **Priority Queue** for direct client submission & technical interview.
- **`PRIMARY/BACKUP` (75–89%)**: Routed to **AI Validation Queue** for recruiter quick-screen.
- **`BACKUP` (60–74%)**: Retained in **Backup Pool** for alternate positions.
- **`HOLD` (40–59%)**: On hold for subsequent requirement reviews.
- **`GAP` (<40%) / `HARD_GATE_FAIL`**: Archived with explicit gap reasoning.

## Fitment Matrix Evidence Table
Every evaluation produces a line-by-line evidence table:
| Requirement Criteria | Candidate Resume Evidence | Result | Category | Weight |
|:---|:---|:---:|:---:|:---:|
| Experience: 8+ years | 9.0 years total experience | **STRONG** | EXPERIENCE | 20% |
| Core Skill: C++ | Demonstrated proficiency in C++ | **STRONG** | CORE_SKILL | 10% |
| Core Skill: Linux | Demonstrated proficiency in Linux | **STRONG** | CORE_SKILL | 10% |
| Core Skill: Multithreading/IPC | Demonstrated proficiency in Multithreading/IPC | **STRONG** | CORE_SKILL | 10% |
| Location: Pune, India (Hybrid) | Candidate location: Pune, India | **STRONG** | LOCATION | 10% |
| Notice Period: <= 30 days | Availability: 15 Days | **STRONG** | NOTICE_PERIOD | 5% |
