import { FastifyPluginAsync } from 'fastify'
import { checkDatabaseHealth } from '../db/index.js'
import { checkRedisHealth } from '../services/redis.js'
import { checkGrpcHealth } from '../services/grpc.js'

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request, reply) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        api: 'up',
        database: 'unknown',
        redis: 'unknown',
        ai: 'unknown'
      }
    }

    try {
      // Check database
      const dbHealthy = await checkDatabaseHealth()
      health.services.database = dbHealthy ? 'up' : 'down'

      // Check Redis
      const redisHealthy = await checkRedisHealth()
      health.services.redis = redisHealthy ? 'up' : 'down'

      // Check gRPC AI service
      const grpcHealthy = await checkGrpcHealth()
      health.services.ai = grpcHealthy ? 'up' : 'down'

      // Overall status
      const allHealthy = Object.values(health.services).every(s => s === 'up')
      health.status = allHealthy ? 'healthy' : 'degraded'

      return reply.code(allHealthy ? 200 : 503).send(health)
    } catch (error) {
      health.status = 'unhealthy'
      return reply.code(503).send(health)
    }
  })

  fastify.get('/ready', async (request, reply) => {
    // Readiness check for Kubernetes
    try {
      const dbHealthy = await checkDatabaseHealth()
      const redisHealthy = await checkRedisHealth()
      
      if (dbHealthy && redisHealthy) {
        return reply.code(200).send({ ready: true })
      }
      
      return reply.code(503).send({ ready: false })
    } catch (error) {
      return reply.code(503).send({ ready: false })
    }
  })

  fastify.get('/live', async (request, reply) => {
    // Liveness check for Kubernetes
    return reply.code(200).send({ alive: true })
  })
}