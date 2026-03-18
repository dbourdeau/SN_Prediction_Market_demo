-- Migration v12: Fix race conditions on balance, add input validation
-- Run this in your Supabase SQL Editor after v11.

-- ==================== 1. FIX place_prediction: atomic balance update ====================

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
    v_pred_id INTEGER;
    v_new_balance INTEGER;
    v_rows INTEGER;
BEGIN
    -- Validate inputs
    IF p_amount < 10 THEN RAISE EXCEPTION 'Minimum trade is 10 tokens'; END IF;
    IF p_shares <= 0 THEN RAISE EXCEPTION 'Invalid shares value'; END IF;
    IF p_shares > p_amount * 20 THEN RAISE EXCEPTION 'Shares value out of range'; END IF;

    SELECT * INTO v_market FROM markets WHERE id = p_market_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Market not found'; END IF;
    IF v_market.status != 'active' OR v_market.resolution IS NOT NULL THEN
        RAISE EXCEPTION 'Market is not active';
    END IF;

    -- Atomic balance deduction with check (prevents race condition)
    UPDATE profiles SET
        balance = balance - p_amount,
        trades = trades + 1
    WHERE id = p_user_id AND balance >= p_amount
    RETURNING balance INTO v_new_balance;

    IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

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

    INSERT INTO transactions (user_id, type, amount, balance_after, description, market_id, prediction_id)
    VALUES (p_user_id, 'buy', -p_amount, v_new_balance,
            'Bought ' || ROUND(p_shares::numeric, 1) || ' ' || UPPER(p_direction) || ' shares',
            p_market_id, v_pred_id);

    RETURN v_pred_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== 2. FIX sell_position: atomic balance update + revenue validation ====================

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
    -- Validate revenue
    IF p_revenue < 0 THEN RAISE EXCEPTION 'Revenue cannot be negative'; END IF;

    SELECT * INTO v_pred FROM predictions WHERE id = p_prediction_id AND user_id = p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Prediction not found'; END IF;
    IF v_pred.status != 'active' THEN RAISE EXCEPTION 'Position is not active'; END IF;

    -- Cap revenue to reasonable bounds (max 10x original investment)
    IF p_revenue > v_pred.amount * 10 THEN RAISE EXCEPTION 'Revenue exceeds maximum'; END IF;

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

    -- Atomic balance credit
    UPDATE profiles SET balance = balance + p_revenue
    WHERE id = p_user_id
    RETURNING balance INTO v_new_balance;

    INSERT INTO transactions (user_id, type, amount, balance_after, description, market_id, prediction_id)
    VALUES (p_user_id, 'sell', p_revenue, v_new_balance,
            'Sold ' || ROUND(v_pred.shares::numeric, 1) || ' ' || UPPER(v_pred.direction) || ' shares',
            v_pred.market_id, p_prediction_id);

    RETURN p_revenue;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== 3. FIX claim_referral: atomic guard against double-claim ====================

CREATE OR REPLACE FUNCTION claim_referral(p_user_id UUID, p_referrer_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_bonus INTEGER := 100;
    v_rows INTEGER;
    v_new_balance INTEGER;
BEGIN
    IF p_user_id = p_referrer_id THEN RETURN FALSE; END IF;

    -- Check referrer exists
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_referrer_id) THEN
        RETURN FALSE;
    END IF;

    -- Atomic: only set referred_by if not already set
    UPDATE profiles SET referred_by = p_referrer_id
    WHERE id = p_user_id AND referred_by IS NULL;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN RETURN FALSE; END IF;

    -- Award bonus to both (atomic)
    UPDATE profiles SET balance = balance + v_bonus WHERE id = p_user_id RETURNING balance INTO v_new_balance;
    INSERT INTO transactions (user_id, type, amount, balance_after, description)
    VALUES (p_user_id, 'signup_bonus', v_bonus, v_new_balance, 'Referral bonus (signed up via referral)');

    UPDATE profiles SET balance = balance + v_bonus WHERE id = p_referrer_id RETURNING balance INTO v_new_balance;
    INSERT INTO transactions (user_id, type, amount, balance_after, description)
    VALUES (p_referrer_id, 'signup_bonus', v_bonus, v_new_balance, 'Referral bonus (referred a new user)');

    INSERT INTO notifications (user_id, type, title, message)
    VALUES (p_referrer_id, 'payout', 'Referral Bonus!',
            'Someone joined using your referral link! You earned ' || v_bonus || ' tokens.');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== 4. FIX claim_daily_bonus: atomic guard against double-claim ====================

CREATE OR REPLACE FUNCTION claim_daily_bonus(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_bonus INTEGER := 50;
    v_rows INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- Atomic: only update if not already claimed today
    UPDATE profiles SET
        balance = balance + v_bonus,
        last_daily_bonus = CURRENT_DATE
    WHERE id = p_user_id
      AND (last_daily_bonus IS NULL OR last_daily_bonus < CURRENT_DATE)
    RETURNING balance INTO v_new_balance;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN RETURN 0; END IF;

    INSERT INTO transactions (user_id, type, amount, balance_after, description)
    VALUES (p_user_id, 'signup_bonus', v_bonus, v_new_balance, 'Daily login bonus');

    RETURN v_bonus;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
