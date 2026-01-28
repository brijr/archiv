import { createMockD1Database, type MockD1Database } from './d1'
import { createMockR2Bucket, type MockR2Bucket } from './r2'

// Create initial mocks
let mockDB: MockD1Database = createMockD1Database()
let mockBucket: MockR2Bucket = createMockR2Bucket()

// The env object that mirrors the Cloudflare Workers env
export const env = {
  get DB() {
    return mockDB
  },
  get BUCKET() {
    return mockBucket
  },
  CDN_DOMAIN: 'test-cdn.example.com',
}

// Reset mocks to fresh state between tests
export function resetMocks() {
  mockDB._reset()
  mockBucket._clear()
}

// Create completely new mock instances (for isolation between test files)
export function recreateMocks() {
  mockDB = createMockD1Database()
  mockBucket = createMockR2Bucket()
}

// Export types for test utilities
export type { MockD1Database, MockR2Bucket }
