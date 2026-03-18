-- ============================================================
-- Migration V5: Weekly digest function + avatar column
-- Safe to run multiple times (idempotent)
-- Run this in Supabase SQL Editor
-- ============================================================

-- ==================== 1. WEEKLY DIGEST FUNCTION ====================
-- Returns digest data for all active users. Call via Edge Function/cron
-- to send weekly emails. Returns one row per user with their stats.

CREATE OR REPLACE FUNCTION get_weekly_digest()
RETURNS TABLE(
    user_id UUID,
    user_name TEXT,
    user_email TEXT,
    active_positions INTEGER,
    closing_soon_markets JSONB,
    leaderboard_rank INTEGER,
    rank_change INTEGER,
    weekly_pnl INTEGER,
    new_markets_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH user_active AS (
        SELECT p.user_id, count(*)::INTEGER as pos_count
        FROM predictions p WHERE p.status = 'active'
        GROUP BY p.user_id
    ),
    closing_soon AS (
        SELECT pred.user_id,
               jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'closes_at', m.closes_at)) as markets
        FROM markets m
        JOIN predictions pred ON pred.market_id = m.id AND pred.status = 'active'
        WHERE m.status = 'active' AND m.resolution IS NULL
          AND m.closes_at BETWEEN now() AND now() + INTERVAL '7 days'
        GROUP BY pred.user_id
    ),
    rankings AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY points DESC)::INTEGER as rank
        FROM profiles
    ),
    weekly_resolved AS (
        SELECT pred.user_id, COALESCE(SUM(pred.payout - pred.amount), 0)::INTEGER as pnl
        FROM predictions pred
        JOIN markets m ON m.id = pred.market_id
        WHERE m.resolved_at >= now() - INTERVAL '7 days'
          AND pred.status IN ('won', 'lost')
        GROUP BY pred.user_id
    ),
    new_mkts AS (
        SELECT count(*)::INTEGER as cnt FROM markets
        WHERE created_at >= now() - INTERVAL '7 days'
    )
    SELECT
        prof.id,
        prof.name,
        au.email::TEXT,
        COALESCE(ua.pos_count, 0),
        cs.markets,
        COALESCE(r.rank, 0),
        0, -- rank_change placeholder (would need historical data)
        COALESCE(wr.pnl, 0),
        nm.cnt
    FROM profiles prof
    JOIN auth.users au ON au.id = prof.id
    LEFT JOIN user_active ua ON ua.user_id = prof.id
    LEFT JOIN closing_soon cs ON cs.user_id = prof.id
    LEFT JOIN rankings r ON r.id = prof.id
    LEFT JOIN weekly_resolved wr ON wr.user_id = prof.id
    CROSS JOIN new_mkts nm
    WHERE COALESCE(ua.pos_count, 0) > 0 OR COALESCE(wr.pnl, 0) != 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
