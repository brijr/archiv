import { env } from "cloudflare:workers";
import { eq, and } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { members } from "@/db/schema";

export type AuthContext = {
  userId: string;
  organizationId: string;
  role: "owner" | "admin" | "member";
};

// Get auth context - returns default org for development
// In production, this would validate cookies/session
export function getAuthContext(): AuthContext {
  // Default context using the default organization created during migration
  return {
    userId: "dev-user",
    organizationId: "default-org",
    role: "owner",
  };
}

// Helper to get auth from request headers (for API routes)
export async function getAuthFromRequest(request: Request): Promise<AuthContext | null> {
  try {
    const auth = getAuth(env as any);
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      return null;
    }

    const activeOrgId = session.session.activeOrganizationId;

    if (!activeOrgId) {
      return null;
    }

    // Verify membership
    const db = getDb(env.DB);
    const membership = await db.query.members.findFirst({
      where: and(
        eq(members.organizationId, activeOrgId),
        eq(members.userId, session.user.id)
      ),
    });

    if (!membership) {
      return null;
    }

    return {
      userId: session.user.id,
      organizationId: activeOrgId,
      role: membership.role as "owner" | "admin" | "member",
    };
  } catch {
    return null;
  }
}
