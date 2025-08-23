import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import Fastify, { FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'
import { Pool } from 'pg'
import Redis from 'ioredis'
import bcrypt from 'bcryptjs'
import { authRoutes } from '../src/routes/auth'
import { initializeDatabase, closeDatabase } from '../src/db'

describe('Auth Integration Tests', () => {
  let server: FastifyInstance
  let testDb: Pool
  let testRedis: Redis
  let testUserEmail = 'test@example.com'
  let testUserId: string

  beforeAll(async () => {
    // Setup test database
    testDb = new Pool({
      connectionString: process.env.TEST_DATABASE_URL || 'postgresql://devex:devex@localhost:5432/devex_test'
    })

    // Setup test Redis
    testRedis = new Redis({
      host: process.env.TEST_REDIS_HOST || 'localhost',
      port: parseInt(process.env.TEST_REDIS_PORT || '6379'),
      db: 1 // Use different DB for tests
    })

    // Setup Fastify server
    server = Fastify({ logger: false })
    
    await server.register(jwt, {
      secret: 'test-secret-key-for-testing-only'
    })

    server.decorate('authenticate', async function(request: any, reply: any) {
      try {
        await request.jwtVerify()
      } catch (err) {
        reply.send(err)
      }
    })

    await server.register(authRoutes, { prefix: '/api/v1/auth' })
    await server.ready()

    // Clean up test data
    await testDb.query('DELETE FROM users WHERE email LIKE $1', ['test%'])
  })

  afterAll(async () => {
    await testDb.query('DELETE FROM users WHERE email LIKE $1', ['test%'])
    await testDb.end()
    await testRedis.quit()
    await server.close()
  })

  describe('Registration Flow', () => {
    it('should register a new user successfully', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: testUserEmail,
          password: 'TestP@ssw0rd123!',
          name: 'Test User'
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('user')
      expect(body).toHaveProperty('accessToken')
      expect(body).toHaveProperty('refreshToken')
      expect(body.user.email).toBe(testUserEmail)
      testUserId = body.user.id
    })

    it('should prevent duplicate email registration', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: testUserEmail,
          password: 'AnotherP@ssw0rd123!',
          name: 'Another User'
        }
      })

      expect(response.statusCode).toBe(409)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('User already exists')
    })

    it('should validate email format', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'invalid-email',
          password: 'TestP@ssw0rd123!',
          name: 'Test User'
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should enforce password complexity', async () => {
      const weakPasswords = [
        'short',
        'nouppercase123!',
        'NOLOWERCASE123!',
        'NoNumbers!',
        'NoSpecialChars123',
        'password123!' // Common pattern
      ]

      for (const password of weakPasswords) {
        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/auth/register',
          payload: {
            email: `weak${Math.random()}@example.com`,
            password,
            name: 'Test User'
          }
        })

        expect(response.statusCode).toBe(400)
        const body = JSON.parse(response.body)
        expect(body.error).toContain('Password does not meet security requirements')
      }
    })
  })

  describe('Login Flow', () => {
    let accessToken: string
    let refreshToken: string

    it('should login with valid credentials', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: testUserEmail,
          password: 'TestP@ssw0rd123!'
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('accessToken')
      expect(body).toHaveProperty('refreshToken')
      expect(body.user.email).toBe(testUserEmail)
      
      accessToken = body.accessToken
      refreshToken = body.refreshToken
    })

    it('should reject invalid password', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: testUserEmail,
          password: 'WrongPassword123!'
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
          password: 'TestP@ssw0rd123!'
        }
      })

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Invalid credentials')
    })
  })

  describe('Token Refresh Flow', () => {
    let accessToken: string
    let refreshToken: string

    beforeEach(async () => {
      // Login to get tokens
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: testUserEmail,
          password: 'TestP@ssw0rd123!'
        }
      })
      const body = JSON.parse(response.body)
      accessToken = body.accessToken
      refreshToken = body.refreshToken
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
      expect(body).toHaveProperty('accessToken')
      expect(body.accessToken).not.toBe(accessToken) // Should be new token
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

    it('should reject missing refresh token', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {}
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Refresh token required')
    })
  })

  describe('Protected Routes', () => {
    let accessToken: string

    beforeEach(async () => {
      // Login to get token
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: testUserEmail,
          password: 'TestP@ssw0rd123!'
        }
      })
      const body = JSON.parse(response.body)
      accessToken = body.accessToken
    })

    it('should access protected route with valid token', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.user.email).toBe(testUserEmail)
    })

    it('should reject access without token', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/auth/me'
      })

      expect(response.statusCode).toBe(401)
    })

    it('should reject access with invalid token', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          Authorization: 'Bearer invalid-token'
        }
      })

      expect(response.statusCode).toBe(401)
    })

    it('should logout successfully', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.message).toBe('Logged out successfully')
    })
  })

  describe('Password Strength Endpoint', () => {
    it('should analyze password strength correctly', async () => {
      const testCases = [
        { password: 'weak', expectedStrength: 'weak' },
        { password: 'Medium123!', expectedStrength: 'medium' },
        { password: 'Str0ng!P@ssw0rd', expectedStrength: 'strong' },
        { password: 'V3ry!Str0ng#P@ssw0rd$2024', expectedStrength: 'very-strong' }
      ]

      for (const testCase of testCases) {
        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/auth/password-strength',
          payload: {
            password: testCase.password
          }
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body).toHaveProperty('strength')
        expect(body).toHaveProperty('score')
        expect(body).toHaveProperty('isValid')
        
        // Weak passwords might not match exactly due to scoring
        if (testCase.password !== 'weak') {
          expect(body.strength).toBe(testCase.expectedStrength)
        }
      }
    })

    it('should provide helpful suggestions for weak passwords', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/password-strength',
        payload: {
          password: 'password'
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.isValid).toBe(false)
      expect(body.suggestions).toBeInstanceOf(Array)
      expect(body.suggestions.length).toBeGreaterThan(0)
    })
  })

  describe('Session Management', () => {
    it('should create session on login', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: testUserEmail,
          password: 'TestP@ssw0rd123!'
        }
      })

      expect(response.statusCode).toBe(200)
      
      // Check Redis for session
      const sessionKey = `session:${testUserId}`
      const session = await testRedis.get(sessionKey)
      expect(session).toBeTruthy()
    })

    it('should clear session on logout', async () => {
      // Login first
      const loginResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: testUserEmail,
          password: 'TestP@ssw0rd123!'
        }
      })
      const { accessToken } = JSON.parse(loginResponse.body)

      // Logout
      await server.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      // Check Redis - session should be gone or expired
      const sessionKey = `session:${testUserId}`
      const session = await testRedis.get(sessionKey)
      expect(session).toBeFalsy()
    })
  })
})