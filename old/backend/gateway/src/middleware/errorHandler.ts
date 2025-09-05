import { FastifyError, FastifyReply, FastifyRequest, FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { logger } from '../utils/logger.js'

export interface AppError extends Error {
  statusCode?: number
  code?: string
  details?: any
}

export class ValidationError extends Error implements AppError {
  statusCode = 400
  code = 'VALIDATION_ERROR'
  
  constructor(message: string, public details?: any) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends Error implements AppError {
  statusCode = 401
  code = 'AUTHENTICATION_ERROR'
  
  constructor(message: string = 'Authentication required') {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class NotFoundError extends Error implements AppError {
  statusCode = 404
  code = 'NOT_FOUND'
  
  constructor(resource: string) {
    super(`${resource} not found`)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends Error implements AppError {
  statusCode = 409
  code = 'CONFLICT'
  
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

export class RateLimitError extends Error implements AppError {
  statusCode = 429
  code = 'RATE_LIMIT_EXCEEDED'
  
  constructor(public retryAfter: number = 60) {
    super('Rate limit exceeded')
    this.name = 'RateLimitError'
  }
}

export async function errorHandler(
  error: FastifyError | AppError | ZodError,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const requestId = request.id || `req_${Date.now()}`
  
  // Log the error
  logger.error({
    err: error,
    requestId,
    request: {
      method: request.method,
      url: request.url,
      params: request.params,
      query: request.query,
    },
    userId: (request as any).user?.id
  }, 'Request error')

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    reply.status(400).send({
      error: 'Validation Error',
      code: 'VALIDATION_ERROR',
      details: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        type: err.code
      })),
      requestId
    })
    return
  }

  // Handle custom application errors
  if ('statusCode' in error && error.statusCode) {
    if (error instanceof RateLimitError) {
      reply.header('X-RateLimit-Retry-After', error.retryAfter.toString())
    }
    
    reply.status(error.statusCode).send({
      error: error.message,
      code: error.code || 'ERROR',
      details: (error as AppError).details,
      requestId
    })
    return
  }

  // Handle Fastify validation errors
  if ((error as FastifyError).validation) {
    reply.status(400).send({
      error: 'Validation Error',
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: (error as FastifyError).validation,
      requestId
    })
    return
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    reply.status(401).send({
      error: 'Invalid token',
      code: 'INVALID_TOKEN',
      requestId
    })
    return
  }

  if (error.name === 'TokenExpiredError') {
    reply.status(401).send({
      error: 'Token expired',
      code: 'TOKEN_EXPIRED',
      requestId
    })
    return
  }

  // Handle database errors
  if (error.message?.includes('ECONNREFUSED')) {
    reply.status(503).send({
      error: 'Database unavailable',
      code: 'DATABASE_ERROR',
      requestId
    })
    return
  }

  // Handle gRPC errors
  if (error.message?.includes('gRPC')) {
    reply.status(502).send({
      error: 'AI service unavailable',
      code: 'AI_SERVICE_ERROR',
      requestId
    })
    return
  }

  // Map Fastify status codes
  const statusCode = (error as FastifyError).statusCode || 500
  const statusMessages: Record<number, string> = {
    401: 'Authentication required',
    403: 'Insufficient permissions',
    404: 'Resource not found',
    429: 'Rate limit exceeded'
  }

  if (statusCode !== 500 && statusMessages[statusCode]) {
    reply.status(statusCode).send({
      error: statusMessages[statusCode],
      code: error.code || 'ERROR',
      requestId
    })
    return
  }

  // Default to 500 Internal Server Error
  const isDevelopment = process.env.NODE_ENV === 'development'
  reply.status(500).send({
    error: 'Internal Server Error',
    code: 'INTERNAL_ERROR',
    message: isDevelopment ? error.message : 'An unexpected error occurred',
    requestId,
    ...(isDevelopment && { stack: error.stack })
  })
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