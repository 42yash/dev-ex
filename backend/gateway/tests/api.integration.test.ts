import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import Fastify, { FastifyInstance } from 'fastify'
import { healthRoutes } from '../src/routes/health'
import { chatRoutes } from '../src/routes/chat'
import jwt from '@fastify/jwt'
import { Pool } from 'pg'
import Redis from 'ioredis'

describe('API Integration Tests', () => {
  let server: FastifyInstance
  let testDb: Pool
  let testRedis: Redis
  let accessToken: string
  let userId: string

  beforeAll(async () => {
    // Setup test database
    testDb = new Pool({
      connectionString: process.env.TEST_DATABASE_URL || 'postgresql://devex:devex@localhost:5432/devex_test'
    })

    // Setup test Redis
    testRedis = new Redis({
      host: process.env.TEST_REDIS_HOST || 'localhost',
      port: parseInt(process.env.TEST_REDIS_PORT || '6379'),
      db: 1
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

    await server.register(healthRoutes, { prefix: '/health' })
    await server.register(chatRoutes, { prefix: '/api/v1/chat' })
    await server.ready()

    // Create test user and get token
    userId = 'test-user-' + Date.now()
    accessToken = server.jwt.sign({
      id: userId,
      email: 'test@example.com',
      role: 'user'
    })
  })

  afterAll(async () => {
    await testDb.query('DELETE FROM sessions WHERE user_id = $1', [userId])
    await testDb.query('DELETE FROM messages WHERE session_id IN (SELECT id FROM sessions WHERE user_id = $1)', [userId])
    await testDb.end()
    await testRedis.quit()
    await server.close()
  })

  describe('Health Check Endpoints', () => {
    it('should return health status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.status).toBe('healthy')
      expect(body).toHaveProperty('timestamp')
      expect(body).toHaveProperty('uptime')
    })

    it('should return readiness status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health/ready'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.ready).toBe(true)
      expect(body).toHaveProperty('checks')
    })

    it('should return liveness status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health/live'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.alive).toBe(true)
    })

    it('should return metrics', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health/metrics'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('memory')
      expect(body).toHaveProperty('cpu')
      expect(body).toHaveProperty('requests')
    })
  })

  describe('Chat API Endpoints', () => {
    let sessionId: string

    describe('POST /api/v1/chat/session', () => {
      it('should create a new chat session', async () => {
        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/chat/session',
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          payload: {
            title: 'Test Session',
            metadata: { test: true }
          }
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body).toHaveProperty('sessionId')
        expect(body).toHaveProperty('createdAt')
        sessionId = body.sessionId
      })

      it('should require authentication', async () => {
        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/chat/session',
          payload: {
            title: 'Test Session'
          }
        })

        expect(response.statusCode).toBe(401)
      })
    })

    describe('POST /api/v1/chat/message', () => {
      beforeEach(async () => {
        // Create a session for testing
        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/chat/session',
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          payload: {
            title: 'Message Test Session'
          }
        })
        const body = JSON.parse(response.body)
        sessionId = body.sessionId
      })

      it('should send a message to existing session', async () => {
        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/chat/message',
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          payload: {
            sessionId,
            message: 'Hello, test message'
          }
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body).toHaveProperty('userMessage')
        expect(body).toHaveProperty('aiResponse')
        expect(body.userMessage.content).toBe('Hello, test message')
      })

      it('should create session if not provided', async () => {
        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/chat/message',
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          payload: {
            message: 'Hello without session'
          }
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body).toHaveProperty('sessionId')
        expect(body).toHaveProperty('userMessage')
        expect(body).toHaveProperty('aiResponse')
      })

      it('should validate message content', async () => {
        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/chat/message',
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          payload: {
            sessionId,
            message: ''  // Empty message
          }
        })

        expect(response.statusCode).toBe(400)
      })

      it('should prevent accessing other users sessions', async () => {
        // Create session with different user
        const otherUserToken = server.jwt.sign({
          id: 'other-user',
          email: 'other@example.com',
          role: 'user'
        })

        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/chat/message',
          headers: {
            Authorization: `Bearer ${otherUserToken}`
          },
          payload: {
            sessionId,  // Try to use first user's session
            message: 'Unauthorized access attempt'
          }
        })

        expect(response.statusCode).toBe(403)
      })
    })

    describe('GET /api/v1/chat/history/:sessionId', () => {
      beforeEach(async () => {
        // Create session and add messages
        const sessionResponse = await server.inject({
          method: 'POST',
          url: '/api/v1/chat/session',
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          payload: {
            title: 'History Test Session'
          }
        })
        const sessionBody = JSON.parse(sessionResponse.body)
        sessionId = sessionBody.sessionId

        // Add some messages
        for (let i = 0; i < 5; i++) {
          await server.inject({
            method: 'POST',
            url: '/api/v1/chat/message',
            headers: {
              Authorization: `Bearer ${accessToken}`
            },
            payload: {
              sessionId,
              message: `Test message ${i}`
            }
          })
        }
      })

      it('should retrieve chat history', async () => {
        const response = await server.inject({
          method: 'GET',
          url: `/api/v1/chat/history/${sessionId}`,
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body).toHaveProperty('messages')
        expect(body).toHaveProperty('totalCount')
        expect(body.messages).toBeInstanceOf(Array)
        expect(body.messages.length).toBeGreaterThan(0)
      })

      it('should support pagination', async () => {
        const response = await server.inject({
          method: 'GET',
          url: `/api/v1/chat/history/${sessionId}?limit=2&offset=0`,
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body.messages.length).toBeLessThanOrEqual(2)
      })

      it('should prevent accessing other users history', async () => {
        const otherUserToken = server.jwt.sign({
          id: 'other-user',
          email: 'other@example.com',
          role: 'user'
        })

        const response = await server.inject({
          method: 'GET',
          url: `/api/v1/chat/history/${sessionId}`,
          headers: {
            Authorization: `Bearer ${otherUserToken}`
          }
        })

        expect(response.statusCode).toBe(403)
      })
    })

    describe('GET /api/v1/chat/sessions', () => {
      it('should list user sessions', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/api/v1/chat/sessions',
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body).toHaveProperty('sessions')
        expect(body.sessions).toBeInstanceOf(Array)
      })

      it('should only return current users sessions', async () => {
        // Create another user's token
        const otherUserToken = server.jwt.sign({
          id: 'other-user-2',
          email: 'other2@example.com',
          role: 'user'
        })

        // Create session for other user
        await server.inject({
          method: 'POST',
          url: '/api/v1/chat/session',
          headers: {
            Authorization: `Bearer ${otherUserToken}`
          },
          payload: {
            title: 'Other User Session'
          }
        })

        // Get current user's sessions
        const response = await server.inject({
          method: 'GET',
          url: '/api/v1/chat/sessions',
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        })

        const body = JSON.parse(response.body)
        const otherUserSessions = body.sessions.filter(
          (s: any) => s.title === 'Other User Session'
        )
        expect(otherUserSessions.length).toBe(0)
      })
    })

    describe('DELETE /api/v1/chat/session/:sessionId', () => {
      beforeEach(async () => {
        // Create a session to delete
        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/chat/session',
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          payload: {
            title: 'Session to Delete'
          }
        })
        const body = JSON.parse(response.body)
        sessionId = body.sessionId
      })

      it('should delete user session', async () => {
        const response = await server.inject({
          method: 'DELETE',
          url: `/api/v1/chat/session/${sessionId}`,
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body.success).toBe(true)

        // Verify session is deleted
        const historyResponse = await server.inject({
          method: 'GET',
          url: `/api/v1/chat/history/${sessionId}`,
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        })
        expect(historyResponse.statusCode).toBe(403)
      })

      it('should prevent deleting other users sessions', async () => {
        const otherUserToken = server.jwt.sign({
          id: 'other-user',
          email: 'other@example.com',
          role: 'user'
        })

        const response = await server.inject({
          method: 'DELETE',
          url: `/api/v1/chat/session/${sessionId}`,
          headers: {
            Authorization: `Bearer ${otherUserToken}`
          }
        })

        expect(response.statusCode).toBe(404)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/chat/message',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        payload: 'invalid json'
      })

      expect(response.statusCode).toBe(400)
    })

    it('should handle missing required fields', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/chat/message',
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        payload: {}  // Missing message field
      })

      expect(response.statusCode).toBe(400)
    })

    it('should handle expired tokens gracefully', async () => {
      const expiredToken = server.jwt.sign(
        { id: 'user', email: 'test@example.com' },
        { expiresIn: '0s' }  // Already expired
      )

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/chat/sessions',
        headers: {
          Authorization: `Bearer ${expiredToken}`
        }
      })

      expect(response.statusCode).toBe(401)
    })
  })
})