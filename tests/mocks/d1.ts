import Database from 'better-sqlite3'

// SQL to create the schema (matching src/db/schema.ts)
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  alt_text TEXT,
  description TEXT,
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  color TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS asset_tags (
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (asset_id, tag_id)
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  scopes TEXT DEFAULT '["read"]',
  last_used_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`

interface D1Result<T = unknown> {
  results: T[]
  success: boolean
  meta: { changes: number; last_row_id: number; duration: number }
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = unknown>(colName?: string): Promise<T | null>
  run(): Promise<D1Result>
  all<T = unknown>(): Promise<D1Result<T>>
  raw<T = unknown>(): Promise<T[]>
}

export function createMockD1Database() {
  const db = new Database(':memory:')

  // Enable foreign keys
  db.pragma('foreign_keys = ON')

  // Initialize schema
  db.exec(SCHEMA_SQL)

  const d1: {
    prepare(query: string): D1PreparedStatement
    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
    exec(query: string): Promise<{ count: number; duration: number }>
    dump(): Promise<ArrayBuffer>
    _db: Database.Database
    _reset(): void
  } = {
    prepare(query: string): D1PreparedStatement {
      let boundValues: unknown[] = []

      const statement: D1PreparedStatement = {
        bind(...values: unknown[]) {
          boundValues = values
          return statement
        },
        async first<T = unknown>(colName?: string): Promise<T | null> {
          try {
            const stmt = db.prepare(query)
            const row = stmt.get(...boundValues) as Record<string, unknown> | undefined
            if (!row) return null
            if (colName) return row[colName] as T
            return row as T
          } catch (error) {
            console.error('D1 first() error:', error, 'Query:', query)
            throw error
          }
        },
        async run(): Promise<D1Result> {
          try {
            const stmt = db.prepare(query)
            const result = stmt.run(...boundValues)
            return {
              results: [],
              success: true,
              meta: {
                changes: result.changes,
                last_row_id: Number(result.lastInsertRowid),
                duration: 0,
              },
            }
          } catch (error) {
            console.error('D1 run() error:', error, 'Query:', query)
            throw error
          }
        },
        async all<T = unknown>(): Promise<D1Result<T>> {
          try {
            const stmt = db.prepare(query)
            const results = stmt.all(...boundValues) as T[]
            return {
              results,
              success: true,
              meta: { changes: 0, last_row_id: 0, duration: 0 },
            }
          } catch (error) {
            console.error('D1 all() error:', error, 'Query:', query)
            throw error
          }
        },
        async raw<T = unknown>(): Promise<T[]> {
          try {
            const stmt = db.prepare(query)
            return stmt.raw().all(...boundValues) as T[]
          } catch (error) {
            console.error('D1 raw() error:', error, 'Query:', query)
            throw error
          }
        },
      }

      return statement
    },

    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      return Promise.all(statements.map((s) => s.all() as Promise<D1Result<T>>))
    },

    async exec(query: string): Promise<{ count: number; duration: number }> {
      db.exec(query)
      return { count: 1, duration: 0 }
    },

    async dump(): Promise<ArrayBuffer> {
      return db.serialize().buffer as ArrayBuffer
    },

    // Expose for debugging
    _db: db,

    // Reset database for clean test state
    _reset() {
      db.exec(`
        DELETE FROM asset_tags;
        DELETE FROM assets;
        DELETE FROM folders;
        DELETE FROM tags;
        DELETE FROM api_keys;
      `)
    },
  }

  return d1
}

export type MockD1Database = ReturnType<typeof createMockD1Database>
