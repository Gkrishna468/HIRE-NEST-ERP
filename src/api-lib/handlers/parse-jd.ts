import crypto from "crypto";
import { adminDb } from "../../lib/firebase-admin.js";
import { CONTROLLED_SKILL_TAXONOMY } from "../../resume-engine/parser/skills.js";

// Deterministic Role Extraction
function extractRoleDeterministically(text: string): string {
  const commonRoles = [
    "Software Engineer", "Senior Software Engineer", "Full Stack Developer", "Frontend Developer", "Backend Developer",
    "DevOps Engineer", "Data Scientist", "Data Engineer", "Product Manager", "Project Manager",
    "QA Engineer", "SDET", "System Administrator", "Cloud Architect", "UI/UX Designer",
    "Technical Lead", "Engineering Manager", "CTO", "CIO", "CEO"
  ];
  
  const textLower = text.toLowerCase();
  for (const role of commonRoles) {
    if (textLower.includes(role.toLowerCase())) {
      return role;
    }
  }
  
  // Fallback heuristic: Try to find something that looks like a title on the first few lines
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && l.length < 50);
  if (lines.length > 0) {
      return lines[0];
  }
  
  return "Software Engineer";
}

// Deterministic Skill Extraction
function extractSkillsDeterministically(text: string): string[] {
  const foundSkills = new Set<string>();
  const textLower = text.toLowerCase();
  
  // Simple word boundary regex to avoid partial matches
  const checkSkill = (skill: string) => {
    const regex = new RegExp(`\\b${skill.replace(/[.*+?^$\{key\}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i');
    return regex.test(text);
  };
  
  CONTROLLED_SKILL_TAXONOMY.flatMap(cat => [cat.canonical, ...cat.aliases]).forEach(skill => {
    if (checkSkill(skill)) {
      foundSkills.add(skill);
    }
  });
  
  // Also check aliases mapping (if we have access to them, or just use the master list)
  // But master list is flat enough.
  
  return Array.from(foundSkills).slice(0, 10);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { jdText } = req.body;
  if (!jdText) {
    return res
      .status(400)
      .json({ message: "Missing jdText parameter in request body" });
  }

  const orgId = req.headers["x-org-id"] || "system";

  try {
    // 1. Check Hash Cache
    const normalizedText = jdText.replace(/\s+/g, " ").trim();
    const hash = crypto
      .createHash("sha256")
      .update(normalizedText)
      .digest("hex");
    let cachedDoc = null;

    if (adminDb) {
      try {
        const cacheRef = adminDb.collection("jd_cache").doc(hash);
        cachedDoc = await cacheRef.get();
      } catch (e) {
        console.error("[CACHE_ERR]", e);
      }
    }

    if (cachedDoc && cachedDoc.exists) {
      console.log(`[PARSE_JD] Cache hit for org ${orgId}`);
      return res.status(200).json(cachedDoc.data());
    }

    // 2. Deterministic Parsing
    const title = extractRoleDeterministically(jdText);
    const skills = extractSkillsDeterministically(jdText);
    
    if (skills.length === 0) {
        skills.push("Communication", "Problem Solving"); // Default fallbacks
    }

    const parsedData = { title, skills };

    // Save to Cache
    if (adminDb && parsedData.title) {
      try {
        await adminDb
          .collection("jd_cache")
          .doc(hash)
          .set({
            ...parsedData,
            embeddingStatus: "unavailable",
            cachedAt: new Date().toISOString(),
          });
      } catch (e) {}
    }

    return res.status(200).json(parsedData);
  } catch (error: any) {
    console.error("[JD_PARSER_ERROR] Failed to parse Job Description:", error);

    // Graceful fallback values
    return res.status(200).json({
      title: "Extracted Role",
      skills: ["Processing Pending", "Will update shortly"],
    });
  }
}
