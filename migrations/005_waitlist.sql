-- TOLDPROOF — waitlist signups for Pro tier + Reputation API.
-- Run once against Neon:
--   pnpm tsx --env-file=.env.local scripts/migrate.ts migrations/005_waitlist.sql
--
-- One row per (email, tier). The functional unique index lets us dedupe
-- case-insensitively without losing the original email casing for replies.

CREATE TABLE IF NOT EXISTS waitlist_signups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL,
  tier         TEXT NOT NULL,
  source       TEXT,
  x_handle     TEXT,
  notes        TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tier_values CHECK (tier IN ('pro', 'reputation-api'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_email_tier
  ON waitlist_signups (LOWER(email), tier);

CREATE INDEX IF NOT EXISTS idx_waitlist_tier_created
  ON waitlist_signups (tier, created_at DESC);

COMMENT ON TABLE waitlist_signups IS
  'Pro + Reputation API tier waitlist signups. Triage by created_at DESC; the inbound flow on hi@toldproof.xyz still works for users who prefer email.';
