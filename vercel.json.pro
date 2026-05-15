{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "//": "Original sub-daily schedules. Restore as vercel.json when on Vercel Pro tier (or pipe through GitHub Actions). Reveal + resolve at 5-min cadence make the autonomous resolution loop feel real-time; reputation at 15-min rebuilds profile chains; agent-fleet at 6-hour drops 4 fresh predictions per day from the demo fleet. Verify-bot also at 5-min for the autonomous @toldproof mention bot (Basic-tier-only, X /2/tweets/search/recent). NOTE: Vercel's schema validator rejects the `//` field in the live vercel.json — so this comment file is the only place this context can live. The active vercel.json (Hobby tier, daily cadence, just reveal + resolve at 06:00 and 07:00 UTC) is the bare-minimum config with no comments. Reputation, agent-fleet, and verify-bot are off-cron on Hobby and must be fired manually via curl with CRON_SECRET (or wait for Pro upgrade).",
  "crons": [
    {
      "path": "/api/cron/reveal",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/verify-bot",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/resolve",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/reputation",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/agent-fleet",
      "schedule": "0 */6 * * *"
    }
  ]
}
