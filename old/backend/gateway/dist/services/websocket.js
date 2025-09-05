import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import { query } from '../db/index.js';
export function setupWebSocket(server, _fastify) {
    const io = new SocketIOServer(server, {
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:3000',
            credentials: true
        },
        transports: ['websocket', 'polling']
    });
    // Authentication middleware
    io.use(async (socket, next) => {
        let token;
        try {
            token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
            if (!token) {
                logger.error('WebSocket authentication failed: No token provided');
                return next(new Error('Authentication required'));
            }
            // Verify JWT token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            // Attach user info to socket
            socket.userId = decoded.id;
            socket.email = decoded.email;
            logger.info(`WebSocket authenticated: ${decoded.email}`);
            next();
        }
        catch (error) {
            logger.error('WebSocket authentication failed:', {
                message: error?.message,
                error: error?.toString(),
                token: token ? 'provided' : 'missing',
                secret: process.env.JWT_SECRET ? 'set' : 'using default'
            });
            next(new Error('Invalid token'));
        }
    });
    // Connection handler
    io.on('connection', (socket) => {
        logger.info(`User connected: ${socket.email} (${socket.id})`);
        // Join user's personal room
        socket.join(`user:${socket.userId}`);
        // Session room management
        socket.on('join_session', async (data) => {
            try {
                const { sessionId } = data;
                // Verify user has access to this session
                const sessions = await query('SELECT id FROM sessions WHERE id = $1 AND user_id = $2', [sessionId, socket.userId]);
                if (sessions.length === 0) {
                    socket.emit('error', { message: 'Session not found or access denied' });
                    return;
                }
                // Join session room
                socket.join(`session:${sessionId}`);
                socket.emit('joined_session', { sessionId });
                logger.info(`User ${socket.email} joined session: ${sessionId}`);
            }
            catch (error) {
                logger.error('Error joining session:', error);
                socket.emit('error', { message: 'Failed to join session' });
            }
        });
        socket.on('leave_session', (data) => {
            const { sessionId } = data;
            socket.leave(`session:${sessionId}`);
            socket.emit('left_session', { sessionId });
            logger.info(`User ${socket.email} left session: ${sessionId}`);
        });
        // Handle typing indicators
        socket.on('typing_start', (data) => {
            socket.to(`session:${data.sessionId}`).emit('user_typing', {
                userId: socket.userId,
                email: socket.email
            });
        });
        socket.on('typing_stop', (data) => {
            socket.to(`session:${data.sessionId}`).emit('user_stopped_typing', {
                userId: socket.userId
            });
        });
        // Handle disconnect
        socket.on('disconnect', () => {
            logger.info(`User disconnected: ${socket.email} (${socket.id})`);
        });
    });
    return io;
}
// Helper function to emit events to specific sessions
export function emitToSession(io, sessionId, event, data) {
    io.to(`session:${sessionId}`).emit(event, data);
}
// Helper function to emit events to specific users
export function emitToUser(io, userId, event, data) {
    io.to(`user:${userId}`).emit(event, data);
}
// Helper function to broadcast new messages
export function broadcastMessage(io, sessionId, message) {
    emitToSession(io, sessionId, 'chat_message', {
        sessionId,
        message
    });
}
// Helper function for streaming AI responses
export function streamMessage(io, sessionId, messageId, chunk, isComplete = false) {
    emitToSession(io, sessionId, 'message_stream', {
        sessionId,
        messageId,
        chunk,
        isComplete
    });
}
// Helper function to notify session updates
export function notifySessionUpdate(io, sessionId, update) {
    emitToSession(io, sessionId, 'session_update', {
        sessionId,
        update
    });
}
//# sourceMappingURL=websocket.js.map