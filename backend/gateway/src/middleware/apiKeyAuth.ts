import { FastifyRequest, FastifyReply } from 'fastify'
import { validateApiKey } from './security.js'

/**
 * Middleware factory for API key authentication with optional permission checking
 * @param requiredPermission - Optional permission required for the endpoint
 * @returns Middleware function for Fastify preHandler
 */
export function requireApiKey(requiredPermission?: string) {
  return async function apiKeyAuthMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    // Attach required permission to request for validation
    if (requiredPermission) {
      (request as any).requiredPermission = requiredPermission
    }
    
    // Validate API key
    const result = await validateApiKey(request, reply)
    
    // If validation failed, reply has already been sent
    if (result !== true) {
      return
    }
    
    // Continue to route handler
    return
  }
}

/**
 * Helper to get API key authentication context from request
 */
export function getApiKeyAuth(request: FastifyRequest): {
  userId?: string
  permissions?: string[]
  rateLimit?: number
} | null {
  return (request as any).apiKeyAuth || null
}

/**
 * Check if the current API key has a specific permission
 */
export function hasPermission(request: FastifyRequest, permission: string): boolean {
  const auth = getApiKeyAuth(request)
  if (!auth || !auth.permissions) {
    return false
  }
  
  return auth.permissions.includes(permission) || auth.permissions.includes('admin')
}

/**
 * Require multiple permissions (AND logic)
 */
export function requireApiKeyWithPermissions(...permissions: string[]) {
  return async function apiKeyAuthMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    // First validate API key
    const result = await validateApiKey(request, reply)
    if (result !== true) {
      return
    }
    
    // Check all required permissions
    const auth = getApiKeyAuth(request)
    if (!auth || !auth.permissions) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'No permissions available'
      })
    }
    
    const isAdmin = auth.permissions.includes('admin')
    const hasAllPermissions = permissions.every(p => 
      auth.permissions!.includes(p) || isAdmin
    )
    
    if (!hasAllPermissions) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Missing required permissions: ${permissions.join(', ')}`
      })
    }
    
    return
  }
}

/**
 * Common permission constants
 */
export const Permissions = {
  READ: 'read',
  WRITE: 'write',
  DELETE: 'delete',
  ADMIN: 'admin',
  EXECUTE: 'execute',
  MANAGE_USERS: 'manage_users',
  MANAGE_API_KEYS: 'manage_api_keys',
  VIEW_ANALYTICS: 'view_analytics',
  MANAGE_WORKFLOWS: 'manage_workflows',
  MANAGE_AGENTS: 'manage_agents'
} as const

export type Permission = typeof Permissions[keyof typeof Permissions]