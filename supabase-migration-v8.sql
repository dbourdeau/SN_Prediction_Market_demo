-- Migration v8: Audit log for admin actions
-- Run this in your Supabase SQL Editor after all previous migrations.

CREATE TABLE IF NOT EXISTS audit_log (
    id          SERIAL PRIMARY KEY,
    actor_id    UUID NOT NULL REFERENCES profiles(id),
    action      TEXT NOT NULL,          -- e.g. 'resolve_market', 'approve_market', 'adjust_balance'
    target_type TEXT NOT NULL,          -- e.g. 'market', 'user'
    target_id   TEXT NOT NULL,          -- market id or user id
    details     JSONB DEFAULT '{}',     -- extra context (resolution, amount, reason, etc.)
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for reverse-chronological listing
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

-- RLS: only admins can read, any authenticated user can insert (server-side logging)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit log"
    ON audit_log FOR SELECT
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

CREATE POLICY "Authenticated users can insert audit log"
    ON audit_log FOR INSERT
    TO authenticated
    WITH CHECK (actor_id = auth.uid());
