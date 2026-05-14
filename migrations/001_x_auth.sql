-- TOLDPROOF — X OAuth + handle release schema (Phase 1).
--
-- Run once against your Neon DB:
--   psql $DATABASE_URL -f migrations/001_x_auth.sql
-- Or via Neon SQL Editor (paste contents).
--
-- All three tables are isolated to this feature — no foreign keys to existing
-- protocol state. The on-chain Sui contract remains the source of truth for
-- predictions; this DB is only the off-chain identity-binding layer.

-- One X handle ↔ one current wallet (mutable via the release flow).
-- OAuth tokens are encrypted at rest with TOLDPROOF_OAUTH_KEY before insert.
CREATE TABLE IF NOT EXISTS x_account_links (
  x_user_id          TEXT PRIMARY KEY,
  x_handle           TEXT NOT NULL,
  wallet_address     TEXT NOT NULL,
  access_token_enc   TEXT NOT NULL,
  refresh_token_enc  TEXT NOT NULL,
  token_expires_at   TIMESTAMPTZ NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_x_handle_lc
  ON x_account_links (LOWER(x_handle));
CREATE INDEX IF NOT EXISTS idx_x_wallet
  ON x_account_links (wallet_address);

-- Ephemeral OAuth-flow state. Holds the PKCE code_verifier between
-- /api/x/auth/start and /api/x/auth/callback. 5-minute TTL.
CREATE TABLE IF NOT EXISTS x_oauth_state (
  state           TEXT PRIMARY KEY,
  code_verifier   TEXT NOT NULL,
  wallet_address  TEXT NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Handle-recovery via tweet attestation. User posts a tweet from the real X
-- account that contains their verification_code; backend matches and rebinds.
CREATE TABLE IF NOT EXISTS handle_release_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  x_handle            TEXT NOT NULL,
  requesting_wallet   TEXT NOT NULL,
  verification_code   TEXT NOT NULL UNIQUE,
  status              TEXT NOT NULL DEFAULT 'pending',
  tweet_id            TEXT,
  tweet_url           TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at         TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ NOT NULL,
  CONSTRAINT status_values CHECK (status IN ('pending', 'verified', 'expired', 'cancelled'))
);
CREATE INDEX IF NOT EXISTS idx_release_pending
  ON handle_release_requests (status, expires_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_release_handle
  ON handle_release_requests (LOWER(x_handle));

-- Cleanup helper — call periodically (cron) to expire stale state.
-- Not wired up in v1; included for ops convenience.
COMMENT ON TABLE x_oauth_state IS 'Ephemeral PKCE state, 5 min TTL. Delete rows where expires_at < now().';
COMMENT ON TABLE handle_release_requests IS 'Release-flow requests, 24h TTL. Mark expired rows status=expired.';
