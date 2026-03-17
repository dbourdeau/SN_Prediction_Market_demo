-- ============================================================
-- Migration V3: Fixes, constraints, auto-close, moderation
-- Safe to run multiple times (idempotent)
-- Run this in Supabase SQL Editor
-- ============================================================

-- ==================== BALANCE CONSTRAINT ====================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_balance_non_negative') THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_balance_non_negative CHECK (balance >= 0);
    END IF;
END $$;

-- ==================== INPUT LENGTH CONSTRAINTS ====================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'markets_title_length') THEN
        ALTER TABLE markets ADD CONSTRAINT markets_title_length CHECK (char_length(title) <= 200);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'markets_desc_length') THEN
        ALTER TABLE markets ADD CONSTRAINT markets_desc_length CHECK (char_length(description) <= 5000);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comments_text_length') THEN
        ALTER TABLE comments ADD CONSTRAINT comments_text_length CHECK (char_length(text) <= 2000);
    END IF;
END $$;

-- ==================== MARKET EDITING ====================

ALTER TABLE markets ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

DROP POLICY IF EXISTS "Market creators can update their markets" ON markets;
DROP POLICY IF EXISTS "Authenticated users can update markets" ON markets;
CREATE POLICY "Authenticated users can update markets" ON markets
    FOR UPDATE TO authenticated USING (true);

-- ==================== COMMENT MODERATION ====================

ALTER TABLE comments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);

DROP POLICY IF EXISTS "Users can create own comments" ON comments;
CREATE POLICY "Users can create own comments" ON comments
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Comments can be updated" ON comments;
CREATE POLICY "Comments can be updated" ON comments
    FOR UPDATE TO authenticated USING (true);

-- ==================== CAP HISTORY ARRAY ====================

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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'predictions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE predictions;
    END IF;
END $$;

-- ==================== DELETE POLICY FOR NOTIFICATIONS ====================

DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications" ON notifications
    FOR DELETE TO authenticated USING (auth.uid() = user_id);
