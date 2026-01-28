import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { resetMocks } from './mocks/cloudflare'
import React from 'react'

// Mock @tanstack/react-router Link component to render as regular anchor
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const original = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...original,
    Link: ({ to, children, className, ...props }: any) =>
      React.createElement('a', { href: to, className, ...props }, children),
  }
})

// Mock createServerFn to directly call the handler function
// This allows us to test server functions without HTTP middleware
vi.mock('@tanstack/react-start', () => ({
  createServerFn: ({ method }: { method: string }) => ({
    handler: (fn: Function) => {
      // Return a function that directly calls the handler
      const serverFn = async (args: any) => fn(args)
      return serverFn
    },
  }),
}))

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Reset Cloudflare mocks before each test
beforeEach(() => {
  resetMocks()
})

// Mock window.matchMedia for responsive components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock clipboard API
const clipboardMock = {
  writeText: vi.fn().mockResolvedValue(undefined),
  readText: vi.fn().mockResolvedValue(''),
}
Object.defineProperty(navigator, 'clipboard', {
  value: clipboardMock,
  writable: true,
  configurable: true,
})

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:test-url')
global.URL.revokeObjectURL = vi.fn()

// Polyfill File.arrayBuffer for jsdom
if (!File.prototype.arrayBuffer) {
  File.prototype.arrayBuffer = function () {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => {
        resolve(reader.result as ArrayBuffer)
      }
      reader.readAsArrayBuffer(this)
    })
  }
}

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
}
global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
