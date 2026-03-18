-- ============================================================
-- Migration V4: Security hardening, transactions, scoring, watchlist
-- Safe to run multiple times (idempotent)
-- Run this in Supabase SQL Editor
-- ============================================================

-- ==================== 1. FIX RLS POLICIES ====================
-- Comments: only own comments or admin can update (for soft-delete)
DROP POLICY IF EXISTS "Comments can be updated" ON comments;
CREATE POLICY "Users can update own comments or admin" ON comments
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
    ));

-- Markets: only creator or admin can update
DROP POLICY IF EXISTS "Authenticated users can update markets" ON markets;
DROP POLICY IF EXISTS "Market creators can update their markets" ON markets;
CREATE POLICY "Market creator or admin can update" ON markets
    FOR UPDATE TO authenticated
    USING (created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
    ));

-- Predictions: allow updates (for sell, resolution status changes)
-- Only the prediction owner or admin should update
DROP POLICY IF EXISTS "Predictions can be updated" ON predictions;
CREATE POLICY "Users can update own predictions or admin" ON predictions
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
    ));

-- Profiles: allow admin to update any profile (for balance adjust, admin toggle)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile or admin" ON profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
    ));

-- ==================== 2. IMPROVE resolve_market ====================
-- Add server-side validation: only admin or market creator can resolve
CREATE OR REPLACE FUNCTION resolve_market(
    p_market_id INTEGER,
    p_resolution TEXT,
    p_resolved_by UUID
) RETURNS void AS $$
DECLARE
    pred RECORD;
    v_payout REAL;
    v_market RECORD;
BEGIN
    -- Validate caller is admin or market creator
    SELECT * INTO v_market FROM markets WHERE id = p_market_id AND resolution IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Market not found or already resolved';
    END IF;

    IF v_market.created_by != p_resolved_by AND NOT EXISTS (
        SELECT 1 FROM profiles WHERE id = p_resolved_by AND is_admin = true
    ) THEN
        RAISE EXCEPTION 'Only the market creator or an admin can resolve this market';
    END IF;

    -- Update market status
    UPDATE markets SET
        resolution = p_resolution,
        resolved_at = now(),
        resolved_by = p_resolved_by,
        status = 'closed'
    WHERE id = p_market_id AND resolution IS NULL;

    -- Process each active prediction
    FOR pred IN
        SELECT * FROM predictions
        WHERE market_id = p_market_id AND status = 'active'
    LOOP
        IF p_resolution = 'void' THEN
            v_payout := pred.amount;
            UPDATE predictions SET status = 'voided', payout = v_payout WHERE id = pred.id;
            UPDATE profiles SET balance = balance + v_payout WHERE id = pred.user_id;

            INSERT INTO notifications (user_id, type, title, message, market_id)
            VALUES (pred.user_id, 'payout', 'Market Voided',
                    'Market was voided. You received ' || v_payout || ' tokens back.',
                    p_market_id);

        ELSIF pred.direction = p_resolution THEN
            v_payout := pred.shares;
            UPDATE predictions SET status = 'won', payout = v_payout WHERE id = pred.id;
            -- Brier-style scoring: points based on confidence and correctness
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

-- ==================== 3. TRANSACTIONS TABLE ====================
-- Ledger of all token movements for transparency

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('buy', 'sell', 'payout', 'void_refund', 'admin_adjust', 'signup_bonus')),
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    description TEXT NOT NULL,
    market_id INTEGER REFERENCES markets(id) ON DELETE SET NULL,
    prediction_id INTEGER REFERENCES predictions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
CREATE POLICY "Users can view own transactions" ON transactions
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated can insert transactions" ON transactions;
CREATE POLICY "Authenticated can insert transactions" ON transactions
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, created_at DESC);

-- Add to realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'transactions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
    END IF;
END $$;

-- ==================== 4. WATCHLIST TABLE ====================
-- Users can bookmark markets to follow

CREATE TABLE IF NOT EXISTS watchlist (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, market_id)
);

ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own watchlist" ON watchlist;
CREATE POLICY "Users can view own watchlist" ON watchlist
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own watchlist" ON watchlist;
CREATE POLICY "Users can manage own watchlist" ON watchlist
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own watchlist" ON watchlist;
CREATE POLICY "Users can delete own watchlist" ON watchlist
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id);

-- ==================== 5. CLOSING SOON NOTIFICATION FUNCTION ====================
-- Call this periodically (or on page load) to notify users about closing markets

CREATE OR REPLACE FUNCTION notify_closing_soon()
RETURNS INTEGER AS $$
DECLARE
    mkt RECORD;
    pred RECORD;
    notified_count INTEGER := 0;
BEGIN
    -- Find markets closing in the next 24 hours that are still active
    FOR mkt IN
        SELECT * FROM markets
        WHERE status = 'active'
          AND resolution IS NULL
          AND closes_at >= CURRENT_DATE
          AND closes_at <= CURRENT_DATE + INTERVAL '1 day'
    LOOP
        -- Notify each user who has an active position
        FOR pred IN
            SELECT DISTINCT user_id FROM predictions
            WHERE market_id = mkt.id AND status = 'active'
        LOOP
            -- Don't send duplicate closing_soon notifications
            IF NOT EXISTS (
                SELECT 1 FROM notifications
                WHERE user_id = pred.user_id
                  AND market_id = mkt.id
                  AND type = 'closing_soon'
            ) THEN
                INSERT INTO notifications (user_id, type, title, message, market_id)
                VALUES (pred.user_id, 'closing_soon', 'Market Closing Soon',
                        'Market "' || LEFT(mkt.title, 80) || '" closes tomorrow. Sell or hold?',
                        mkt.id);
                notified_count := notified_count + 1;
            END IF;
        END LOOP;
    END LOOP;

    RETURN notified_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== 6. MARKET COUNT FUNCTION ====================
-- Get total market count for pagination

CREATE OR REPLACE FUNCTION get_market_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT count(*)::INTEGER FROM markets);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
