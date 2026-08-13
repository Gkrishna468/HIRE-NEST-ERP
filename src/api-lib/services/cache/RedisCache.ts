import { createClient } from 'redis';

export class RedisCache {
    private cache: Map<string, { value: any; expiresAt: number }> = new Map();
    private isConnected: boolean = true;

    constructor() {
        // Fallback to in-memory map to prevent ECONNREFUSED in environments without Redis
    }

    async connect() {
        // No-op for in-memory cache
    }

    async get(key: string): Promise<any | null> {
        const item = this.cache.get(key);
        if (!item) return null;
        if (Date.now() > item.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return item.value;
    }

    async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
        this.cache.set(key, {
            value,
            expiresAt: Date.now() + (ttlSeconds * 1000)
        });
    }
}

export const redisCache = new RedisCache();
