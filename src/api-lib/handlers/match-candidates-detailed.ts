import { AIRuntime } from "../services/AIRuntime.js";
import { PromptRegistry } from "../services/PromptRegistry.js";
import { SkillNormalizer } from "../../resume-engine/matching/skill-normalizer.js";
import { extractStatedExperience } from "../../resume-engine/parser/experience.js";

// Helper to extract years of experience using regex
function extractYearsOfExperience(text: string): number {
  return extractStatedExperience(text);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { jd, candidateProfile } = req.body;
  if (!jd || !candidateProfile) {
    return res.status(400).json({
      message: "Missing jd or candidateProfile parameters in request body",
    });
  }

  try {
    // ---------------------------------------------------------
    // DETERMINISTIC BUSINESS LOGIC - ZERO AI DEPENDENCY
    // ---------------------------------------------------------
    const jdText = typeof jd === "string" ? jd : JSON.stringify(jd);
    const resumeText = typeof candidateProfile === "string" ? candidateProfile : JSON.stringify(candidateProfile);

    // 1. Skill Extraction & Overlap using Controlled Taxonomy
    const jdLower = jdText.toLowerCase();
    const resumeLower = resumeText.toLowerCase();

    // Standard list of canonical skills
    const techWords = [
      "react", "node", "typescript", "javascript", "python", "java", "c++", "c#", ".net",
      "aws", "azure", "gcp", "docker", "kubernetes", "sql", "linux", "agile", "css", "html",
      "api", "rest", "graphql", "microservices", "ruby", "go", "rust", "swift", "kotlin",
      "spring", "django", "flask", "vue", "angular", "mongodb", "postgresql", "mysql",
      "redis", "kafka", "rabbitmq", "terraform", "ci/cd", "multithreading", "rtos", "embedded"
    ];

    const requiredSkills = techWords.filter((word) => jdLower.includes(word));
    const foundSkills = requiredSkills.filter((word) =>
      resumeLower.includes(word),
    );
    const missingSkills = requiredSkills.filter(
      (word) => !resumeLower.includes(word),
    );

    let skillsScore = 50;
    if (requiredSkills.length > 0) {
      skillsScore = Math.min(
        100,
        Math.round((foundSkills.length / requiredSkills.length) * 100),
      );
    } else if (foundSkills.length > 0) {
      skillsScore = 80;
    }

    // 2. Experience Match
    const requiredExp = extractYearsOfExperience(jdText);
    const candidateExp = extractYearsOfExperience(resumeText);

    let experienceScore = 70; // baseline
    if (requiredExp > 0) {
      if (candidateExp >= requiredExp) {
        experienceScore = 100;
      } else if (candidateExp > 0) {
        experienceScore = Math.max(0, 100 - (requiredExp - candidateExp) * 20); // deduct 20% per missing year
      }
    } else if (candidateExp > 0) {
      experienceScore = 85;
    }

    // 3. Location/Domain Match
    const remoteKeywords = ["remote", "work from home", "wfh", "telecommute"];
    const requiresRemote = remoteKeywords.some((k) => jdLower.includes(k));
    const candidateWantsRemote = remoteKeywords.some((k) =>
      resumeLower.includes(k),
    );

    let locationScore = 80;
    if (requiresRemote && candidateWantsRemote) locationScore = 100;
    else if (!requiresRemote && requiresRemote) locationScore = 60;

    let domainScore = 75;

    // Compute Total Deterministic Score
    const totalScore = Math.round(
      skillsScore * 0.5 +
        experienceScore * 0.3 +
        locationScore * 0.1 +
        domainScore * 0.1,
    );

    let recommendation: 'STRONG_FIT' | 'CONSIDER' | 'NOT_SUITABLE' = "CONSIDER";
    if (totalScore >= 80) recommendation = "STRONG_FIT";
    if (totalScore < 60) recommendation = "NOT_SUITABLE";

    // 4. OPTIONAL AI EXPLANATION PASS (Gemini is strictly optional for text reasoning only)
    let aiReasoning = "";
    const explainWithAI = req.body.explainWithAI === true;

    if (explainWithAI) {
      try {
        const prompt = PromptRegistry.getPrompt('candidate_match', 'v1', {
          totalScore,
          foundSkills,
          missingSkills,
          candidateExp,
          requiredExp,
          jdText: jdLower.substring(0, 1000),
          resumeText: resumeLower.substring(0, 1000)
        });

        const aiResponse = await AIRuntime.analyze({
          prompt: prompt,
          capability: 'candidate_matching',
          modelPreference: "fast",
          compressContext: true
        });
        if (aiResponse.outcome === "success") {
          aiReasoning = aiResponse.data.text || "";
        }
      } catch (e) {
        console.warn("[AI_EXPLAIN_FAILED]", e);
      }
    }

    const parsedData = {
      matchScore: totalScore,
      breakdown: {
        skillsScore,
        experienceScore,
        domainScore,
        locationScore,
        bonusScore: candidateExp > requiredExp + 3 ? 10 : 0,
        totalScore,
      },
      summary: aiReasoning || `Deterministic profile evaluation completed. Overall match scored at ${totalScore}%.`,
      strengths:
        foundSkills.length > 0
          ? foundSkills.map(
              (s) => `Demonstrated proficiency in ${s.toUpperCase()}`,
            )
          : ["General baseline capability mapped"],
      gaps:
        missingSkills.length > 0
          ? missingSkills.map(s => `Missing ${s.toUpperCase()}`)
          : ["No major technical gaps detected"],
      missingSkills: missingSkills,
      recruiterAssessment: aiReasoning || (
        recommendation === "STRONG_FIT"
          ? "High alignment on deterministic matching. Prioritize interview scheduling."
          : "Evaluate missing skills before progressing. Candidate lacks density in required stack."
      ),
      recommendation: recommendation,
      nextSteps:
        missingSkills.length > 0
          ? `Request clarification on: ${missingSkills.slice(0, 3).join(", ")}`
          : "Proceed to technical assessment.",
      outreachDrafts: {
        founder:
          "Hey, reviewed your profile and noticed a strong alignment with our technical stack. Would love to have a quick chat about our roadmap.",
        professional:
          "Dear Candidate, Your technical qualifications correspond well with our open requirements. We would appreciate the opportunity to connect.",
        executive:
          "Reaching out regarding a strategic role that aligns with your expertise. Please let me know if you are open to a confidential briefing.",
        warm: "Hi! I'm helping build a great team and your background stood out. Would you be open to a casual chat to explore synergy?",
      },
    };

    return res.status(200).json(parsedData);
  } catch (error: any) {
    console.error(
      "[DETAILED_MATCH_ERROR] Failed during deterministic matching:",
      error,
    );
    return res.status(500).json({
      error: error.message,
      message: "System error during deterministic match scoring.",
    });
  }
}
