# HireNestOS Data Governance & Operational Source of Truth

## Source of Truth Principles
1. **Firestore is the Runtime Operational Source of Truth**:
   - Stores active candidates, requirements, submissions, pipelines, organizations, and users.
   - `resume_processing_ledger`: Records every document upload, SHA-256 hash, extraction method, OCR status, text length, and parsing timestamp.
   - `resume_cache`: Keyed by SHA-256 document hash for instant retrieval on duplicate or repeated uploads.
   - `candidate_matches` & `requirement_match_index`: Single source of truth for all match intelligence.

2. **GitHub for Code, Governance, and Version History**:
   - Tracks codebase releases, architecture decision records (ADRs), schemas, and change audits.
   - Never used as a direct operational runtime tracking database.

3. **Cryptographic Deduplication & Auditability**:
   - Every uploaded document receives a SHA-256 hash immediately upon file receipt.
   - Subsequent uploads of identical documents are detected deterministically with zero redundant computation or OCR cycles.
   - Complete ledger trail guarantees traceability from raw document byte stream to recruiter submission.
