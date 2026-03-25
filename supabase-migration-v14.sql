-- Migration v14: Add optional source_url field to markets
-- Allows market creators to link a SharePoint file (or any URL) as the source of truth

ALTER TABLE markets ADD COLUMN IF NOT EXISTS source_url TEXT;
