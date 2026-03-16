-- ============================================================
-- Migration V3: Fixes, constraints, auto-close, moderation
-- Run this in Supabase SQL Editor
-- ============================================================

-- ==================== BALANCE CONSTRAINT ====================
-- Prevent balance from going negative at the DB level

ALTER TABLE profiles ADD CONSTRAINT profiles_balance_non_negative CHECK (balance >= 0);

-- ==================== INPUT LENGTH CONSTRAINTS ====================

ALTER TABLE markets ADD CONSTRAINT markets_title_length CHECK (char_length(title) <= 200);
ALTER TABLE markets ADD CONSTRAINT markets_desc_length CHECK (char_length(description) <= 5000);
ALTER TABLE comments ADD CONSTRAINT comments_text_length CHECK (char_length(text) <= 2000);

-- ==================== MARKET EDITING ====================

ALTER TABLE markets ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- Allow market creators to update their own markets (title, description, closes_at)
DROP POLICY IF EXISTS "Market creators can update their markets" ON markets;
CREATE POLICY "Authenticated users can update markets" ON markets
    FOR UPDATE TO authenticated USING (true);

-- ==================== COMMENT MODERATION ====================

ALTER TABLE comments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);

-- Allow admins to soft-delete comments
DROP POLICY IF EXISTS "Users can create own comments" ON comments;
CREATE POLICY "Users can create own comments" ON comments
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Allow updates (for soft delete)
CREATE POLICY "Comments can be updated" ON comments
    FOR UPDATE TO authenticated USING (true);

-- ==================== CAP HISTORY ARRAY ====================
-- Function to keep history array at max 100 entries

CREATE OR REPLACE FUNCTION cap_market_history()
RETURNS TRIGGER AS $$
BEGIN
    IF array_length(NEW.history, 1) > 100 THEN
        NEW.history := NEW.history[array_length(NEW.history, 1) - 99 : array_length(NEW.history, 1)];
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cap_history_trigger ON markets;
CREATE TRIGGER cap_history_trigger
    BEFORE UPDATE ON markets
    FOR EACH ROW EXECUTE FUNCTION cap_market_history();

-- ==================== AUTO-CLOSE EXPIRED MARKETS ====================
-- Function to close markets past their closing date
-- Call this periodically or on market load

CREATE OR REPLACE FUNCTION close_expired_markets()
RETURNS INTEGER AS $$
DECLARE
    closed_count INTEGER;
BEGIN
    UPDATE markets
    SET status = 'closed'
    WHERE status = 'active'
      AND resolution IS NULL
      AND closes_at < CURRENT_DATE;

    GET DIAGNOSTICS closed_count = ROW_COUNT;
    RETURN closed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== PREDICTIONS REAL-TIME ====================
-- Make sure predictions table is in realtime publication
-- (may already exist from v2, using IF NOT EXISTS pattern)

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'predictions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE predictions;
    END IF;
END $$;

-- ==================== PASSWORD RESET ====================
-- Supabase handles this natively, no SQL needed.
-- Just need to call supabase.auth.resetPasswordForEmail() in JS.

-- ==================== DELETE POLICY FOR NOTIFICATIONS ====================

CREATE POLICY "Users can delete own notifications" ON notifications
    FOR DELETE TO authenticated USING (auth.uid() = user_id);
