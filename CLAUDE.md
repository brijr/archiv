# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on port 3000
npm run build        # Build for production
npm run deploy       # Build + deploy to Cloudflare Workers

npm run test         # Run all tests once
npm run test:watch   # Run tests in watch mode
npm run test:ui      # Run tests with Vitest UI
npm run test:unit    # Run only unit tests
npm run test:integration  # Run only integration tests
npm run test:components   # Run only component tests

npm run cf-typegen   # Generate Cloudflare types from wrangler.jsonc
```

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
Access in server functions via `getCloudflareContext()`:
- `env.DB` - D1 database
- `env.BUCKET` - R2 storage bucket
- `env.AUTH_KV` - KV namespace for session cache

### Component Patterns
- UI components: `src/components/ui/` (shadcn, don't edit directly)
- Feature components: `src/components/` (app-specific)
- Dialogs: `src/components/dialogs/`
- Layout: `AppLayout.tsx` handles auth redirects, `AppSidebar.tsx` is main nav
