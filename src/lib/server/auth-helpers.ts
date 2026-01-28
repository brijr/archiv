import { env } from "cloudflare:workers";
import { eq, and } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { members } from "@/db/schema";
import { getRequest } from "@tanstack/react-start/server";

export type AuthContext = {
  userId: string;
  organizationId: string;
  role: "owner" | "admin" | "member";
};

/**
 * Get auth context from the current request.
 * Returns the authenticated user's context including their active organization.
 * Throws an error if not authenticated or no active organization.
 */
export async function getAuthContext(): Promise<AuthContext> {
  const request = getRequest();

  const auth = getAuth(env as any);
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user) {
    throw new Error("Not authenticated");
  }

  const activeOrgId = session.session.activeOrganizationId;

  if (!activeOrgId) {
    throw new Error("No active organization");
  }

  // Verify membership and get role
  const db = getDb(env.DB);
  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.organizationId, activeOrgId),
      eq(members.userId, session.user.id)
    ),
  });

  if (!membership) {
    throw new Error("Not a member of this organization");
  }

  return {
    userId: session.user.id,
    organizationId: activeOrgId,
    role: membership.role as "owner" | "admin" | "member",
  };
}

/**
 * Get auth context or return null if not authenticated.
 * Use this for optional auth scenarios.
 */
export async function getAuthContextOptional(): Promise<AuthContext | null> {
  try {
    return await getAuthContext();
  } catch {
    return null;
  }
}

/**
 * Helper to get auth from request headers (for API routes).
 * @deprecated Use getAuthContext() instead which automatically gets the request.
 */
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
