import { db as adminDb } from '../../lib/firebase-admin';

export default async function aiHealthHandler(req: any, res: any) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const healthStatus: Record<string, any> = {
        status: "healthy",
        gateway: "healthy",
        ollama: "unconfigured",
        gemini: "unconfigured",
        cache: "healthy",
        ledger: "healthy"
    };

    // 1. Check Ollama Status
    try {
        const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
        if (response.ok) {
            const data = await response.json();
            healthStatus.ollama = "healthy";
            healthStatus.ollama_models = data.models?.map((m: any) => m.name) || [];
        } else {
            healthStatus.ollama = `unhealthy (status: ${response.status})`;
        }
    } catch (e: any) {
        if (process.env.OLLAMA_BASE_URL) {
            healthStatus.ollama = `error: ${e.message}`;
            healthStatus.status = "degraded";
        } else {
            healthStatus.ollama = "offline";
        }
    }

    // 2. Check Gemini Configuration Status
    if (process.env.GEMINI_API_KEY) {
        healthStatus.gemini = "healthy";
    } else {
        healthStatus.gemini = "unconfigured";
    }

    // 4. Check Firestore Ledger Status
    if (!adminDb) {
        healthStatus.ledger = "unhealthy";
        healthStatus.status = "degraded";
    }

    return res.status(healthStatus.status === "healthy" ? 200 : 207).json(healthStatus);
}
