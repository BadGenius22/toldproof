-- TOLDPROOF — Prediction verdicts denormalization (leaderboard skill score).
--
-- The AI Resolution Agent classifies every verdict's difficulty (trivial /
-- easy / medium / hard). That data lives in the Walrus reasoning-trace JSON
-- and is too slow to fetch for every row of the leaderboard. We denormalize
-- it into Postgres at resolve-time so /leaderboard and /[handle] can compute
-- a difficulty-weighted skill score without N round-trips to Walrus.
--
-- The Move contract remains the source of truth for hit/miss + resolver
-- identity. This table is a cache + difficulty index. If it drifts, a
-- backfill script can rebuild from Walrus traces.
--
-- Skill Score formula uses these rows directly: Wilson lower bound at 95%
-- over difficulty-weighted hits (trivial=0.0, easy=0.3, medium=1.0,
-- hard=2.0). See lib/leaderboard.ts.
--
-- Run once:
--   pnpm tsx --env-file=.env.local scripts/migrate.ts migrations/003_prediction_verdicts.sql

CREATE TABLE IF NOT EXISTS prediction_verdicts (
  prediction_id          TEXT PRIMARY KEY,           -- 0x… Sui object id
  identity               TEXT NOT NULL,              -- x_handle for humans, alias for agents
  entity_type            INTEGER NOT NULL,           -- 0 = human, 1 = agent (matches Move)
  hit                    BOOLEAN NOT NULL,
  difficulty             TEXT NOT NULL,              -- 'trivial' | 'easy' | 'medium' | 'hard'
  difficulty_reasoning   TEXT,                       -- AI's one-line justification
  confidence             REAL NOT NULL,              -- 0..1, from the verdict
  sealed_at_ms           BIGINT NOT NULL,            -- for recency analysis later
  resolved_at_ms         BIGINT NOT NULL,
  resolver_addr          TEXT NOT NULL,              -- 0x… address that signed mark_resolved
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup by identity for /[handle] profile rendering.
CREATE INDEX IF NOT EXISTS idx_verdicts_identity
  ON prediction_verdicts (LOWER(identity));

-- Fast scan-by-difficulty for the leaderboard histogram aggregation.
CREATE INDEX IF NOT EXISTS idx_verdicts_difficulty
  ON prediction_verdicts (difficulty);

-- Constrain difficulty to the four valid values.
ALTER TABLE prediction_verdicts
  DROP CONSTRAINT IF EXISTS prediction_verdicts_difficulty_check;
ALTER TABLE prediction_verdicts
  ADD CONSTRAINT prediction_verdicts_difficulty_check
  CHECK (difficulty IN ('trivial', 'easy', 'medium', 'hard'));

COMMENT ON TABLE prediction_verdicts IS
  'Denormalized verdict + difficulty cache. Source of truth is on-chain (Move) + Walrus (reasoning trace). Used by /leaderboard skill-score computation.';
