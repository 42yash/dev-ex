export declare function initializeDatabase(): Promise<void>;
export declare function query<T = any>(text: string, params?: any[]): Promise<T[]>;
export declare function getClient(): Promise<import("pg").PoolClient>;
export declare function transaction<T>(callback: (client: any) => Promise<T>): Promise<T>;
export declare function checkDatabaseHealth(): Promise<boolean>;
export declare function closeDatabase(): Promise<void>;
//# sourceMappingURL=index.d.ts.map