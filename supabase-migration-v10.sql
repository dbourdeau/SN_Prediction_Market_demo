-- Migration v10: Daily login bonus, comment notifications, optimistic locking, referral tracking
-- Run this in your Supabase SQL Editor after v9.

-- ==================== 1. DAILY LOGIN BONUS ====================

-- Add last_daily_bonus column to profiles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_daily_bonus') THEN
        ALTER TABLE profiles ADD COLUMN last_daily_bonus DATE;
    END IF;
END $$;

-- Function: awards 50 tokens if not already claimed today. Returns bonus amount (0 if already claimed).
CREATE OR REPLACE FUNCTION claim_daily_bonus(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_last_bonus DATE;
    v_bonus INTEGER := 50;
BEGIN
    SELECT last_daily_bonus INTO v_last_bonus FROM profiles WHERE id = p_user_id;

    IF v_last_bonus IS NOT NULL AND v_last_bonus = CURRENT_DATE THEN
        RETURN 0; -- already claimed today
    END IF;

    UPDATE profiles SET
        balance = balance + v_bonus,
        last_daily_bonus = CURRENT_DATE
    WHERE id = p_user_id;

    -- Log transaction
    INSERT INTO transactions (user_id, type, amount, balance_after, description)
    SELECT p_user_id, 'signup_bonus', v_bonus, balance, 'Daily login bonus'
    FROM profiles WHERE id = p_user_id;

    RETURN v_bonus;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== 2. COMMENT NOTIFICATIONS ====================
-- Trigger: when a comment is inserted, notify all users who have active positions on that market

CREATE OR REPLACE FUNCTION notify_comment_position_holders()
RETURNS TRIGGER AS $$
DECLARE
    v_market_title TEXT;
    v_commenter_name TEXT;
    pos_user UUID;
BEGIN
    SELECT title INTO v_market_title FROM markets WHERE id = NEW.market_id;
    SELECT name INTO v_commenter_name FROM profiles WHERE id = NEW.user_id;

    FOR pos_user IN
        SELECT DISTINCT user_id FROM predictions
        WHERE market_id = NEW.market_id AND status = 'active' AND user_id != NEW.user_id
    LOOP
        INSERT INTO notifications (user_id, type, title, message, market_id)
        VALUES (pos_user, 'comment', 'New Comment',
                esc_text(v_commenter_name) || ' commented on "' || LEFT(v_market_title, 60) || '"',
                NEW.market_id);
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper to escape text for notification messages (prevent injection in notification text)
CREATE OR REPLACE FUNCTION esc_text(t TEXT) RETURNS TEXT AS $$
BEGIN
    RETURN replace(replace(t, '<', '&lt;'), '>', '&gt;');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

DROP TRIGGER IF EXISTS comment_notify_trigger ON comments;
CREATE TRIGGER comment_notify_trigger
    AFTER INSERT ON comments
    FOR EACH ROW EXECUTE FUNCTION notify_comment_position_holders();

-- ==================== 3. OPTIMISTIC LOCKING ====================
-- Add version column to markets for concurrent trade protection

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'markets' AND column_name = 'version') THEN
        ALTER TABLE markets ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Update place_prediction to check and increment version
