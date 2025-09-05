import { FastifyRequest, FastifyReply } from 'fastify'
import { z, ZodError, ZodSchema } from 'zod'
import DOMPurify from 'isomorphic-dompurify'

// Sanitize string inputs to prevent XSS
const sanitizeString = (value: unknown): string => {
  if (typeof value !== 'string') return String(value)
  // Remove any HTML/script tags and dangerous characters
  return DOMPurify.sanitize(value, { 
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true 
  }).trim()
}

// Custom Zod preprocessor for sanitization
export const sanitizedString = (schema?: z.ZodString) => {
  const baseSchema = schema || z.string()
  return z.preprocess(sanitizeString, baseSchema)
}

// Common validation schemas
export const schemas = {
  // User schemas
  email: sanitizedString(z.string().email('Invalid email format')),
  password: z.string().min(12, 'Password must be at least 12 characters'),
  username: sanitizedString(z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens')),
  
  // Common fields
  id: z.string().uuid('Invalid ID format'),
  pagination: z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    sortBy: sanitizedString(z.string().optional()),
    sortOrder: z.enum(['asc', 'desc']).optional()
  }),
  
  // Chat/Message schemas
  message: sanitizedString(z.string().min(1).max(10000)),
  
  // File upload
  file: z.object({
    filename: sanitizedString(z.string().max(255)),
    mimetype: z.string().regex(/^[\w-]+\/[\w-]+$/),
    size: z.number().positive().max(10 * 1024 * 1024) // 10MB max
  })
}

// Request validation schemas for different routes
export const requestSchemas = {
  auth: {
    register: z.object({
      email: schemas.email,
      password: schemas.password,
      name: sanitizedString(z.string().min(1).max(100)),
      username: schemas.username.optional()
    }),
    
    login: z.object({
      email: schemas.email,
      password: z.string() // Don't sanitize passwords
    }),
    
    refreshToken: z.object({
      refreshToken: z.string()
    }),
    
    changePassword: z.object({
      currentPassword: z.string(),
      newPassword: schemas.password
    }),
    
    resetPassword: z.object({
      email: schemas.email
    })
  },
  
  chat: {
    sendMessage: z.object({
      conversationId: schemas.id.optional(),
      message: schemas.message,
      context: z.record(z.any()).optional(),
      parentMessageId: schemas.id.optional()
    }),
    
    getConversation: z.object({
      conversationId: schemas.id
    }),
    
    listConversations: schemas.pagination,
    
    deleteConversation: z.object({
      conversationId: schemas.id
    })
  },
  
  user: {
    updateProfile: z.object({
      name: sanitizedString(z.string().min(1).max(100)).optional(),
      bio: sanitizedString(z.string().max(500)).optional(),
      avatar: z.string().url().optional()
    }),
    
    updateSettings: z.object({
      theme: z.enum(['light', 'dark', 'auto']).optional(),
      language: z.enum(['en', 'es', 'fr', 'de', 'zh', 'ja']).optional(),
      notifications: z.object({
        email: z.boolean().optional(),
        push: z.boolean().optional(),
        sms: z.boolean().optional()
      }).optional()
    })
  },
  
  upload: {
    file: schemas.file,
    
    multipleFiles: z.object({
      files: z.array(schemas.file).max(10)
    })
  }
}

// Validation middleware factory
export const validate = (schema: ZodSchema) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Validate request body, query, and params
      const dataToValidate = {
        ...(request.body as object || {}),
        ...(request.query as object || {}),
        ...(request.params as object || {})
      }
      
      const validated = await schema.parseAsync(dataToValidate)
      
      // Replace request data with validated and sanitized data
      if (request.body) {
        request.body = validated
      }
      
      return validated
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        })
      }
      
      // Log unexpected errors
      request.log.error(error)
      return reply.status(500).send({
        error: 'Internal server error during validation'
      })
    }
  }
}

// SQL injection prevention for raw queries
export const sanitizeSQLParam = (value: string): string => {
  // Remove or escape dangerous SQL characters
  return value
    .replace(/['";\\]/g, '') // Remove quotes and backslashes
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove multi-line comment starts
    .replace(/\*\//g, '') // Remove multi-line comment ends
    .replace(/\b(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|EXEC|EXECUTE)\b/gi, '') // Remove SQL keywords
    .trim()
}

// Validate and sanitize ID parameters
export const validateId = async (request: FastifyRequest, reply: FastifyReply) => {
  const { id } = request.params as { id?: string }
  
  if (!id) {
    return reply.status(400).send({ error: 'ID parameter is required' })
  }
  
  try {
    schemas.id.parse(id)
  } catch {
    return reply.status(400).send({ error: 'Invalid ID format' })
  }
}

// Rate limiting keys based on user/IP
export const getRateLimitKey = (request: FastifyRequest): string => {
  // Try to get user ID from JWT
  const user = (request as any).user
  if (user?.id) {
    return `user:${user.id}`
  }
  
  // Fall back to IP address
  const ip = request.headers['x-forwarded-for'] || 
             request.headers['x-real-ip'] || 
             request.ip
  
  return `ip:${ip}`
}

// Export middleware for use in routes
export const validationMiddleware = {
  auth: {
    register: validate(requestSchemas.auth.register),
    login: validate(requestSchemas.auth.login),
    refreshToken: validate(requestSchemas.auth.refreshToken),
    changePassword: validate(requestSchemas.auth.changePassword),
    resetPassword: validate(requestSchemas.auth.resetPassword)
  },
  
  chat: {
    sendMessage: validate(requestSchemas.chat.sendMessage),
    getConversation: validate(requestSchemas.chat.getConversation),
    listConversations: validate(requestSchemas.chat.listConversations),
    deleteConversation: validate(requestSchemas.chat.deleteConversation)
  },
  
  user: {
    updateProfile: validate(requestSchemas.user.updateProfile),
    updateSettings: validate(requestSchemas.user.updateSettings)
  },
  
  upload: {
    file: validate(requestSchemas.upload.file),
    multipleFiles: validate(requestSchemas.upload.multipleFiles)
  }
}