-- Migration v11: Fix resolve functions to log transactions + reconcile existing balances
-- Run this in your Supabase SQL Editor after v10.

-- ==================== 1. FIX resolve_market: log payout transactions ====================

CREATE OR REPLACE FUNCTION resolve_market(
    p_market_id INTEGER,
    p_resolution TEXT,
    p_resolved_by UUID
) RETURNS void AS $$
DECLARE
    pred RECORD;
    v_payout REAL;
    v_market RECORD;
    v_new_balance INTEGER;
BEGIN
    SELECT * INTO v_market FROM markets WHERE id = p_market_id AND resolution IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Market not found or already resolved';
    END IF;

    IF v_market.created_by != p_resolved_by AND NOT EXISTS (
        SELECT 1 FROM profiles WHERE id = p_resolved_by AND is_admin = true
    ) THEN
        RAISE EXCEPTION 'Only the market creator or an admin can resolve this market';
    END IF;

    UPDATE markets SET
        resolution = p_resolution,
        resolved_at = now(),
        resolved_by = p_resolved_by,
        status = 'closed'
    WHERE id = p_market_id AND resolution IS NULL;

    FOR pred IN
        SELECT * FROM predictions
        WHERE market_id = p_market_id AND status = 'active'
    LOOP
        IF p_resolution = 'void' THEN
            v_payout := pred.amount;
            UPDATE predictions SET status = 'voided', payout = v_payout WHERE id = pred.id;
            UPDATE profiles SET balance = balance + v_payout WHERE id = pred.user_id;

            -- Log transaction
            SELECT balance INTO v_new_balance FROM profiles WHERE id = pred.user_id;
            INSERT INTO transactions (user_id, type, amount, balance_after, description, market_id, prediction_id)
            VALUES (pred.user_id, 'payout', v_payout, v_new_balance,
                    'Market voided — refund of ' || ROUND(v_payout::numeric, 1) || ' tokens',
                    p_market_id, pred.id);

            INSERT INTO notifications (user_id, type, title, message, market_id)
            VALUES (pred.user_id, 'payout', 'Market Voided',
                    'Market was voided. You received ' || v_payout || ' tokens back.',
                    p_market_id);

        ELSIF pred.direction = p_resolution THEN
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

            -- Log transaction
            SELECT balance INTO v_new_balance FROM profiles WHERE id = pred.user_id;
            INSERT INTO transactions (user_id, type, amount, balance_after, description, market_id, prediction_id)
            VALUES (pred.user_id, 'payout', ROUND(v_payout), v_new_balance,
                    'Won ' || ROUND(v_payout::numeric, 1) || ' tokens on ' || UPPER(pred.direction),
                    p_market_id, pred.id);

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

    INSERT INTO notifications (user_id, type, title, message, market_id)
    SELECT created_by, 'resolution', 'Your Market Was Resolved',
           'Your market has been resolved as ' || UPPER(p_resolution) || '.',
           p_market_id
    FROM markets WHERE id = p_market_id AND created_by IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== 2. FIX resolve_multi_market: log payout transactions ====================

CREATE OR REPLACE FUNCTION resolve_multi_market(
    p_market_id INTEGER,
    p_winning_index INTEGER,
    p_resolved_by UUID
) RETURNS void AS $$
DECLARE
    pred RECORD;
    v_payout REAL;
    v_market RECORD;
    v_resolution TEXT;
    v_new_balance INTEGER;
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
            v_payout := pred.amount;
            UPDATE predictions SET status = 'voided', payout = v_payout WHERE id = pred.id;
            UPDATE profiles SET balance = balance + v_payout WHERE id = pred.user_id;

            SELECT balance INTO v_new_balance FROM profiles WHERE id = pred.user_id;
            INSERT INTO transactions (user_id, type, amount, balance_after, description, market_id, prediction_id)
            VALUES (pred.user_id, 'payout', v_payout, v_new_balance,
                    'Market voided — refund of ' || ROUND(v_payout::numeric, 1) || ' tokens',
                    p_market_id, pred.id);

            INSERT INTO notifications (user_id, type, title, message, market_id)
            VALUES (pred.user_id, 'payout', 'Market Voided',
                    'Market was voided. You received ' || v_payout || ' tokens back.',
                    p_market_id);

        ELSIF pred.option_index = p_winning_index THEN
            v_payout := pred.shares;
            UPDATE predictions SET status = 'won', payout = v_payout WHERE id = pred.id;
            UPDATE profiles SET
                balance = balance + v_payout,
                points = points + GREATEST(10, ROUND(v_payout - pred.amount)),
                accuracy = CASE WHEN trades > 0 THEN (accuracy * trades + 1) / (trades + 1) ELSE 1 END
            WHERE id = pred.user_id;

            SELECT balance INTO v_new_balance FROM profiles WHERE id = pred.user_id;
            INSERT INTO transactions (user_id, type, amount, balance_after, description, market_id, prediction_id)
            VALUES (pred.user_id, 'payout', ROUND(v_payout), v_new_balance,
                    'Won ' || ROUND(v_payout::numeric, 1) || ' tokens on "' || LEFT(v_resolution, 40) || '"',
                    p_market_id, pred.id);

            INSERT INTO notifications (user_id, type, title, message, market_id)
            VALUES (pred.user_id, 'payout', 'You Won!',
                    'Your prediction was correct! You earned ' || ROUND(v_payout::numeric, 1) || ' tokens.',
                    p_market_id);
        ELSE
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
           'Your market has been resolved as "' || v_resolution || '".',
           p_market_id
    FROM markets WHERE id = p_market_id AND created_by IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== 3. BACKFILL: insert missing payout transactions ====================
-- This creates transaction records for past resolved predictions that are missing them.

INSERT INTO transactions (user_id, type, amount, balance_after, description, market_id, prediction_id, created_at)
SELECT
    p.user_id,
    'payout',
    CASE WHEN p.status = 'voided' THEN p.amount ELSE ROUND(p.payout::numeric) END,
    0, -- balance_after is approximate; set to 0 as historical placeholder
    CASE
        WHEN p.status = 'voided' THEN 'Market voided — refund (backfill)'
        WHEN p.status = 'won' THEN 'Won ' || ROUND(p.payout::numeric, 1) || ' tokens (backfill)'
        ELSE 'Payout (backfill)'
    END,
    p.market_id,
    p.id,
    COALESCE(m.resolved_at, p.created_at)
FROM predictions p
JOIN markets m ON m.id = p.market_id
WHERE p.status IN ('won', 'voided')
  AND p.payout > 0
  AND NOT EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.prediction_id = p.id AND t.type = 'payout'
  );
