-- ============================================================
-- SharkPool — Complete Database Schema
-- Run this in Supabase SQL Editor on a fresh project.
-- This replaces all supabase-setup.sql + migration files.
--
-- After running:
--   1. Set yourself as admin: UPDATE profiles SET is_admin = true WHERE email = 'you@sharkninja.com';
--   2. Set AI key: INSERT INTO app_config (key, value) VALUES ('anthropic_api_key', 'sk-ant-...');
-- ============================================================

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
    id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email            TEXT UNIQUE NOT NULL,
    name             TEXT NOT NULL,
    department       TEXT NOT NULL DEFAULT 'General',
    avatar           TEXT NOT NULL DEFAULT 'XX',
    balance          INTEGER NOT NULL DEFAULT 500 CHECK (balance >= 0),
    points           INTEGER NOT NULL DEFAULT 0,
    accuracy         REAL NOT NULL DEFAULT 0,
    trades           INTEGER NOT NULL DEFAULT 0,
    is_admin         BOOLEAN NOT NULL DEFAULT false,
    last_daily_bonus DATE,
    referred_by      UUID REFERENCES profiles(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS markets (
    id               SERIAL PRIMARY KEY,
    title            TEXT NOT NULL CHECK (char_length(title) <= 200),
    description      TEXT NOT NULL CHECK (char_length(description) <= 5000),
    category         TEXT NOT NULL DEFAULT 'strategy',
    probability      REAL NOT NULL DEFAULT 0.50,
    volume           INTEGER NOT NULL DEFAULT 0,
    traders          INTEGER NOT NULL DEFAULT 0,
    status           TEXT NOT NULL DEFAULT 'active',
    trending         BOOLEAN NOT NULL DEFAULT false,
    created_by       UUID REFERENCES profiles(id),
    created_by_name  TEXT NOT NULL DEFAULT 'Unknown',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    closes_at        DATE NOT NULL,
    history          JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- AMM state
    logit            REAL NOT NULL DEFAULT 0,
    q_yes            REAL NOT NULL DEFAULT 0,
    q_no             REAL NOT NULL DEFAULT 0,
    -- Resolution
    resolution       TEXT CHECK (resolution IN ('yes', 'no', 'void')),
    resolved_at      TIMESTAMPTZ,
    resolved_by      UUID REFERENCES profiles(id),
    -- Admin workflow
    edited_at        TIMESTAMPTZ,
    approved_by      UUID REFERENCES profiles(id),
    approved_at      TIMESTAMPTZ,
    -- Multi-outcome
    market_type      TEXT NOT NULL DEFAULT 'binary' CHECK (market_type IN ('binary', 'multi')),
    options          JSONB,       -- [{label: "Option A"}, ...]
    q_values         JSONB,       -- [0, 0, 0, ...]
    probabilities    JSONB,       -- [0.33, 0.33, 0.34]
    -- Concurrency
    version          INTEGER NOT NULL DEFAULT 0,
    -- Priority / audience
    is_priority      BOOLEAN NOT NULL DEFAULT false,
    target_dept      TEXT,   -- optional dept tag (e.g. 'Sales') set by market creator
    -- Source of truth
    source_url       TEXT,
    -- AI research cache
    research_cache   JSONB,
    research_cached_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS predictions (
    id           SERIAL PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    market_id    INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    direction    TEXT NOT NULL,
    amount       INTEGER NOT NULL CHECK (amount >= 10),
    shares       REAL NOT NULL DEFAULT 0,
    entry_prob   REAL NOT NULL,
    status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'won', 'lost', 'voided')),
    payout       REAL NOT NULL DEFAULT 0,
    option_index INTEGER,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
    id         SERIAL PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    market_id  INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    text       TEXT NOT NULL CHECK (char_length(text) <= 2000),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
    id         SERIAL PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type       TEXT NOT NULL CHECK (type IN ('resolution', 'payout', 'comment', 'closing_soon', 'welcome')),
    title      TEXT NOT NULL,
    message    TEXT NOT NULL,
    market_id  INTEGER REFERENCES markets(id) ON DELETE SET NULL,
    is_read    BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
    id             SERIAL PRIMARY KEY,
    user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type           TEXT NOT NULL CHECK (type IN ('buy', 'sell', 'payout', 'void_refund', 'admin_adjust', 'signup_bonus')),
    amount         INTEGER NOT NULL,
    balance_after  INTEGER NOT NULL,
    description    TEXT NOT NULL,
    market_id      INTEGER REFERENCES markets(id) ON DELETE SET NULL,
    prediction_id  INTEGER REFERENCES predictions(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS watchlist (
    id         SERIAL PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    market_id  INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, market_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
    id          SERIAL PRIMARY KEY,
    actor_id    UUID NOT NULL REFERENCES profiles(id),
    action      TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id   TEXT NOT NULL,
    details     JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_config (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_predictions_user     ON predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_market   ON predictions(market_id);
CREATE INDEX IF NOT EXISTS idx_comments_market      ON comments(market_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user   ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_transactions_user    ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_markets_status       ON markets(status);
CREATE INDEX IF NOT EXISTS idx_watchlist_user       ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created    ON audit_log(created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config    ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Profiles readable by authenticated" ON profiles
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile or admin" ON profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Markets
CREATE POLICY "Markets readable by authenticated" ON markets
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create markets" ON markets
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Market creator or admin can update" ON markets
    FOR UPDATE TO authenticated
    USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Predictions
CREATE POLICY "Predictions readable by authenticated" ON predictions
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create own predictions" ON predictions
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own predictions or admin" ON predictions
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Comments
CREATE POLICY "Comments readable by authenticated" ON comments
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create own comments" ON comments
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments or admin" ON comments
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Notifications
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON notifications
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON notifications
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Transactions
CREATE POLICY "Users can view own transactions" ON transactions
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated can insert transactions" ON transactions
    FOR INSERT TO authenticated WITH CHECK (true);

-- Watchlist
CREATE POLICY "Users can view own watchlist" ON watchlist
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own watchlist" ON watchlist
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own watchlist" ON watchlist
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Audit log
CREATE POLICY "Admins can read audit log" ON audit_log
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "Authenticated users can insert audit log" ON audit_log
    FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

-- app_config: no policies — only accessible via SECURITY DEFINER functions

-- ============================================================
-- REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE markets;
ALTER PUBLICATION supabase_realtime ADD TABLE predictions;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION esc_text(t TEXT) RETURNS TEXT AS $$
BEGIN
    RETURN replace(replace(t, '<', '&lt;'), '>', '&gt;');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, avatar)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        UPPER(LEFT(COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), 1) ||
              LEFT(REVERSE(split_part(COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), ' ', 2)), 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Cap market history array at 100 entries
CREATE OR REPLACE FUNCTION cap_market_history()
RETURNS TRIGGER AS $$
BEGIN
    IF jsonb_array_length(COALESCE(NEW.history, '[]'::jsonb)) > 100 THEN
        NEW.history := (
            SELECT jsonb_agg(elem)
            FROM (
                SELECT elem
                FROM jsonb_array_elements(NEW.history) WITH ORDINALITY AS t(elem, ord)
                ORDER BY ord DESC
                LIMIT 100
            ) sub
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cap_history_trigger ON markets;
CREATE TRIGGER cap_history_trigger
    BEFORE UPDATE ON markets
    FOR EACH ROW EXECUTE FUNCTION cap_market_history();

-- Notify position holders when a comment is posted
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

DROP TRIGGER IF EXISTS comment_notify_trigger ON comments;
CREATE TRIGGER comment_notify_trigger
    AFTER INSERT ON comments
    FOR EACH ROW EXECUTE FUNCTION notify_comment_position_holders();

-- ============================================================
-- RPCS — TRADING
-- ============================================================

CREATE OR REPLACE FUNCTION place_prediction(
    p_user_id        UUID,
    p_market_id      INTEGER,
    p_direction      TEXT,
    p_amount         INTEGER,
    p_shares         REAL,
    p_entry_prob     REAL,
    p_option_index   INTEGER DEFAULT NULL,
    p_new_probability     REAL DEFAULT NULL,
    p_new_logit          REAL DEFAULT NULL,
    p_new_q_yes          REAL DEFAULT NULL,
    p_new_q_no           REAL DEFAULT NULL,
    p_new_q_values        JSONB DEFAULT NULL,
    p_new_probabilities   JSONB DEFAULT NULL,
    p_new_history         JSONB DEFAULT NULL,
    p_expected_version    INTEGER DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_market       RECORD;
    v_pred_id      INTEGER;
    v_new_balance  INTEGER;
    v_rows         INTEGER;
BEGIN
    IF p_amount < 10 THEN RAISE EXCEPTION 'Minimum trade is 10 tokens'; END IF;
    IF p_shares <= 0 THEN RAISE EXCEPTION 'Invalid shares value'; END IF;
    IF p_shares > p_amount * 20 THEN RAISE EXCEPTION 'Shares value out of range'; END IF;

    SELECT * INTO v_market FROM markets WHERE id = p_market_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Market not found'; END IF;
    IF v_market.status != 'active' OR v_market.resolution IS NOT NULL THEN
        RAISE EXCEPTION 'Market is not active';
    END IF;

    UPDATE profiles SET balance = balance - p_amount, trades = trades + 1
    WHERE id = p_user_id AND balance >= p_amount
    RETURNING balance INTO v_new_balance;
    IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

    INSERT INTO predictions (user_id, market_id, direction, amount, shares, entry_prob, status, option_index)
    VALUES (p_user_id, p_market_id, p_direction, p_amount, p_shares, p_entry_prob, 'active', p_option_index)
    RETURNING id INTO v_pred_id;

    UPDATE markets SET
        probability    = COALESCE(p_new_probability, probability),
        logit          = COALESCE(p_new_logit, logit),
        q_yes          = COALESCE(p_new_q_yes, q_yes),
        q_no           = COALESCE(p_new_q_no, q_no),
        q_values       = COALESCE(p_new_q_values, q_values),
        probabilities  = COALESCE(p_new_probabilities, probabilities),
        volume         = volume + p_amount,
        traders        = traders + 1,
        history        = COALESCE(p_new_history, history),
        version        = version + 1
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

CREATE OR REPLACE FUNCTION sell_position(
    p_user_id          UUID,
    p_prediction_id    INTEGER,
    p_revenue          INTEGER,
    p_new_probability     REAL DEFAULT NULL,
    p_new_logit          REAL DEFAULT NULL,
    p_new_q_yes          REAL DEFAULT NULL,
    p_new_q_no           REAL DEFAULT NULL,
    p_new_q_values        JSONB DEFAULT NULL,
    p_new_probabilities   JSONB DEFAULT NULL,
    p_new_history         JSONB DEFAULT NULL,
    p_expected_version    INTEGER DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_pred         RECORD;
    v_market       RECORD;
    v_new_balance  INTEGER;
    v_rows         INTEGER;
BEGIN
    IF p_revenue < 0 THEN RAISE EXCEPTION 'Revenue cannot be negative'; END IF;

    SELECT * INTO v_pred FROM predictions WHERE id = p_prediction_id AND user_id = p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Prediction not found'; END IF;
    IF v_pred.status != 'active' THEN RAISE EXCEPTION 'Position is not active'; END IF;
    IF p_revenue > v_pred.amount * 10 THEN RAISE EXCEPTION 'Revenue exceeds maximum'; END IF;

    SELECT * INTO v_market FROM markets WHERE id = v_pred.market_id;
    IF v_market.status != 'active' OR v_market.resolution IS NOT NULL THEN
        RAISE EXCEPTION 'Market is not active';
    END IF;

    UPDATE predictions SET status = 'sold', payout = p_revenue WHERE id = p_prediction_id;

    UPDATE markets SET
        probability    = COALESCE(p_new_probability, probability),
        logit          = COALESCE(p_new_logit, logit),
        q_yes          = COALESCE(p_new_q_yes, q_yes),
        q_no           = COALESCE(p_new_q_no, q_no),
        q_values       = COALESCE(p_new_q_values, q_values),
        probabilities  = COALESCE(p_new_probabilities, probabilities),
        volume         = volume + p_revenue,
        history        = COALESCE(p_new_history, history),
        version        = version + 1
    WHERE id = v_pred.market_id
      AND (p_expected_version IS NULL OR version = p_expected_version);

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
        RAISE EXCEPTION 'Market was updated by another trade. Please try again.';
    END IF;

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

-- ============================================================
-- RPCS — MARKET RESOLUTION
-- ============================================================

CREATE OR REPLACE FUNCTION resolve_market(
    p_market_id    INTEGER,
    p_resolution   TEXT,
    p_resolved_by  UUID
) RETURNS void AS $$
DECLARE
    pred           RECORD;
    v_payout       REAL;
    v_market       RECORD;
    v_new_balance  INTEGER;
BEGIN
    SELECT * INTO v_market FROM markets WHERE id = p_market_id AND resolution IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Market not found or already resolved'; END IF;

    IF v_market.created_by != p_resolved_by AND NOT EXISTS (
        SELECT 1 FROM profiles WHERE id = p_resolved_by AND is_admin = true
    ) THEN
        RAISE EXCEPTION 'Only the market creator or an admin can resolve this market';
    END IF;

    UPDATE markets SET resolution = p_resolution, resolved_at = now(),
        resolved_by = p_resolved_by, status = 'closed'
    WHERE id = p_market_id AND resolution IS NULL;

    FOR pred IN SELECT * FROM predictions WHERE market_id = p_market_id AND status = 'active' LOOP
        IF p_resolution = 'void' THEN
            v_payout := pred.amount;
            UPDATE predictions SET status = 'voided', payout = v_payout WHERE id = pred.id;
            UPDATE profiles SET balance = balance + v_payout WHERE id = pred.user_id;
            SELECT balance INTO v_new_balance FROM profiles WHERE id = pred.user_id;
            INSERT INTO transactions (user_id, type, amount, balance_after, description, market_id, prediction_id)
            VALUES (pred.user_id, 'payout', v_payout, v_new_balance,
                    'Market voided — refund of ' || ROUND(v_payout::numeric, 1) || ' tokens', p_market_id, pred.id);
            INSERT INTO notifications (user_id, type, title, message, market_id)
            VALUES (pred.user_id, 'payout', 'Market Voided',
                    'Market was voided. You received ' || v_payout || ' tokens back.', p_market_id);

        ELSIF pred.direction = p_resolution THEN
            v_payout := pred.shares;
            UPDATE predictions SET status = 'won', payout = v_payout WHERE id = pred.id;
            UPDATE profiles SET
                balance = balance + v_payout,
                points  = points + GREATEST(10, ROUND(v_payout - pred.amount)),
                accuracy = CASE WHEN trades > 0 THEN (accuracy * trades + 1) / (trades + 1) ELSE 1 END
            WHERE id = pred.user_id;
            SELECT balance INTO v_new_balance FROM profiles WHERE id = pred.user_id;
            INSERT INTO transactions (user_id, type, amount, balance_after, description, market_id, prediction_id)
            VALUES (pred.user_id, 'payout', ROUND(v_payout), v_new_balance,
                    'Won ' || ROUND(v_payout::numeric, 1) || ' tokens on ' || UPPER(pred.direction), p_market_id, pred.id);
            INSERT INTO notifications (user_id, type, title, message, market_id)
            VALUES (pred.user_id, 'payout', 'You Won!',
                    'Your prediction was correct! You earned ' || ROUND(v_payout::numeric, 1) || ' tokens.', p_market_id);
        ELSE
            UPDATE predictions SET status = 'lost', payout = 0 WHERE id = pred.id;
            UPDATE profiles SET
                accuracy = CASE WHEN trades > 0 THEN (accuracy * trades) / (trades + 1) ELSE 0 END
            WHERE id = pred.user_id;
            INSERT INTO notifications (user_id, type, title, message, market_id)
            VALUES (pred.user_id, 'resolution', 'Market Resolved',
                    'Your prediction was incorrect. Better luck next time!', p_market_id);
        END IF;
    END LOOP;

    INSERT INTO notifications (user_id, type, title, message, market_id)
    SELECT created_by, 'resolution', 'Your Market Was Resolved',
           'Your market has been resolved as ' || UPPER(p_resolution) || '.', p_market_id
    FROM markets WHERE id = p_market_id AND created_by IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION resolve_multi_market(
    p_market_id      INTEGER,
    p_winning_index  INTEGER,
    p_resolved_by    UUID
) RETURNS void AS $$
DECLARE
    pred           RECORD;
    v_payout       REAL;
    v_market       RECORD;
    v_resolution   TEXT;
    v_new_balance  INTEGER;
BEGIN
    SELECT * INTO v_market FROM markets WHERE id = p_market_id AND resolution IS NULL AND market_type = 'multi';
    IF NOT FOUND THEN RAISE EXCEPTION 'Multi-outcome market not found or already resolved'; END IF;

    IF v_market.created_by != p_resolved_by AND NOT EXISTS (
        SELECT 1 FROM profiles WHERE id = p_resolved_by AND is_admin = true
    ) THEN
        RAISE EXCEPTION 'Only the market creator or an admin can resolve this market';
    END IF;

    v_resolution := CASE WHEN p_winning_index = -1 THEN 'void'
                         ELSE v_market.options->p_winning_index->>'label' END;

    UPDATE markets SET resolution = v_resolution, resolved_at = now(),
        resolved_by = p_resolved_by, status = 'closed'
    WHERE id = p_market_id AND resolution IS NULL;

    FOR pred IN SELECT * FROM predictions WHERE market_id = p_market_id AND status = 'active' LOOP
        IF p_winning_index = -1 THEN
            v_payout := pred.amount;
            UPDATE predictions SET status = 'voided', payout = v_payout WHERE id = pred.id;
            UPDATE profiles SET balance = balance + v_payout WHERE id = pred.user_id;
            SELECT balance INTO v_new_balance FROM profiles WHERE id = pred.user_id;
            INSERT INTO transactions (user_id, type, amount, balance_after, description, market_id, prediction_id)
            VALUES (pred.user_id, 'payout', v_payout, v_new_balance,
                    'Market voided — refund of ' || ROUND(v_payout::numeric, 1) || ' tokens', p_market_id, pred.id);
            INSERT INTO notifications (user_id, type, title, message, market_id)
            VALUES (pred.user_id, 'payout', 'Market Voided',
                    'Market was voided. You received ' || v_payout || ' tokens back.', p_market_id);

        ELSIF pred.option_index = p_winning_index THEN
            v_payout := pred.shares;
            UPDATE predictions SET status = 'won', payout = v_payout WHERE id = pred.id;
            UPDATE profiles SET
                balance = balance + v_payout,
                points  = points + GREATEST(10, ROUND(v_payout - pred.amount)),
                accuracy = CASE WHEN trades > 0 THEN (accuracy * trades + 1) / (trades + 1) ELSE 1 END
            WHERE id = pred.user_id;
            SELECT balance INTO v_new_balance FROM profiles WHERE id = pred.user_id;
            INSERT INTO transactions (user_id, type, amount, balance_after, description, market_id, prediction_id)
            VALUES (pred.user_id, 'payout', ROUND(v_payout), v_new_balance,
                    'Won ' || ROUND(v_payout::numeric, 1) || ' tokens on "' || LEFT(v_resolution, 40) || '"', p_market_id, pred.id);
            INSERT INTO notifications (user_id, type, title, message, market_id)
            VALUES (pred.user_id, 'payout', 'You Won!',
                    'Your prediction was correct! You earned ' || ROUND(v_payout::numeric, 1) || ' tokens.', p_market_id);
        ELSE
            UPDATE predictions SET status = 'lost', payout = 0 WHERE id = pred.id;
            UPDATE profiles SET
                accuracy = CASE WHEN trades > 0 THEN (accuracy * trades) / (trades + 1) ELSE 0 END
            WHERE id = pred.user_id;
            INSERT INTO notifications (user_id, type, title, message, market_id)
            VALUES (pred.user_id, 'resolution', 'Market Resolved',
                    'Market resolved as "' || v_resolution || '". Your prediction was incorrect.', p_market_id);
        END IF;
    END LOOP;

    INSERT INTO notifications (user_id, type, title, message, market_id)
    SELECT created_by, 'resolution', 'Your Market Was Resolved',
           'Your market has been resolved as "' || v_resolution || '".', p_market_id
    FROM markets WHERE id = p_market_id AND created_by IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPCS — MARKET ADMIN
-- ============================================================

CREATE OR REPLACE FUNCTION approve_market(p_market_id INTEGER, p_approved_by UUID)
RETURNS void AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_approved_by AND is_admin = true) THEN
        RAISE EXCEPTION 'Only admins can approve markets';
    END IF;
    UPDATE markets SET status = 'active', approved_by = p_approved_by, approved_at = now()
    WHERE id = p_market_id AND status = 'pending';
    IF NOT FOUND THEN RAISE EXCEPTION 'Market not found or not in pending status'; END IF;
    INSERT INTO notifications (user_id, type, title, message, market_id)
    SELECT created_by, 'resolution', 'Market Approved!',
           'Your market "' || LEFT(title, 80) || '" has been approved and is now live.', p_market_id
    FROM markets WHERE id = p_market_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reject_market(p_market_id INTEGER, p_rejected_by UUID, p_reason TEXT DEFAULT 'Does not meet guidelines')
RETURNS void AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_rejected_by AND is_admin = true) THEN
        RAISE EXCEPTION 'Only admins can reject markets';
    END IF;
    INSERT INTO notifications (user_id, type, title, message, market_id)
    SELECT created_by, 'resolution', 'Market Rejected',
           'Your market "' || LEFT(title, 80) || '" was not approved. Reason: ' || p_reason, NULL
    FROM markets WHERE id = p_market_id AND status = 'pending';
    DELETE FROM markets WHERE id = p_market_id AND status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION delete_market(p_market_id INTEGER, p_deleted_by UUID)
RETURNS VOID AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_deleted_by AND is_admin = true) THEN
        RAISE EXCEPTION 'Only admins can delete markets';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM markets WHERE id = p_market_id) THEN
        RAISE EXCEPTION 'Market not found';
    END IF;
    DELETE FROM transactions WHERE market_id = p_market_id;
    DELETE FROM predictions   WHERE market_id = p_market_id;
    DELETE FROM comments      WHERE market_id = p_market_id;
    DELETE FROM watchlist     WHERE market_id = p_market_id;
    DELETE FROM markets       WHERE id = p_market_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION close_expired_markets()
RETURNS INTEGER AS $$
DECLARE closed_count INTEGER;
BEGIN
    UPDATE markets SET status = 'closed'
    WHERE status = 'active' AND resolution IS NULL AND closes_at < CURRENT_DATE;
    GET DIAGNOSTICS closed_count = ROW_COUNT;
    RETURN closed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPCS — BONUSES
-- ============================================================

CREATE OR REPLACE FUNCTION claim_daily_bonus(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_bonus       INTEGER := 50;
    v_rows        INTEGER;
    v_new_balance INTEGER;
BEGIN
    UPDATE profiles SET balance = balance + v_bonus, last_daily_bonus = CURRENT_DATE
    WHERE id = p_user_id AND (last_daily_bonus IS NULL OR last_daily_bonus < CURRENT_DATE)
    RETURNING balance INTO v_new_balance;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN RETURN 0; END IF;
    INSERT INTO transactions (user_id, type, amount, balance_after, description)
    VALUES (p_user_id, 'signup_bonus', v_bonus, v_new_balance, 'Daily login bonus');
    RETURN v_bonus;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION claim_referral(p_user_id UUID, p_referrer_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_bonus       INTEGER := 100;
    v_rows        INTEGER;
    v_new_balance INTEGER;
BEGIN
    IF p_user_id = p_referrer_id THEN RETURN FALSE; END IF;
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_referrer_id) THEN RETURN FALSE; END IF;
    UPDATE profiles SET referred_by = p_referrer_id
    WHERE id = p_user_id AND referred_by IS NULL;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN RETURN FALSE; END IF;
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

-- ============================================================
-- RPCS — NOTIFICATIONS
-- ============================================================

CREATE OR REPLACE FUNCTION notify_closing_soon()
RETURNS INTEGER AS $$
DECLARE
    mkt            RECORD;
    pred           RECORD;
    notified_count INTEGER := 0;
BEGIN
    FOR mkt IN
        SELECT * FROM markets
        WHERE status = 'active' AND resolution IS NULL
          AND closes_at >= CURRENT_DATE AND closes_at <= CURRENT_DATE + INTERVAL '1 day'
    LOOP
        FOR pred IN SELECT DISTINCT user_id FROM predictions
                    WHERE market_id = mkt.id AND status = 'active'
        LOOP
            IF NOT EXISTS (SELECT 1 FROM notifications
                           WHERE user_id = pred.user_id AND market_id = mkt.id AND type = 'closing_soon') THEN
                INSERT INTO notifications (user_id, type, title, message, market_id)
                VALUES (pred.user_id, 'closing_soon', 'Market Closing Soon',
                        'Market "' || LEFT(mkt.title, 80) || '" closes tomorrow. Sell or hold?', mkt.id);
                notified_count := notified_count + 1;
            END IF;
        END LOOP;
    END LOOP;
    RETURN notified_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPCS — UTILITIES
-- ============================================================

CREATE OR REPLACE FUNCTION get_market_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT count(*)::INTEGER FROM markets);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_weekly_digest()
RETURNS TABLE(
    user_id              UUID,
    user_name            TEXT,
    user_email           TEXT,
    active_positions     INTEGER,
    closing_soon_markets JSONB,
    leaderboard_rank     INTEGER,
    rank_change          INTEGER,
    weekly_pnl           INTEGER,
    new_markets_count    INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH user_active AS (
        SELECT p.user_id, count(*)::INTEGER as pos_count
        FROM predictions p WHERE p.status = 'active' GROUP BY p.user_id
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
        SELECT id, ROW_NUMBER() OVER (ORDER BY points DESC)::INTEGER as rank FROM profiles
    ),
    weekly_resolved AS (
        SELECT pred.user_id, COALESCE(SUM(pred.payout - pred.amount), 0)::INTEGER as pnl
        FROM predictions pred JOIN markets m ON m.id = pred.market_id
        WHERE m.resolved_at >= now() - INTERVAL '7 days' AND pred.status IN ('won', 'lost')
        GROUP BY pred.user_id
    ),
    new_mkts AS (SELECT count(*)::INTEGER as cnt FROM markets WHERE created_at >= now() - INTERVAL '7 days')
    SELECT prof.id, prof.name, au.email::TEXT,
           COALESCE(ua.pos_count, 0), cs.markets, COALESCE(r.rank, 0),
           0, COALESCE(wr.pnl, 0), nm.cnt
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

-- ============================================================
-- RPCS — AI KEY (SECURITY DEFINER — no client access to app_config)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_ai_key()
RETURNS TEXT AS $$
DECLARE result TEXT;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    SELECT value INTO result FROM public.app_config WHERE key = 'anthropic_api_key';
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- RPCS — BRIEFING CACHE (readable by all authed users, writable by admins only)
-- ============================================================

CREATE OR REPLACE FUNCTION get_briefing_cache()
RETURNS JSONB AS $$
DECLARE cache_val TEXT; cached_at TEXT;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    SELECT value INTO cache_val FROM public.app_config WHERE key = 'briefing_cache';
    SELECT value INTO cached_at FROM public.app_config WHERE key = 'briefing_cached_at';
    IF cache_val IS NULL THEN RETURN NULL; END IF;
    RETURN jsonb_build_object('cache', cache_val::jsonb, 'cached_at', cached_at);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION set_briefing_cache(p_cache TEXT, p_cached_at TEXT)
RETURNS VOID AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
        RAISE EXCEPTION 'Admin only';
    END IF;
    INSERT INTO public.app_config (key, value) VALUES ('briefing_cache', p_cache)
        ON CONFLICT (key) DO UPDATE SET value = p_cache;
    INSERT INTO public.app_config (key, value) VALUES ('briefing_cached_at', p_cached_at)
        ON CONFLICT (key) DO UPDATE SET value = p_cached_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
