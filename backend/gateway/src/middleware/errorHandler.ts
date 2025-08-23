import { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { logger } from '../utils/logger.js'

export async function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Log the error
  logger.error({
    err: error,
    request: {
      method: request.method,
      url: request.url,
      params: request.params,
      query: request.query,
    }
  }, 'Request error')

  // Handle different error types
  if (error.validation) {
    reply.status(400).send({
      error: 'Validation Error',
      message: 'Invalid request data',
      details: error.validation
    })
    return
  }

  if (error.statusCode === 401) {
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required'
    })
    return
  }

  if (error.statusCode === 403) {
    reply.status(403).send({
      error: 'Forbidden',
      message: 'You do not have permission to access this resource'
    })
    return
  }

  if (error.statusCode === 404) {
    reply.status(404).send({
      error: 'Not Found',
      message: 'The requested resource was not found'
    })
    return
  }

  if (error.statusCode === 429) {
    reply.status(429).send({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.'
    })
    return
  }

  // Default to 500 Internal Server Error
  reply.status(error.statusCode || 500).send({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' 
      ? error.message 
      : 'An unexpected error occurred'
  })
}