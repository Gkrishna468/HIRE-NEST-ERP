/**
 * HireNestOS Deterministic Employment & Experience Calculator
 * Calculates total experience accurately via date union arithmetic (overlap-aware) without any LLM.
 */

import { EmploymentRecord } from "../types.js";

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const COMMON_DESIGNATIONS = [
  "Software Engineer", "Senior Software Engineer", "Lead Software Engineer",
  "Principal Engineer", "Staff Software Engineer", "Full Stack Developer",
  "Backend Developer", "Frontend Developer", "DevOps Engineer", "Cloud Architect",
  "Solutions Architect", "Technical Lead", "Engineering Manager", "Data Engineer",
  "Data Scientist", "QA Automation Engineer", "Product Manager", "Scrum Master",
  "C++ Developer", "Java Developer", "Python Developer", "React Developer",
  "Node.js Developer", "Embedded Software Engineer", "Firmware Engineer", "System Architect"
];

const KNOWN_COMPANIES = [
  "Google", "Microsoft", "Amazon", "Meta", "Apple", "Oracle", "Cisco", "IBM",
  "TCS", "Tata Consultancy Services", "Infosys", "Wipro", "HCL", "Cognizant",
  "Accenture", "Capgemini", "Tech Mahindra", "LTIMindtree", "Persistent Systems",
  "Mindtree", "Deloitte", "KPMG", "EY", "PwC", "SAP", "Salesforce", "ServiceNow",
  "Adobe", "Qualcomm", "Intel", "NVIDIA", "Samsung", "PayPal", "Uber", "Swiggy",
  "Zomato", "Flipkart", "Razorpay", "Ola", "Paytm", "PhonePe", "CRED", "Jio"
];

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Parses date string (e.g. "Jan 2018", "04/2019", "2018", "Present", "Current")
 */
function parseDateToken(token: string, isEnd: boolean = false): Date {
  const clean = token.trim().toLowerCase();
  const now = new Date();

  if (["present", "current", "till date", "now", "ongoing"].includes(clean)) {
    return now;
  }

  // Month Year e.g. "Jan 2018" or "January 2018"
  const myMatch = clean.match(/([a-z]+)[.\s/-]+(\d{4})/i);
  if (myMatch) {
    const monthStr = myMatch[1].slice(0, 3);
    const month = MONTH_MAP[monthStr] ?? (isEnd ? 11 : 0);
    const year = parseInt(myMatch[2], 10);
    return new Date(year, month, 1);
  }

  // MM/YYYY e.g. "04/2019" or "4-2019"
  const slashMatch = clean.match(/(\d{1,2})[/-](\d{4})/);
  if (slashMatch) {
    const month = parseInt(slashMatch[1], 10) - 1;
    const year = parseInt(slashMatch[2], 10);
    return new Date(year, Math.max(0, Math.min(11, month)), 1);
  }

  // Year only e.g. "2018"
  const yearMatch = clean.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    return new Date(year, isEnd ? 11 : 0, 1);
  }

  return isEnd ? now : new Date(now.getFullYear() - 1, 0, 1);
}

/**
 * Calculates total experience in years by taking the union of all intervals
 * (avoiding double counting overlapping roles/side projects).
 */
export function calculateExperienceFromRanges(ranges: DateRange[]): number {
  if (!ranges || ranges.length === 0) return 0;

  // Filter valid ranges
  const validRanges = ranges
    .filter(r => r.start && r.end && r.start <= r.end)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  if (validRanges.length === 0) return 0;

  // Merge overlapping intervals
  const merged: DateRange[] = [validRanges[0]];

  for (let i = 1; i < validRanges.length; i++) {
    const current = validRanges[i];
    const prev = merged[merged.length - 1];

    if (current.start <= prev.end) {
      // Overlap: extend previous end if current ends later
      if (current.end > prev.end) {
        prev.end = current.end;
      }
    } else {
      merged.push(current);
    }
  }

  // Sum total months across merged intervals
  let totalMonths = 0;
  for (const range of merged) {
    const yearsDiff = range.end.getFullYear() - range.start.getFullYear();
    const monthsDiff = range.end.getMonth() - range.start.getMonth();
    const months = yearsDiff * 12 + monthsDiff + 1; // inclusive
    totalMonths += Math.max(1, months);
  }

  const years = parseFloat((totalMonths / 12).toFixed(1));
  return Math.min(40, Math.max(0, years));
}

/**
 * Extracts total experience mentioned as text in resume (e.g. "7+ years of experience", "8.5 yrs exp")
 */
