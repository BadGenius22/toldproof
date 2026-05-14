-- TOLDPROOF — Seal quota tracking (Phase 5b).
--
-- Enforces the "10 free predictions per month per human" rule advertised on
-- the pricing page. One row per (x_handle, calendar month). Free + paid
-- counters are tracked separately so the analyst dashboard can later show
-- "this user crossed into paid on May 8th."
--
-- The on-chain contract has no concept of quotas — this is an off-chain
-- gate at the API layer. Sophisticated users who bypass our UI can still
-- call seal_prediction directly and burn their own gas; we treat that as
-- a documented edge case (the V3 audit's FPC-1 design observation).
--
-- Run once:
--   pnpm tsx --env-file=.env.local scripts/migrate.ts migrations/002_seal_quota.sql

CREATE TABLE IF NOT EXISTS seal_quota (
  x_handle      TEXT NOT NULL,
  year_month    TEXT NOT NULL,                   -- 'YYYY-MM' bucket
  free_used     INTEGER NOT NULL DEFAULT 0,
  paid_used     INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (x_handle, year_month)
);

CREATE INDEX IF NOT EXISTS idx_quota_handle
  ON seal_quota (LOWER(x_handle));

COMMENT ON TABLE seal_quota IS
  'Off-chain per-handle monthly seal quota. Free tier = 10/month; overage = $0.10 each via seal_prediction_paid<T>.';
