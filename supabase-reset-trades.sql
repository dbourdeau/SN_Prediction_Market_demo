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

-- 6. Reset all active markets to initial state
UPDATE markets SET
    volume = 0,
    traders = 0,
    version = 0,
    probability = CASE WHEN market_type = 'multi' THEN 1.0 / jsonb_array_length(options) ELSE 0.50 END,
    logit = 0,
    q_yes = 0,
    q_no = 0,
    q_values = CASE WHEN market_type = 'multi' THEN (SELECT jsonb_agg(0) FROM generate_series(1, jsonb_array_length(options))) ELSE NULL END,
    probabilities = CASE WHEN market_type = 'multi' THEN (SELECT jsonb_agg(1.0 / jsonb_array_length(options)) FROM generate_series(1, jsonb_array_length(options))) ELSE NULL END,
    history = CASE WHEN market_type = 'multi' THEN jsonb_build_array((SELECT jsonb_agg(1.0 / jsonb_array_length(options)) FROM generate_series(1, jsonb_array_length(options)))) ELSE '[0.50]'::jsonb END
WHERE resolution IS NULL;

-- 7. Unresolve any resolved markets (optional — comment out if you want to keep resolutions)
-- UPDATE markets SET resolution = NULL, resolved_at = NULL, resolved_by = NULL, status = 'active' WHERE resolution IS NOT NULL;

-- 8. Clear audit log
DELETE FROM audit_log;

-- 9. Clear watchlist
DELETE FROM watchlist;
