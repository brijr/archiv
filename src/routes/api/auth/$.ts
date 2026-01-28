import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { env } from "cloudflare:workers";
import { getAuth } from "@/lib/auth";

// Handle all auth API routes using TanStack Start API routes
export const APIRoute = createAPIFileRoute("/api/auth/$")({
  GET: async ({ request }: { request: Request }) => {
    const auth = getAuth(env as any);
    return auth.handler(request);
  },
  POST: async ({ request }: { request: Request }) => {
    const auth = getAuth(env as any);
    return auth.handler(request);
  },
});
