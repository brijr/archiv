import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from "drizzle-orm/sqlite-core";

// ============================================================================
// Better Auth Tables
// ============================================================================

// Users
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// Sessions
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  activeOrganizationId: text("active_organization_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// Accounts (OAuth providers, email/password)
export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// Verifications (email verification, password reset)
export const verifications = sqliteTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// Organizations (workspaces/tenants)
export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// Organization Members
export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // owner, admin, member
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
}, (table) => [
  uniqueIndex("members_org_user_idx").on(table.organizationId, table.userId),
]);

// Organization Invitations
export const invitations = sqliteTable("invitations", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("pending"), // pending, accepted, rejected, expired
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// ============================================================================
// Application Tables (with multi-tenancy)
// ============================================================================

// Folders for organization
export const folders = sqliteTable("folders", {
  id: text("id").primaryKey(), // nanoid
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  parentId: text("parent_id").references((): ReturnType<typeof text> => folders.id, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
}, (table) => [
  uniqueIndex("folders_org_slug_idx").on(table.organizationId, table.slug),
  index("folders_org_idx").on(table.organizationId),
]);

// Assets (images, files)
export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(), // nanoid
  filename: text("filename").notNull(), // original filename
  r2Key: text("r2_key").notNull().unique(), // path in R2 bucket
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(), // bytes
  width: integer("width"), // for images
  height: integer("height"), // for images
  altText: text("alt_text"),
  description: text("description"),
  folderId: text("folder_id").references(() => folders.id, { onDelete: "set null" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  // AI-generated caption for images
  aiCaption: text("ai_caption"), // AI-generated description of image content
  aiCaptionModel: text("ai_caption_model"), // Model used (e.g., "@cf/unum/uform-gen2-qwen-500m")
  // Embedding status for semantic search
  embeddingStatus: text("embedding_status").default("pending"), // "pending" | "processing" | "completed" | "failed"
  embeddingError: text("embedding_error"), // Error message if failed
  embeddedAt: integer("embedded_at", { mode: "timestamp" }), // When embedding was completed
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
}, (table) => [
  index("assets_org_idx").on(table.organizationId),
  index("assets_org_folder_idx").on(table.organizationId, table.folderId),
  index("assets_embedding_status_idx").on(table.embeddingStatus),
]);

// Tags
export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  color: text("color"), // hex color for UI
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
}, (table) => [
  uniqueIndex("tags_org_name_idx").on(table.organizationId, table.name),
  uniqueIndex("tags_org_slug_idx").on(table.organizationId, table.slug),
  index("tags_org_idx").on(table.organizationId),
]);

// Asset-Tag junction table
export const assetTags = sqliteTable(
  "asset_tags",
  {
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.assetId, table.tagId] })]
);

// API Keys for REST API
export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(), // nanoid
  name: text("name").notNull(), // "Vercel Deploy", "Raycast Script", etc.
  keyHash: text("key_hash").notNull(), // SHA-256 hash of the key
  keyPrefix: text("key_prefix").notNull(), // First 15 chars for identification (archiv_a1b2c3d4)
  scopes: text("scopes", { mode: "json" }).$type<string[]>().default(["read"]), // ["read", "write", "delete"]
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
}, (table) => [
  index("api_keys_org_idx").on(table.organizationId),
]);

// Share Links for public asset/folder access (Slack/Notion/external sharing)
export const shareLinks = sqliteTable("share_links", {
  id: text("id").primaryKey(), // nanoid
  token: text("token").notNull().unique(), // Secure random token for URL
  assetId: text("asset_id").references(() => assets.id, { onDelete: "cascade" }),
  folderId: text("folder_id").references(() => folders.id, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }), // null = never expires
  allowDownload: integer("allow_download", { mode: "boolean" }).default(true),
  viewCount: integer("view_count").default(0),
  maxViews: integer("max_views"), // null = unlimited
  createdById: text("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
}, (table) => [
  index("share_links_token_idx").on(table.token),
  index("share_links_asset_idx").on(table.assetId),
  index("share_links_folder_idx").on(table.folderId),
  index("share_links_org_idx").on(table.organizationId),
]);

// ============================================================================
// Type exports
// ============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type Folder = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;
export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type ShareLink = typeof shareLinks.$inferSelect;
export type NewShareLink = typeof shareLinks.$inferInsert;
