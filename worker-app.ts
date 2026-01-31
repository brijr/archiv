import { getAuth } from "@/lib/auth";
import { handleEmbeddingQueue, type EmbeddingMessage } from "@/lib/queue-handler";

// This is the main worker entry point
// It intercepts auth API requests and routes them to Better Auth
export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle Better Auth API routes
    if (url.pathname.startsWith("/api/auth")) {
      try {
        const auth = getAuth(env);
        return await auth.handler(request);
      } catch (error) {
        console.error("Auth error:", error);
        return new Response(JSON.stringify({ error: String(error) }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Handle oEmbed API for Notion/Slack/etc integrations (dynamic import to avoid bundling issues)
    if (url.pathname === "/api/v1/oembed") {
      const { handleOEmbed } = await import("@/lib/api/oembed");
      return handleOEmbed(request, env);
    }

    // For other routes, let TanStack Start handle them
    // This will be imported dynamically to avoid circular dependencies
    const { default: tanstackHandler } = await import("@tanstack/react-start/server-entry");
    return tanstackHandler.fetch(request, env, ctx);
  },

  // Queue consumer for embedding jobs
  async queue(batch: MessageBatch<EmbeddingMessage>, env: Env): Promise<void> {
    await handleEmbeddingQueue(batch, env);
  },
};
