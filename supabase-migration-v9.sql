-- Migration v9: Server-side place_prediction and sell_position functions
-- These run as SECURITY DEFINER to bypass RLS, since regular users can't
-- update markets they didn't create (the v4 RLS policy).
-- Run this in your Supabase SQL Editor after all previous migrations.

-- ==================== PLACE PREDICTION (BINARY) ====================
CREATE OR REPLACE FUNCTION place_prediction(
    p_user_id UUID,
    p_market_id INTEGER,
    p_direction TEXT,           -- 'yes' or 'no' for binary, option label for multi
    p_amount INTEGER,
    p_shares REAL,
    p_entry_prob REAL,
    p_option_index INTEGER DEFAULT NULL,
    -- market updates
    p_new_probability REAL DEFAULT NULL,
    p_new_logit REAL DEFAULT NULL,
    p_new_q_yes REAL DEFAULT NULL,
    p_new_q_no REAL DEFAULT NULL,
    p_new_q_values JSONB DEFAULT NULL,
    p_new_probabilities JSONB DEFAULT NULL,
    p_new_history JSONB DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_market RECORD;
    v_user RECORD;
    v_pred_id INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- Validate market
    SELECT * INTO v_market FROM markets WHERE id = p_market_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Market not found'; END IF;
    IF v_market.status != 'active' OR v_market.resolution IS NOT NULL THEN
        RAISE EXCEPTION 'Market is not active';
    END IF;

    -- Validate user balance
    SELECT * INTO v_user FROM profiles WHERE id = p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
    IF v_user.balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
    IF p_amount < 10 THEN RAISE EXCEPTION 'Minimum trade is 10 tokens'; END IF;

    -- Create the prediction
    INSERT INTO predictions (user_id, market_id, direction, amount, shares, entry_prob, status, option_index)
    VALUES (p_user_id, p_market_id, p_direction, p_amount, p_shares, p_entry_prob, 'active', p_option_index)
    RETURNING id INTO v_pred_id;

    -- Update the market
    UPDATE markets SET
        probability = COALESCE(p_new_probability, probability),
        logit = COALESCE(p_new_logit, logit),
        q_yes = COALESCE(p_new_q_yes, q_yes),
        q_no = COALESCE(p_new_q_no, q_no),
        q_values = COALESCE(p_new_q_values, q_values),
        probabilities = COALESCE(p_new_probabilities, probabilities),
        volume = volume + p_amount,
        traders = traders + 1,
        history = COALESCE(p_new_history, history)
    WHERE id = p_market_id;

    -- Deduct from user balance, increment trades
    v_new_balance := v_user.balance - p_amount;
    UPDATE profiles SET
        balance = v_new_balance,
        trades = trades + 1
    WHERE id = p_user_id;

    -- Log transaction
    INSERT INTO transactions (user_id, type, amount, balance_after, description, market_id, prediction_id)
    VALUES (p_user_id, 'buy', -p_amount, v_new_balance,
            'Bought ' || ROUND(p_shares::numeric, 1) || ' ' || UPPER(p_direction) || ' shares',
            p_market_id, v_pred_id);

    RETURN v_pred_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== SELL POSITION ====================
CREATE OR REPLACE FUNCTION sell_position(
    p_user_id UUID,
    p_prediction_id INTEGER,
    p_revenue INTEGER,
    -- market updates
    p_new_probability REAL DEFAULT NULL,
    p_new_logit REAL DEFAULT NULL,
    p_new_q_yes REAL DEFAULT NULL,
    p_new_q_no REAL DEFAULT NULL,
    p_new_q_values JSONB DEFAULT NULL,
    p_new_probabilities JSONB DEFAULT NULL,
    p_new_history JSONB DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_pred RECORD;
    v_market RECORD;
    v_new_balance INTEGER;
BEGIN
    -- Validate prediction belongs to user and is active
    SELECT * INTO v_pred FROM predictions WHERE id = p_prediction_id AND user_id = p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Prediction not found'; END IF;
    IF v_pred.status != 'active' THEN RAISE EXCEPTION 'Position is not active'; END IF;

    -- Validate market is active
    SELECT * INTO v_market FROM markets WHERE id = v_pred.market_id;
    IF v_market.status != 'active' OR v_market.resolution IS NOT NULL THEN
        RAISE EXCEPTION 'Market is not active';
    END IF;

    -- Update prediction to sold
    UPDATE predictions SET status = 'sold', payout = p_revenue WHERE id = p_prediction_id;

    -- Update the market
    UPDATE markets SET
        probability = COALESCE(p_new_probability, probability),
        logit = COALESCE(p_new_logit, logit),
        q_yes = COALESCE(p_new_q_yes, q_yes),
        q_no = COALESCE(p_new_q_no, q_no),
        q_values = COALESCE(p_new_q_values, q_values),
        probabilities = COALESCE(p_new_probabilities, probabilities),
        volume = volume + p_revenue,
        history = COALESCE(p_new_history, history)
    WHERE id = v_pred.market_id;

    -- Credit user balance
    SELECT balance INTO v_new_balance FROM profiles WHERE id = p_user_id;
    v_new_balance := v_new_balance + p_revenue;
    UPDATE profiles SET balance = v_new_balance WHERE id = p_user_id;

    -- Log transaction
    INSERT INTO transactions (user_id, type, amount, balance_after, description, market_id, prediction_id)
    VALUES (p_user_id, 'sell', p_revenue, v_new_balance,
            'Sold ' || ROUND(v_pred.shares::numeric, 1) || ' ' || UPPER(v_pred.direction) || ' shares',
            v_pred.market_id, p_prediction_id);

    RETURN p_revenue;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
