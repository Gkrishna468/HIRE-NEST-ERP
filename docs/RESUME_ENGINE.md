# HireNestOS Deterministic Resume Engine (Zero-AI Critical Path)

## Architecture Overview

The HireNestOS Resume Engine is built on a **Zero-AI Critical Path** philosophy:
> **"AI can enhance the result (e.g. summaries, recruiter co-pilot), but AI must NEVER be required for the critical result (ingestion, OCR, parsing, candidate creation, skill extraction, experience calculation, matching, ranking, or application)."**

```text
Candidate uploads CV (PDF, DOCX, Scanned PDF, TXT, PNG, JPG, WEBP)
        ↓
File Validation (<10MB, Whitelisted MIME & Extensions)
        ↓
SHA-256 Document Hashing (Cryptographic Identity)
        ↓
Duplicate Detection via Resume Processing Ledger & In-Memory Cache
        ↓
Document Classification & Deterministic Extractor Dispatch
 ┌──────────────────────┬──────────────────────┬──────────────────────┐
 │                      │                      │                      │
PDF Native (pdf-parse)  DOCX Native (mammoth)  Image (PNG/JPG/WEBP)   Plain Text UTF-8
 │                      │                      │                      │
 └──────┬───────────────┴──────┬───────────────┴──────────┬───────────┘
        │ (Sparse Text < 40 chars)                        │
        ↓                                                 │
   Tesseract OCR Fallback                                 │
        │                                                 │
 ┌──────┴─────────────────────────────────────────────────┘
 ↓
Clean Normalization (Whitespace, UTF-8, Hyphenation repair)
 ↓
Deterministic Resume Parser
 ├── Contact & Identity Extractor (Name, Email, Phone, Location, LinkedIn, GitHub)
 ├── Controlled Skills Taxonomy (50+ Canonical stacks, Aliases, Synonyms e.g. C++17 -> C++)
 ├── Experience Calculator (Date Union Arithmetic, Overlap Resolution, Stated Experience)
 └── Education & Credentials (Degrees, Institutions, Certifications, Notice Period)
 ↓
Candidate Profile Generation
 ↓
Resume Processing Ledger Audit Record (Firestore & Memory)
```

## Supported File Formats & Extractor Routing
1. **PDF Text Resumes**: Extracted natively via `pdf-parse`.
2. **Scanned PDFs**: Automatically detected if extracted text is sparse (<40 chars) and routed to page screenshot OCR.
3. **DOCX / Word**: Extracted natively via `mammoth.extractRawText`, with fallback to embedded media image OCR.
4. **Images (PNG, JPG, JPEG, WEBP)**: Extracted via Tesseract OCR worker.
5. **Plain Text / Markdown / RTF**: Extracted via UTF-8 buffer normalization.

## Deterministic Parsing Modules
- `src/resume-engine/parser/contact.ts`: Robust regexes for name heuristics, RFC 5322 emails, Indian (`+91` / `0` / 10-digit) and international E.164 phone numbers, locations, LinkedIn, and GitHub profiles.
- `src/resume-engine/parser/skills.ts`: Controlled taxonomy with 50+ canonical stacks across Languages, Frontend, Backend, Cloud, Database, DevOps, Testing, and Systems. Normalizes aliases (e.g. `c++17`, `c/c++`, `cpp` -> `C++`; `reactjs` -> `React`).
- `src/resume-engine/parser/experience.ts`: Resolves date tokens (e.g., `Jan 2018 - Mar 2021`, `04/2019 to Present`), calculates overlapping date ranges via interval union, and returns accurate total experience in years.
- `src/resume-engine/parser/education.ts`: Extracts degrees (B.Tech, B.E., M.S., MCA, MBA, Ph.D), institutions, graduation years, and certifications (AWS, CKA, PMP, etc.).
- `src/resume-engine/ledger/ResumeLedgerService.ts`: Records `candidateId`, `documentHash` (SHA-256), `parserVersion`, `extractionMethod`, `ocrUsed`, `status`, `textLength`, and timestamps.
