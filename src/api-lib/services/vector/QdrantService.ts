export class QdrantService {
    private baseUrl: string;
    private apiKey: string;

    constructor() {
        this.baseUrl = process.env.QDRANT_URL || 'http://localhost:6333';
        this.apiKey = process.env.QDRANT_API_KEY || '';
    }

    async search(collectionName: string, vector: number[], limit: number = 5) {
        console.log(`[Qdrant] Searching in ${collectionName}`);
        return [];
    }

    async upsert(collectionName: string, points: any[]) {
        console.log(`[Qdrant] Upserting to ${collectionName}`);
    }
}

export const qdrantService = new QdrantService();
