import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ApiKeyService, apiKeyAuth } from '../services/apiKeyService.js'
import { AuditLogger } from '../services/auditLogger.js'
import { authRateLimit } from '../middleware/rateLimiter.js'

// Validation schemas
const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  permissions: z.array(z.string()).optional().default(['read']),
  expiresInDays: z.number().min(1).max(365).optional()
})

const rotateApiKeySchema = z.object({
  keyId: z.string().uuid()
})

const revokeApiKeySchema = z.object({
  keyId: z.string().uuid()
})

export const apiKeyRoutes: FastifyPluginAsync = async (fastify) => {
  // Create new API key
  fastify.post('/keys', {
    preHandler: [fastify.authenticate],
    config: authRateLimit.config
  }, async (request, reply) => {
    try {
      const user = (request as any).user
      const body = createApiKeySchema.parse(request.body)
      
      // Create the API key
      const { key, id } = await ApiKeyService.createApiKey(
        user.id,
        body.name,
        body.permissions,
        body.expiresInDays
      )
      
      // Log audit event
      await AuditLogger.log({
        eventType: 'api_key_created',
        userId: user.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        resource: 'api_keys',
        action: 'create',
        result: 'success',
        metadata: { keyId: id, name: body.name }
      })
      
      return reply.status(201).send({
        id,
        key, // Only returned once!
        name: body.name,
        permissions: body.permissions,
        message: 'Store this key securely - it will not be shown again'
      })
    } catch (error) {
      request.log.error(error)
      
      // Log audit event
      await AuditLogger.log({
        eventType: 'api_key_created',
        userId: (request as any).user?.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        resource: 'api_keys',
        action: 'create',
        result: 'failure',
        metadata: { error: (error as Error).message }
      })
      
      return reply.status(500).send({
        error: 'Failed to create API key'
      })
    }
  })
  
  // List user's API keys
  fastify.get('/keys', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const user = (request as any).user
      const keys = await ApiKeyService.listUserApiKeys(user.id)
      
      // Don't return the actual key hashes
      const sanitizedKeys = keys.map(key => ({
        id: key.id,
        name: key.name,
        permissions: key.permissions,
        rateLimit: key.rate_limit,
        lastUsedAt: key.last_used_at,
        createdAt: key.created_at,
        expiresAt: key.expires_at
      }))
      
      return reply.send(sanitizedKeys)
    } catch (error) {
      request.log.error(error)
      return reply.status(500).send({
        error: 'Failed to list API keys'
      })
    }
  })
  
  // Rotate API key
  fastify.post('/keys/rotate', {
    preHandler: [fastify.authenticate],
    config: authRateLimit.config
  }, async (request, reply) => {
    try {
      const user = (request as any).user
      const { keyId } = rotateApiKeySchema.parse(request.body)
      
      const newKey = await ApiKeyService.rotateApiKey(keyId, user.id)
      
      // Log audit event
      await AuditLogger.log({
        eventType: 'api_key_rotated',
        userId: user.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        resource: 'api_keys',
        action: 'rotate',
        result: 'success',
        metadata: { keyId }
      })
      
      return reply.send({
        key: newKey,
        message: 'API key rotated successfully. Store this key securely - it will not be shown again'
      })
    } catch (error) {
      request.log.error(error)
      
      // Log audit event
      await AuditLogger.log({
        eventType: 'api_key_rotated',
        userId: (request as any).user?.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        resource: 'api_keys',
        action: 'rotate',
        result: 'failure',
        metadata: { error: (error as Error).message }
      })
      
      return reply.status(500).send({
        error: 'Failed to rotate API key'
      })
    }
  })
  
  // Revoke API key
  fastify.delete('/keys/:keyId', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const user = (request as any).user
      const { keyId } = request.params as { keyId: string }
      
      // Validate keyId format
      z.string().uuid().parse(keyId)
      
      await ApiKeyService.revokeApiKey(keyId, user.id)
      
      // Log audit event
      await AuditLogger.log({
        eventType: 'api_key_revoked',
        userId: user.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        resource: 'api_keys',
        action: 'revoke',
        result: 'success',
        metadata: { keyId }
      })
      
      return reply.status(204).send()
    } catch (error) {
      request.log.error(error)
      
      // Log audit event
      await AuditLogger.log({
        eventType: 'api_key_revoked',
        userId: (request as any).user?.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        resource: 'api_keys',
        action: 'revoke',
        result: 'failure',
        metadata: { error: (error as Error).message }
      })
      
      return reply.status(500).send({
        error: 'Failed to revoke API key'
      })
    }
  })
  
  // Test endpoint that accepts API key authentication
  fastify.get('/test', {
    preHandler: [apiKeyAuth]
  }, async (request, reply) => {
    const apiKeyInfo = (request as any).apiKey
    
    return reply.send({
      message: 'API key is valid',
      userId: apiKeyInfo.userId,
      permissions: apiKeyInfo.permissions,
      rateLimit: apiKeyInfo.rateLimit
    })
  })
}