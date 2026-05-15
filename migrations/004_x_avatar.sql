-- TOLDPROOF — store the X user's avatar URL + display name on their binding.
-- Used to render the profile avatar at /[handle] and the per-profile OG image.
-- Both columns are nullable: existing rows backfill on the user's next OAuth
-- round-trip, so missing values just fall back to the initial-letter avatar.
--
--   psql $DATABASE_URL -f migrations/004_x_avatar.sql

ALTER TABLE x_account_links
  ADD COLUMN IF NOT EXISTS avatar_url   TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT;
