-- Add AI captioning columns to assets table
ALTER TABLE assets ADD COLUMN ai_caption TEXT;
ALTER TABLE assets ADD COLUMN ai_caption_model TEXT;
