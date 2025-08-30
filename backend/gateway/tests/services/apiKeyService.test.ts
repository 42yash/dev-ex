/**
 * Test suite for API Key Service
 */

import { jest } from '@jest/globals'
import { ApiKeyService } from '../../src/services/apiKeyService'
import * as db from '../../src/db'
import * as redis from '../../src/services/redis'

// Mock dependencies
jest.mock('../../src/db')
jest.mock('../../src/services/redis')
jest.mock('../../src/utils/logger')

describe('ApiKeyService', () => {
  const mockQuery = db.query as jest.MockedFunction<typeof db.query>
  const mockGetCached = redis.getCached as jest.MockedFunction<typeof redis.getCached>
  const mockSetCached = redis.setCached as jest.MockedFunction<typeof redis.setCached>
  const mockDeleteCached = redis.deleteCached as jest.MockedFunction<typeof redis.deleteCached>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateApiKey', () => {
    it('should generate a key with correct prefix', () => {
      const key = ApiKeyService.generateApiKey()
      expect(key).toMatch(/^devex_/)
      expect(key.length).toBeGreaterThan(30)
    })

    it('should generate unique keys', () => {
      const keys = new Set()
      for (let i = 0; i < 100; i++) {
        keys.add(ApiKeyService.generateApiKey())
      }
      expect(keys.size).toBe(100)
    })
  })

  describe('createApiKey', () => {
    it('should create a new API key successfully', async () => {
      const userId = 'test-user-123'
      const name = 'Test API Key'
      const permissions = ['read', 'write']
      
      mockQuery.mockResolvedValueOnce([])

      const result = await ApiKeyService.createApiKey(userId, name, permissions)
      
      expect(result).toHaveProperty('key')
      expect(result).toHaveProperty('id')
      expect(result.key).toMatch(/^devex_/)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO api_keys'),
        expect.arrayContaining([
          expect.any(String), // keyId
          userId,
          expect.any(String), // hashedKey
          name,
          permissions,
          null // expiresAt
        ])
      )
    })

    it('should create API key with expiration', async () => {
      const userId = 'test-user-123'
      const name = 'Expiring Key'
      const permissions = ['read']
      const expiresInDays = 30
      
      mockQuery.mockResolvedValueOnce([])

      const result = await ApiKeyService.createApiKey(userId, name, permissions, expiresInDays)
      
      expect(result).toHaveProperty('key')
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO api_keys'),
        expect.arrayContaining([
          expect.any(String),
          userId,
          expect.any(String),
          name,
          permissions,
          expect.any(Date) // expiresAt should be a Date
        ])
      )
    })
  })

  describe('validateApiKey', () => {
    it('should validate a valid API key from cache', async () => {
      const key = 'devex_validkey123'
      const cachedData = {
        id: 'key-id-123',
        userId: 'user-123',
        key: 'hashed-key',
        name: 'Test Key',
        permissions: ['read', 'write'],
        rateLimit: 100,
        expiresAt: null,
        lastUsedAt: null,
        createdAt: new Date()
      }
      
      mockGetCached.mockResolvedValueOnce(cachedData)
      
      const result = await ApiKeyService.validateApiKey(key)
      
      expect(result).toEqual({
        valid: true,
        userId: 'user-123',
        permissions: ['read', 'write'],
        rateLimit: 100
      })
    })

    it('should validate a valid API key from database', async () => {
      const key = 'devex_validkey123'
      const dbData = {
        id: 'key-id-123',
        user_id: 'user-123',
        key_hash: 'hashed-key',
        name: 'Test Key',
        permissions: ['read', 'write'],
        rate_limit: 100,
        expires_at: null,
        last_used_at: null,
        created_at: new Date()
      }
      
      mockGetCached.mockResolvedValueOnce(null)
      mockQuery.mockResolvedValueOnce([dbData])
      mockSetCached.mockResolvedValueOnce(undefined)
      
      const result = await ApiKeyService.validateApiKey(key)
      
      expect(result).toEqual({
        valid: true,
        userId: 'user-123',
        permissions: ['read', 'write'],
        rateLimit: 100
      })
      
      expect(mockSetCached).toHaveBeenCalled()
    })

    it('should reject invalid API key format', async () => {
      const key = 'invalid_key_format'
      
      const result = await ApiKeyService.validateApiKey(key)
      
      expect(result).toEqual({ valid: false })
      expect(mockGetCached).not.toHaveBeenCalled()
      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('should reject expired API key', async () => {
      const key = 'devex_expiredkey123'
      const expiredDate = new Date(Date.now() - 86400000) // 1 day ago
      const cachedData = {
        id: 'key-id-123',
        userId: 'user-123',
        key: 'hashed-key',
        name: 'Expired Key',
        permissions: ['read'],
        rateLimit: 100,
        expiresAt: expiredDate,
        lastUsedAt: null,
        createdAt: new Date()
      }
      
      mockGetCached.mockResolvedValueOnce(cachedData)
      mockDeleteCached.mockResolvedValueOnce(true)
      
      const result = await ApiKeyService.validateApiKey(key)
      
      expect(result).toEqual({ valid: false })
      expect(mockDeleteCached).toHaveBeenCalledWith(expect.stringContaining('api_key:'))
    })

    it('should reject non-existent API key', async () => {
      const key = 'devex_nonexistent123'
      
      mockGetCached.mockResolvedValueOnce(null)
      mockQuery.mockResolvedValueOnce([])
      
      const result = await ApiKeyService.validateApiKey(key)
      
      expect(result).toEqual({ valid: false })
    })
  })

  describe('rotateApiKey', () => {
    it('should rotate an existing API key', async () => {
      const keyId = 'key-id-123'
      const userId = 'user-123'
      const existingKey = {
        id: keyId,
        user_id: userId,
        key_hash: 'old-hash',
        name: 'Original Key',
        permissions: ['read', 'write'],
        rate_limit: 100,
        expires_at: null
      }
      
      mockQuery
        .mockResolvedValueOnce([existingKey]) // SELECT existing key
        .mockResolvedValueOnce([]) // BEGIN transaction
        .mockResolvedValueOnce([]) // UPDATE revoke old key
        .mockResolvedValueOnce([]) // INSERT new key
        .mockResolvedValueOnce([]) // COMMIT
      
      mockDeleteCached.mockResolvedValueOnce(true)
      
      const newKey = await ApiKeyService.rotateApiKey(keyId, userId)
      
      expect(newKey).toMatch(/^devex_/)
      expect(mockQuery).toHaveBeenCalledTimes(5)
      expect(mockDeleteCached).toHaveBeenCalled()
    })

    it('should throw error if key not found', async () => {
      const keyId = 'non-existent-key'
      const userId = 'user-123'
      
      mockQuery.mockResolvedValueOnce([])
      
      await expect(ApiKeyService.rotateApiKey(keyId, userId))
        .rejects.toThrow('API key not found or already revoked')
    })
  })

  describe('revokeApiKey', () => {
    it('should revoke an API key', async () => {
      const keyId = 'key-id-123'
      const userId = 'user-123'
      
      mockQuery
        .mockResolvedValueOnce([{ affectedRows: 1 }])
      
      mockDeleteCached.mockResolvedValueOnce(true)
      
      const result = await ApiKeyService.revokeApiKey(keyId, userId)
      
      expect(result).toBe(true)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE api_keys SET revoked = true'),
        [keyId, userId]
      )
    })

    it('should return false if key not found', async () => {
      const keyId = 'non-existent-key'
      const userId = 'user-123'
      
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }])
      
      const result = await ApiKeyService.revokeApiKey(keyId, userId)
      
      expect(result).toBe(false)
    })
  })

  describe('listUserApiKeys', () => {
    it('should list all API keys for a user', async () => {
      const userId = 'user-123'
      const keys = [
        {
          id: 'key-1',
          name: 'Key 1',
          permissions: ['read'],
          created_at: new Date(),
          last_used_at: null,
          expires_at: null
        },
        {
          id: 'key-2',
          name: 'Key 2',
          permissions: ['read', 'write'],
          created_at: new Date(),
          last_used_at: new Date(),
          expires_at: null
        }
      ]
      
      mockQuery.mockResolvedValueOnce(keys)
      
      const result = await ApiKeyService.listUserApiKeys(userId)
      
      expect(result).toEqual(keys)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [userId]
      )
    })

    it('should return empty array if no keys found', async () => {
      const userId = 'user-without-keys'
      
      mockQuery.mockResolvedValueOnce([])
      
      const result = await ApiKeyService.listUserApiKeys(userId)
      
      expect(result).toEqual([])
    })
  })

  describe('getApiKeyById', () => {
    it('should get API key by ID', async () => {
      const keyId = 'key-id-123'
      const userId = 'user-123'
      const keyData = {
        id: keyId,
        name: 'Test Key',
        permissions: ['read'],
        created_at: new Date(),
        last_used_at: null,
        expires_at: null
      }
      
      mockQuery.mockResolvedValueOnce([keyData])
      
      const result = await ApiKeyService.getApiKeyById(keyId, userId)
      
      expect(result).toEqual(keyData)
    })

    it('should return null if key not found', async () => {
      const keyId = 'non-existent-key'
      const userId = 'user-123'
      
      mockQuery.mockResolvedValueOnce([])
      
      const result = await ApiKeyService.getApiKeyById(keyId, userId)
      
      expect(result).toBeNull()
    })
  })
})