import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify'
import { v4 as uuidv4 } from 'uuid'

/**
 * Middleware to handle correlation IDs for request tracing
 * Correlation IDs help trace requests across multiple services
 */
export function correlationIdMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
) {
  // Check for existing correlation ID from headers
  let correlationId = request.headers['x-correlation-id'] as string
  
  // Generate new correlation ID if not present
  if (!correlationId) {
    correlationId = `corr_${Date.now()}_${uuidv4().split('-')[0]}`
  }
  
  // Attach to request object for easy access
  (request as any).correlationId = correlationId
  
  // Add to response headers for client tracking
  reply.header('X-Correlation-ID', correlationId)
  
  // Add to request ID for logging
  if (!request.id) {
    request.id = correlationId
  }
  
  done()
}

/**
 * Helper to extract correlation ID from request
 */
export function getCorrelationId(request: FastifyRequest): string {
  return (request as any).correlationId || 
         request.headers['x-correlation-id'] as string || 
         request.id || 
         `corr_${Date.now()}`
}

/**
 * Propagate correlation ID to external service calls
 */
export function propagateCorrelationId(request: FastifyRequest): Record<string, string> {
  const correlationId = getCorrelationId(request)
  return {
    'X-Correlation-ID': correlationId,
    'X-Request-ID': request.id || correlationId
  }
}