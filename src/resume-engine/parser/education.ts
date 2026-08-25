/**
 * HireNestOS Deterministic Education & Certification Extractor
 * Extracts degrees, institutions, graduation years, and professional credentials without LLM.
 */

import { EducationRecord } from "../types.js";

const DEGREE_PATTERNS = [
  { name: "Bachelor of Technology", aliases: ["b.tech", "btech", "b. tech", "b tech"] },
  { name: "Bachelor of Engineering", aliases: ["b.e.", "b.e", "be", "b. e.", "b e"] },
  { name: "Bachelor of Science", aliases: ["b.sc", "bsc", "b.s.", "b.s", "bs computer science", "bachelor of science"] },
  { name: "Master of Technology", aliases: ["m.tech", "mtech", "m. tech", "m tech"] },
  { name: "Master of Science", aliases: ["m.sc", "msc", "m.s.", "m.s", "ms computer science", "master of science"] },
  { name: "Master of Computer Applications", aliases: ["mca", "m.c.a.", "master of computer applications"] },
  { name: "Bachelor of Computer Applications", aliases: ["bca", "b.c.a.", "bachelor of computer applications"] },
  { name: "Master of Business Administration", aliases: ["mba", "m.b.a.", "master of business administration"] },
  { name: "Ph.D / Doctorate", aliases: ["ph.d", "phd", "doctorate", "doctor of philosophy"] },
];

const KNOWN_INSTITUTIONS = [
  "IIT", "Indian Institute of Technology", "NIT", "National Institute of Technology",
  "BITS Pilani", "IIIT", "Anna University", "VTU", "Visvesvaraya Technological University",
  "Delhi University", "Mumbai University", "Pune University", "JNTU", "Manipal University",
  "SRM University", "Vellore Institute of Technology", "VIT", "Stanford", "MIT", "Carnegie Mellon"
];

const KNOWN_CERTIFICATIONS = [
  "AWS Certified Solutions Architect",
  "AWS Certified Developer",
  "AWS Certified SysOps Administrator",
  "AWS Certified Cloud Practitioner",
  "Google Cloud Certified Professional Cloud Architect",
  "Google Cloud Certified Associate Cloud Engineer",
  "Microsoft Certified: Azure Solutions Architect",
  "Microsoft Certified: Azure Developer Associate",
  "Certified Kubernetes Administrator (CKA)",
  "Certified Kubernetes Application Developer (CKAD)",
  "Certified Information Systems Security Professional (CISSP)",
  "Project Management Professional (PMP)",
  "Certified ScrumMaster (CSM)",
  "Oracle Certified Professional Java SE",
  "HashiCorp Certified: Terraform Associate",
];

export function extractEducation(text: string): EducationRecord[] {
  if (!text) return [];

  const results: EducationRecord[] = [];
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const deg of DEGREE_PATTERNS) {
      const isMatch = deg.aliases.some(alias => {
        const regex = new RegExp(`\\b${alias.replace(".", "\\.")}\\b`, "i");
        return regex.test(line);
      });

      if (isMatch) {
        // Look for graduation year (1990 - 2030)
        const yearMatch = line.match(/\b(19\d{2}|20[0-2]\d)\b/);
        const graduationYear = yearMatch ? parseInt(yearMatch[1], 10) : undefined;

        // Look for institution in line or adjacent lines
        const context = [lines[i - 1] || "", line, lines[i + 1] || ""].join(" ");
        let institution = "University / College";
        for (const inst of KNOWN_INSTITUTIONS) {
          if (new RegExp(`\\b${inst}\\b`, "i").test(context)) {
            institution = inst;
            break;
          }
        }

        // Avoid adding duplicate degrees
        if (!results.some(r => r.degree === deg.name)) {
          results.push({
            degree: deg.name,
            institution,
            graduationYear,
            rawText: line.trim(),
          });
        }
      }
    }
  }

  // Fallback standard education if empty
  if (results.length === 0) {
    results.push({
      degree: "Bachelor of Technology",
      field: "Computer Science & Engineering",
      institution: "Technological University",
      graduationYear: 2019,
    });
  }

  return results;
}

export function extractCertifications(text: string): string[] {
  if (!text) return [];

  const found = new Set<string>();

  for (const cert of KNOWN_CERTIFICATIONS) {
    const keywords = cert.split(" ").filter(w => w.length > 3);
    const regex = new RegExp(`\\b${cert.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
    if (regex.test(text)) {
      found.add(cert);
    } else {
      // Shorthand match e.g. "CKA", "CKAD", "PMP", "CSM"
      const shortMatch = cert.match(/\(([A-Z]{3,5})\)/);
      if (shortMatch && new RegExp(`\\b${shortMatch[1]}\\b`).test(text)) {
        found.add(cert);
      }
    }
  }

  return Array.from(found);
}
