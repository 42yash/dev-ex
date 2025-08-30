/**
 * Jest test setup file
 * This file runs before all tests to configure the test environment
 */

import { jest } from '@jest/globals'

// Set test environment variables
process.env.NODE_ENV = 'test'
process.env.LOG_LEVEL = 'error' // Reduce log noise during tests
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db'
process.env.REDIS_URL = 'redis://localhost:6379/1'
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-testing-only'
process.env.SESSION_SECRET = 'test-session-secret-for-testing-only'

// Global test timeout
jest.setTimeout(10000)

// Mock console methods to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error for debugging failed tests
  error: console.error,
}

// Clean up after all tests
afterAll(async () => {
  // Clean up any open handles
  await new Promise(resolve => setTimeout(resolve, 500))
})