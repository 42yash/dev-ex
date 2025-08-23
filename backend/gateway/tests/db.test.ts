import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals'
import { 
  initializeDatabase, 
  query, 
  getClient, 
  transaction,
  checkDatabaseHealth,
  closeDatabase,
  getPoolStats,
  prepareStatement
} from '../src/db/index'
import { Pool } from 'pg'

// Mock pg module
jest.mock('pg', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn()
  }

  const mockPool = {
    connect: jest.fn().mockResolvedValue(mockClient),
    query: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
    totalCount: 5,
    idleCount: 3,
    waitingCount: 0
  }

  return {
    Pool: jest.fn(() => mockPool)
  }
})

describe('Database Module', () => {
  let mockPool: any
  let mockClient: any

  beforeAll(async () => {
    // Set up environment variables
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
    process.env.NODE_ENV = 'test'
    process.env.DB_POOL_MAX = '10'
    process.env.DB_POOL_MIN = '2'
  })

  beforeEach(() => {
    jest.clearAllMocks()
    // Get mocked instances
    mockPool = new (require('pg').Pool)()
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    }
    mockPool.connect.mockResolvedValue(mockClient)
  })

  describe('initializeDatabase', () => {
    it('should initialize database pool successfully', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ now: new Date() }] })
      
      await initializeDatabase()
      
      expect(mockPool.connect).toHaveBeenCalled()
      expect(mockClient.query).toHaveBeenCalledWith('SELECT NOW()')
      expect(mockClient.release).toHaveBeenCalled()
    })

    it('should set up pool event handlers', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ now: new Date() }] })
      
      await initializeDatabase()
      
      expect(mockPool.on).toHaveBeenCalledWith('connect', expect.any(Function))
      expect(mockPool.on).toHaveBeenCalledWith('acquire', expect.any(Function))
      expect(mockPool.on).toHaveBeenCalledWith('release', expect.any(Function))
      expect(mockPool.on).toHaveBeenCalledWith('remove', expect.any(Function))
      expect(mockPool.on).toHaveBeenCalledWith('error', expect.any(Function))
    })

    it('should handle initialization errors', async () => {
      mockPool.connect.mockRejectedValueOnce(new Error('Connection failed'))
      
      await expect(initializeDatabase()).rejects.toThrow('Connection failed')
    })
  })

  describe('query', () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ now: new Date() }] })
      await initializeDatabase()
    })

    it('should execute query successfully', async () => {
      const mockResult = { 
        rows: [{ id: 1, name: 'Test' }], 
        rowCount: 1 
      }
      mockPool.query.mockResolvedValueOnce(mockResult)
      
      const result = await query('SELECT * FROM users WHERE id = $1', [1])
      
      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1])
      expect(result).toEqual(mockResult.rows)
    })

    it('should retry on connection errors', async () => {
      const error = new Error('Connection refused')
      ;(error as any).code = 'ECONNREFUSED'
      
      mockPool.query
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 })
      
      const result = await query('SELECT 1', [], 2)
      
      expect(mockPool.query).toHaveBeenCalledTimes(2)
      expect(result).toEqual([{ id: 1 }])
    })

    it('should not retry non-retryable errors', async () => {
      const error = new Error('Syntax error')
      ;(error as any).code = '42601'
      
      mockPool.query.mockRejectedValueOnce(error)
      
      await expect(query('SELECT 1', [], 2)).rejects.toThrow('Syntax error')
      expect(mockPool.query).toHaveBeenCalledTimes(1)
    })

    it('should throw error if pool not initialized', async () => {
      await closeDatabase()
      
      await expect(query('SELECT 1')).rejects.toThrow('Database not initialized')
    })
  })

  describe('transaction', () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ now: new Date() }] })
      await initializeDatabase()
    })

    it('should execute transaction successfully', async () => {
      mockPool.connect.mockResolvedValueOnce(mockClient)
      mockClient.query.mockResolvedValue({ rows: [] })
      
      const result = await transaction(async (client) => {
        await client.query('INSERT INTO users (name) VALUES ($1)', ['Test'])
        return { success: true }
      })
      
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN')
      expect(mockClient.query).toHaveBeenCalledWith('INSERT INTO users (name) VALUES ($1)', ['Test'])
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT')
      expect(mockClient.release).toHaveBeenCalled()
      expect(result).toEqual({ success: true })
    })

    it('should rollback transaction on error', async () => {
      mockPool.connect.mockResolvedValueOnce(mockClient)
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('Insert failed')) // INSERT
      
      await expect(
        transaction(async (client) => {
          await client.query('INSERT INTO users (name) VALUES ($1)', ['Test'])
        })
      ).rejects.toThrow('Insert failed')
      
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
      expect(mockClient.release).toHaveBeenCalled()
    })

    it('should release client even if rollback fails', async () => {
      mockPool.connect.mockResolvedValueOnce(mockClient)
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('Insert failed')) // INSERT
        .mockRejectedValueOnce(new Error('Rollback failed')) // ROLLBACK
      
      await expect(
        transaction(async (client) => {
          await client.query('INSERT INTO users (name) VALUES ($1)', ['Test'])
        })
      ).rejects.toThrow('Insert failed')
      
      expect(mockClient.release).toHaveBeenCalled()
    })
  })

  describe('getClient', () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ now: new Date() }] })
      await initializeDatabase()
    })

    it('should return a client from pool', async () => {
      mockPool.connect.mockResolvedValueOnce(mockClient)
      
      const client = await getClient()
      
      expect(client).toBe(mockClient)
      expect(mockPool.connect).toHaveBeenCalled()
    })

    it('should throw error if pool not initialized', async () => {
      await closeDatabase()
      
      await expect(getClient()).rejects.toThrow('Database not initialized')
    })
  })

  describe('checkDatabaseHealth', () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ now: new Date() }] })
      await initializeDatabase()
    })

    it('should return true when database is healthy', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      
      const isHealthy = await checkDatabaseHealth()
      
      expect(isHealthy).toBe(true)
      expect(mockPool.query).toHaveBeenCalledWith('SELECT 1', undefined)
    })

    it('should return false when database is unhealthy', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Connection failed'))
      
      const isHealthy = await checkDatabaseHealth()
      
      expect(isHealthy).toBe(false)
    })
  })

  describe('getPoolStats', () => {
    it('should return pool statistics when initialized', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ now: new Date() }] })
      await initializeDatabase()
      
      const stats = getPoolStats()
      
      expect(stats).toMatchObject({
        poolExists: true,
        totalCount: 5,
        idleCount: 3,
        waitingCount: 0
      })
    })

    it('should return default stats when not initialized', () => {
      const stats = getPoolStats()
      
      expect(stats).toMatchObject({
        poolExists: false
      })
    })
  })

  describe('prepareStatement', () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ now: new Date() }] })
      await initializeDatabase()
    })

    it('should prepare statement successfully', async () => {
      mockPool.connect.mockResolvedValueOnce(mockClient)
      mockClient.query.mockResolvedValueOnce({ rows: [] })
      
      await prepareStatement('get_user', 'SELECT * FROM users WHERE id = $1', 1)
      
      expect(mockClient.query).toHaveBeenCalledWith({
        name: 'get_user',
        text: 'SELECT * FROM users WHERE id = $1',
        values: 1
      })
      expect(mockClient.release).toHaveBeenCalled()
    })

    it('should release client even on error', async () => {
      mockPool.connect.mockResolvedValueOnce(mockClient)
      mockClient.query.mockRejectedValueOnce(new Error('Prepare failed'))
      
      await expect(
        prepareStatement('get_user', 'SELECT * FROM users WHERE id = $1', 1)
      ).rejects.toThrow('Prepare failed')
      
      expect(mockClient.release).toHaveBeenCalled()
    })
  })

  describe('closeDatabase', () => {
    it('should close database pool', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ now: new Date() }] })
      await initializeDatabase()
      
      await closeDatabase()
      
      expect(mockPool.end).toHaveBeenCalled()
    })

    it('should handle closing when not initialized', async () => {
      await closeDatabase()
      // Should not throw
      expect(mockPool.end).not.toHaveBeenCalled()
    })
  })

  afterAll(async () => {
    await closeDatabase()
    jest.restoreAllMocks()
  })
})