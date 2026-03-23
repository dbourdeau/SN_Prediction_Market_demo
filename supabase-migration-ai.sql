-- Migration: AI Integration — secure API key storage
-- Run this in your Supabase SQL Editor.
--
-- Stores the Claude API key in a table with NO read policy (invisible to client).
-- A SECURITY DEFINER function lets authenticated users fetch it at runtime.
-- The actual Claude API call happens in the browser (js/ai.js).

-- 1. Config table for secrets
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT/UPDATE/DELETE policies — only SECURITY DEFINER functions can access

-- 2. Insert your API key (REPLACE with your actual key!)
INSERT INTO app_config (key, value)
VALUES ('anthropic_api_key', 'YOUR_CLAUDE_API_KEY_HERE')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 3. RPC to fetch the key (authenticated users only)
-- SET search_path = public is required for SECURITY DEFINER to resolve the table
CREATE OR REPLACE FUNCTION public.get_ai_key()
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT value INTO result FROM public.app_config WHERE key = 'anthropic_api_key';
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
