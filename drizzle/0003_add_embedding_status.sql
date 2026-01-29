-- Add embedding tracking columns for semantic search
ALTER TABLE assets ADD COLUMN embedding_status TEXT DEFAULT 'pending';
ALTER TABLE assets ADD COLUMN embedding_error TEXT;
ALTER TABLE assets ADD COLUMN embedded_at INTEGER;

-- Index for finding assets that need embedding
CREATE INDEX IF NOT EXISTS assets_embedding_status_idx ON assets(embedding_status);
