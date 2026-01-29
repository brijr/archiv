import Database from 'better-sqlite3'

// SQL to create the schema (matching src/db/schema.ts)
const SCHEMA_SQL = `
-- Better Auth tables
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER DEFAULT 0,
  image TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active_organization_id TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  access_token_expires_at INTEGER,
  refresh_token_expires_at INTEGER,
  scope TEXT,
  id_token TEXT,
  password TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS verifications (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo TEXT,
  metadata TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at INTEGER NOT NULL,
  inviter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Application tables with multi-tenancy
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS folders_org_slug_idx ON folders(organization_id, slug);
CREATE INDEX IF NOT EXISTS folders_org_idx ON folders(organization_id);

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
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS assets_org_idx ON assets(organization_id);
CREATE INDEX IF NOT EXISTS assets_org_folder_idx ON assets(organization_id, folder_id);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  color TEXT,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS tags_org_name_idx ON tags(organization_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS tags_org_slug_idx ON tags(organization_id, slug);
CREATE INDEX IF NOT EXISTS tags_org_idx ON tags(organization_id);

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
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  last_used_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS api_keys_org_idx ON api_keys(organization_id);
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
        DELETE FROM invitations;
        DELETE FROM members;
        DELETE FROM sessions;
        DELETE FROM accounts;
        DELETE FROM organizations;
        DELETE FROM users;
        DELETE FROM verifications;
      `)
      // Insert test organization for tests
      db.exec(`
        INSERT INTO organizations (id, name, slug) VALUES ('test-org', 'Test Organization', 'test-org');
        INSERT INTO users (id, name, email) VALUES ('test-user', 'Test User', 'test@example.com');
        INSERT INTO members (id, organization_id, user_id, role) VALUES ('test-member', 'test-org', 'test-user', 'owner');
      `)
    },
  }

  return d1
}

export type MockD1Database = ReturnType<typeof createMockD1Database>
