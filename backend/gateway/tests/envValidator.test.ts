import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

describe('Environment Validator', () => {
  let originalEnv: NodeJS.ProcessEnv
  let originalExit: typeof process.exit
  let exitMock: jest.Mock

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env }
    
    // Mock process.exit
    exitMock = jest.fn()
    originalExit = process.exit
    process.exit = exitMock as any
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()
    
    // Clear module cache to reload the validator
    jest.resetModules()
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
    process.exit = originalExit
    
    // Restore console methods
    jest.restoreAllMocks()
  })

  const setValidEnvironment = () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      PORT: '8080',
      JWT_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      SESSION_SECRET: 'c'.repeat(32),
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      REDIS_URL: 'redis://localhost:6379',
      LOG_LEVEL: 'info'
    }
  }

  describe('Valid Environment', () => {
    it('should validate successfully with all required variables', () => {
      setValidEnvironment()
      
      const { validateEnv } = require('../src/utils/envValidator')
      const env = validateEnv()
      
      expect(env).toBeDefined()
      expect(env.NODE_ENV).toBe('test')
      expect(env.PORT).toBe(8080)
      expect(exitMock).not.toHaveBeenCalled()
    })

    it('should use default values for optional variables', () => {
      setValidEnvironment()
      delete process.env.LOG_LEVEL
      delete process.env.CORS_ORIGIN
      
      const { validateEnv } = require('../src/utils/envValidator')
      const env = validateEnv()
      
      expect(env.LOG_LEVEL).toBe('info')
      expect(env.CORS_ORIGIN).toBe('http://localhost:3000')
    })

    it('should parse boolean values correctly', () => {
      setValidEnvironment()
      process.env.CORS_CREDENTIALS = 'true'
      process.env.PASSWORD_REQUIRE_UPPERCASE = 'false'
      
      const { validateEnv } = require('../src/utils/envValidator')
      const env = validateEnv()
      
      expect(env.CORS_CREDENTIALS).toBe(true)
      expect(env.PASSWORD_REQUIRE_UPPERCASE).toBe(false)
    })

    it('should parse numeric values correctly', () => {
      setValidEnvironment()
      process.env.RATE_LIMIT_WINDOW_MS = '60000'
      process.env.RATE_LIMIT_MAX_REQUESTS = '50'
      
      const { validateEnv } = require('../src/utils/envValidator')
      const env = validateEnv()
      
      expect(env.RATE_LIMIT_WINDOW_MS).toBe(60000)
      expect(env.RATE_LIMIT_MAX_REQUESTS).toBe(50)
    })
  })

  describe('Invalid Environment', () => {
    it('should exit if JWT_SECRET is missing', () => {
      setValidEnvironment()
      delete process.env.JWT_SECRET
      
      const { validateEnv } = require('../src/utils/envValidator')
      validateEnv()
      
      expect(exitMock).toHaveBeenCalledWith(1)
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('JWT_SECRET')
      )
    })

    it('should exit if JWT_SECRET is too short', () => {
      setValidEnvironment()
      process.env.JWT_SECRET = 'short'
      
      const { validateEnv } = require('../src/utils/envValidator')
      validateEnv()
      
      expect(exitMock).toHaveBeenCalledWith(1)
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('at least 32 characters')
      )
    })

    it('should exit if JWT_SECRET contains default value', () => {
      setValidEnvironment()
      process.env.JWT_SECRET = 'CHANGE-THIS-' + 'a'.repeat(20)
      
      const { validateEnv } = require('../src/utils/envValidator')
      validateEnv()
      
      expect(exitMock).toHaveBeenCalledWith(1)
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('contains default value')
      )
    })

    it('should exit if JWT_SECRET and JWT_REFRESH_SECRET are the same', () => {
      setValidEnvironment()
      const secret = 'a'.repeat(32)
      process.env.JWT_SECRET = secret
      process.env.JWT_REFRESH_SECRET = secret
      
      const { validateEnv } = require('../src/utils/envValidator')
      validateEnv()
      
      expect(exitMock).toHaveBeenCalledWith(1)
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('must be different')
      )
    })

    it('should exit if DATABASE_URL is invalid', () => {
      setValidEnvironment()
      process.env.DATABASE_URL = 'not-a-url'
      
      const { validateEnv } = require('../src/utils/envValidator')
      validateEnv()
      
      expect(exitMock).toHaveBeenCalledWith(1)
    })

    it('should exit if NODE_ENV is invalid', () => {
      setValidEnvironment()
      process.env.NODE_ENV = 'invalid'
      
      const { validateEnv } = require('../src/utils/envValidator')
      validateEnv()
      
      expect(exitMock).toHaveBeenCalledWith(1)
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('NODE_ENV')
      )
    })
  })

  describe('Production Environment', () => {
    it('should fail if LOG_LEVEL is debug in production', () => {
      setValidEnvironment()
      process.env.NODE_ENV = 'production'
      process.env.LOG_LEVEL = 'debug'
      
      const { validateEnv } = require('../src/utils/envValidator')
      validateEnv()
      
      expect(exitMock).toHaveBeenCalledWith(1)
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('LOG_LEVEL should not be "debug" in production')
      )
    })

    it('should fail if CORS_ORIGIN is localhost in production', () => {
      setValidEnvironment()
      process.env.NODE_ENV = 'production'
      process.env.CORS_ORIGIN = 'http://localhost:3000'
      
      const { validateEnv } = require('../src/utils/envValidator')
      validateEnv()
      
      expect(exitMock).toHaveBeenCalledWith(1)
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('CORS_ORIGIN is not secure for production')
      )
    })

    it('should fail if CORS_ORIGIN is * in production', () => {
      setValidEnvironment()
      process.env.NODE_ENV = 'production'
      process.env.CORS_ORIGIN = '*'
      
      const { validateEnv } = require('../src/utils/envValidator')
      validateEnv()
      
      expect(exitMock).toHaveBeenCalledWith(1)
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('CORS_ORIGIN is not secure for production')
      )
    })

    it('should pass with secure production settings', () => {
      setValidEnvironment()
      process.env.NODE_ENV = 'production'
      process.env.CORS_ORIGIN = 'https://example.com'
      process.env.LOG_LEVEL = 'warn'
      
      const { validateEnv } = require('../src/utils/envValidator')
      const env = validateEnv()
      
      expect(env).toBeDefined()
      expect(exitMock).not.toHaveBeenCalled()
    })
  })

  describe('Environment Masking', () => {
    it('should mask sensitive values in development', () => {
      setValidEnvironment()
      process.env.NODE_ENV = 'development'
      
      const { validateEnv } = require('../src/utils/envValidator')
      validateEnv()
      
      expect(console.log).toHaveBeenCalledWith(
        'Environment configuration:',
        expect.objectContaining({
          JWT_SECRET: '***MASKED***',
          JWT_REFRESH_SECRET: '***MASKED***',
          SESSION_SECRET: '***MASKED***',
          DATABASE_URL: '***MASKED***',
          REDIS_URL: '***MASKED***'
        })
      )
    })

    it('should not log configuration in production', () => {
      setValidEnvironment()
      process.env.NODE_ENV = 'production'
      process.env.CORS_ORIGIN = 'https://example.com'
      
      const { validateEnv } = require('../src/utils/envValidator')
      validateEnv()
      
      const configLogs = (console.log as jest.Mock).mock.calls.filter(
        call => call[0] === 'Environment configuration:'
      )
      expect(configLogs).toHaveLength(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle PORT as string', () => {
      setValidEnvironment()
      process.env.PORT = '3000'
      
      const { validateEnv } = require('../src/utils/envValidator')
      const env = validateEnv()
      
      expect(env.PORT).toBe(3000)
      expect(typeof env.PORT).toBe('number')
    })

    it('should handle missing optional rate limit settings', () => {
      setValidEnvironment()
      delete process.env.RATE_LIMIT_WINDOW_MS
      delete process.env.RATE_LIMIT_MAX_REQUESTS
      
      const { validateEnv } = require('../src/utils/envValidator')
      const env = validateEnv()
      
      expect(env.RATE_LIMIT_WINDOW_MS).toBe(900000)
      expect(env.RATE_LIMIT_MAX_REQUESTS).toBe(100)
    })

    it('should validate password policy settings', () => {
      setValidEnvironment()
      process.env.PASSWORD_MIN_LENGTH = '8'
      process.env.PASSWORD_REQUIRE_UPPERCASE = 'true'
      process.env.PASSWORD_REQUIRE_LOWERCASE = 'true'
      process.env.PASSWORD_REQUIRE_NUMBERS = 'false'
      process.env.PASSWORD_REQUIRE_SPECIAL = 'false'
      
      const { validateEnv } = require('../src/utils/envValidator')
      const env = validateEnv()
      
      expect(env.PASSWORD_MIN_LENGTH).toBe(8)
      expect(env.PASSWORD_REQUIRE_UPPERCASE).toBe(true)
      expect(env.PASSWORD_REQUIRE_LOWERCASE).toBe(true)
      expect(env.PASSWORD_REQUIRE_NUMBERS).toBe(false)
      expect(env.PASSWORD_REQUIRE_SPECIAL).toBe(false)
    })
  })
})