import type { InferSelectModel } from "drizzle-orm";
import type { folders, assets, tags, apiKeys } from "@/db/schema";

// Base types from schema
export type Folder = InferSelectModel<typeof folders>;
export type Asset = InferSelectModel<typeof assets>;
export type Tag = InferSelectModel<typeof tags>;
export type ApiKey = InferSelectModel<typeof apiKeys>;

// Extended types
export type AssetWithTags = Asset & { tags: Tag[] };

export type FolderWithChildren = Folder & {
  children: FolderWithChildren[];
};

export type FolderWithAssets = Folder & {
  assets: Asset[];
  subfolders: Folder[];
};

// API response types
export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

// Input types for server functions
export type CreateAssetInput = {
  filename: string;
  r2Key: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  folderId?: string;
};

export type UpdateAssetInput = {
  id: string;
  altText?: string;
  description?: string;
  folderId?: string | null;
};

export type CreateFolderInput = {
  name: string;
  parentId?: string;
};

export type UpdateFolderInput = {
  id: string;
  name: string;
};

export type CreateTagInput = {
  name: string;
  color?: string;
};

export type UpdateTagInput = {
  id: string;
  name?: string;
  color?: string;
};

// API scopes
export type ApiScope = "read" | "write" | "delete";

// Filter options
export type AssetFilters = {
  folderId?: string;
  tagId?: string;
  mimeType?: string;
  search?: string;
};

// Embedding status types
export type EmbeddingStatus = "pending" | "processing" | "completed" | "failed";

// Vector search result
export type VectorSearchResult = {
  asset: Asset & { url: string };
  score: number;
  matchType: "semantic" | "keyword" | "both";
};

// Backfill status
export type BackfillStatus = {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
};

// Vector search input
export type VectorSearchInput = {
  query: string;
  limit?: number;
  folderId?: string;
  tagIds?: string[];
  mimeTypePrefix?: string;
  minScore?: number;
};