CREATE OR REPLACE FUNCTION place_prediction(
    p_user_id UUID,
    p_market_id INTEGER,
    p_direction TEXT,
    p_amount INTEGER,
    p_shares REAL,
    p_entry_prob REAL,
    p_option_index INTEGER DEFAULT NULL,
    p_new_probability REAL DEFAULT NULL,
    p_new_logit REAL DEFAULT NULL,
    p_new_q_yes REAL DEFAULT NULL,
    p_new_q_no REAL DEFAULT NULL,
    p_new_q_values JSONB DEFAULT NULL,
    p_new_probabilities JSONB DEFAULT NULL,
    p_new_history JSONB DEFAULT NULL,
    p_expected_version INTEGER DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_market RECORD;
    v_user RECORD;
    v_pred_id INTEGER;
    v_new_balance INTEGER;
    v_rows INTEGER;
BEGIN
    SELECT * INTO v_market FROM markets WHERE id = p_market_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Market not found'; END IF;
    IF v_market.status != 'active' OR v_market.resolution IS NOT NULL THEN
        RAISE EXCEPTION 'Market is not active';
    END IF;

    SELECT * INTO v_user FROM profiles WHERE id = p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
    IF v_user.balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
    IF p_amount < 10 THEN RAISE EXCEPTION 'Minimum trade is 10 tokens'; END IF;

    INSERT INTO predictions (user_id, market_id, direction, amount, shares, entry_prob, status, option_index)
    VALUES (p_user_id, p_market_id, p_direction, p_amount, p_shares, p_entry_prob, 'active', p_option_index)
    RETURNING id INTO v_pred_id;

    -- Optimistic lock: only update if version matches (or no version check requested)
    UPDATE markets SET
        probability = COALESCE(p_new_probability, probability),
        logit = COALESCE(p_new_logit, logit),
        q_yes = COALESCE(p_new_q_yes, q_yes),
        q_no = COALESCE(p_new_q_no, q_no),
        q_values = COALESCE(p_new_q_values, q_values),
        probabilities = COALESCE(p_new_probabilities, probabilities),
        volume = volume + p_amount,
        traders = traders + 1,
        history = COALESCE(p_new_history, history),
        version = version + 1
    WHERE id = p_market_id
      AND (p_expected_version IS NULL OR version = p_expected_version);

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
        RAISE EXCEPTION 'Market was updated by another trade. Please try again.';
    END IF;

    v_new_balance := v_user.balance - p_amount;
    UPDATE profiles SET balance = v_new_balance, trades = trades + 1 WHERE id = p_user_id;

    INSERT INTO transactions (user_id, type, amount, balance_after, description, market_id, prediction_id)
    VALUES (p_user_id, 'buy', -p_amount, v_new_balance,
            'Bought ' || ROUND(p_shares::numeric, 1) || ' ' || UPPER(p_direction) || ' shares',
            p_market_id, v_pred_id);

    RETURN v_pred_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update sell_position to also increment version
CREATE OR REPLACE FUNCTION sell_position(
    p_user_id UUID,
    p_prediction_id INTEGER,
    p_revenue INTEGER,
    p_new_probability REAL DEFAULT NULL,
    p_new_logit REAL DEFAULT NULL,
    p_new_q_yes REAL DEFAULT NULL,
    p_new_q_no REAL DEFAULT NULL,
    p_new_q_values JSONB DEFAULT NULL,
    p_new_probabilities JSONB DEFAULT NULL,
    p_new_history JSONB DEFAULT NULL,
    p_expected_version INTEGER DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_pred RECORD;
    v_market RECORD;
    v_new_balance INTEGER;
    v_rows INTEGER;
BEGIN
    SELECT * INTO v_pred FROM predictions WHERE id = p_prediction_id AND user_id = p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Prediction not found'; END IF;
    IF v_pred.status != 'active' THEN RAISE EXCEPTION 'Position is not active'; END IF;

    SELECT * INTO v_market FROM markets WHERE id = v_pred.market_id;
    IF v_market.status != 'active' OR v_market.resolution IS NOT NULL THEN
        RAISE EXCEPTION 'Market is not active';
    END IF;

    UPDATE predictions SET status = 'sold', payout = p_revenue WHERE id = p_prediction_id;

    UPDATE markets SET
        probability = COALESCE(p_new_probability, probability),
        logit = COALESCE(p_new_logit, logit),
        q_yes = COALESCE(p_new_q_yes, q_yes),
        q_no = COALESCE(p_new_q_no, q_no),
        q_values = COALESCE(p_new_q_values, q_values),
        probabilities = COALESCE(p_new_probabilities, probabilities),
        volume = volume + p_revenue,
        history = COALESCE(p_new_history, history),
        version = version + 1
    WHERE id = v_pred.market_id
      AND (p_expected_version IS NULL OR version = p_expected_version);

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
        RAISE EXCEPTION 'Market was updated by another trade. Please try again.';
    END IF;

    SELECT balance INTO v_new_balance FROM profiles WHERE id = p_user_id;
    v_new_balance := v_new_balance + p_revenue;
    UPDATE profiles SET balance = v_new_balance WHERE id = p_user_id;

    INSERT INTO transactions (user_id, type, amount, balance_after, description, market_id, prediction_id)
    VALUES (p_user_id, 'sell', p_revenue, v_new_balance,
            'Sold ' || ROUND(v_pred.shares::numeric, 1) || ' ' || UPPER(v_pred.direction) || ' shares',
            v_pred.market_id, p_prediction_id);

    RETURN p_revenue;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== 4. REFERRAL TRACKING ====================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'referred_by') THEN
        ALTER TABLE profiles ADD COLUMN referred_by UUID REFERENCES profiles(id);
    END IF;
END $$;

-- Function: link referral and award both parties 100 tokens
CREATE OR REPLACE FUNCTION claim_referral(p_user_id UUID, p_referrer_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_bonus INTEGER := 100;
BEGIN
    -- Can't refer yourself
    IF p_user_id = p_referrer_id THEN RETURN FALSE; END IF;

    -- Check if already referred
    IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND referred_by IS NOT NULL) THEN
        RETURN FALSE;
    END IF;

    -- Check referrer exists
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_referrer_id) THEN
        RETURN FALSE;
    END IF;

    -- Link referral
    UPDATE profiles SET referred_by = p_referrer_id WHERE id = p_user_id AND referred_by IS NULL;

    -- Award bonus to both
    UPDATE profiles SET balance = balance + v_bonus WHERE id = p_user_id;
    UPDATE profiles SET balance = balance + v_bonus WHERE id = p_referrer_id;

    -- Log transactions
    INSERT INTO transactions (user_id, type, amount, balance_after, description)
    SELECT p_user_id, 'signup_bonus', v_bonus, balance, 'Referral bonus (signed up via referral)'
    FROM profiles WHERE id = p_user_id;

    INSERT INTO transactions (user_id, type, amount, balance_after, description)
    SELECT p_referrer_id, 'signup_bonus', v_bonus, balance, 'Referral bonus (referred a new user)'
    FROM profiles WHERE id = p_referrer_id;

    -- Notify referrer
    INSERT INTO notifications (user_id, type, title, message)
    VALUES (p_referrer_id, 'payout', 'Referral Bonus!',
            'Someone joined using your referral link! You earned ' || v_bonus || ' tokens.');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
