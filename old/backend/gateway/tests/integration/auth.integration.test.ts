import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import Fastify, { FastifyInstance } from 'fastify'
import { authRoutes } from '../../src/routes/auth'
import { initializeDatabase, closeDatabase, query } from '../../src/db/index'
import { initializeRedis } from '../../src/services/redis'
import jwt from '@fastify/jwt'

describe('Auth Integration Tests', () => {
  let server: FastifyInstance
  let testUserEmail = 'test@example.com'
  let testUserId: string

  beforeAll(async () => {
    // Initialize test database
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://devex:devex@localhost:5432/devex_test'
    process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1'
    process.env.JWT_SECRET = 'test-jwt-secret-'.repeat(3)
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-'.repeat(3)

    await initializeDatabase()
    await initializeRedis()

    // Create test server
    server = Fastify({ logger: false })
    
    await server.register(jwt, {
      secret: process.env.JWT_SECRET
    })
    
    await server.register(authRoutes, { prefix: '/api/v1/auth' })
    await server.ready()

    // Clean up any existing test data
    await query('DELETE FROM users WHERE email LIKE $1', ['test%'])
  })

  afterAll(async () => {
    await query('DELETE FROM users WHERE email LIKE $1', ['test%'])
    await closeDatabase()
    await server.close()
  })

  beforeEach(async () => {
    // Generate unique email for each test
    testUserEmail = `test-${Date.now()}@example.com`
  })

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user with valid data', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: testUserEmail,
          password: 'SecureP@ssw0rd123',
          name: 'Test User'
        }
      })

      expect(response.statusCode).toBe(200)
      
      const body = JSON.parse(response.body)
      expect(body.user).toBeDefined()
      expect(body.user.email).toBe(testUserEmail)
      expect(body.user.name).toBe('Test User')
      expect(body.accessToken).toBeDefined()
      expect(body.refreshToken).toBeDefined()
      
      testUserId = body.user.id

      // Verify user was created in database
      const users = await query('SELECT * FROM users WHERE email = $1', [testUserEmail])
      expect(users.length).toBe(1)
      expect(users[0].email).toBe(testUserEmail)
    })

    it('should reject duplicate email registration', async () => {
      // First registration
      await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: testUserEmail,
          password: 'SecureP@ssw0rd123',
          name: 'Test User'
        }
      })

      // Attempt duplicate registration
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: testUserEmail,
          password: 'AnotherP@ssw0rd123',
          name: 'Another User'
        }
      })

      expect(response.statusCode).toBe(409)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('User already exists')
    })

    it('should reject weak passwords', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: testUserEmail,
          password: 'weak',
          name: 'Test User'
        }
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('Password does not meet security requirements')
    })

    it('should reject invalid email format', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'not-an-email',
          password: 'SecureP@ssw0rd123',
          name: 'Test User'
        }
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Validation failed')
    })

    it('should sanitize HTML in name field', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: testUserEmail,
          password: 'SecureP@ssw0rd123',
          name: '<script>alert("xss")</script>Test User'
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.user.name).toBe('Test User')
    })
  })

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: testUserEmail,
          password: 'SecureP@ssw0rd123',
          name: 'Test User'
        }
      })
    })

    it('should login with valid credentials', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: testUserEmail,
          password: 'SecureP@ssw0rd123'
        }
      })

      expect(response.statusCode).toBe(200)
      
      const body = JSON.parse(response.body)
      expect(body.user).toBeDefined()
      expect(body.user.email).toBe(testUserEmail)
      expect(body.accessToken).toBeDefined()
      expect(body.refreshToken).toBeDefined()
    })

    it('should reject invalid password', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: testUserEmail,
          password: 'WrongPassword123'
        }
      })

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Invalid credentials')
    })

    it('should reject non-existent user', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'SecureP@ssw0rd123'
        }
      })

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Invalid credentials')
    })
  })

  describe('POST /api/v1/auth/refresh', () => {
    let refreshToken: string

    beforeEach(async () => {
      // Register and get tokens
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: testUserEmail,
          password: 'SecureP@ssw0rd123',
          name: 'Test User'
        }
      })
      
      const body = JSON.parse(response.body)
      refreshToken = body.refreshToken
      testUserId = body.user.id
    })

    it('should refresh access token with valid refresh token', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken
        }
      })

      expect(response.statusCode).toBe(200)
      
      const body = JSON.parse(response.body)
      expect(body.accessToken).toBeDefined()
      expect(body.accessToken).not.toBe(refreshToken)
    })

    it('should reject invalid refresh token', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: 'invalid-token'
        }
      })

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Invalid refresh token')
    })

    it('should reject expired refresh token', async () => {
      // Create an expired token
      const expiredToken = server.jwt.sign(
        { id: testUserId },
        { expiresIn: '-1h' }
      )

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: expiredToken
        }
      })

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Invalid refresh token')
    })
  })

  describe('POST /api/v1/auth/logout', () => {
    let accessToken: string

    beforeEach(async () => {
      // Register and get tokens
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: testUserEmail,
          password: 'SecureP@ssw0rd123',
          name: 'Test User'
        }
      })
      
      const body = JSON.parse(response.body)
      accessToken = body.accessToken
    })

    it('should logout successfully with valid token', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.message).toBe('Logged out successfully')
    })

    it('should reject logout without token', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/logout'
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('Rate Limiting', () => {
    it('should enforce rate limits on registration', async () => {
      // Make multiple rapid requests
      const requests = Array(15).fill(0).map((_, i) => 
        server.inject({
          method: 'POST',
          url: '/api/v1/auth/register',
          payload: {
            email: `ratelimit-${i}@example.com`,
            password: 'SecureP@ssw0rd123',
            name: 'Test User'
          }
        })
      )

      const responses = await Promise.all(requests)
      
      // Some requests should be rate limited
      const rateLimited = responses.filter(r => r.statusCode === 429)
      expect(rateLimited.length).toBeGreaterThan(0)
      
      const rateLimitedBody = JSON.parse(rateLimited[0].body)
      expect(rateLimitedBody.error).toContain('rate limit')
    })
  })
})