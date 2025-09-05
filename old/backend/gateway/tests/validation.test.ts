import { describe, it, expect, beforeEach } from '@jest/globals'
import { 
  sanitizedString, 
  schemas, 
  requestSchemas,
  sanitizeSQLParam,
  validate
} from '../src/middleware/validation'
import { z } from 'zod'
import { FastifyRequest, FastifyReply } from 'fastify'

describe('Validation Middleware', () => {
  describe('sanitizedString', () => {
    it('should remove HTML tags from input', () => {
      const schema = sanitizedString()
      const result = schema.parse('<script>alert("xss")</script>Hello')
      expect(result).toBe('Hello')
    })

    it('should trim whitespace', () => {
      const schema = sanitizedString()
      const result = schema.parse('  hello world  ')
      expect(result).toBe('hello world')
    })

    it('should handle non-string input', () => {
      const schema = sanitizedString()
      const result = schema.parse(123)
      expect(result).toBe('123')
    })

    it('should preserve safe characters', () => {
      const schema = sanitizedString()
      const result = schema.parse('Hello-World_123')
      expect(result).toBe('Hello-World_123')
    })
  })

  describe('Common Schemas', () => {
    describe('email validation', () => {
      it('should accept valid email', () => {
        const result = schemas.email.parse('test@example.com')
        expect(result).toBe('test@example.com')
      })

      it('should reject invalid email', () => {
        expect(() => schemas.email.parse('not-an-email')).toThrow()
      })

      it('should sanitize email with HTML', () => {
        const result = schemas.email.parse('<b>test@example.com</b>')
        expect(result).toBe('test@example.com')
      })
    })

    describe('password validation', () => {
      it('should accept strong password', () => {
        const result = schemas.password.parse('StrongP@ssw0rd123')
        expect(result).toBe('StrongP@ssw0rd123')
      })

      it('should reject weak password', () => {
        expect(() => schemas.password.parse('weak')).toThrow()
      })

      it('should require minimum 12 characters', () => {
        expect(() => schemas.password.parse('Short@123')).toThrow()
      })
    })

    describe('username validation', () => {
      it('should accept valid username', () => {
        const result = schemas.username.parse('user_name-123')
        expect(result).toBe('user_name-123')
      })

      it('should reject username with special characters', () => {
        expect(() => schemas.username.parse('user@name')).toThrow()
      })

      it('should enforce length limits', () => {
        expect(() => schemas.username.parse('ab')).toThrow() // Too short
        expect(() => schemas.username.parse('a'.repeat(31))).toThrow() // Too long
      })
    })

    describe('UUID validation', () => {
      it('should accept valid UUID', () => {
        const uuid = '123e4567-e89b-12d3-a456-426614174000'
        const result = schemas.id.parse(uuid)
        expect(result).toBe(uuid)
      })

      it('should reject invalid UUID', () => {
        expect(() => schemas.id.parse('not-a-uuid')).toThrow()
      })
    })

    describe('pagination validation', () => {
      it('should provide default values', () => {
        const result = schemas.pagination.parse({})
        expect(result).toEqual({
          page: 1,
          limit: 20,
          sortBy: undefined,
          sortOrder: undefined
        })
      })

      it('should validate page and limit', () => {
        const result = schemas.pagination.parse({ page: 2, limit: 50 })
        expect(result.page).toBe(2)
        expect(result.limit).toBe(50)
      })

      it('should reject invalid pagination', () => {
        expect(() => schemas.pagination.parse({ page: -1 })).toThrow()
        expect(() => schemas.pagination.parse({ limit: 101 })).toThrow()
      })
    })

    describe('file validation', () => {
      it('should validate file metadata', () => {
        const file = {
          filename: 'test.pdf',
          mimetype: 'application/pdf',
          size: 1024 * 1024 // 1MB
        }
        const result = schemas.file.parse(file)
        expect(result).toEqual(file)
      })

      it('should reject oversized files', () => {
        const file = {
          filename: 'large.pdf',
          mimetype: 'application/pdf',
          size: 11 * 1024 * 1024 // 11MB
        }
        expect(() => schemas.file.parse(file)).toThrow()
      })

      it('should reject invalid mimetype', () => {
        const file = {
          filename: 'test.pdf',
          mimetype: 'invalid mimetype',
          size: 1024
        }
        expect(() => schemas.file.parse(file)).toThrow()
      })
    })
  })

  describe('Request Schemas', () => {
    describe('auth schemas', () => {
      it('should validate registration request', () => {
        const data = {
          email: 'test@example.com',
          password: 'StrongP@ssw0rd123',
          name: 'Test User'
        }
        const result = requestSchemas.auth.register.parse(data)
        expect(result.email).toBe('test@example.com')
        expect(result.name).toBe('Test User')
      })

      it('should validate login request', () => {
        const data = {
          email: 'test@example.com',
          password: 'anypassword'
        }
        const result = requestSchemas.auth.login.parse(data)
        expect(result).toEqual(data)
      })

      it('should sanitize name in registration', () => {
        const data = {
          email: 'test@example.com',
          password: 'StrongP@ssw0rd123',
          name: '<script>alert("xss")</script>Test User'
        }
        const result = requestSchemas.auth.register.parse(data)
        expect(result.name).toBe('Test User')
      })
    })

    describe('chat schemas', () => {
      it('should validate send message request', () => {
        const data = {
          message: 'Hello, world!',
          conversationId: '123e4567-e89b-12d3-a456-426614174000'
        }
        const result = requestSchemas.chat.sendMessage.parse(data)
        expect(result.message).toBe('Hello, world!')
      })

      it('should sanitize message content', () => {
        const data = {
          message: '<script>alert("xss")</script>Hello'
        }
        const result = requestSchemas.chat.sendMessage.parse(data)
        expect(result.message).toBe('Hello')
      })

      it('should enforce message length limits', () => {
        const data = {
          message: 'a'.repeat(10001)
        }
        expect(() => requestSchemas.chat.sendMessage.parse(data)).toThrow()
      })
    })

    describe('user schemas', () => {
      it('should validate profile update', () => {
        const data = {
          name: 'Updated Name',
          bio: 'My bio',
          avatar: 'https://example.com/avatar.jpg'
        }
        const result = requestSchemas.user.updateProfile.parse(data)
        expect(result.name).toBe('Updated Name')
      })

      it('should validate settings update', () => {
        const data = {
          theme: 'dark',
          language: 'en',
          notifications: {
            email: true,
            push: false
          }
        }
        const result = requestSchemas.user.updateSettings.parse(data)
        expect(result.theme).toBe('dark')
      })
    })
  })

  describe('SQL Sanitization', () => {
    it('should remove SQL injection attempts', () => {
      const input = "'; DROP TABLE users; --"
      const result = sanitizeSQLParam(input)
      expect(result).toBe(' DROP TABLE users ')
    })

    it('should remove dangerous SQL keywords', () => {
      const input = 'user DELETE FROM INSERT INTO users'
      const result = sanitizeSQLParam(input)
      expect(result).toBe('user   users')
    })

    it('should handle normal input', () => {
      const input = 'John Doe'
      const result = sanitizeSQLParam(input)
      expect(result).toBe('John Doe')
    })
  })

  describe('Validation Middleware Function', () => {
    it('should validate request data', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number()
      })
      
      const middleware = validate(schema)
      const mockRequest = {
        body: { name: 'Test', age: 25 },
        query: {},
        params: {},
        log: { error: jest.fn() }
      } as any

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as any

      const result = await middleware(mockRequest, mockReply)
      expect(result).toEqual({ name: 'Test', age: 25 })
    })

    it('should return 400 on validation error', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number()
      })
      
      const middleware = validate(schema)
      const mockRequest = {
        body: { name: 'Test', age: 'not a number' },
        query: {},
        params: {},
        log: { error: jest.fn() }
      } as any

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as any

      await middleware(mockRequest, mockReply)
      
      expect(mockReply.status).toHaveBeenCalledWith(400)
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed'
        })
      )
    })

    it('should merge body, query, and params', async () => {
      const schema = z.object({
        bodyField: z.string(),
        queryField: z.string(),
        paramField: z.string()
      })
      
      const middleware = validate(schema)
      const mockRequest = {
        body: { bodyField: 'body' },
        query: { queryField: 'query' },
        params: { paramField: 'param' },
        log: { error: jest.fn() }
      } as any

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as any

      const result = await middleware(mockRequest, mockReply)
      expect(result).toEqual({
        bodyField: 'body',
        queryField: 'query',
        paramField: 'param'
      })
    })
  })
})