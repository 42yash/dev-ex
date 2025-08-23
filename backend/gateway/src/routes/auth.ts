import { FastifyPluginAsync } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { query, transaction } from '../db/index.js'
import { setSession } from '../services/redis.js'
import { logger } from '../utils/logger.js'
import { passwordValidator } from '../utils/passwordValidator.js'
import { authRateLimit, publicRateLimit } from '../middleware/rateLimiter.js'
import { validationMiddleware } from '../middleware/validation.js'

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Register endpoint with rate limiting and validation
  fastify.post('/register', {
    preHandler: [validationMiddleware.auth.register],
    ...authRateLimit.config
  }, async (request, reply) => {
    try {
      const body = request.body as { email: string; password: string; name?: string }
      
      // Validate password complexity
      const passwordValidation = passwordValidator.validate(body.password)
      if (!passwordValidation.isValid) {
        return reply.status(400).send({
          error: 'Password does not meet security requirements',
          details: passwordValidation.errors,
          strength: passwordValidation.strength
        })
      }
      
      // Check if user already exists
      const existingUsers = await query(
        'SELECT id FROM users WHERE email = $1',
        [body.email]
      )
      
      if (existingUsers.length > 0) {
        return reply.status(409).send({
          error: 'User already exists'
        })
      }
      
      // Hash password with stronger settings
      const passwordHash = await bcrypt.hash(body.password, 12)
      
      // Create user
      const result = await query(
        `INSERT INTO users (email, password_hash, name) 
         VALUES ($1, $2, $3) 
         RETURNING id, email, name, role, created_at`,
        [body.email, passwordHash, body.name || null]
      )
      
      const user = result[0]
      
      // Generate tokens
      const accessToken = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role
      }, { expiresIn: '1h' })
      
      const refreshToken = fastify.jwt.sign(
        { id: user.id },
        { expiresIn: '7d' }
      )
      
      // Store session in Redis
      await setSession(user.id, {
        userId: user.id,
        email: user.email,
        refreshToken
      })
      
      logger.info(`User registered: ${user.email}`)
      
      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        accessToken,
        refreshToken
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors
        })
      }
      throw error
    }
  })
  
  // Login endpoint with rate limiting and validation
  fastify.post('/login', {
    preHandler: [validationMiddleware.auth.login],
    ...authRateLimit.config
  }, async (request, reply) => {
    try {
      const body = request.body as { email: string; password: string }
      
      // Find user
      const users = await query(
        'SELECT id, email, name, role, password_hash FROM users WHERE email = $1',
        [body.email]
      )
      
      if (users.length === 0) {
        return reply.status(401).send({
          error: 'Invalid credentials'
        })
      }
      
      const user = users[0]
      
      // Verify password
      const validPassword = await bcrypt.compare(body.password, user.password_hash)
      if (!validPassword) {
        return reply.status(401).send({
          error: 'Invalid credentials'
        })
      }
      
      // Generate tokens
      const accessToken = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role
      }, { expiresIn: '1h' })
      
      const refreshToken = fastify.jwt.sign(
        { id: user.id },
        { expiresIn: '7d' }
      )
      
      // Store session in Redis
      await setSession(user.id, {
        userId: user.id,
        email: user.email,
        refreshToken
      })
      
      logger.info(`User logged in: ${user.email}`)
      
      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        accessToken,
        refreshToken
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors
        })
      }
      throw error
    }
  })
  
  // Refresh token endpoint
  fastify.post('/refresh', async (request, reply) => {
    try {
      const { refreshToken } = request.body as { refreshToken: string }
      
      if (!refreshToken) {
        return reply.status(400).send({
          error: 'Refresh token required'
        })
      }
      
      // Verify refresh token
      let decoded: any
      try {
        decoded = fastify.jwt.verify(refreshToken)
      } catch (err) {
        return reply.status(401).send({
          error: 'Invalid refresh token'
        })
      }
      
      // Get user
      const users = await query(
        'SELECT id, email, role FROM users WHERE id = $1',
        [decoded.id]
      )
      
      if (users.length === 0) {
        return reply.status(401).send({
          error: 'User not found'
        })
      }
      
      const user = users[0]
      
      // Generate new access token
      const accessToken = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role
      }, { expiresIn: '1h' })
      
      return reply.send({
        accessToken
      })
    } catch (error) {
      throw error
    }
  })
  
  // Logout endpoint
  fastify.post('/logout', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const user = (request as any).user
      
      // Clear session from Redis
      await setSession(user.id, null, 1) // Expire immediately
      
      logger.info(`User logged out: ${user.email}`)
      
      return reply.send({
        message: 'Logged out successfully'
      })
    } catch (error) {
      throw error
    }
  })
  
  // Get current user endpoint
  fastify.get('/me', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const user = (request as any).user
      
      const users = await query(
        'SELECT id, email, name, role, created_at FROM users WHERE id = $1',
        [user.id]
      )
      
      if (users.length === 0) {
        return reply.status(404).send({
          error: 'User not found'
        })
      }
      
      return reply.send({
        user: users[0]
      })
    } catch (error) {
      throw error
    }
  })
  
  // Password strength checker endpoint
  fastify.post('/password-strength', async (request, reply) => {
    try {
      const { password } = request.body as { password: string }
      
      if (!password) {
        return reply.status(400).send({
          error: 'Password is required'
        })
      }
      
      const validation = passwordValidator.validate(password)
      
      return reply.send({
        strength: validation.strength,
        score: validation.score,
        isValid: validation.isValid,
        suggestions: validation.errors
      })
    } catch (error) {
      throw error
    }
  })
}