import { v4 as uuidv4 } from 'uuid'

export interface ErrorContext {
  requestId?: string
  userId?: string
  sessionId?: string
  correlationId?: string
  resource?: string
  operation?: string
  metadata?: Record<string, any>
}

export abstract class BaseError extends Error {
  public readonly id: string
  public readonly timestamp: Date
  public readonly isOperational: boolean
  public abstract readonly statusCode: number
  public abstract readonly code: string
  
  constructor(
    message: string,
    public readonly context: ErrorContext = {},
    isOperational = true
  ) {
    super(message)
    this.id = uuidv4()
    this.timestamp = new Date()
    this.isOperational = isOperational
    this.name = this.constructor.name
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor)
  }
  
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      context: this.context,
      ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
    }
  }
}

// 400 Bad Request
export class ValidationError extends BaseError {
  readonly statusCode = 400
  readonly code = 'VALIDATION_ERROR'
  
  constructor(
    message: string,
    public readonly errors?: Array<{ field: string; message: string }>,
    context?: ErrorContext
  ) {
    super(message, context)
  }
}

// 401 Unauthorized
export class AuthenticationError extends BaseError {
  readonly statusCode = 401
  readonly code = 'AUTHENTICATION_ERROR'
  
  constructor(message = 'Authentication required', context?: ErrorContext) {
    super(message, context)
  }
}

export class InvalidTokenError extends AuthenticationError {
  readonly code = 'INVALID_TOKEN'
  
  constructor(message = 'Invalid authentication token', context?: ErrorContext) {
    super(message, context)
  }
}

export class TokenExpiredError extends AuthenticationError {
  readonly code = 'TOKEN_EXPIRED'
  
  constructor(message = 'Authentication token has expired', context?: ErrorContext) {
    super(message, context)
  }
}

// 403 Forbidden
export class AuthorizationError extends BaseError {
  readonly statusCode = 403
  readonly code = 'AUTHORIZATION_ERROR'
  
  constructor(
    message = 'Insufficient permissions',
    public readonly requiredPermission?: string,
    context?: ErrorContext
  ) {
    super(message, context)
  }
}

// 404 Not Found
export class NotFoundError extends BaseError {
  readonly statusCode = 404
  readonly code = 'NOT_FOUND'
  
  constructor(resource: string, context?: ErrorContext) {
    super(`${resource} not found`, { ...context, resource })
  }
}

// 409 Conflict
export class ConflictError extends BaseError {
  readonly statusCode = 409
  readonly code = 'CONFLICT'
  
  constructor(message: string, context?: ErrorContext) {
    super(message, context)
  }
}

export class DuplicateError extends ConflictError {
  readonly code = 'DUPLICATE_RESOURCE'
  
  constructor(resource: string, field: string, value: string, context?: ErrorContext) {
    super(
      `${resource} with ${field} '${value}' already exists`,
      { ...context, resource, metadata: { field, value } }
    )
  }
}

// 422 Unprocessable Entity
export class BusinessLogicError extends BaseError {
  readonly statusCode = 422
  readonly code = 'BUSINESS_LOGIC_ERROR'
  
  constructor(message: string, context?: ErrorContext) {
    super(message, context)
  }
}

// 429 Too Many Requests
export class RateLimitError extends BaseError {
  readonly statusCode = 429
  readonly code = 'RATE_LIMIT_EXCEEDED'
  
  constructor(
    public readonly retryAfter: number = 60,
    public readonly limit: number = 100,
    context?: ErrorContext
  ) {
    super(
      `Rate limit exceeded. Retry after ${retryAfter} seconds`,
      context
    )
  }
}

// 500 Internal Server Error
export class InternalError extends BaseError {
  readonly statusCode = 500
  readonly code = 'INTERNAL_ERROR'
  
  constructor(message = 'An internal error occurred', context?: ErrorContext) {
    super(message, context, false) // Not operational
  }
}

// 502 Bad Gateway
export class ExternalServiceError extends BaseError {
  readonly statusCode = 502
  readonly code = 'EXTERNAL_SERVICE_ERROR'
  
  constructor(
    service: string,
    message?: string,
    context?: ErrorContext
  ) {
    super(
      message || `External service '${service}' is unavailable`,
      { ...context, metadata: { service } }
    )
  }
}

export class AIServiceError extends ExternalServiceError {
  readonly code = 'AI_SERVICE_ERROR'
  
  constructor(message = 'AI service unavailable', context?: ErrorContext) {
    super('AI Service', message, context)
  }
}

// 503 Service Unavailable
export class ServiceUnavailableError extends BaseError {
  readonly statusCode = 503
  readonly code = 'SERVICE_UNAVAILABLE'
  
  constructor(
    message = 'Service temporarily unavailable',
    public readonly retryAfter?: number,
    context?: ErrorContext
  ) {
    super(message, context)
  }
}

export class DatabaseError extends ServiceUnavailableError {
  readonly code = 'DATABASE_ERROR'
  
  constructor(message = 'Database unavailable', context?: ErrorContext) {
    super(message, undefined, context)
  }
}

// 504 Gateway Timeout
export class TimeoutError extends BaseError {
  readonly statusCode = 504
  readonly code = 'TIMEOUT'
  
  constructor(
    operation: string,
    timeoutMs: number,
    context?: ErrorContext
  ) {
    super(
      `Operation '${operation}' timed out after ${timeoutMs}ms`,
      { ...context, operation, metadata: { timeoutMs } }
    )
  }
}

// Error Factory
export class ErrorFactory {
  static fromError(error: Error, context?: ErrorContext): BaseError {
    // Already a BaseError
    if (error instanceof BaseError) {
      return error
    }
    
    // JWT errors
    if (error.name === 'JsonWebTokenError') {
      return new InvalidTokenError(error.message, context)
    }
    if (error.name === 'TokenExpiredError') {
      return new TokenExpiredError(error.message, context)
    }
    
    // Database errors
    if (error.message?.includes('ECONNREFUSED')) {
      return new DatabaseError('Database connection refused', context)
    }
    if (error.message?.includes('duplicate key')) {
      return new ConflictError(error.message, context)
    }
    
    // gRPC errors
    if (error.message?.includes('gRPC')) {
      return new AIServiceError(error.message, context)
    }
    
    // Default to internal error
    return new InternalError(error.message, context)
  }
  
  static isOperational(error: Error): boolean {
    if (error instanceof BaseError) {
      return error.isOperational
    }
    return false
  }
}

// Error utilities
export function formatErrorResponse(error: BaseError, includeStack = false) {
  const response: any = {
    error: {
      id: error.id,
      code: error.code,
      message: error.message,
      timestamp: error.timestamp
    }
  }
  
  if (error.context.requestId) {
    response.requestId = error.context.requestId
  }
  
  if (error.context.correlationId) {
    response.correlationId = error.context.correlationId
  }
  
  if (error instanceof ValidationError && error.errors) {
    response.error.details = error.errors
  }
  
  if (error instanceof RateLimitError) {
    response.error.retryAfter = error.retryAfter
    response.error.limit = error.limit
  }
  
  if (includeStack && error.stack) {
    response.error.stack = error.stack
  }
  
  return response
}

// Type guards
export function isBaseError(error: unknown): error is BaseError {
  return error instanceof BaseError
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError
}

export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError
}

export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError
}