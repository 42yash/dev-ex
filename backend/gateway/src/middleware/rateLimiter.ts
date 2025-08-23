import { FastifyRequest, FastifyReply } from 'fastify'

// Specific rate limits for sensitive endpoints
export const authRateLimit = {
  config: {
    rateLimit: {
      max: 5, // 5 attempts
      timeWindow: '15 minutes',
      keyGenerator: (request: FastifyRequest) => {
        // Rate limit by email for auth endpoints
        const body = request.body as any
        return body?.email || request.ip
      },
      errorResponseBuilder: () => {
        return {
          statusCode: 429,
          error: 'Too Many Attempts',
          message: 'Too many authentication attempts. Please try again later.',
        }
      }
    }
  }
}

export const passwordResetRateLimit = {
  config: {
    rateLimit: {
      max: 3, // 3 attempts
      timeWindow: '1 hour',
      keyGenerator: (request: FastifyRequest) => {
        const body = request.body as any
        return body?.email || request.ip
      }
    }
  }
}

export const apiKeyRateLimit = {
  config: {
    rateLimit: {
      max: 1000, // Higher limit for API key users
      timeWindow: '15 minutes',
      keyGenerator: (request: FastifyRequest) => {
        const apiKey = request.headers['x-api-key'] as string
        return apiKey || request.ip
      }
    }
  }
}

export const chatRateLimit = {
  config: {
    rateLimit: {
      max: 30, // 30 messages
      timeWindow: '5 minutes',
      keyGenerator: (request: FastifyRequest) => {
        // Rate limit by user and session
        const user = (request as any).user
        const body = request.body as any
        return `${user?.id || request.ip}:${body?.sessionId || 'default'}`
      }
    }
  }
}

// IP-based rate limiter for public endpoints
export const publicRateLimit = {
  config: {
    rateLimit: {
      max: 20,
      timeWindow: '1 minute',
      keyGenerator: (request: FastifyRequest) => request.ip
    }
  }
}