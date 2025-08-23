import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import Fastify from 'fastify'
import { authRoutes } from '../src/routes/auth'
import { passwordValidator } from '../src/utils/passwordValidator'

describe('Authentication Routes', () => {
  let server: any

  beforeAll(async () => {
    server = Fastify()
    await server.register(authRoutes, { prefix: '/api/v1/auth' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  describe('POST /api/v1/auth/register', () => {
    it('should reject weak passwords', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'weak',
          name: 'Test User'
        }
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('Password does not meet security requirements')
    })

    it('should reject registration with invalid email', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'not-an-email',
          password: 'StrongP@ssw0rd123',
          name: 'Test User'
        }
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('POST /api/v1/auth/password-strength', () => {
    it('should return password strength assessment', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/password-strength',
        payload: {
          password: 'MyStr0ng!Passw0rd'
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('strength')
      expect(body).toHaveProperty('score')
      expect(body).toHaveProperty('isValid')
    })
  })
})

describe('Password Validator', () => {
  describe('validate()', () => {
    it('should reject passwords shorter than minimum length', () => {
      const result = passwordValidator.validate('short')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must be at least 12 characters long')
    })

    it('should require uppercase letters', () => {
      const result = passwordValidator.validate('lowercase0nly!')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one uppercase letter')
    })

    it('should require lowercase letters', () => {
      const result = passwordValidator.validate('UPPERCASE0NLY!')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one lowercase letter')
    })

    it('should require numbers', () => {
      const result = passwordValidator.validate('NoNumbersHere!')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one number')
    })

    it('should require special characters', () => {
      const result = passwordValidator.validate('NoSpecialChar5')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one special character')
    })

    it('should accept strong passwords', () => {
      const result = passwordValidator.validate('MyStr0ng!Passw0rd')
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(['strong', 'very-strong']).toContain(result.strength)
    })

    it('should detect common patterns', () => {
      const result = passwordValidator.validate('Password123!@#')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password contains common patterns or sequences')
    })

    it('should detect repeated characters', () => {
      const result = passwordValidator.validate('Passsword123!')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password contains too many repeated characters')
    })
  })

  describe('generateStrongPassword()', () => {
    it('should generate valid passwords', () => {
      const password = passwordValidator.generateStrongPassword(16)
      const result = passwordValidator.validate(password)
      expect(result.isValid).toBe(true)
      expect(password.length).toBe(16)
    })
  })
})