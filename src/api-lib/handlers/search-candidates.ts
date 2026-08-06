import { adminDb } from "../../lib/firebase-admin.js";
import { getScopedCandidateUniverse } from "../utils/governance.js";
import { AIRuntime } from "../services/AIRuntime.js";

export default async function searchCandidatesHandler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { query: searchQuery } = req.body;
  const role = req.user?.role || req.query?.role;
  const orgId = req.user?.organizationId || req.query?.orgId;

  if (!searchQuery) {
    return res.status(400).json({ error: "Query is required" });
  }

  try {
    if (!adminDb) {
      return res.status(200).json({ candidates: [] });
    }

    // 1. Fetch scoped candidates (limit to 100 for performance)
    const snapshot = await getScopedCandidateUniverse(
      adminDb,
      "candidatePool",
      role,
      orgId
    )
    .limit(50)
    .get();

    const candidates = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    })).filter(c => c.status !== "DELETED" && c.isActive !== false);

    if (candidates.length === 0) {
      return res.status(200).json({ candidates: [] });
    }

    // 2. Use Gemini to rank candidates based on the query
    const candidateDataForAi = candidates.map(c => ({
      id: c.id,
      name: c.fullName || c.name,
      skills: c.skills || [],
      experience: c.experience || "",
      summary: c.distillationSummary || "",
      resumeText: (c.resumeText || "").substring(0, 1000) // Truncate to save tokens
    }));

    const prompt = `
      You are a senior recruiter AI. Rank the following candidates based on the search query: "${searchQuery}".
      
      Candidates:
      ${JSON.stringify(candidateDataForAi, null, 2)}
      
      Return a JSON array of objects with "id" and a "relevanceScore" (0-100) and a brief "reason".
      Order them by relevanceScore descending.
      Only return candidates that are at least somewhat relevant (score > 10).
      Return ONLY the JSON array.
    `;

    const result = await AIRuntime.analyze({
      prompt: prompt,
      modelPreference: 'fast',
      schema: true,
      compressContext: true // Uses Headroom
    });
    
    let rankings = result.data || [];

    if (!Array.isArray(rankings)) {
      console.warn("[SEARCH_AI_PARSE_WARN] Expected array, got something else", rankings);
      rankings = [];
    }

    // 3. Merge rankings back into candidate data
    const rankedCandidates = rankings.map((ranking: any) => {
      const candidate = candidates.find(c => c.id === ranking.id);
      if (candidate) {
        return {
          ...candidate,
          aiSearchScore: ranking.relevanceScore,
          aiSearchReason: ranking.reason
        };
      }
      return null;
    }).filter(Boolean);

    return res.status(200).json({ candidates: rankedCandidates });

  } catch (error: any) {
    console.error("[SEARCH_CANDIDATES_ERR]", error);
    return res.status(500).json({ error: error.message });
  }
}
