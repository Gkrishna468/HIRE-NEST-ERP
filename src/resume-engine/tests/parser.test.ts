/**
 * HireNestOS Deterministic Resume Parser Test Suite
 */

import { parseResumeDeterministically } from "../parser/resume-parser.js";
import { extractContactDetails, extractEmail, extractPhone, extractLocation } from "../parser/contact.js";
import { extractSkills, normalizeSkillName } from "../parser/skills.js";
import { calculateExperienceFromRanges, extractEmploymentHistory, extractStatedExperience } from "../parser/experience.js";

export function runParserTests(): { passed: number; failed: number; errors: string[] } {
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

  console.log("\n=== [TEST SUITE 1: DETERMINISTIC RESUME PARSER] ===");

  // 1. Skill Normalization Tests
  console.log("-> Testing Skill Normalization & Controlled Taxonomy:");
  assert(normalizeSkillName("c++") === "C++", "Normalizes 'c++' -> 'C++'");
  assert(normalizeSkillName("c/c++") === "C++", "Normalizes 'c/c++' -> 'C++'");
  assert(normalizeSkillName("cpp") === "C++", "Normalizes 'cpp' -> 'C++'");
  assert(normalizeSkillName("c plus plus") === "C++", "Normalizes 'c plus plus' -> 'C++'");
  assert(normalizeSkillName("react.js") === "React", "Normalizes 'react.js' -> 'React'");
  assert(normalizeSkillName("reactjs") === "React", "Normalizes 'reactjs' -> 'React'");
  assert(normalizeSkillName("nodejs") === "Node.js", "Normalizes 'nodejs' -> 'Node.js'");
  assert(normalizeSkillName("amazon web services") === "AWS", "Normalizes 'amazon web services' -> 'AWS'");
  assert(normalizeSkillName("k8s") === "Kubernetes", "Normalizes 'k8s' -> 'Kubernetes'");
  assert(normalizeSkillName("postgres") === "PostgreSQL", "Normalizes 'postgres' -> 'PostgreSQL'");

  // 2. Contact Extraction Tests
  console.log("-> Testing Contact & Identity Extraction:");
  const sampleText1 = `
    Alex Rivera
    Email: alex.rivera@techglobal.com | Phone: +91 98451 23456 | Location: Bengaluru, India
    LinkedIn: linkedin.com/in/alexrivera-dev | GitHub: github.com/alexrivera-cloud

    SUMMARY
    Senior Cloud Architect with 8.5 years of experience building distributed systems.
  `;

  const contact1 = extractContactDetails(sampleText1);
  assert(contact1.candidateName === "Alex Rivera", "Extracts candidate name 'Alex Rivera'");
  assert(contact1.email === "alex.rivera@techglobal.com", "Extracts email 'alex.rivera@techglobal.com'");
  assert(contact1.phone.includes("98451"), "Extracts phone number");
  assert(contact1.location.includes("Bengaluru"), "Extracts location 'Bengaluru, India'");
  assert(contact1.linkedin === "https://linkedin.com/in/alexrivera-dev", "Extracts LinkedIn profile");
  assert(contact1.github === "https://github.com/alexrivera-cloud", "Extracts GitHub profile");

  // 3. Date Union Experience Calculation Tests
  console.log("-> Testing Experience Date Arithmetic (Overlap-Aware):");
  const expRanges = [
    { start: new Date(2018, 0, 1), end: new Date(2020, 5, 1) }, // 2.5 yrs
    { start: new Date(2020, 3, 1), end: new Date(2023, 0, 1) }, // overlaps by 2 mos, ends Jan 2023
  ];
  const calculatedExp = calculateExperienceFromRanges(expRanges);
  assert(calculatedExp >= 4.8 && calculatedExp <= 5.2, `Calculates merged non-overlapping experience (got ${calculatedExp} yrs)`);

  // 4. Stated Experience Regex
  assert(extractStatedExperience("I have 7+ years of experience in backend development") === 7, "Extracts 7+ years");
  assert(extractStatedExperience("Total Experience: 10.5 Yrs") === 10.5, "Extracts 10.5 Yrs");

  // 5. Full Representative Resume Ingestion & Parsing (Senior C++ / Embedded Resume)
  console.log("-> Testing Full Resume Document Parsing (Embedded/C++ Profile):");
  const embeddedResumeText = `
    Vikram Malhotra
    vikram.malhotra@embeddedtech.io | +91 9988776655 | Pune, India
    linkedin.com/in/vikram-malhotra | github.com/vikram-embedded

    PROFESSIONAL SUMMARY
    Lead Embedded Systems Engineer with 9 years of experience developing safety-critical firmware, RTOS, and Linux device drivers using Modern C++ (C++17/C++20) and C.

    EXPERIENCE
    Infosys - Technical Lead
    Jan 2021 - Present
    - Architected RTOS multithreading IPC subsystems and CAN bus interfaces in C++.
    - Implemented unit testing using GoogleTest and GDB debugging on ARM Cortex-M.

    Persistent Systems - Senior Software Engineer
    Jun 2017 - Dec 2020
    - Developed Linux kernel drivers and socket networking layers in C and C++.
    - Optimized STL algorithms reducing memory footprint by 35%.

    Tata Consultancy Services - Systems Engineer
    Jul 2015 - May 2017
    - Built C/C++ diagnostic utilities and automated test scripts in Python.

    EDUCATION
    Bachelor of Technology in Electronics and Communication Engineering
    National Institute of Technology, 2015

    TECHNICAL SKILLS
    Languages: C++, C, Python, Bash
    Systems: RTOS, Linux, Multithreading, IPC, Sockets, STL, GDB
    Tools: Docker, Git, CI/CD, GoogleTest
    Notice Period: 15 Days
  `;

  const parsed = parseResumeDeterministically({ text: embeddedResumeText, filename: "Vikram_Malhotra_CV.pdf" });
  assert(parsed.candidateName === "Vikram Malhotra", "Parsed name matches 'Vikram Malhotra'");
  assert(parsed.email === "vikram.malhotra@embeddedtech.io", "Parsed email matches");
  assert(parsed.totalExperience >= 8.5 && parsed.totalExperience <= 9.5, `Parsed experience ~9 years (got ${parsed.totalExperience})`);
  assert(parsed.normalizedSkills.includes("C++"), "Parsed normalized skill 'C++'");
  assert(parsed.normalizedSkills.includes("Linux"), "Parsed normalized skill 'Linux'");
  assert(parsed.normalizedSkills.includes("Docker"), "Parsed normalized skill 'Docker'");
  assert(parsed.noticePeriod === "15 Days", "Parsed notice period '15 Days'");
  assert(parsed.education.length > 0, "Parsed education record");
  assert(parsed.status === "PARSED", "Status is marked PARSED");

  return { passed, failed, errors };
}
