import { createClient } from 'redis';

export class RedisCache {
    private client: any;
    private isConnected: boolean = false;

    constructor() {
        const url = process.env.REDIS_URL || 'redis://localhost:6379';
        this.client = createClient({ url });
        this.client.on('error', (err: any) => console.warn('Redis Client Error', err));
    }

    async connect() {
        if (!this.isConnected) {
            try {
                await this.client.connect();
                this.isConnected = true;
            } catch (e) {
                console.warn('Failed to connect to Redis', e);
            }
        }
    }

    async get(key: string): Promise<any | null> {
        await this.connect();
        if (!this.isConnected) return null;
        try {
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }

    async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
        await this.connect();
        if (!this.isConnected) return;
        try {
            await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
        } catch (e) {
            console.warn('Redis set failed', e);
        }
    }
}

export const redisCache = new RedisCache();
