import { getAuth } from "@/lib/auth";

// This is the main worker entry point
// It intercepts auth API requests and routes them to Better Auth
export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle Better Auth API routes
    if (url.pathname.startsWith("/api/auth")) {
      const auth = getAuth(env);
      return auth.handler(request);
    }

    // For other routes, let TanStack Start handle them
    // This will be imported dynamically to avoid circular dependencies
    const { default: tanstackHandler } = await import("@tanstack/react-start/server-entry");
    return tanstackHandler.fetch(request, env, ctx);
  },
};
