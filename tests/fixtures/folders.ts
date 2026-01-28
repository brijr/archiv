import { nanoid } from 'nanoid'
import type { Folder, FolderWithChildren } from '@/lib/types'

export function createFolder(overrides: Partial<Folder> = {}): Folder {
  const id = overrides.id || nanoid(12)
  const name = overrides.name || `Test Folder ${id.slice(0, 4)}`
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    parentId: null,
    createdAt: new Date(),
    ...overrides,
  }
}

export function createFolderWithChildren(
  overrides: Partial<Folder> = {},
  children: FolderWithChildren[] = []
): FolderWithChildren {
  const folder = createFolder(overrides)
  return {
    ...folder,
    children,
  }
}

export function createFolderTree(
  depth = 2,
  childrenPerLevel = 2
): FolderWithChildren[] {
  function buildLevel(
    parentId: string | null,
    currentDepth: number
  ): FolderWithChildren[] {
    if (currentDepth >= depth) return []

    return Array.from({ length: childrenPerLevel }, (_, i) => {
      const folder = createFolder({
        parentId,
        name: `Folder D${currentDepth} C${i}`,
      })
      return {
        ...folder,
        children: buildLevel(folder.id, currentDepth + 1),
      }
    })
  }

  return buildLevel(null, 0)
}

// Create multiple folders (flat list)
export function createFolders(count: number, overrides: Partial<Folder> = {}): Folder[] {
  return Array.from({ length: count }, () => createFolder(overrides))
}
