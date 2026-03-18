-- ============================================================
-- Migration V6: Market approval workflow
-- Safe to run multiple times (idempotent)
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add approved_by and approved_at columns to markets
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'markets' AND column_name = 'approved_by') THEN
        ALTER TABLE markets ADD COLUMN approved_by UUID REFERENCES profiles(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'markets' AND column_name = 'approved_at') THEN
        ALTER TABLE markets ADD COLUMN approved_at TIMESTAMPTZ;
    END IF;
END $$;

-- Function to approve a market (admin only)
CREATE OR REPLACE FUNCTION approve_market(p_market_id INTEGER, p_approved_by UUID)
RETURNS void AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_approved_by AND is_admin = true) THEN
        RAISE EXCEPTION 'Only admins can approve markets';
    END IF;

    UPDATE markets SET
        status = 'active',
        approved_by = p_approved_by,
        approved_at = now()
    WHERE id = p_market_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Market not found or not in pending status';
    END IF;

    -- Notify the market creator
    INSERT INTO notifications (user_id, type, title, message, market_id)
    SELECT created_by, 'resolution', 'Market Approved!',
           'Your market "' || LEFT(title, 80) || '" has been approved and is now live.',
           p_market_id
    FROM markets WHERE id = p_market_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject a market (admin only)
CREATE OR REPLACE FUNCTION reject_market(p_market_id INTEGER, p_rejected_by UUID, p_reason TEXT DEFAULT 'Does not meet guidelines')
RETURNS void AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_rejected_by AND is_admin = true) THEN
        RAISE EXCEPTION 'Only admins can reject markets';
    END IF;

    -- Notify creator before deleting
    INSERT INTO notifications (user_id, type, title, message, market_id)
    SELECT created_by, 'resolution', 'Market Rejected',
           'Your market "' || LEFT(title, 80) || '" was not approved. Reason: ' || p_reason,
           NULL
    FROM markets WHERE id = p_market_id AND status = 'pending';

    DELETE FROM markets WHERE id = p_market_id AND status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
