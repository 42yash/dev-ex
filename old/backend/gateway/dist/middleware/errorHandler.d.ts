import { FastifyError, FastifyReply, FastifyRequest, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
export interface AppError extends Error {
    statusCode?: number;
    code?: string;
    details?: any;
}
export declare class ValidationError extends Error implements AppError {
    details?: any | undefined;
    statusCode: number;
    code: string;
    constructor(message: string, details?: any | undefined);
}
export declare class AuthenticationError extends Error implements AppError {
    statusCode: number;
    code: string;
    constructor(message?: string);
}
export declare class NotFoundError extends Error implements AppError {
    statusCode: number;
    code: string;
    constructor(resource: string);
}
export declare class ConflictError extends Error implements AppError {
    statusCode: number;
    code: string;
    constructor(message: string);
}
export declare class RateLimitError extends Error implements AppError {
    retryAfter: number;
    statusCode: number;
    code: string;
    constructor(retryAfter?: number);
}
export declare function errorHandler(error: FastifyError | AppError | ZodError, request: FastifyRequest, reply: FastifyReply): Promise<void>;
export declare function setupErrorHandler(fastify: FastifyInstance): void;
//# sourceMappingURL=errorHandler.d.ts.map