import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import { env } from './utils/envValidator.js'  // Validate environment on startup
import { config } from './config/index.js'
import { logger } from './utils/logger.js'
import { healthRoutes } from './routes/health.js'
import { authRoutes } from './routes/auth.js'
import { chatRoutes } from './routes/chat.js'
import { streamRoutes } from './routes/stream.js'
import { apiKeyRoutes } from './routes/apiKeys.js'
import { securityRoutes } from './routes/security.js'
import { errorHandler } from './middleware/errorHandler.js'
import { initializeDatabase, pool } from './db/index.js'
import { initializeRedis, getRedis } from './services/redis.js'
import { initializeGrpcClients } from './services/grpc.js'
import { setupWebSocket } from './services/websocket.js'
import { securityPlugin, requestIdPlugin, corsOptions } from './middleware/security.js'
import { initSecureDatabase } from './services/secureDatabase.js'
import { AuditLogger } from './services/auditLogger.js'
import { startSecurityCronJobs, stopSecurityCronJobs } from './services/cronJobs.js'

const server = Fastify({
  logger: true
})

// Socket.io instance (will be initialized after server starts)
let io: any = null

async function start() {
  try {
    // Initialize database
    await initializeDatabase()
    logger.info('Database initialized')
    
    // Initialize secure database service
    initSecureDatabase(pool)
    logger.info('Secure database service initialized')

    // Initialize Redis
    await initializeRedis()
    logger.info('Redis initialized')

    // Initialize gRPC clients
    await initializeGrpcClients()
    logger.info('gRPC clients initialized')

    // Register security plugins
    await server.register(requestIdPlugin)
    await server.register(securityPlugin)
    
    // Register CORS with enhanced security options
    await server.register(cors, corsOptions)

    await server.register(jwt, {
      secret: config.jwt.secret,
      sign: {
        expiresIn: config.jwt.expiry
      }
    })

    // Configure rate limiting
    await server.register(rateLimit, {
      global: true,
      max: config.rateLimit.max || 100,
      timeWindow: config.rateLimit.windowMs || 900000, // 15 minutes
      cache: 10000,
      allowList: [], // Add trusted IPs if needed
      redis: getRedis(), // Use Redis for distributed rate limiting
      skipSuccessfulRequests: false,
      keyGenerator: (request: any) => {
        // Rate limit by user ID if authenticated, otherwise by IP
        return request.user?.id || request.ip
      },
      errorResponseBuilder: (request: any, context: any) => {
        return {
          statusCode: 429,
          error: 'Too Many Requests',
          message: `Rate limit exceeded, retry in ${context.after}`,
          retryAfter: context.after,
          limit: context.max,
          remaining: context.remaining,
          resetTime: new Date(context.ttl).toISOString()
        }
      }
    })

    // JWT decorator - must be before routes
    server.decorate('authenticate', async function(request: any, reply: any) {
      try {
        await request.jwtVerify()
      } catch (err) {
        reply.send(err)
      }
    })

    // Set error handler
    server.setErrorHandler(errorHandler as any)

    // Register routes
    await server.register(healthRoutes, { prefix: '/health' })
    await server.register(authRoutes, { prefix: '/api/v1/auth' })
    await server.register(chatRoutes, { prefix: '/api/v1/chat' })
    await server.register(streamRoutes, { prefix: '/api/v1/stream' })
    await server.register(apiKeyRoutes, { prefix: '/api/v1' })
    await server.register(securityRoutes, { prefix: '/api/v1/security' })

    // Start server
    await server.listen({ 
      port: config.app.port, 
      host: '0.0.0.0' 
    })

    // Setup WebSocket server AFTER Fastify is listening
    io = setupWebSocket(server.server as any, server)
    ;(server as any).log.info('WebSocket server initialized')
    
    // Make io available globally for routes to use
    ;(server as any).io = io
    
    // Start security cron jobs
    startSecurityCronJobs()
    logger.info('Security cron jobs started')

    ;(server as any).log.info(`Server listening on http://0.0.0.0:${config.app.port}`)
  } catch (err) {
    logger.error(err)
    process.exit(1)
  }
}

// Handle graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Shutting down gracefully...')
  
  // Stop cron jobs
  stopSecurityCronJobs()
  
  // Flush audit logs
  await AuditLogger.flush()
  
  // Close server
  await server.close()
  
  process.exit(0)
}

process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)

start()