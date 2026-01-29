import { nanoid } from 'nanoid'
import type { Tag } from '@/lib/types'

const COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280', // gray
]

export function createTag(overrides: Partial<Tag> = {}): Tag {
  const id = overrides.id || nanoid(12)
  const name = overrides.name || `Tag ${id.slice(0, 4)}`
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    organizationId: 'test-org',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

// Create multiple tags
export function createTags(count: number, overrides: Partial<Tag> = {}): Tag[] {
  return Array.from({ length: count }, () => createTag(overrides))
}

// Create tags with specific names
export function createNamedTags(names: string[]): Tag[] {
  return names.map((name) => createTag({ name }))
}
