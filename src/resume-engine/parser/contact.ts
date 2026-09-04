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
  /^\[.*\]$/,
  /curriculum\s+vitae/i,
  /summary\s+of\s+qualifications/i,
  /professional\s+summary/i,
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
  /github/i,
  // Strict Job titles, technical terms, and non-name section keywords:
  /\b(developer|engineer|architect|manager|analyst|consultant|specialist|lead|senior|junior|principal|director|executive|intern|student|associate|coordinator|administrator|designer|writer|head|officer|president|vp|member|expert|professional|pmp|scrum)\b/i,
  /\b(react|node|python|java|sql|aws|kubernetes|javascript|docker|git|html|css|c\+\+|rust|go|gcp|azure|redux|typescript|linux|spark|hadoop|data|cloud|software|full\s*stack|frontend|backend|devops|security|network|system|database|mobile|ios|android|web|machine\s*learning|artificial\s*intelligence|nlp|deep\s*learning|data\s*scientist)\b/i,
  /\b(university|college|institute|school|academy|technologies|solutions|services|systems|corp|inc|co|limited|ltd|pvt|private|group|enterprise|global|national|international|technological)\b/i,
  /\b(summary|projects|objective|certifications|awards|languages|interests|hobbies|activities|courses|publications|references|education|experience|skills|contact|profile)\b/i
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

  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  
  // 1. Check for explicit location prefix lines in the top of the document or anywhere
  const prefixRegex = /\b(?:location|address|based\s+in|reside\s+in|living\s+in|current\s+location)\s*:\s*([^\n|]+)/i;
  const prefixMatch = text.match(prefixRegex);
  if (prefixMatch) {
    const candidateLoc = prefixMatch[1].trim();
    // Validate if it is a sane length
    if (candidateLoc.length > 2 && candidateLoc.length < 50) {
      return candidateLoc.replace(/[,|\s]+$/, "").trim();
    }
  }

  // 2. Prioritize looking at the first 15 lines for any of our KNOWN_LOCATIONS
  const topLines = lines.slice(0, 15);
  for (const loc of KNOWN_LOCATIONS) {
    // Skip general terms like "India" or "Remote" as first-choice specific city
    if (loc === "India" || loc === "Remote") continue;
    
    const regex = new RegExp(`\\b${loc}\\b`, "i");
    for (const line of topLines) {
      if (regex.test(line)) {
        return loc === "Bangalore" ? "Bengaluru, India" : `${loc}, India`;
      }
    }
  }

  // 3. Fallback to scanning the rest of the lines for known specific cities
  for (const loc of KNOWN_LOCATIONS) {
    if (loc === "India" || loc === "Remote") continue;
    
    const regex = new RegExp(`\\b${loc}\\b`, "i");
    for (const line of lines) {
      if (regex.test(line)) {
        return loc === "Bangalore" ? "Bengaluru, India" : `${loc}, India`;
      }
    }
  }

  // 4. Last fallback: general "India" or "Remote"
  if (/\bIndia\b/i.test(text)) {
    return "India";
  }
  if (/\bRemote\b/i.test(text)) {
    return "Remote / Flexible";
  }

  return "Remote / Flexible";
}

export function extractCandidateName(text: string, filename?: string): string {
  if (!text) return "";

  // 1. Scan the first 15 non-empty lines of the resume text
  const lines = text.split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .slice(0, 15);

  for (const rawLine of lines) {
    // Skip noise/bracket tags like [OCR_EXTRACTED_LAYER_START]
    if (/^\[.*\]$/.test(rawLine)) continue;

    // Check if line contains any blacklist pattern
    const isExcluded = NON_NAME_PATTERNS.some(pat => pat.test(rawLine));
    if (isExcluded) continue;

    // Support lines with roles/titles like "John Doe | Senior Software Engineer" or "Dr. Elena Rostova, Ph.D."
    const candidatesToTest = [
      rawLine,
      rawLine.split("|")[0].trim(),
      rawLine.split(",")[0].trim(),
      rawLine.split(" - ")[0].trim()
    ];

    for (const testStr of candidatesToTest) {
      if (!testStr || testStr.length < 3 || testStr.length > 45) continue;
      if (NON_NAME_PATTERNS.some(pat => pat.test(testStr))) continue;

      // Clean prefix/suffix honorifics for check
      const cleaned = testStr
        .replace(/^(dr\.|mr\.|ms\.|mrs\.|prof\.)\s+/i, "")
        .replace(/,\s*(ph\.d\.|m\.s\.|b\.s\.|mba|cpa|md)$/i, "")
        .trim();

      const words = cleaned.split(/\s+/).filter(w => w.length > 0);
      if (words.length >= 2 && words.length <= 4) {
        const isNameLike = /^[a-zA-Z\s.'-]+$/.test(cleaned);
        if (isNameLike) {
          // Clean up formatting
          return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
        }
      }
    }
  }

  // 2. Fallback to filename parsing if name is formatted in filename (e.g. "John_Doe_Resume.pdf")
  if (filename) {
    const baseName = filename.replace(/\.[^/.]+$/, "")
      .replace(/[-_]/g, " ")
      .replace(/\b(resume|cv|latest|updated|profile|final|\d{4}|missing|name|unknown|sample|test|candidate|unnamed|file|document|doc|upload|fixed)\b/gi, "")
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
