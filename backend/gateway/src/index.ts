import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import { config } from './config/index.js'
import { logger } from './utils/logger.js'
import { healthRoutes } from './routes/health.js'
import { authRoutes } from './routes/auth.js'
import { chatRoutes } from './routes/chat.js'
import { errorHandler } from './middleware/errorHandler.js'
import { initializeDatabase } from './db/index.js'
import { initializeRedis } from './services/redis.js'
import { initializeGrpcClients } from './services/grpc.js'

const server = Fastify({
  logger: logger
})

async function start() {
  try {
    // Initialize database
    await initializeDatabase()
    logger.info('Database initialized')

    // Initialize Redis
    await initializeRedis()
    logger.info('Redis initialized')

    // Initialize gRPC clients
    await initializeGrpcClients()
    logger.info('gRPC clients initialized')

    // Register plugins
    await server.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        }
      }
    })

    await server.register(cors, {
      origin: config.cors.origin,
      credentials: true
    })

    await server.register(jwt, {
      secret: config.jwt.secret,
      sign: {
        expiresIn: config.jwt.expiry
      }
    })

    await server.register(rateLimit, {
      max: config.rateLimit.max,
      timeWindow: config.rateLimit.windowMs
    })

    // Set error handler
    server.setErrorHandler(errorHandler)

    // Register routes
    await server.register(healthRoutes, { prefix: '/health' })
    await server.register(authRoutes, { prefix: '/api/v1/auth' })
    await server.register(chatRoutes, { prefix: '/api/v1/chat' })

    // JWT decorator
    server.decorate('authenticate', async function(request: any, reply: any) {
      try {
        await request.jwtVerify()
      } catch (err) {
        reply.send(err)
      }
    })

    // Start server
    await server.listen({ 
      port: config.app.port, 
      host: '0.0.0.0' 
    })

    logger.info(`Server listening on http://0.0.0.0:${config.app.port}`)
  } catch (err) {
    logger.error(err)
    process.exit(1)
  }
}

// Handle graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Shutting down gracefully...')
  await server.close()
  process.exit(0)
}

process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)

start()