/**
 * HireNestOS Deterministic Resume Engine - Type Definitions
 * Version: 2.5.0 (Zero-AI Architecture)
 */

export type ExtractionMethod = 
  | "PDF_TEXT"
  | "PDF_SCANNED_OCR"
  | "PDF_RECOVERY_OCR"
  | "DOCX_MAMMOTH"
  | "DOCX_IMAGE_OCR"
  | "IMAGE_OCR"
  | "TEXT_UTF8"
  | "CACHE_HIT";

export type LedgerStatus = "COMPLETED" | "SUCCESS" | "DUPLICATE" | "FAILED" | "PROCESSING" | "QUEUED" | "MANUAL_REVIEW" | "PARTIAL";

export type PipelineStage = 
  | "QUEUED" 
  | "PROCESSING" 
  | "EXTRACTING" 
  | "OCR" 
  | "PARSING" 
  | "PERSISTING" 
  | "COMPLETED" 
  | "FAILED" 
  | "DUPLICATE" 
  | "MANUAL_REVIEW";

export interface ResumeProcessingTimelineEvent {
  stage: PipelineStage;
  status: "SUCCESS" | "IN_PROGRESS" | "FAILED";
  timestamp: string;
  message: string;
  durationMs?: number;
}

export interface ResumeProcessingLedgerEntry {
  resumeProcessingId: string;
  candidateId?: string;
  documentHash: string; // SHA-256
  filename: string;
  mimeType: string;
  fileSize: number;
  parserVersion: string;
  ocrVersion?: string;
  extractionMethod: ExtractionMethod;
  ocrUsed: boolean;
  startedAt: string;
  completedAt?: string;
  updatedAt: string;
  status: LedgerStatus;
  stage: PipelineStage;
  candidateName?: string;
  email?: string;
  phone?: string;
  location?: string;
  totalExperience?: number;
  skillsFound?: number;
  skills?: string[];
  errorCode?: string;
  errorMessage?: string;
  requiresManualReview?: boolean;
  textLength: number;
  confidence: number; // 0 to 1
  timeline: ResumeProcessingTimelineEvent[];
  metadata?: Record<string, any>;
}

export interface EmploymentRecord {
  company: string;
  designation: string;
  startDate?: string; // YYYY-MM
  endDate?: string;   // YYYY-MM or 'Present'
  durationMonths?: number;
  rawPeriod?: string;
  isCurrent?: boolean;
  description?: string;
}

export interface EducationRecord {
  degree: string;
  field?: string;
  institution: string;
  graduationYear?: number;
  rawText?: string;
}

export interface CertificationRecord {
  name: string;
  issuer?: string;
  year?: number;
}

export interface CandidateProfile {
  name?: string;
  candidateName: string;
  email: string;
  phone: string;
  location: string;
  currentLocation: string;
  totalExperience: number; // Years with decimal precision (e.g. 7.1)
  skills: string[];
  normalizedSkills: string[];
  companies: string[];
  designations: string[];
  employmentHistory: EmploymentRecord[];
  currentCompany: string;
  currentRole: string;
  education: EducationRecord[];
  certifications: string[];
  noticePeriod: string; // e.g. 'Immediate', '15 Days', '30 Days', '60 Days', '90 Days', 'Not Specified'
  linkedin: string;
  github: string;
  portfolio: string;
  resumeText: string;
  documentHash: string;
  summary: string;
  status: "PARSED" | "PARTIAL" | "MANUAL_REVIEW_REQUIRED";
  parsedAt: string;
}

export interface SkillMatchDetail {
  requirementSkill: string;
  matchedCandidateSkill?: string;
  status: "STRONG" | "VALIDATE" | "GAP";
  evidenceText?: string;
  category?: string;
  isMandatory?: boolean;
}

export type FitmentTier = "PRIMARY" | "PRIMARY/BACKUP" | "BACKUP" | "HOLD" | "GAP" | "HARD_GATE_FAIL";

export interface FitmentMatrixRow {
  requirement: string;
  resumeEvidence: string;
  result: "STRONG" | "VALIDATE" | "GAP" | "HARD_GATE_FAIL";
  category: "EXPERIENCE" | "CORE_SKILL" | "SECONDARY_SKILL" | "LOCATION" | "NOTICE_PERIOD" | "EDUCATION" | "DOMAIN" | "OTHER";
  weight: number;
  scoreContribution: number;
}

export interface HardGateEvaluation {
  passed: boolean;
  failedGates: string[];
  reasons: string[];
}

export interface FitmentScoreBreakdown {
  experienceScore: number;       // 20% weight
  coreSkillsScore: number;       // 30% weight
  secondarySkillsScore: number;  // 15% weight
  domainScore: number;           // 10% weight
  locationScore: number;         // 10% weight
  noticePeriodScore: number;     // 5% weight
  educationScore: number;        // 5% weight
  otherScore: number;            // 5% weight
  totalScore: number;            // 0 - 100%
}

export interface FitmentResult {
  candidateId: string;
  requirementId: string;
  fitmentScore: number;
  tier: FitmentTier;
  hardGatesPassed: boolean;
  hardGateDetails: HardGateEvaluation;
  breakdown: FitmentScoreBreakdown;
  matrix: FitmentMatrixRow[];
  skillsMatched: string[];
  skillsMissing: string[];
  evidenceSummary: string;
  explanation: {
    strengths: string[];
    gaps: string[];
    recommendation: "STRONG_FIT" | "CONSIDER" | "BACKUP" | "NOT_SUITABLE";
    nextAction: string;
  };
  calculatedAt: string;
  engineVersion: string;
}
