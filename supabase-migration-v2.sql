-- ============================================================
-- Migration V2: Full prediction market features
-- Run this in Supabase SQL Editor AFTER the initial setup
-- ============================================================

-- ==================== SCHEMA CHANGES ====================

-- Markets: Add AMM state and resolution fields
ALTER TABLE markets ADD COLUMN IF NOT EXISTS logit REAL NOT NULL DEFAULT 0;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS q_yes REAL NOT NULL DEFAULT 0;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS q_no REAL NOT NULL DEFAULT 0;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS resolution TEXT CHECK (resolution IN ('yes', 'no', 'void'));
ALTER TABLE markets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES profiles(id);

-- Predictions: Add shares tracking and resolution status
-- Drop unique constraint to allow multiple trades per user per market
ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_user_id_market_id_key;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS shares REAL NOT NULL DEFAULT 0;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'won', 'lost', 'voided'));
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS payout REAL NOT NULL DEFAULT 0;

-- Profiles: Add admin flag
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- ==================== NOTIFICATIONS TABLE ====================

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('resolution', 'payout', 'comment', 'closing_soon', 'welcome')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    market_id INTEGER REFERENCES markets(id) ON DELETE SET NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON notifications
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ==================== UPDATE EXISTING MARKETS WITH LOGIT ====================
-- logit = ln(p / (1-p)), clamped to avoid infinity

UPDATE markets SET logit = LN(GREATEST(probability, 0.01) / GREATEST(1 - probability, 0.01))
WHERE logit = 0 AND probability != 0.5;

-- ==================== ENABLE REALTIME ====================

ALTER PUBLICATION supabase_realtime ADD TABLE markets;
ALTER PUBLICATION supabase_realtime ADD TABLE predictions;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_predictions_user ON predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_market ON predictions(market_id);
CREATE INDEX IF NOT EXISTS idx_comments_market ON comments(market_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);

-- ==================== ADMIN SETUP ====================
-- After running this, manually set yourself as admin:
-- UPDATE profiles SET is_admin = true WHERE email = 'your-email@sharkninja.com';

-- ==================== PAYOUT FUNCTION ====================
-- This function resolves a market and calculates payouts for all predictions

CREATE OR REPLACE FUNCTION resolve_market(
    p_market_id INTEGER,
    p_resolution TEXT,
    p_resolved_by UUID
) RETURNS void AS $$
DECLARE
    pred RECORD;
    v_payout REAL;
BEGIN
    -- Update market status
    UPDATE markets SET
        resolution = p_resolution,
        resolved_at = now(),
        resolved_by = p_resolved_by,
        status = 'closed'
    WHERE id = p_market_id AND resolution IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Market not found or already resolved';
    END IF;

    -- Process each active prediction
    FOR pred IN
        SELECT * FROM predictions
        WHERE market_id = p_market_id AND status = 'active'
    LOOP
        IF p_resolution = 'void' THEN
            -- Void: refund original amount
            v_payout := pred.amount;
            UPDATE predictions SET status = 'voided', payout = v_payout WHERE id = pred.id;
            UPDATE profiles SET balance = balance + v_payout WHERE id = pred.user_id;

            INSERT INTO notifications (user_id, type, title, message, market_id)
            VALUES (pred.user_id, 'payout', 'Market Voided',
                    'Market was voided. You received ' || v_payout || ' tokens back.',
                    p_market_id);

        ELSIF pred.direction = p_resolution THEN
            -- Winner: shares pay out 1 token each
            v_payout := pred.shares;
            UPDATE predictions SET status = 'won', payout = v_payout WHERE id = pred.id;
            UPDATE profiles SET
                balance = balance + v_payout,
                points = points + GREATEST(10, ROUND(v_payout - pred.amount)),
                accuracy = CASE
                    WHEN trades > 0 THEN (accuracy * trades + 1) / (trades + 1)
                    ELSE 1
                END
            WHERE id = pred.user_id;

            INSERT INTO notifications (user_id, type, title, message, market_id)
            VALUES (pred.user_id, 'payout', 'You Won!',
                    'Your prediction was correct! You earned ' || ROUND(v_payout::numeric, 1) || ' tokens.',
                    p_market_id);
        ELSE
            -- Loser: payout is 0
            UPDATE predictions SET status = 'lost', payout = 0 WHERE id = pred.id;
            UPDATE profiles SET
                accuracy = CASE
                    WHEN trades > 0 THEN (accuracy * trades) / (trades + 1)
                    ELSE 0
                END
            WHERE id = pred.user_id;

            INSERT INTO notifications (user_id, type, title, message, market_id)
            VALUES (pred.user_id, 'resolution', 'Market Resolved',
                    'Your prediction was incorrect. Better luck next time!',
                    p_market_id);
        END IF;
    END LOOP;

    -- Notify market creator
    INSERT INTO notifications (user_id, type, title, message, market_id)
    SELECT created_by, 'resolution', 'Your Market Was Resolved',
           'Your market has been resolved as ' || UPPER(p_resolution) || '.',
           p_market_id
    FROM markets WHERE id = p_market_id AND created_by IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
