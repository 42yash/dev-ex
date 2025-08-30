import { FastifyRequest, FastifyReply } from 'fastify'
import { validateApiKey } from './security.js'
import { logger } from '../utils/logger.js'

/**
 * Authentication middleware that validates API key and populates user context
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // Validate API key
    const result = await validateApiKey(request, reply)
    
    // If validation failed, reply has already been sent
    if (result !== true) {
      return
    }
    
    // Get API key auth context
    const apiKeyAuth = (request as any).apiKeyAuth
    
    if (!apiKeyAuth || !apiKeyAuth.userId) {
      logger.warn('API key auth succeeded but no user ID found')
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid authentication context'
      })
    }
    
    // Populate user context for downstream handlers
    ;(request as any).user = {
      id: apiKeyAuth.userId,
      permissions: apiKeyAuth.permissions || [],
      rateLimit: apiKeyAuth.rateLimit
    }
    
    logger.debug(`User ${apiKeyAuth.userId} authenticated successfully`)
    
  } catch (error) {
    logger.error('Authentication error:', error)
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Authentication failed'
    })
  }
}

/**
 * Helper to get authenticated user from request
 */
export function getAuthUser(request: FastifyRequest): {
  id: string
  permissions: string[]
  rateLimit?: number
} | null {
  return (request as any).user || null
}

/**
 * Check if the current user has a specific permission
 */
export function userHasPermission(request: FastifyRequest, permission: string): boolean {
  const user = getAuthUser(request)
  if (!user || !user.permissions) {
    return false
  }
  
  return user.permissions.includes(permission) || user.permissions.includes('*')
}