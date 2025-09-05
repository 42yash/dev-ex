import * as grpc from '@grpc/grpc-js';
export declare function initializeGrpcClients(): Promise<void>;
export declare function getChatClient(): any;
export declare function checkGrpcHealth(): Promise<boolean>;
export declare function createMetadata(token?: string): grpc.Metadata;
export declare function sendMessage(sessionId: string, message: string, options?: any): Promise<any>;
export declare function createSession(userId: string, metadata?: any): Promise<any>;
export declare function getHistory(sessionId: string, limit?: number, offset?: number): Promise<any>;
//# sourceMappingURL=grpc.d.ts.map