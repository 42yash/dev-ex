import { Redis } from 'ioredis';
export declare function initializeRedis(): Promise<void>;
export declare function getRedis(): Redis;
export declare function checkRedisHealth(): Promise<boolean>;
export declare function getCached<T>(key: string): Promise<T | null>;
export declare function setCached<T>(key: string, value: T, ttl?: number): Promise<void>;
export declare function deleteCached(key: string): Promise<void>;
export declare function getSession(sessionId: string): Promise<any>;
export declare function setSession(sessionId: string, data: any, ttl?: number): Promise<void>;
export declare function deleteSession(sessionId: string): Promise<void>;
export declare function checkRateLimit(key: string, limit: number, window: number): Promise<boolean>;
export declare function closeRedis(): Promise<void>;
//# sourceMappingURL=redis.d.ts.map