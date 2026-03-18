-- Migration v13: Admin delete market RPC
-- Run this in your Supabase SQL Editor after v12.

CREATE OR REPLACE FUNCTION delete_market(p_market_id INTEGER, p_deleted_by UUID)
RETURNS VOID AS $$
BEGIN
    -- Verify caller is admin
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_deleted_by AND is_admin = true) THEN
        RAISE EXCEPTION 'Only admins can delete markets';
    END IF;

    -- Verify market exists
    IF NOT EXISTS (SELECT 1 FROM markets WHERE id = p_market_id) THEN
        RAISE EXCEPTION 'Market not found';
    END IF;

    -- Delete in FK order
    DELETE FROM transactions WHERE market_id = p_market_id;
    DELETE FROM predictions WHERE market_id = p_market_id;
    DELETE FROM comments WHERE market_id = p_market_id;
    DELETE FROM watchlist WHERE market_id = p_market_id;
    DELETE FROM markets WHERE id = p_market_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
