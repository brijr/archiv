import { describe, it, expect } from 'vitest'
import { cn, slugify, formatBytes, formatDate } from '@/lib/utils'

describe('cn', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('should handle conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
  })

  it('should handle undefined and null', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar')
  })

  it('should merge Tailwind classes correctly', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('should handle arrays', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })

  it('should handle objects', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz')
  })
})

describe('slugify', () => {
  it('should convert to lowercase', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('should replace spaces with hyphens', () => {
    expect(slugify('my folder name')).toBe('my-folder-name')
  })

  it('should remove special characters', () => {
    expect(slugify('Hello! @World#')).toBe('hello-world')
  })

  it('should handle multiple consecutive spaces', () => {
    expect(slugify('hello    world')).toBe('hello-world')
  })

  it('should trim leading/trailing hyphens', () => {
    expect(slugify('--hello--')).toBe('hello')
  })

  it('should handle underscores', () => {
    expect(slugify('hello_world')).toBe('hello-world')
  })

  it('should handle mixed whitespace', () => {
    expect(slugify('hello  world')).toBe('hello-world')
  })

  it('should return empty string for empty input', () => {
    expect(slugify('')).toBe('')
  })

  it('should handle leading/trailing spaces', () => {
    expect(slugify('  hello world  ')).toBe('hello-world')
  })
})

describe('formatBytes', () => {
  it('should format 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 Bytes')
  })

  it('should format bytes', () => {
    expect(formatBytes(500)).toBe('500 Bytes')
  })

  it('should format kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB')
  })

  it('should format megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1 MB')
  })

  it('should format gigabytes', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB')
  })

  it('should format terabytes', () => {
    expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1 TB')
  })

  it('should respect decimal places', () => {
    expect(formatBytes(1536, 1)).toBe('1.5 KB')
  })

  it('should default to 2 decimal places', () => {
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('should handle fractional bytes', () => {
    expect(formatBytes(1500, 2)).toBe('1.46 KB')
  })

  it('should handle negative decimals as 0', () => {
    expect(formatBytes(1536, -1)).toBe('2 KB')
  })
})

describe('formatDate', () => {
  it('should format Date object', () => {
    const date = new Date('2024-06-15T12:00:00Z')
    const result = formatDate(date)
    expect(result).toContain('Jun')
    expect(result).toContain('15')
    expect(result).toContain('2024')
  })

  it('should format Unix timestamp (seconds)', () => {
    const timestamp = Math.floor(new Date('2024-06-15T12:00:00Z').getTime() / 1000)
    const result = formatDate(timestamp)
    expect(result).toContain('Jun')
    expect(result).toContain('15')
    expect(result).toContain('2024')
  })

  it('should format different dates correctly', () => {
    const jan1 = new Date('2024-01-01T12:00:00Z')
    const result = formatDate(jan1)
    expect(result).toContain('Jan')
    expect(result).toContain('1')
    expect(result).toContain('2024')
  })
})
