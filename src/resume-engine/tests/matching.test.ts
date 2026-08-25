/**
 * HireNestOS Deterministic Matching & Fitment Engine Test Suite
 */

import { FitmentEngine, RequirementProfile } from "../matching/fitment-engine.js";
import { HardGateEvaluator } from "../matching/hard-gates.js";
import { SkillNormalizer } from "../matching/skill-normalizer.js";
import { CandidateRankingService } from "../matching/ranking.js";

export function runMatchingTests(): { passed: number; failed: number; errors: string[] } {
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

  console.log("\n=== [TEST SUITE 2: DETERMINISTIC FITMENT INTELLIGENCE & MATCHING] ===");

  // 1. Skill Overlap Tests
  console.log("-> Testing Skill Overlap Resolution:");
  const candidateSkills = ["C++", "Linux", "Docker", "Python", "Multithreading/IPC", "Git"];
  const requiredSkills = ["C/C++", "Linux", "RTOS", "Docker"];
  const overlap = SkillNormalizer.calculateSkillOverlap(candidateSkills, requiredSkills);
  assert(overlap.matched.includes("C++"), "Matches 'C++' against 'C/C++' requirement");
  assert(overlap.matched.includes("Linux"), "Matches 'Linux'");
  assert(overlap.matched.includes("Docker"), "Matches 'Docker'");
  assert(overlap.missing.some(m => m.includes("RTOS") || m.includes("Embedded")), "Detects missing 'RTOS'");
  assert(overlap.overlapRatio === 0.75, "Calculates 75% overlap ratio");

  // 2. Hard Gate Evaluation Tests
  console.log("-> Testing Hard Gates Logic:");
  const gatePass = HardGateEvaluator.evaluate(
    { totalExperience: 8, skills: ["C++", "Linux", "Docker"], location: "Bengaluru, India", noticePeriod: "15 Days" },
    { minExperience: 6, mandatorySkills: ["C++", "Linux"], maxNoticePeriodDays: 30 }
  );
  assert(gatePass.passed === true, "Passes all valid hard gates");

  const gateFailExp = HardGateEvaluator.evaluate(
    { totalExperience: 2, skills: ["C++", "Linux"], location: "Pune", noticePeriod: "30 Days" },
    { minExperience: 7, mandatorySkills: ["C++"] }
  );
  assert(gateFailExp.passed === false, "Fails when candidate experience is significantly below requirement");
  assert(gateFailExp.failedGates.includes("EXPERIENCE_GATE"), "Flags 'EXPERIENCE_GATE' failure");

  const gateFailSkills = HardGateEvaluator.evaluate(
    { totalExperience: 8, skills: ["JavaScript", "HTML"], location: "Remote" },
    { minExperience: 5, mandatorySkills: ["C++", "RTOS", "Linux"] }
  );
  assert(gateFailSkills.passed === false, "Fails when missing multiple mandatory skills");
  assert(gateFailSkills.failedGates.includes("MANDATORY_SKILLS_GATE"), "Flags 'MANDATORY_SKILLS_GATE' failure");

  // 3. Fitment Matrix & Scoring Tests
  console.log("-> Testing Fitment Matrix Score Breakdown & Tiering:");
  const reqProfile: RequirementProfile = {
    id: "REQ-EMBEDDED-01",
    title: "Senior C++ Embedded Systems Architect",
    skills: ["C++", "Linux", "Multithreading/IPC", "Docker", "Python", "RTOS"],
    mandatorySkills: ["C++", "Linux", "Multithreading/IPC"],
    secondarySkills: ["Docker", "Python", "RTOS"],
    minExperience: 7,
    location: "Pune, India",
    workMode: "Hybrid",
    maxNoticePeriodDays: 30,
  };

  const strongCandidate = {
    id: "CAND-001",
    candidateName: "Vikram Malhotra",
    skills: ["C++", "Linux", "Multithreading/IPC", "Docker", "Python", "GDB/Debugging", "STL"],
    totalExperience: 9,
    location: "Pune, India",
    noticePeriod: "15 Days",
    education: [{ degree: "B.Tech", institution: "NIT" }],
  };

  const fitmentResult = FitmentEngine.evaluate(strongCandidate, reqProfile);
  assert(fitmentResult.hardGatesPassed === true, "Strong candidate passes hard gates");
  assert(fitmentResult.fitmentScore >= 85, `Strong candidate receives high score (got ${fitmentResult.fitmentScore}%)`);
  assert(fitmentResult.tier === "PRIMARY" || fitmentResult.tier === "PRIMARY/BACKUP", `Tier is PRIMARY or PRIMARY/BACKUP (got ${fitmentResult.tier})`);
  assert(fitmentResult.matrix.length >= 4, "Matrix includes line-by-line evidence rows");
  assert(fitmentResult.explanation.strengths.length > 0, "Generates deterministic explainable strengths");

  // 4. Candidate Ranking & Eligibility Queue Tests
  console.log("-> Testing Multi-Candidate Ranking & Priority Routing:");
  const candA = { id: "CAND-A", candidateName: "Senior Lead", skills: ["C++", "Linux", "Multithreading/IPC", "Docker", "Python"], totalExperience: 9, location: "Pune", noticePeriod: "15 Days" };
  const candB = { id: "CAND-B", candidateName: "Mid Engineer", skills: ["C++", "Linux"], totalExperience: 5, location: "Bengaluru", noticePeriod: "30 Days" };
  const candC = { id: "CAND-C", candidateName: "Junior React Dev", skills: ["React", "HTML5/CSS3"], totalExperience: 2, location: "Mumbai", noticePeriod: "60 Days" };

  const ranked = CandidateRankingService.rankCandidates([candB, candC, candA], reqProfile);
  assert(ranked[0].candidate.id === "CAND-A", "Rank 1 is the strongest matched candidate");
  assert(ranked[0].routingQueue === "PRIORITY_QUEUE" || ranked[0].routingQueue === "AI_VALIDATION_QUEUE", "Rank 1 routed to priority/validation queue");
  assert(ranked[2].candidate.id === "CAND-C", "Rank 3 is the lowest matched candidate");
  assert(ranked[2].fitment.hardGatesPassed === false || ranked[2].fitment.tier === "GAP" || ranked[2].fitment.tier === "HARD_GATE_FAIL", "Junior non-matching candidate flagged appropriately");

  return { passed, failed, errors };
}
