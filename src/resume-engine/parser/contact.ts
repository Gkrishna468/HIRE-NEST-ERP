/**
 * HireNestOS Deterministic Contact & Identity Extractor
 * Extracts Name, Email, Phone, Location, LinkedIn, and GitHub using robust deterministic regexes.
 */

export interface ExtractedContact {
  candidateName: string;
  email: string;
  phone: string;
  location: string;
  currentLocation: string;
  linkedin: string;
  github: string;
  portfolio: string;
}

// Common Indian & Global Cities / Locations dictionary for robust location matching
const KNOWN_LOCATIONS = [
  "Bengaluru", "Bangalore", "Hyderabad", "Pune", "Mumbai", "Chennai", "Delhi", "New Delhi",
  "Noida", "Gurugram", "Gurgaon", "Kolkata", "Ahmedabad", "Kochi", "Cochin", "Trivandrum",
  "Chandigarh", "Jaipur", "Indore", "Coimbatore", "San Francisco", "New York", "Seattle",
  "Austin", "London", "Berlin", "Singapore", "Dubai", "Toronto", "Sydney", "Remote", "India"
];

// Noise words to strip when identifying candidate name from top lines
const NON_NAME_PATTERNS = [
  /curriculum\s+vitae/i,
  /resume/i,
  /profile/i,
  /summary/i,
  /experience/i,
  /education/i,
  /skills/i,
  /contact/i,
  /phone/i,
  /email/i,
  /address/i,
  /page\s+\d+/i,
  /confidential/i,
  /@/,
  /\.com/i,
  /\+?\d{6,}/,
  /http/i,
  /www\./i,
  /linkedin/i,
  /github/i
];

export function extractEmail(text: string): string {
  if (!text) return "";
  // Standard RFC 5322 compliant regex for emails
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
  const match = text.match(emailRegex);
  return match ? match[1].toLowerCase().trim() : "";
}

export function extractPhone(text: string): string {
  if (!text) return "";

  // 1. Indian Phone patterns: (+91|91|0)?[6-9]\d{9} or formatted with spaces/hyphens
  const indiaPhoneRegex = /(?:(?:\+?91|0)[ -]?)?[6-9]\d{4}[ -]?\d{5}\b/;
  const indiaMatch = text.match(indiaPhoneRegex);
  if (indiaMatch) {
    return indiaMatch[0].trim();
  }

  // 2. Global International / E.164 phone formats
  const intlPhoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,5}\b/;
  const intlMatch = text.match(intlPhoneRegex);
  if (intlMatch) {
    const cleaned = intlMatch[0].trim();
    // Validate that it contains at least 8 digits
    const digitsOnly = cleaned.replace(/\D/g, "");
    if (digitsOnly.length >= 8 && digitsOnly.length <= 15) {
      return cleaned;
    }
  }

  return "";
}

export function extractLinkedIn(text: string): string {
  if (!text) return "";
  const match = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i);
  return match ? `https://linkedin.com/in/${match[1]}` : "";
}

export function extractGitHub(text: string): string {
  if (!text) return "";
  const match = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)/i);
  if (match && !["features", "topics", "collections", "pricing"].includes(match[1].toLowerCase())) {
    return `https://github.com/${match[1]}`;
  }
  return "";
}

export function extractPortfolio(text: string): string {
  if (!text) return "";
  const match = text.match(/(?:https?:\/\/)?([a-zA-Z0-9-]+\.(?:dev|me|io|tech|app|site|netlify\.app|vercel\.app|github\.io))\b/i);
  return match ? `https://${match[1]}` : "";
}

export function extractLocation(text: string): string {
  if (!text) return "";
  for (const loc of KNOWN_LOCATIONS) {
    const regex = new RegExp(`\\b${loc}\\b`, "i");
    if (regex.test(text)) {
      return loc === "Bangalore" ? "Bengaluru, India" : loc.includes("India") ? loc : `${loc}, India`;
    }
  }
  return "Remote / Flexible";
}

export function extractCandidateName(text: string, filename?: string): string {
  if (!text) return "";

  // 1. Scan the first 10 non-empty lines of the resume text
  const lines = text.split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .slice(0, 12);

  for (const line of lines) {
    // Check if line contains any blacklist pattern
    const isExcluded = NON_NAME_PATTERNS.some(pat => pat.test(line));
    if (isExcluded) continue;

    // Check if line looks like a human name (2-4 words, 3-35 chars, only letters and spaces/dots)
    const words = line.split(/\s+/).filter(w => w.length > 0);
    if (words.length >= 2 && words.length <= 4 && line.length >= 3 && line.length <= 40) {
      const isNameLike = /^[a-zA-Z\s.'-]+$/.test(line);
      if (isNameLike) {
        // Clean up formatting
        return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
      }
    }
  }

  // 2. Fallback to filename parsing if name is formatted in filename (e.g. "John_Doe_Resume.pdf")
  if (filename) {
    const baseName = filename.replace(/\.[^/.]+$/, "")
      .replace(/[-_]/g, " ")
      .replace(/\b(resume|cv|latest|updated|profile|final|\d{4})\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    const words = baseName.split(" ").filter(w => w.length > 1);
    if (words.length >= 2 && words.length <= 4 && !/^\d+$/.test(words.join(""))) {
      const isNameLike = words.every(w => /^[a-zA-Z.'-]+$/.test(w));
      if (isNameLike) {
        return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
      }
    }
  }

  return "";
}

export function extractContactDetails(text: string, filename?: string): ExtractedContact {
  const email = extractEmail(text);
  const phone = extractPhone(text);
  const candidateName = extractCandidateName(text, filename);
  const location = extractLocation(text);
  const linkedin = extractLinkedIn(text);
  const github = extractGitHub(text);
  const portfolio = extractPortfolio(text);

  return {
    candidateName,
    email,
    phone,
    location,
    currentLocation: location,
    linkedin,
    github,
    portfolio,
  };
}