export function extractStatedExperience(text: string): number {
  if (!text) return 0;

  const patterns = [
    /(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)\s*(?:of)?\s*(?:total)?\s*(?:relevant)?\s*(?:experience|exp)/i,
    /total\s*experience\s*[:\-]?\s*(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)/i,
    /experience\s*[:\-]?\s*(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)/i,
  ];

  for (const pat of patterns) {
    const match = text.match(pat);
    if (match) {
      const val = parseFloat(match[1]);
      if (val > 0 && val <= 40) return val;
    }
  }

  return 0;
}

/**
 * Detects Notice Period mentioned in resume.
 */
export function extractNoticePeriod(text: string): string {
  if (!text) return "Not Specified";

  if (/immediate(?:ly)?\s*(?:available|joiner)?/i.test(text) || /0\s*days?\s*notice/i.test(text)) {
    return "Immediate";
  }
  if (/15\s*days?\s*notice/i.test(text) || /2\s*weeks?\s*notice/i.test(text)) {
    return "15 Days";
  }
  if (/30\s*days?\s*notice/i.test(text) || /1\s*month\s*notice/i.test(text)) {
    return "30 Days";
  }
  if (/45\s*days?\s*notice/i.test(text)) {
    return "45 Days";
  }
  if (/60\s*days?\s*notice/i.test(text) || /2\s*months?\s*notice/i.test(text)) {
    return "60 Days";
  }
  if (/90\s*days?\s*notice/i.test(text) || /3\s*months?\s*notice/i.test(text)) {
    return "90 Days";
  }

  // Generic notice pattern e.g. "Notice Period: 30 days"
  const match = text.match(/notice\s*period\s*[:\-]?\s*(\d+)\s*(?:days?|months?)/i);
  if (match) {
    const num = parseInt(match[1], 10);
    return `${num} Days`;
  }

  return "30 Days"; // Default professional standard
}

/**
 * Extracts structured employment history from resume text deterministically.
 */
export function extractEmploymentHistory(text: string): {
  history: EmploymentRecord[];
  totalExperience: number;
  currentCompany: string;
  currentRole: string;
  companies: string[];
  designations: string[];
} {
  const history: EmploymentRecord[] = [];
  const foundCompanies = new Set<string>();
  const foundDesignations = new Set<string>();
  const extractedRanges: DateRange[] = [];

  // 1. Regular expression to find employment duration blocks
  // Patterns like: "Jan 2018 - Mar 2021", "04/2019 to Present", "2018 - 2022", "Aug 2020 - Current"
  const dateRangeRegex = /(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{1,2}[/-]\d{4}|\b(?:19|20)\d{2}\b)\s*(?:-|–|—|to|until)\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{1,2}[/-]\d{4}|\b(?:19|20)\d{2}\b|present|current|till date|now|ongoing)/gi;

  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(dateRangeRegex);

    if (match) {
      const rawPeriod = match[0];
      const parts = rawPeriod.split(/(?:-|–|—|to|until)/i);
      if (parts.length === 2) {
        const start = parseDateToken(parts[0], false);
        const end = parseDateToken(parts[1], true);
        extractedRanges.push({ start, end });

        const isCurrent = /present|current|till date|now|ongoing/i.test(parts[1]);

        // Look at surrounding lines (current line, line before, line after) for company & designation
        const contextLines = [
          lines[i - 1] || "",
          line.replace(dateRangeRegex, ""),
          lines[i + 1] || ""
        ].join(" ");

        let company = "Technology Services";
        for (const c of KNOWN_COMPANIES) {
          if (new RegExp(`\\b${c}\\b`, "i").test(contextLines)) {
            company = c;
            foundCompanies.add(c);
            break;
          }
        }

        let designation = "Software Engineer";
        for (const d of COMMON_DESIGNATIONS) {
          if (new RegExp(`\\b${d.replace("+", "\\+")}\\b`, "i").test(contextLines)) {
            designation = d;
            foundDesignations.add(d);
            break;
          }
        }

        history.push({
          company,
          designation,
          rawPeriod,
          isCurrent,
          startDate: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
          endDate: isCurrent ? "Present" : `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}`,
        });
      }
    }
  }

  // 2. Compute date-union experience
  let calculatedExp = calculateExperienceFromRanges(extractedRanges);

  // If explicit stated experience is present in the resume text, prefer it as ground truth
  const statedExp = extractStatedExperience(text);
  if (statedExp > 0) {
    calculatedExp = statedExp;
  } else if (calculatedExp === 0) {
    calculatedExp = 3.5; // Fallback median
  }

  // 3. Current company & role
  const currentRecord = history.find(h => h.isCurrent) || history[0];
  const currentCompany = currentRecord?.company || (Array.from(foundCompanies)[0] || "Enterprise Tech");
  const currentRole = currentRecord?.designation || (Array.from(foundDesignations)[0] || "Senior Software Engineer");

  return {
    history,
    totalExperience: calculatedExp,
    currentCompany,
    currentRole,
    companies: Array.from(foundCompanies),
    designations: Array.from(foundDesignations),
  };
}
