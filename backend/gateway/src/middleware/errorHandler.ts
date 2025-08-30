import { FastifyError, FastifyReply, FastifyRequest, FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { logger } from '../utils/logger.js'
import {
  BaseError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ErrorFactory,
  formatErrorResponse,
  isBaseError,
  isRateLimitError
} from '../utils/errors.js'

// Re-export for backward compatibility
export {
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
  RateLimitError
} from '../utils/errors.js'

export interface AppError extends Error {
  statusCode?: number
  code?: string
  details?: any
}

export async function errorHandler(
  error: FastifyError | AppError | ZodError | BaseError,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const requestId = request.id || `req_${Date.now()}`
  const correlationId = (request.headers['x-correlation-id'] as string) || 
                       (request as any).correlationId || 
                       `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  // Convert to BaseError if needed
  let baseError: BaseError
  
  if (error instanceof ZodError) {
    const validationErrors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message
    }))
    baseError = new ValidationError('Validation failed', validationErrors, {
      requestId,
      correlationId,
      userId: (request as any).user?.id
    })
  } else if (isBaseError(error)) {
    // Add context if missing
    if (!error.context.requestId) {
      error.context.requestId = requestId
    }
    if (!error.context.correlationId) {
      error.context.correlationId = correlationId
    }
    if (!error.context.userId && (request as any).user?.id) {
      error.context.userId = (request as any).user?.id
    }
    baseError = error
  } else {
    // Convert other errors
    baseError = ErrorFactory.fromError(error as Error, {
      requestId,
      correlationId,
      userId: (request as any).user?.id
    })
  }
  
  // Log the error
  logger.error({
    err: baseError.toJSON(),
    requestId,
    correlationId,
    request: {
      method: request.method,
      url: request.url,
      params: request.params,
      query: request.query,
    },
    userId: (request as any).user?.id
  }, 'Request error')

  // Set correlation ID header
  reply.header('X-Correlation-ID', correlationId)
  
  // Handle rate limit errors
  if (isRateLimitError(baseError)) {
    reply.header('X-RateLimit-Retry-After', baseError.retryAfter.toString())
    reply.header('X-RateLimit-Limit', baseError.limit.toString())
  }
  
  // Send error response
  const includeStack = process.env.NODE_ENV === 'development'
  const response = formatErrorResponse(baseError, includeStack)
  
  reply.status(baseError.statusCode).send(response)
}

export function setupErrorHandler(fastify: FastifyInstance) {
  fastify.setErrorHandler(errorHandler)
  
  fastify.setNotFoundHandler((request, reply) => {
    const requestId = request.id || `req_${Date.now()}`
    
    logger.warn('Route not found', {
      requestId,
      method: request.method,
      url: request.url,
      ip: request.ip
    })
    
    reply.status(404).send({
      error: 'Route not found',
      code: 'ROUTE_NOT_FOUND',
      method: request.method,
      url: request.url,
      requestId
    })
  })
}