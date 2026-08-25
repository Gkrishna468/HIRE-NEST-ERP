/**
 * HireNestOS Master Deterministic Resume Parser
 * Generates a fully populated, structured CandidateProfile without any LLM/AI dependencies.
 */

import { CandidateProfile } from "../types.js";
import { extractContactDetails } from "./contact.js";
import { extractSkills } from "./skills.js";
import { extractEmploymentHistory, extractNoticePeriod } from "./experience.js";
import { extractEducation, extractCertifications } from "./education.js";
import { ResumeLedgerService } from "../ledger/ResumeLedgerService.js";

export function parseResumeDeterministically(params: {
  text: string;
  filename?: string;
  documentHash?: string;
}): CandidateProfile {
  const { text, filename, documentHash } = params;
  const hash = documentHash || ResumeLedgerService.computeHash(text);

  // 1. Contact & Identity extraction
  const contact = extractContactDetails(text, filename);

  // 2. Controlled skills taxonomy extraction
  const { skills, normalizedSkills } = extractSkills(text);

  // 3. Employment history, date union experience, current role
  const employment = extractEmploymentHistory(text);

  // 4. Education and Certifications
  const education = extractEducation(text);
  const certifications = extractCertifications(text);

  // 5. Notice Period
  const noticePeriod = extractNoticePeriod(text);

  // 6. Summary generation (deterministic extracted lead lines)
  const nonContactLines = text
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 25 && !l.includes("@") && !/^\+?\d/.test(l))
    .slice(0, 3);
  
  const summary = nonContactLines.length > 0 
    ? nonContactLines.join(" ") 
    : `${contact.candidateName} is an experienced ${employment.currentRole} with ${employment.totalExperience} years of experience specializing in ${normalizedSkills.slice(0, 4).join(", ")}.`;

  // 7. Status classification
  const hasIdentity = Boolean(contact.candidateName && contact.candidateName.trim().length > 0);
  const hasContact = Boolean(contact.email || contact.phone);
  const hasSkills = normalizedSkills.length > 0;

  let status: "PARSED" | "PARTIAL" | "MANUAL_REVIEW_REQUIRED";
  if (hasIdentity && (hasContact || hasSkills)) {
    status = "PARSED";
  } else if (!hasIdentity) {
    status = "MANUAL_REVIEW_REQUIRED";
  } else {
    status = "PARTIAL";
  }

  return {
    name: contact.candidateName || "",
    candidateName: contact.candidateName || "",
    email: contact.email || "",
    phone: contact.phone || "",
    location: contact.location,
    currentLocation: contact.currentLocation,
    totalExperience: employment.totalExperience,
    skills,
    normalizedSkills,
    companies: employment.companies,
    designations: employment.designations,
    employmentHistory: employment.history,
    currentCompany: employment.currentCompany,
    currentRole: employment.currentRole,
    education,
    certifications,
    noticePeriod,
    linkedin: contact.linkedin,
    github: contact.github,
    portfolio: contact.portfolio,
    resumeText: text,
    documentHash: hash,
    summary,
    status,
    parsedAt: new Date().toISOString(),
  };
}
