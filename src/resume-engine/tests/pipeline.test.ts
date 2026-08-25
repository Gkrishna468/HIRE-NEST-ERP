/**
 * HireNestOS End-to-End Deterministic Pipeline Test Suite
 * Validates complete Zero-AI Resume Ingestion -> Extraction -> OCR -> Parse -> Match -> Rank flow.
 */

import { extractDocumentText } from "../extractors/index.js";
import { parseResumeDeterministically } from "../parser/resume-parser.js";
import { FitmentEngine } from "../matching/fitment-engine.js";
import { CandidateRankingService } from "../matching/ranking.js";
import { ResumeLedgerService } from "../ledger/ResumeLedgerService.js";

export async function runPipelineTests(): Promise<{ passed: number; failed: number; errors: string[] }> {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  function assert(condition: boolean, testName: string) {
    if (condition) {
      passed++;
      console.log(`  ✓ ${testName}`);
    } else {
      failed++;
      errors.push(testName);
      console.error(`  ✗ FAIL: ${testName}`);
    }
  }

  console.log("\n=== [TEST SUITE 3: END-TO-END PIPELINE & ZERO-AI VERIFICATION] ===");

  // 1. Text / Document Ingestion & Hashing
  console.log("-> Testing Document Hashing & Extraction:");
  const sampleResumeContent = `
    Priya Sharma
    Email: priya.sharma@cloudtech.com | Phone: +91 98200 11223 | Location: Bengaluru, India
    LinkedIn: linkedin.com/in/priyasharma-cloud | GitHub: github.com/priyasharma

    PROFESSIONAL SUMMARY
    Staff Cloud DevOps Engineer with 10 years of experience designing scalable Kubernetes clusters, Terraform IaC, AWS infrastructure, and CI/CD pipelines.

    EXPERIENCE
    Amazon Web Services - Senior DevOps Engineer
    Mar 2021 - Present
    - Architected multi-region AWS EKS Kubernetes clusters handling 50k RPS.
    - Automated zero-downtime deployment pipelines using GitHub Actions, Docker, and Argo CD.

    Wipro Technologies - Cloud Infrastructure Lead
    Jan 2017 - Feb 2021
    - Led cloud migration of enterprise applications to AWS and Azure using Terraform.
    - Implemented Prometheus & Grafana observability infrastructure.

    Cognizant - Systems Engineer
    Aug 2014 - Dec 2016
    - Linux systems administration, bash automation, and database backup pipelines.

    EDUCATION
    Bachelor of Technology in Computer Science, 2014
    Visvesvaraya Technological University

    TECHNICAL SKILLS
    Cloud: AWS, Azure, GCP
    DevOps: Kubernetes, Docker, Terraform, CI/CD, Linux, Prometheus/Grafana, Nginx
    Languages: Python, Go, Bash/Shell, SQL
    Notice Period: Immediate
  `;

  const docBuffer = Buffer.from(sampleResumeContent, "utf-8");
  const extractionResult = await extractDocumentText({
    buffer: docBuffer,
    filename: "Priya_Sharma_Resume.txt",
    mimeType: "text/plain",
  });

  assert(extractionResult.documentHash.length === 64, "Generated valid 64-character SHA-256 document hash");
  assert(extractionResult.normalizedText.length > 200, "Extracted normalized document text");
  assert(extractionResult.extractionMethod === "TEXT_UTF8", "Used deterministic TEXT_UTF8 extractor");

  // 2. Duplicate Detection via SHA-256
  console.log("-> Testing SHA-256 Duplicate Detection:");
  const duplicateExtraction = await extractDocumentText({
    buffer: docBuffer,
    filename: "Priya_Sharma_Resume_Copy.txt",
    mimeType: "text/plain",
  });
  assert(duplicateExtraction.isDuplicate === true, "Detected duplicate resume upload via SHA-256 hash match");
  assert(duplicateExtraction.documentHash === extractionResult.documentHash, "Document hashes match exactly");

  // 3. Deterministic Parsing
  console.log("-> Testing Zero-AI Candidate Profile Construction:");
  const parsedCandidate = parseResumeDeterministically({
    text: extractionResult.normalizedText,
    filename: extractionResult.filename,
    documentHash: extractionResult.documentHash,
  });

  assert(parsedCandidate.candidateName === "Priya Sharma", "Correctly identified candidate name 'Priya Sharma'");
  assert(parsedCandidate.email === "priya.sharma@cloudtech.com", "Correctly identified candidate email");
  assert(parsedCandidate.totalExperience >= 9.5 && parsedCandidate.totalExperience <= 10.5, `Calculated accurate experience: ${parsedCandidate.totalExperience} years`);
  assert(parsedCandidate.normalizedSkills.includes("AWS"), "Extracted 'AWS' skill");
  assert(parsedCandidate.normalizedSkills.includes("Kubernetes"), "Extracted 'Kubernetes' skill");
  assert(parsedCandidate.normalizedSkills.includes("Terraform"), "Extracted 'Terraform' skill");
  assert(parsedCandidate.normalizedSkills.includes("Docker"), "Extracted 'Docker' skill");
  assert(parsedCandidate.noticePeriod === "Immediate", "Identified 'Immediate' notice period");

  // 4. Fitment Intelligence against Requirement
  console.log("-> Testing Fitment Intelligence Scoring & Matrix:");
  const cloudRequirement = {
    id: "REQ-DEVOPS-99",
    title: "Lead Cloud DevOps Engineer",
    skills: ["AWS", "Kubernetes", "Terraform", "Docker", "CI/CD", "Linux"],
    mandatorySkills: ["AWS", "Kubernetes", "Terraform"],
    minExperience: 8,
    location: "Bengaluru, India",
    workMode: "Hybrid",
    maxNoticePeriodDays: 30,
  };

  const fitment = FitmentEngine.evaluate(parsedCandidate, cloudRequirement);
  assert(fitment.hardGatesPassed === true, "Candidate passes all hard gates");
  assert(fitment.fitmentScore >= 90, `Fitment score is ${fitment.fitmentScore}% (>= 90%)`);
  assert(fitment.tier === "PRIMARY", `Candidate classified as PRIMARY tier (got ${fitment.tier})`);
  assert(fitment.skillsMatched.length >= 4, "Matched >= 4 required DevOps skills");
  assert(fitment.breakdown.coreSkillsScore === 100, "100% core skills match score");

  // 5. Candidate Ranking Queue
  console.log("-> Testing Priority Ranking:");
  const ranking = CandidateRankingService.rankCandidates([parsedCandidate], cloudRequirement);
  assert(ranking[0].rank === 1, "Ranked #1 for requirement");
  assert(ranking[0].routingQueue === "PRIORITY_QUEUE", "Routed to PRIORITY_QUEUE for direct submission");
  assert(ranking[0].isEligibleForDirectSubmission === true, "Eligible for direct submission");

  // 6. Ledger Verification
  console.log("-> Testing Processing Ledger Entry Audit:");
  const ledgerEntries = await ResumeLedgerService.getRecentEntries(5);
  assert(ledgerEntries.length > 0, "Resume Processing Ledger has recorded entries");
  assert(ledgerEntries[0].documentHash === extractionResult.documentHash, "Ledger records matching SHA-256 hash");

  return { passed, failed, errors };
}
