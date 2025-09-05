import { Pool } from 'pg';
export interface Session {
    id: string;
    userId: string;
    title: string;
    status: 'active' | 'ended';
    createdAt: Date;
    lastActivity: Date;
    endedAt?: Date;
    metadata?: Record<string, any>;
}
export interface Message {
    id: string;
    sessionId: string;
    sender: 'user' | 'ai';
    content: string;
    tokensUsed?: number;
    processingTime?: number;
    createdAt: Date;
    metadata?: Record<string, any>;
}
export declare class SessionManager {
    private db;
    constructor(db: Pool);
    createSession(userId: string, title?: string): Promise<Session>;
    getSession(sessionId: string): Promise<Session | null>;
    getUserSessions(userId: string, limit?: number): Promise<Session[]>;
    updateSessionActivity(sessionId: string): Promise<void>;
    endSession(sessionId: string): Promise<void>;
    addMessage(sessionId: string, sender: 'user' | 'ai', content: string, metadata?: Record<string, any>): Promise<Message>;
    getSessionMessages(sessionId: string, limit?: number): Promise<Message[]>;
    updateMessageMetrics(messageId: string, tokensUsed: number, processingTime: number): Promise<void>;
    validateSessionAccess(sessionId: string, userId: string): Promise<boolean>;
    getSessionStats(userId: string): Promise<{
        totalSessions: number;
        activeSessions: number;
        totalMessages: number;
        totalTokensUsed: number;
    }>;
    private formatSession;
    private formatMessage;
}
export declare function createSessionManager(db: Pool): SessionManager;
//# sourceMappingURL=session.d.ts.map