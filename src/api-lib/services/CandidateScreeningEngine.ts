import crypto from "crypto";
import { adminDb } from "../../lib/firebase-admin.js";
import { AIGateway, AILevel } from "./AIGateway.js";
import { extractStatedExperience } from "../../resume-engine/parser/experience.js";

export interface CandidateScreeningResult {
  matchScore: number;
  tier: "High Confidence" | "Strong Potential" | "Partial Match" | "Weak Match";
  level?: AILevel;
  skillsMatched: string[];
  skillsMissing: string[];
  strengths: string[];
  gaps: string[];
  recommendation: "STRONG_FIT" | "CONSIDER" | "NOT_SUITABLE";
  summary: string;
  breakdown: {
    skillsScore: number;
    experienceScore: number;
    domainScore: number;
    locationScore: number;
    noticeScore?: number;
    educationScore?: number;
    bonusScore?: number;
    totalScore: number;
  };
  recruiterAssessment: string;
  nextSteps: string;
  outreachDrafts: {
    founder: string;
    professional: string;
    executive: string;
    warm: string;
  };
  cached?: boolean;
  analyzedAt?: string;
  cacheHash?: string;
}

// In-memory LRU cache to guarantee sub-millisecond response for repeat views
const inMemoryCache = new Map<string, { result: CandidateScreeningResult; timestamp: number }>();
const MEMORY_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export class CandidateScreeningEngine {
  /**
   * Generates a deterministic content-hash for Resume + JD with level awareness
   */
  static generateContentHash(resumeText: string, jdText: string, level: AILevel = 1): string {
    const normalizedResume = (resumeText || "").trim().toLowerCase();
    const normalizedJd = (jdText || "").trim().toLowerCase();
    return crypto
      .createHash("sha256")
      .update(`${normalizedResume}:::${normalizedJd}:::L${level}`)
      .digest("hex");
  }

  /**
   * Deterministic Fallback Rule Engine (Zero external dependencies)
   * Uses canonical 7-factor weighted scoring:
   * - Mandatory Skills: 35%
   * - Relevant Experience: 25%
   * - Domain Experience: 15%
   * - Location / Work Mode: 10%
   * - Notice Period: 5%
   * - Education / Certifications: 5%
   * - Nice-to-Have Skills: 5%
   * Total: 100%
   */
  static runDeterministicScreening(resumeText: string, jdText: string, level: AILevel = 1): CandidateScreeningResult {
    const jdLower = (jdText || "").toLowerCase();
    const resumeLower = (resumeText || "").toLowerCase();

    const techWords = [
      "react", "node", "typescript", "javascript", "python", "java", "c++", "c#", ".net",
      "aws", "azure", "gcp", "docker", "kubernetes", "sql", "linux", "agile", "css", "html",
      "api", "rest", "graphql", "microservices", "ruby", "go", "rust", "swift", "kotlin",
      "spring", "django", "flask", "vue", "angular", "mongodb", "postgresql", "mysql",
      "redis", "kafka", "rabbitmq", "terraform", "ci/cd", "multithreading", "salesforce",
      "apex", "lightning", "snowflake", "bigquery", "spark", "hadoop", "devops", "sre"
    ];

    const requiredSkills = techWords.filter((w) => jdLower.includes(w));
    const foundSkills = requiredSkills.filter((w) => resumeLower.includes(w));
    const missingSkills = requiredSkills.filter((w) => !resumeLower.includes(w));

    let mandatorySkillsScore = 60;
    if (requiredSkills.length > 0) {
      mandatorySkillsScore = Math.min(100, Math.round((foundSkills.length / requiredSkills.length) * 100));
    } else if (foundSkills.length > 0) {
      mandatorySkillsScore = 80;
    }

    const requiredExp = extractStatedExperience(jdText);
    const candidateExp = extractStatedExperience(resumeText);

    let experienceScore = 70;
    if (requiredExp > 0) {
      if (candidateExp >= requiredExp) {
        experienceScore = 100;
      } else if (candidateExp > 0) {
        experienceScore = Math.max(20, Math.round(100 - ((requiredExp - candidateExp) / requiredExp) * 60));
      }
    } else if (candidateExp > 0) {
      experienceScore = 85;
    }

    const remoteKeywords = ["remote", "work from home", "wfh", "telecommute", "flexible"];
    const requiresRemote = remoteKeywords.some((k) => jdLower.includes(k));
    const candidateWantsRemote = remoteKeywords.some((k) => resumeLower.includes(k));

    let locationScore = 80;
    if (requiresRemote && candidateWantsRemote) locationScore = 100;
    else if (!requiresRemote && requiresRemote) locationScore = 60;

    const domainScore = 75;
    const noticeScore = resumeLower.includes("immediate") ? 100 : resumeLower.includes("30") ? 85 : 70;
    const educationScore = (resumeLower.includes("bachelor") || resumeLower.includes("master") || resumeLower.includes("b.tech") || resumeLower.includes("degree")) ? 95 : 80;
    const niceToHaveScore = foundSkills.length > 3 ? 90 : 70;

    const totalScore = Math.round(
      mandatorySkillsScore * 0.35 +
      experienceScore * 0.25 +
      domainScore * 0.15 +
      locationScore * 0.10 +
      noticeScore * 0.05 +
      educationScore * 0.05 +
      niceToHaveScore * 0.05
    );

    let recommendation: "STRONG_FIT" | "CONSIDER" | "NOT_SUITABLE" = "CONSIDER";
    let tier: CandidateScreeningResult["tier"] = "Strong Potential";

    if (totalScore >= 80) {
      recommendation = "STRONG_FIT";
      tier = "High Confidence";
    } else if (totalScore >= 60) {
      recommendation = "CONSIDER";
      tier = "Strong Potential";
    } else if (totalScore >= 40) {
      recommendation = "NOT_SUITABLE";
      tier = "Partial Match";
    } else {
      recommendation = "NOT_SUITABLE";
      tier = "Weak Match";
    }

    return {
      matchScore: totalScore,
      tier,
      level,
      skillsMatched: foundSkills,
      skillsMissing: missingSkills,
      strengths: foundSkills.length > 0 ? foundSkills.map((s) => `Demonstrated proficiency in ${s.toUpperCase()}`) : ["Baseline technical competency identified"],
      gaps: missingSkills.length > 0 ? missingSkills.map((s) => `Missing ${s.toUpperCase()}`) : ["No critical technical gaps detected"],
      recommendation,
      summary: `Profile screened via deterministic analysis engine (Level ${level}). Overall alignment scored at ${totalScore}%.`,
      breakdown: {
        skillsScore: mandatorySkillsScore,
        experienceScore,
        domainScore,
        locationScore,
        noticeScore,
        educationScore,
        totalScore
      },
      recruiterAssessment: recommendation === "STRONG_FIT"
        ? "High alignment on deterministic matching. Prioritize interview scheduling."
        : "Evaluate missing skills before progressing. Candidate lacks density in required stack.",
      nextSteps: missingSkills.length > 0
        ? `Request clarification on: ${missingSkills.slice(0, 3).join(", ")}`
        : "Proceed to technical assessment.",
      outreachDrafts: {
        founder: "Hey, reviewed your profile and noticed a strong alignment with our technical stack. Would love to have a quick chat about our roadmap.",
        professional: "Dear Candidate, Your technical qualifications correspond well with our open requirements. We would appreciate the opportunity to connect.",
        executive: "Reaching out regarding a strategic role that aligns with your expertise. Please let me know if you are open to a confidential briefing.",
        warm: "Hi! I'm helping build a great team and your background stood out. Would you be open to a casual chat to explore synergy?"
      },
      cached: false,
      analyzedAt: new Date().toISOString()
    };
  }

  /**
   * Screens Candidate Resume against JD via Gemini Flash
   * - Level 1: Routine screening (gemini-3.1-flash-lite)
   * - Level 2: Deep reasoning / fitment analysis (gemini-3.7-flash)
   */
  static async screenCandidateAgainstJob(
    candidateProfile: string,
    jd: string,
    options?: {
      candidateId?: string;
      requirementId?: string;
      forceRefresh?: boolean;
      userId?: string;
      level?: AILevel;
      deepFitment?: boolean;
    }
  ): Promise<CandidateScreeningResult> {
    const resumeText = (candidateProfile || "").trim();
    const jdText = (jd || "").trim();

    if (!resumeText || !jdText) {
      throw new Error("Both candidate resume text and job description are required for screening.");
    }

    const level: AILevel = options?.deepFitment || options?.level === 2 ? 2 : 1;
    const cacheHash = this.generateContentHash(resumeText, jdText, level);

    // 1. Check In-Memory Cache (Sub-millisecond)
    if (!options?.forceRefresh) {
      const memoryHit = inMemoryCache.get(cacheHash);
      if (memoryHit && Date.now() - memoryHit.timestamp < MEMORY_CACHE_TTL) {
        console.log(`[CandidateScreeningEngine] Memory Cache Hit for hash ${cacheHash.slice(0, 8)} [L${level}] (0 AI calls)`);
        return {
          ...memoryHit.result,
          level,
          cached: true,
          cacheHash
        };
      }
    }

    // 2. Check Firestore Persistent Cache (candidate_match_cache)
    if (!options?.forceRefresh && adminDb) {
      try {
        const cacheDoc = await adminDb.collection("candidate_match_cache").doc(cacheHash).get();
        if (cacheDoc.exists) {
          const cachedData = cacheDoc.data();
          if (cachedData && cachedData.screeningResult) {
            console.log(`[CandidateScreeningEngine] Firestore Cache Hit for hash ${cacheHash.slice(0, 8)} [L${level}] (0 AI calls)`);
            const result = {
              ...cachedData.screeningResult,
              level,
              cached: true,
              cacheHash
            };
            inMemoryCache.set(cacheHash, { result, timestamp: Date.now() });
            return result;
          }
        }
      } catch (err: any) {
        console.warn(`[CandidateScreeningEngine] Persistent cache read failed:`, err.message);
      }
    }

    // 3. Invoke AIGateway with level routing
    const targetFeature = level === 2 ? "deep_fitment" : "candidate_screening";
    console.log(`[CandidateScreeningEngine] Cache miss for hash ${cacheHash.slice(0, 8)}. Invoking Level ${level} Gemini screening...`);

    const screeningPrompt = `You are the principal AI Candidate Screening Engine for HireNest OS.
Analyze the following Candidate Resume against the Job Description (JD).

JOB DESCRIPTION:
"""
${jdText.substring(0, 4000)}
"""

CANDIDATE RESUME:
"""
${resumeText.substring(0, 5000)}
"""

Evaluate candidate-JD fit rigorously and return a valid JSON object matching this exact schema:
{
  "matchScore": number (0 to 100, representing comprehensive match percentage),
  "tier": string (one of: "High Confidence", "Strong Potential", "Partial Match", "Weak Match"),
  "skillsMatched": string[] (skills found in both JD and candidate profile),
  "skillsMissing": string[] (skills required by JD but absent in candidate profile),
  "strengths": string[] (2-4 key reasons why this candidate is a strong fit),
  "gaps": string[] (1-3 areas of concern, missing experience, or unverified skills),
  "recommendation": string ("STRONG_FIT" if score >= 80, "CONSIDER" if score >= 60, "NOT_SUITABLE" if score < 60),
  "summary": string (2-3 sentence executive recruiter summary of the fit),
  "breakdown": {
    "skillsScore": number (0-100),
    "experienceScore": number (0-100),
    "domainScore": number (0-100),
    "locationScore": number (0-100),
    "totalScore": number (0-100)
  },
  "recruiterAssessment": string (Actionable directive for the recruiter),
  "nextSteps": string (Immediate recommended next action for this candidate),
  "outreachDrafts": {
    "founder": string (Short casual founder outreach message),
    "professional": string (Polite corporate recruiter outreach),
    "executive": string (Executive search briefing outreach),
    "warm": string (Friendly engaging outreach)
  }
}`;

    let screeningResult: CandidateScreeningResult;

    try {
      const aiResponse = await AIGateway.processChat({
        prompt: screeningPrompt,
        feature: targetFeature,
        level,
        agent: "CandidateScreeningEngine",
        temperature: 0.1,
        systemInstruction: "You are HireNest OS's screening engine. Evaluate candidates objectively. Output valid JSON only.",
        schema: {
          type: "object",
          properties: {
            matchScore: { type: "number" },
            tier: { type: "string" },
            skillsMatched: { type: "array", items: { type: "string" } },
            skillsMissing: { type: "array", items: { type: "string" } },
            strengths: { type: "array", items: { type: "string" } },
            gaps: { type: "array", items: { type: "string" } },
            recommendation: { type: "string" },
            summary: { type: "string" },
            breakdown: {
              type: "object",
              properties: {
                skillsScore: { type: "number" },
                experienceScore: { type: "number" },
                domainScore: { type: "number" },
                locationScore: { type: "number" },
                totalScore: { type: "number" }
              },
              required: ["skillsScore", "experienceScore", "domainScore", "locationScore", "totalScore"]
            },
            recruiterAssessment: { type: "string" },
            nextSteps: { type: "string" },
            outreachDrafts: {
              type: "object",
              properties: {
                founder: { type: "string" },
                professional: { type: "string" },
                executive: { type: "string" },
                warm: { type: "string" }
              }
            }
          },
          required: [
            "matchScore",
            "tier",
            "skillsMatched",
            "skillsMissing",
            "strengths",
            "gaps",
            "recommendation",
            "summary",
            "breakdown"
          ]
        },
        userId: options?.userId || "recruiter",
        office: "recruiter"
      });

      let parsed: any;
      const rawText = aiResponse.response.trim();
      try {
        parsed = JSON.parse(rawText);
      } catch {
        const jsonMatch = rawText.match(/```(?:json)?([\s\S]*?)```/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1].trim());
        } else {
          throw new Error("Unable to parse AI screening response as JSON");
        }
      }

      const score = Math.min(100, Math.max(0, Math.round(Number(parsed.matchScore) || 75)));
      let rec: "STRONG_FIT" | "CONSIDER" | "NOT_SUITABLE" = "CONSIDER";
      if (parsed.recommendation === "STRONG_FIT" || score >= 80) rec = "STRONG_FIT";
      else if (parsed.recommendation === "NOT_SUITABLE" || score < 60) rec = "NOT_SUITABLE";

      let tier: CandidateScreeningResult["tier"] = "Strong Potential";
      if (score >= 85) tier = "High Confidence";
      else if (score >= 70) tier = "Strong Potential";
      else if (score >= 50) tier = "Partial Match";
      else tier = "Weak Match";

      screeningResult = {
        matchScore: score,
        tier: (parsed.tier as any) || tier,
        level,
        skillsMatched: Array.isArray(parsed.skillsMatched) ? parsed.skillsMatched : [],
        skillsMissing: Array.isArray(parsed.skillsMissing) ? parsed.skillsMissing : [],
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : ["Profile matches target requirements"],
        gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
        recommendation: rec,
        summary: parsed.summary || `AI screening (Level ${level}) evaluated match at ${score}%.`,
        breakdown: {
          skillsScore: Math.round(Number(parsed.breakdown?.skillsScore) || score),
          experienceScore: Math.round(Number(parsed.breakdown?.experienceScore) || 80),
          domainScore: Math.round(Number(parsed.breakdown?.domainScore) || 80),
          locationScore: Math.round(Number(parsed.breakdown?.locationScore) || 90),
          totalScore: score
        },
        recruiterAssessment: parsed.recruiterAssessment || (
          rec === "STRONG_FIT"
            ? "High alignment on core requirements. Proceed with interview screening."
            : "Review missing skills with candidate before advancing."
        ),
        nextSteps: parsed.nextSteps || "Schedule initial technical screening.",
        outreachDrafts: parsed.outreachDrafts || {
          founder: "Hey, reviewed your profile and saw strong synergy with what we're building.",
          professional: "Dear Candidate, Your technical profile aligns closely with our open position.",
          executive: "Reaching out regarding a strategic engagement aligned with your background.",
          warm: "Hi! Your impressive background caught our eye and we'd love to connect."
        },
        cached: false,
        analyzedAt: new Date().toISOString(),
        cacheHash
      };
    } catch (aiError: any) {
      console.warn(`[CandidateScreeningEngine] Level ${level} Gemini call failed: ${aiError.message}. Using deterministic fallback.`);
      screeningResult = this.runDeterministicScreening(resumeText, jdText, level);
      screeningResult.cacheHash = cacheHash;
    }

    // 4. Save to Persistent Cache & Memory Cache
    inMemoryCache.set(cacheHash, { result: screeningResult, timestamp: Date.now() });

    if (adminDb) {
      const cachePayload = {
        cacheHash,
        level,
        screeningResult,
        candidateId: options?.candidateId || null,
        requirementId: options?.requirementId || null,
        resumeSnippet: resumeText.slice(0, 300),
        jdSnippet: jdText.slice(0, 300),
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      };

      adminDb
        .collection("candidate_match_cache")
        .doc(cacheHash)
        .set(cachePayload)
        .catch((e: any) => console.warn(`[CandidateScreeningEngine] Failed to write cache to Firestore:`, e));

      // Also persist to candidate document if candidateId provided
      if (options?.candidateId) {
        adminDb
          .collection("candidatePool")
          .doc(options.candidateId)
          .set(
            {
              aiMatchScore: screeningResult.matchScore,
              aiScreeningResult: screeningResult,
              lastScreenedAt: new Date().toISOString()
            },
            { merge: true }
          )
          .catch((e: any) => console.warn(`[CandidateScreeningEngine] Failed to update candidate doc:`, e));
      }
    }

    return screeningResult;
  }

  /**
   * Helper for Deep Fitment Analysis (Level 2: Gemini 3.7 Flash)
   */
  static async deepFitmentAnalysis(
    candidateProfile: string,
    jd: string,
    options?: {
      candidateId?: string;
      requirementId?: string;
      forceRefresh?: boolean;
      userId?: string;
    }
  ): Promise<CandidateScreeningResult> {
    return this.screenCandidateAgainstJob(candidateProfile, jd, {
      ...options,
      level: 2,
      deepFitment: true
    });
  }
}
