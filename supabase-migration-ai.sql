-- Migration: AI Integration (Claude API via Postgres HTTP extension)
-- Run this in your Supabase SQL Editor.
--
-- This creates two RPC functions that call the Claude API server-side.
-- The API key is stored in a config table — never exposed to the browser.

-- 1. Enable the HTTP extension (makes HTTP calls from Postgres)
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- 2. Config table for secrets (only admins can read)
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- No SELECT policy for regular users — only SECURITY DEFINER functions can read it
-- This means the API key is completely invisible to the browser/client

-- 3. Insert your API key (REPLACE with your actual key!)
-- You can also UPDATE this later if you rotate keys.
INSERT INTO app_config (key, value)
VALUES ('anthropic_api_key', 'YOUR_CLAUDE_API_KEY_HERE')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 4. RPC: Generate market suggestions from a topic
CREATE OR REPLACE FUNCTION ai_suggest_markets(p_topic TEXT, p_category TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    api_key TEXT;
    request_body TEXT;
    response extensions.http_response;
    system_prompt TEXT;
    user_prompt TEXT;
BEGIN
    -- Only authenticated users can call this
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Get API key from config
    SELECT value INTO api_key FROM app_config WHERE key = 'anthropic_api_key';
    IF api_key IS NULL OR api_key = 'YOUR_CLAUDE_API_KEY_HERE' THEN
        RAISE EXCEPTION 'API key not configured';
    END IF;

    system_prompt := 'You are a market question generator for SharkPool, an internal prediction market at SharkNinja (consumer electronics company that makes Shark vacuums/hair tools and Ninja kitchen appliances).

Generate 3 prediction market questions based on the user''s topic. Each question should:
- Be specific and time-bound (include a date or quarter)
- Have clear YES/NO resolution criteria
- Be relevant to SharkNinja employees
- Include a suggested category from: product_launch, competitor, sales, strategy, innovation, fun

Respond with a JSON array of exactly 3 objects, each with these fields:
- "title": the market question (under 200 chars)
- "description": resolution criteria and background (200-500 chars)
- "category": one of the categories listed above
- "closes_at": suggested closing date in YYYY-MM-DD format

Respond ONLY with the JSON array, no other text.';

    user_prompt := 'Topic: ' || p_topic;
    IF p_category IS NOT NULL THEN
        user_prompt := user_prompt || E'\nPreferred category: ' || p_category;
    END IF;

    -- Build request body
    request_body := json_build_object(
        'model', 'claude-sonnet-4-20250514',
        'max_tokens', 1024,
        'system', system_prompt,
        'messages', json_build_array(
            json_build_object('role', 'user', 'content', user_prompt)
        )
    )::text;

    -- Call Claude API
    SELECT * INTO response FROM extensions.http((
        'POST',
        'https://api.anthropic.com/v1/messages',
        ARRAY[
            extensions.http_header('x-api-key', api_key),
            extensions.http_header('anthropic-version', '2023-06-01'),
            extensions.http_header('content-type', 'application/json')
        ],
        'application/json',
        request_body
    )::extensions.http_request);

    -- Check response status
    IF response.status != 200 THEN
        RAISE EXCEPTION 'Claude API error: status %, body: %', response.status, left(response.content, 200);
    END IF;

    -- Extract the text content from Claude's response
    RETURN response.content::json->'content'->0->>'text';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC: Summarize market activity
CREATE OR REPLACE FUNCTION ai_summarize_market(
    p_market_id INTEGER
)
RETURNS TEXT AS $$
DECLARE
    api_key TEXT;
    request_body TEXT;
    response extensions.http_response;
    system_prompt TEXT;
    user_prompt TEXT;
    market_rec RECORD;
    trades_summary TEXT;
    comments_summary TEXT;
    days_left INTEGER;
BEGIN
    -- Only authenticated users can call this
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Get API key
    SELECT value INTO api_key FROM app_config WHERE key = 'anthropic_api_key';
    IF api_key IS NULL OR api_key = 'YOUR_CLAUDE_API_KEY_HERE' THEN
        RAISE EXCEPTION 'API key not configured';
    END IF;

    -- Get market data
    SELECT * INTO market_rec FROM markets WHERE id = p_market_id;
    IF market_rec IS NULL THEN
        RAISE EXCEPTION 'Market not found';
    END IF;

    days_left := GREATEST(0, (market_rec.closes_at::date - CURRENT_DATE));

    -- Build trades summary (last 20)
    SELECT COALESCE(string_agg(
        p2.name || ' bet ' || pred.amount || 't on ' || UPPER(pred.direction) || ' (' || round(pred.shares::numeric, 1) || ' shares)',
        '; '
    ), 'None yet')
    INTO trades_summary
    FROM (SELECT * FROM predictions WHERE market_id = p_market_id ORDER BY created_at DESC LIMIT 20) pred
    JOIN profiles p2 ON p2.id = pred.user_id;

    -- Build comments summary (last 10)
    SELECT COALESCE(string_agg(
        p2.name || ': "' || left(c.text, 150) || '"',
        E'\n'
    ), 'No comments yet')
    INTO comments_summary
    FROM (SELECT * FROM comments WHERE market_id = p_market_id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 10) c
    JOIN profiles p2 ON p2.id = c.user_id;

    system_prompt := 'You are an analyst for SharkPool, an internal prediction market at SharkNinja. Provide a brief, insightful summary of market activity.

Your summary should be 2-4 sentences covering:
- Current market sentiment and probability trend
- Key trading patterns (large bets, recent momentum shifts)
- Notable points from the discussion (if any comments)
- What the market signal means for the underlying question

Be concise and analytical. Use plain language. Do not use markdown formatting — just plain text paragraphs.';

    user_prompt := 'Market: "' || market_rec.title || '"
Description: ' || market_rec.description || '
Current probability: ' || round(market_rec.probability * 100) || '%
Status: ' || market_rec.status || '
Volume: ' || market_rec.volume || ' tokens across ' || market_rec.traders || ' traders
Days remaining: ' || days_left || '

Recent trades: ' || trades_summary || '

Comments:
' || comments_summary;

    -- Build request body
    request_body := json_build_object(
        'model', 'claude-sonnet-4-20250514',
        'max_tokens', 512,
        'system', system_prompt,
        'messages', json_build_array(
            json_build_object('role', 'user', 'content', user_prompt)
        )
    )::text;

    -- Call Claude API
    SELECT * INTO response FROM extensions.http((
        'POST',
        'https://api.anthropic.com/v1/messages',
        ARRAY[
            extensions.http_header('x-api-key', api_key),
            extensions.http_header('anthropic-version', '2023-06-01'),
            extensions.http_header('content-type', 'application/json')
        ],
        'application/json',
        request_body
    )::extensions.http_request);

    IF response.status != 200 THEN
        RAISE EXCEPTION 'Claude API error: status %, body: %', response.status, left(response.content, 200);
    END IF;

    RETURN response.content::json->'content'->0->>'text';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
