import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
export declare function setupWebSocket(server: HTTPServer, _fastify: any): SocketIOServer;
export declare function emitToSession(io: SocketIOServer, sessionId: string, event: string, data: any): void;
export declare function emitToUser(io: SocketIOServer, userId: string, event: string, data: any): void;
export declare function broadcastMessage(io: SocketIOServer, sessionId: string, message: {
    id: string;
    sessionId: string;
    sender: 'user' | 'ai';
    content: string;
    timestamp: string;
    widgets?: any[];
    metadata?: any;
}): void;
export declare function streamMessage(io: SocketIOServer, sessionId: string, messageId: string, chunk: string, isComplete?: boolean): void;
export declare function notifySessionUpdate(io: SocketIOServer, sessionId: string, update: {
    title?: string;
    status?: string;
    lastActivity?: string;
}): void;
//# sourceMappingURL=websocket.d.ts.map