import { vi } from 'vitest'
import type { AuthContext } from '@/lib/server/auth-helpers'

// Default mock auth context for tests
export const mockAuthContext: AuthContext = {
  userId: 'test-user',
  organizationId: 'test-org',
  role: 'owner',
}

// Mock the getAuthContext function
export function setupAuthMock(context: Partial<AuthContext> = {}) {
  const authContext = { ...mockAuthContext, ...context }

  vi.mock('@/lib/server/auth-helpers', () => ({
    getAuthContext: vi.fn().mockResolvedValue(authContext),
    getAuthContextOptional: vi.fn().mockResolvedValue(authContext),
  }))

  return authContext
}

// Reset auth mock
export function resetAuthMock() {
  vi.resetModules()
}
