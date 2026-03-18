-- RESET: Wipe all trades, transactions, and reset balances
-- Run this in Supabase SQL Editor to start fresh after fixing data integrity.
-- WARNING: This deletes ALL predictions, transactions, comments, and notifications.
-- Markets are preserved but reset to their initial state.

-- 1. Delete all predictions
DELETE FROM predictions;

-- 2. Delete all transactions
DELETE FROM transactions;

-- 3. Delete all notifications
DELETE FROM notifications;

-- 4. Delete all comments
DELETE FROM comments;

-- 5. Reset all user balances to 1000, zero out stats
UPDATE profiles SET
    balance = 1000,
    trades = 0,
    points = 0,
    accuracy = 0,
    last_daily_bonus = NULL;

-- 6a. Reset binary markets
UPDATE markets SET
    volume = 0, traders = 0, version = 0,
    probability = 0.50, logit = 0,
    q_yes = 0, q_no = 0,
    q_values = NULL, probabilities = NULL,
    history = '[0.50]'::jsonb
WHERE resolution IS NULL AND (market_type IS NULL OR market_type = 'binary');

-- 6b. Reset multi-outcome markets via a loop
DO $$
DECLARE
    m RECORD;
    n INTEGER;
    q JSONB;
    p JSONB;
BEGIN
    FOR m IN SELECT id, options FROM markets WHERE resolution IS NULL AND market_type = 'multi' LOOP
        n := jsonb_array_length(m.options);
        SELECT jsonb_agg(0) INTO q FROM generate_series(1, n);
        SELECT jsonb_agg(1.0 / n) INTO p FROM generate_series(1, n);
        UPDATE markets SET
            volume = 0, traders = 0, version = 0,
            probability = 1.0 / n, logit = 0,
            q_yes = 0, q_no = 0,
            q_values = q, probabilities = p,
            history = jsonb_build_array(p)
        WHERE id = m.id;
    END LOOP;
END $$;

-- 7. Unresolve any resolved markets (optional — comment out if you want to keep resolutions)
-- UPDATE markets SET resolution = NULL, resolved_at = NULL, resolved_by = NULL, status = 'active' WHERE resolution IS NOT NULL;

-- 8. Clear audit log (if table exists)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_log') THEN
        EXECUTE 'DELETE FROM audit_log';
    END IF;
END $$;

-- 9. Clear watchlist
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'watchlist') THEN
        EXECUTE 'DELETE FROM watchlist';
    END IF;
END $$;
