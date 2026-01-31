# Archiv

A modern Digital Asset Management (DAM) system built with TanStack Start and deployed to Cloudflare Workers. Multi-tenant workspaces, semantic search, and shareable links.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [TanStack Start](https://tanstack.com/start) (React 19 + TanStack Router) |
| Database | [Drizzle ORM](https://orm.drizzle.team/) + Cloudflare D1 (SQLite) |
| Auth | [Better Auth](https://www.better-auth.com/) with organization plugin |
| Storage | Cloudflare R2 |
| Search | Cloudflare Vectorize + Workers AI |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Runtime | Cloudflare Workers |

## Quick Start

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) 9+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`pnpm add -g wrangler`)
- Cloudflare account (for D1, R2, Vectorize, Workers AI)

### Local Development

```bash
# Install dependencies
pnpm install

# Generate Cloudflare types
pnpm cf-typegen

# Start dev server (port 3000)
pnpm dev
```

### Environment Setup

Create Cloudflare resources and configure `wrangler.jsonc`:

```bash
# Create D1 database
wrangler d1 create archiv-db

# Create R2 bucket
wrangler r2 bucket create archiv-assets

# Create KV namespace for auth sessions
wrangler kv namespace create AUTH_KV

# Create Vectorize index (768 dimensions for bge-base-en-v1.5)
wrangler vectorize create archiv-assets --dimensions=768 --metric=cosine

# Create embedding queue
wrangler queues create archiv-embedding-queue
```

Update the IDs in `wrangler.jsonc` with the values from each command.

### Secrets

```bash
# Generate a secure secret for Better Auth
wrangler secret put BETTER_AUTH_SECRET
```

## Project Structure

```
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn/ui components (don't edit directly)
│   │   ├── dialogs/         # Modal dialogs
│   │   ├── AppLayout.tsx    # Auth wrapper + sidebar layout
│   │   └── AppSidebar.tsx   # Main navigation
│   ├── db/
│   │   └── schema.ts        # Drizzle schema (all tables)
│   ├── lib/
│   │   ├── server/          # Server functions (RPC-style API)
│   │   │   ├── assets.ts    # Asset CRUD + upload
│   │   │   ├── folders.ts   # Folder management
│   │   │   ├── tags.ts      # Tag management
│   │   │   ├── search.ts    # Text search
│   │   │   ├── vector-search.ts  # Semantic search
│   │   │   ├── embeddings.ts     # Vector embedding logic
│   │   │   ├── share.ts     # Share links
│   │   │   └── auth-helpers.ts   # Auth context utilities
│   │   ├── auth.ts          # Better Auth configuration
│   │   ├── auth-client.ts   # Client-side auth hooks
│   │   ├── db.ts            # Drizzle client factory
│   │   ├── r2.ts            # R2 storage utilities
│   │   └── types.ts         # Shared TypeScript types
│   └── routes/              # File-based routing
│       ├── __root.tsx       # Root layout
│       ├── index.tsx        # Dashboard
│       ├── asset.$id.tsx    # Asset detail view
│       ├── folder.$slug.tsx # Folder view
│       ├── search.tsx       # Search results
│       ├── tags.tsx         # Tag management
│       ├── upload.tsx       # Upload page
│       ├── login.tsx        # Login page
│       ├── register.tsx     # Registration page
│       ├── s.$token.tsx     # Public share page
│       ├── embed.$token.tsx # oEmbed endpoint
│       ├── workspace/       # Workspace management
│       └── settings/        # Settings pages
├── drizzle/                 # SQL migrations
├── tests/                   # Test files
│   ├── unit/               # Unit tests
│   ├── integration/        # Server function tests
│   ├── components/         # Component tests
│   ├── mocks/              # Test mocks (D1, R2, auth)
│   └── fixtures/           # Test data
├── worker-app.ts            # Cloudflare Worker entry point
├── wrangler.jsonc           # Cloudflare configuration
└── drizzle.config.ts        # Drizzle Kit configuration
```

## Development

### Commands

```bash
pnpm dev                # Start dev server on port 3000
pnpm build              # Build for production
pnpm deploy             # Build + deploy to Cloudflare Workers

pnpm test               # Run all tests once
pnpm test:watch         # Run tests in watch mode
pnpm test:ui            # Run tests with Vitest UI
pnpm test:unit          # Run only unit tests
pnpm test:integration   # Run only integration tests
pnpm test:components    # Run only component tests

pnpm cf-typegen         # Generate Cloudflare types from wrangler.jsonc
```

### Database Migrations

```bash
# Generate migration from schema changes
pnpm drizzle-kit generate

# Push schema to local D1 (dev)
pnpm drizzle-kit push

# Apply migration to production
CLOUDFLARE_ACCOUNT_ID=<id> wrangler d1 execute archiv-db --remote --file=./drizzle/<migration>.sql
```

**Note:** D1 doesn't support `DEFAULT (unixepoch())` in ALTER TABLE statements. When adding new columns, use nullable columns or constant defaults.

### Adding UI Components

This project uses [shadcn/ui](https://ui.shadcn.com/). Add components with:

```bash
pnpm dlx shadcn@latest add <component-name>
```

Components are added to `src/components/ui/`. Don't edit these directly—customize by wrapping or extending.

## Architecture

### Server Functions

Server functions in `src/lib/server/` use TanStack Start's `createServerFn()`. They're called like regular functions but execute on the server:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { getAuthContext } from "@/lib/server/auth-helpers";

export const getAssets = createServerFn({ method: "GET" })
  .validator((data: { page?: number }) => data)
  .handler(async ({ data }) => {
    const ctx = await getAuthContext();  // Always authenticate first
    // ... database operations scoped to ctx.organizationId
  });
```

### Authentication

All authenticated endpoints call `getAuthContext()` which:
1. Extracts session from request headers
2. Verifies user is authenticated
3. Verifies user belongs to the active organization
4. Returns `{ userId, organizationId, role }`

### Multi-Tenancy

Every resource has an `organizationId` field. Server functions always filter by the user's active organization:

```typescript
const assets = await db.query.assets.findMany({
  where: eq(assets.organizationId, ctx.organizationId),
});
```

R2 keys are prefixed with `{organizationId}/` for storage isolation.

### Semantic Search

Assets are embedded for vector search using Workers AI (`@cf/baai/bge-base-en-v1.5`):

1. Asset uploaded → `queueEmbedding()` sends message to queue
2. Queue consumer calls `generateAssetEmbedding()`
3. Text composed from: filename, altText, description, tags
4. Vector stored in Vectorize with metadata
5. `embeddingStatus` tracks progress: `pending` → `processing` → `completed` | `failed`

### Worker Entry Point

`worker-app.ts` routes requests:
- `/api/auth/*` → Better Auth
- `/api/v1/oembed` → oEmbed API (for Notion/Slack)
- Queue messages → Embedding consumer
- Everything else → TanStack Start SSR

## Routing

File-based routing with TanStack Router:

| File | Route |
|------|-------|
| `index.tsx` | `/` |
| `asset.$id.tsx` | `/asset/:id` |
| `folder.$slug.tsx` | `/folder/:slug` |
| `settings/api-keys.tsx` | `/settings/api-keys` |
| `__root.tsx` | Root layout wrapper |

## Cloudflare Bindings

Access via `import { env } from "cloudflare:workers"`:

| Binding | Type | Purpose |
|---------|------|---------|
| `env.DB` | D1Database | SQLite database |
| `env.BUCKET` | R2Bucket | Asset storage |
| `env.AUTH_KV` | KVNamespace | Session cache |
| `env.VECTORIZE` | VectorizeIndex | Semantic search |
| `env.AI` | Ai | Embedding generation |
| `env.EMBEDDING_QUEUE` | Queue | Async embedding jobs |

## Testing

Tests use Vitest with mocks for Cloudflare services:

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm vitest run tests/unit/lib/utils.test.ts

# Run tests matching a pattern
pnpm vitest run -t "should upload"
```

Test mocks are in `tests/mocks/`:
- `d1.ts` - In-memory SQLite via better-sqlite3
- `r2.ts` - Mock R2 bucket
- `auth.ts` - Mock auth context
- `cloudflare.ts` - Mock `cloudflare:workers` module

## Deployment

```bash
# Deploy to Cloudflare Workers
pnpm deploy
```

Ensure all secrets are set:
```bash
wrangler secret put BETTER_AUTH_SECRET
```

## Path Aliases

Use `@/` for imports from `src/`:

```typescript
import { Button } from "@/components/ui/button";
import { getAuthContext } from "@/lib/server/auth-helpers";
import { assets } from "@/db/schema";
```

## License

Private
