-- ============================================================
-- Migration V7: Multi-outcome markets + For Fun category
-- Safe to run multiple times (idempotent)
-- Run this in Supabase SQL Editor
-- ============================================================

-- ==================== 1. ADD MULTI-OUTCOME COLUMNS ====================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'markets' AND column_name = 'market_type') THEN
        ALTER TABLE markets ADD COLUMN market_type TEXT NOT NULL DEFAULT 'binary' CHECK (market_type IN ('binary', 'multi'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'markets' AND column_name = 'options') THEN
        ALTER TABLE markets ADD COLUMN options JSONB; -- [{label: "Option A"}, ...]
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'markets' AND column_name = 'q_values') THEN
        ALTER TABLE markets ADD COLUMN q_values JSONB; -- [0, 0, 0, ...]
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'markets' AND column_name = 'probabilities') THEN
        ALTER TABLE markets ADD COLUMN probabilities JSONB; -- [0.33, 0.33, 0.34]
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'predictions' AND column_name = 'option_index') THEN
        ALTER TABLE predictions ADD COLUMN option_index INTEGER; -- which option (0-indexed) for multi markets
    END IF;
END $$;

-- ==================== 2. RESOLVE MULTI-OUTCOME MARKET ====================

CREATE OR REPLACE FUNCTION resolve_multi_market(
    p_market_id INTEGER,
    p_winning_index INTEGER,  -- -1 for void
    p_resolved_by UUID
) RETURNS void AS $$
DECLARE
    pred RECORD;
    v_payout REAL;
    v_market RECORD;
    v_resolution TEXT;
BEGIN
    SELECT * INTO v_market FROM markets WHERE id = p_market_id AND resolution IS NULL AND market_type = 'multi';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Multi-outcome market not found or already resolved';
    END IF;

    IF v_market.created_by != p_resolved_by AND NOT EXISTS (
        SELECT 1 FROM profiles WHERE id = p_resolved_by AND is_admin = true
    ) THEN
        RAISE EXCEPTION 'Only the market creator or an admin can resolve this market';
    END IF;

    -- Determine resolution label
    IF p_winning_index = -1 THEN
        v_resolution := 'void';
    ELSE
        v_resolution := v_market.options->p_winning_index->>'label';
    END IF;

    UPDATE markets SET
        resolution = v_resolution,
        resolved_at = now(),
        resolved_by = p_resolved_by,
        status = 'closed'
    WHERE id = p_market_id AND resolution IS NULL;

    FOR pred IN
        SELECT * FROM predictions
        WHERE market_id = p_market_id AND status = 'active'
    LOOP
        IF p_winning_index = -1 THEN
            -- Void: refund everyone
            v_payout := pred.amount;
            UPDATE predictions SET status = 'voided', payout = v_payout WHERE id = pred.id;
            UPDATE profiles SET balance = balance + v_payout WHERE id = pred.user_id;

            INSERT INTO notifications (user_id, type, title, message, market_id)
            VALUES (pred.user_id, 'payout', 'Market Voided',
                    'Market was voided. You received ' || v_payout || ' tokens back.',
                    p_market_id);

        ELSIF pred.option_index = p_winning_index THEN
            -- Winner
            v_payout := pred.shares;
            UPDATE predictions SET status = 'won', payout = v_payout WHERE id = pred.id;
            UPDATE profiles SET
                balance = balance + v_payout,
                points = points + GREATEST(10, ROUND(v_payout - pred.amount)),
                accuracy = CASE WHEN trades > 0 THEN (accuracy * trades + 1) / (trades + 1) ELSE 1 END
            WHERE id = pred.user_id;

            INSERT INTO notifications (user_id, type, title, message, market_id)
            VALUES (pred.user_id, 'payout', 'You Won!',
                    'Your prediction was correct! You earned ' || ROUND(v_payout::numeric, 1) || ' tokens.',
                    p_market_id);
        ELSE
            -- Loser
            UPDATE predictions SET status = 'lost', payout = 0 WHERE id = pred.id;
            UPDATE profiles SET
                accuracy = CASE WHEN trades > 0 THEN (accuracy * trades) / (trades + 1) ELSE 0 END
            WHERE id = pred.user_id;

            INSERT INTO notifications (user_id, type, title, message, market_id)
            VALUES (pred.user_id, 'resolution', 'Market Resolved',
                    'Market resolved as "' || v_resolution || '". Your prediction was incorrect.',
                    p_market_id);
        END IF;
    END LOOP;

    INSERT INTO notifications (user_id, type, title, message, market_id)
    SELECT created_by, 'resolution', 'Your Market Was Resolved',
           'Your market has been resolved: "' || v_resolution || '".',
           p_market_id
    FROM markets WHERE id = p_market_id AND created_by IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
