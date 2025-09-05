import { z } from 'zod';
declare const configSchema: z.ZodObject<{
    app: z.ZodObject<{
        port: z.ZodNumber;
        env: z.ZodEnum<["development", "production", "test"]>;
    }, "strip", z.ZodTypeAny, {
        port: number;
        env: "development" | "production" | "test";
    }, {
        port: number;
        env: "development" | "production" | "test";
    }>;
    database: z.ZodObject<{
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
    }, {
        url: string;
    }>;
    redis: z.ZodObject<{
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
    }, {
        url: string;
    }>;
    jwt: z.ZodObject<{
        secret: z.ZodString;
        refreshSecret: z.ZodString;
        expiry: z.ZodString;
        refreshExpiry: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        secret: string;
        refreshSecret: string;
        expiry: string;
        refreshExpiry: string;
    }, {
        secret: string;
        refreshSecret: string;
        expiry: string;
        refreshExpiry: string;
    }>;
    cors: z.ZodObject<{
        origin: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">, z.ZodBoolean]>;
    }, "strip", z.ZodTypeAny, {
        origin: string | boolean | string[];
    }, {
        origin: string | boolean | string[];
    }>;
    rateLimit: z.ZodObject<{
        max: z.ZodNumber;
        windowMs: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        max: number;
        windowMs: number;
    }, {
        max: number;
        windowMs: number;
    }>;
    grpc: z.ZodObject<{
        aiServiceUrl: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        aiServiceUrl: string;
    }, {
        aiServiceUrl: string;
    }>;
}, "strip", z.ZodTypeAny, {
    app: {
        port: number;
        env: "development" | "production" | "test";
    };
    database: {
        url: string;
    };
    redis: {
        url: string;
    };
    jwt: {
        secret: string;
        refreshSecret: string;
        expiry: string;
        refreshExpiry: string;
    };
    cors: {
        origin: string | boolean | string[];
    };
    rateLimit: {
        max: number;
        windowMs: number;
    };
    grpc: {
        aiServiceUrl: string;
    };
}, {
    app: {
        port: number;
        env: "development" | "production" | "test";
    };
    database: {
        url: string;
    };
    redis: {
        url: string;
    };
    jwt: {
        secret: string;
        refreshSecret: string;
        expiry: string;
        refreshExpiry: string;
    };
    cors: {
        origin: string | boolean | string[];
    };
    rateLimit: {
        max: number;
        windowMs: number;
    };
    grpc: {
        aiServiceUrl: string;
    };
}>;
export declare const config: {
    app: {
        port: number;
        env: "development" | "production" | "test";
    };
    database: {
        url: string;
    };
    redis: {
        url: string;
    };
    jwt: {
        secret: string;
        refreshSecret: string;
        expiry: string;
        refreshExpiry: string;
    };
    cors: {
        origin: string | boolean | string[];
    };
    rateLimit: {
        max: number;
        windowMs: number;
    };
    grpc: {
        aiServiceUrl: string;
    };
};
export type Config = z.infer<typeof configSchema>;
export {};
//# sourceMappingURL=index.d.ts.map