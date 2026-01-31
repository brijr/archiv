# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev             # Start dev server on port 3000
pnpm build           # Build for production
pnpm deploy          # Build + deploy to Cloudflare Workers

pnpm test            # Run all tests once
pnpm test:watch      # Run tests in watch mode
pnpm test:ui         # Run tests with Vitest UI
pnpm test:unit       # Run only unit tests
pnpm test:integration    # Run only integration tests
pnpm test:components     # Run only component tests

pnpm cf-typegen      # Generate Cloudflare types from wrangler.jsonc
```

### Database Migrations

```bash
pnpm drizzle-kit generate                    # Generate migration from schema changes
pnpm drizzle-kit push                        # Push schema to local D1 (dev)
CLOUDFLARE_ACCOUNT_ID=<id> pnpm wrangler d1 execute archiv-db --remote --file=./drizzle/<migration>.sql  # Apply to prod
```

Note: D1 doesn't support `DEFAULT (unixepoch())` in ALTER TABLE. Use nullable columns or constant defaults for migrations.

## Architecture

This is a **TanStack Start** full-stack React app deployed to **Cloudflare Workers**. It's a Digital Asset Management (DAM) system with multi-tenant workspaces.

### Tech Stack
- **Framework**: TanStack Start (React 19 + TanStack Router)
- **Database**: Drizzle ORM + Cloudflare D1 (SQLite)
- **Auth**: Better Auth with organization plugin
- **Storage**: Cloudflare R2 for assets
- **Styling**: Tailwind CSS v4 + shadcn/ui components

### Key Directories
- `src/routes/` - File-based routing (TanStack Router)
- `src/lib/server/` - Server functions (RPC-style API)
- `src/lib/` - Auth, database, R2, utilities
- `src/db/schema.ts` - Drizzle schema (all tables)
- `src/components/ui/` - shadcn/radix components
- `worker-app.ts` - Cloudflare Worker entry point

### Routing Patterns
- `index.tsx` → `/`
- `asset.$id.tsx` → `/asset/:id` (dynamic route)
- `folder.$slug.tsx` → `/folder/:slug`
- `settings/api-keys.tsx` → `/settings/api-keys`
- `__root.tsx` → Root layout wrapper

### Server Functions
Server functions in `src/lib/server/` use `createServerFn()` from TanStack Start. They are called like regular functions but execute on the server:

```typescript
import { createServerFn } from "@tanstack/react-start";

export const getAssets = createServerFn({ method: "GET" })
  .validator((data: GetAssetsInput) => data)
  .handler(async ({ data }) => {
    const ctx = await getAuthContext();
    // ... database operations
  });
```

### Authentication Pattern
All authenticated server functions call `getAuthContext()` which:
1. Extracts session from request headers
2. Verifies user is authenticated
3. Verifies user belongs to the active organization
4. Returns `{ userId, organizationId, role }`

### Multi-Tenancy
Every resource (assets, folders, tags) has an `organizationId` field. Server functions always filter by the user's active organization from auth context.

### Path Aliases
Use `@/` for imports from `src/`:
```typescript
import { Button } from "@/components/ui/button";
import { getAuthContext } from "@/lib/server/auth-helpers";
```

### Cloudflare Bindings
Access via `import { env } from "cloudflare:workers"`:
- `env.DB` - D1 database
- `env.BUCKET` - R2 storage bucket
- `env.AUTH_KV` - KV namespace for session cache
- `env.VECTORIZE` - Vectorize index for semantic search
- `env.AI` - Workers AI for embedding generation
- `env.EMBEDDING_QUEUE` - Queue for async embedding jobs

### Semantic Search Architecture
Assets are embedded for vector search using `@cf/baai/bge-base-en-v1.5`. The flow:
1. Asset upload → `queueEmbedding()` sends message to `EMBEDDING_QUEUE`
2. Queue consumer in `worker-app.ts` calls `generateAssetEmbedding()`
3. Embedding text composed from: filename, altText, description, tags
4. Vector stored in Vectorize with metadata (organizationId, folderId, mimeType)
5. `embeddingStatus` field tracks: "pending" → "processing" → "completed" | "failed"

### Worker Entry Point
`worker-app.ts` handles:
- `/api/auth/*` → Better Auth handler
- `/api/v1/oembed` → oEmbed API for Notion/Slack embeds
- Queue consumer for embedding jobs
- All other routes → TanStack Start SSR

### Component Patterns
- UI components: `src/components/ui/` (shadcn, don't edit directly)
- Feature components: `src/components/` (app-specific)
- Dialogs: `src/components/dialogs/`
- Layout: `AppLayout.tsx` handles auth redirects, `AppSidebar.tsx` is main nav
