import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

// Folders for organization
export const folders = sqliteTable("folders", {
  id: text("id").primaryKey(), // nanoid
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  parentId: text("parent_id").references((): ReturnType<typeof text> => folders.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

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
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// Tags
export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  color: text("color"), // hex color for UI
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

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
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});
