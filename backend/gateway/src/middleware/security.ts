import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import crypto from 'crypto'

// Security headers configuration
export const securityHeaders = {
  // Prevent clickjacking attacks
  'X-Frame-Options': 'DENY',
  
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Enable XSS protection in older browsers
  'X-XSS-Protection': '1; mode=block',
  
  // Control DNS prefetching
  'X-DNS-Prefetch-Control': 'off',
  
  // Control browser features and APIs
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  
  // Control referrer information
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Enforce HTTPS (only in production)
  ...(process.env.NODE_ENV === 'production' && {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
  })
}

// Content Security Policy configuration
export const generateCSP = (nonce: string): string => {
  const directives = {
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"],
    'style-src': ["'self'", "'unsafe-inline'"], // Allow inline styles for now
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'"],
    'connect-src': ["'self'", 'wss:', 'ws:'],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'upgrade-insecure-requests': process.env.NODE_ENV === 'production' ? [''] : undefined
  }
  
  return Object.entries(directives)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => `${key} ${value.join(' ')}`)
    .join('; ')
}

// Security middleware plugin
export const securityPlugin: FastifyPluginAsync = async (fastify) => {
  // Add security headers to all responses
  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload) => {
    // Generate CSP nonce for this request
    const nonce = crypto.randomBytes(16).toString('base64')
    
    // Set security headers
    Object.entries(securityHeaders).forEach(([header, value]) => {
      reply.header(header, value)
    })
    
    // Set CSP header
    reply.header('Content-Security-Policy', generateCSP(nonce))
    
    // Store nonce for use in templates
    ;(request as any).cspNonce = nonce
    
    return payload
  })
  
  // Prevent parameter pollution
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Clean duplicate query parameters
    if (request.query) {
      const cleaned: Record<string, any> = {}
      Object.entries(request.query as Record<string, any>).forEach(([key, value]) => {
        // Keep only the first value if array
        cleaned[key] = Array.isArray(value) ? value[0] : value
      })
      ;(request as any).query = cleaned
    }
  })
  
  // Request size limits
  fastify.addHook('preValidation', async (request: FastifyRequest, reply: FastifyReply) => {
    const contentLength = request.headers['content-length']
    const maxSize = 10 * 1024 * 1024 // 10MB
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      return reply.status(413).send({
        error: 'Request entity too large',
        message: `Maximum request size is ${maxSize / (1024 * 1024)}MB`
      })
    }
  })
}

// API Key validation middleware
export const validateApiKey = async (request: FastifyRequest, reply: FastifyReply) => {
  const apiKey = request.headers['x-api-key'] as string
  
  if (!apiKey) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'API key is required'
    })
  }
  
  // Validate API key format (should be a UUID or specific format)
  const apiKeyRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
  if (!apiKeyRegex.test(apiKey)) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid API key format'
    })
  }
  
  // TODO: Check API key against database
  // This would involve checking the key exists, is not expired, and has necessary permissions
  
  return true
}

// Request ID middleware for tracing
export const requestIdPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Generate or use existing request ID
    const requestId = request.headers['x-request-id'] as string || crypto.randomUUID()
    
    // Add to request and response
    ;(request as any).requestId = requestId
    reply.header('X-Request-ID', requestId)
    
    // Add to logger context
    request.log = fastify.log.child({ requestId })
  })
}

// CORS configuration with security
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000']
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true)
    }
    
    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  maxAge: 86400 // 24 hours
}

// IP blocking middleware
const blockedIPs = new Set<string>()

export const blockIP = (ip: string) => {
  blockedIPs.add(ip)
  // Could also persist to Redis for distributed blocking
}

export const unblockIP = (ip: string) => {
  blockedIPs.delete(ip)
}

export const ipBlockingMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
  const clientIP = request.headers['x-forwarded-for'] as string || 
                   request.headers['x-real-ip'] as string || 
                   request.ip
  
  if (blockedIPs.has(clientIP)) {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Access denied'
    })
  }
}

// Security audit logging
export interface SecurityEvent {
  type: 'auth_failure' | 'rate_limit' | 'invalid_input' | 'suspicious_activity' | 'api_key_invalid'
  userId?: string
  ip: string
  path: string
  method: string
  details?: any
}

export const logSecurityEvent = (event: SecurityEvent, logger: any) => {
  logger.warn({
    ...event,
    timestamp: new Date().toISOString(),
    category: 'security'
  }, `Security event: ${event.type}`)
  
  // TODO: Send to security monitoring service
  // TODO: Store in database for audit trail
}