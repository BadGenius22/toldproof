# ERRORS.md — failure log

Format: `## YYYY-MM-DD — [topic]` then What didn't work / What worked / Note for next time.
Check this file before re-attempting a similar task.

## 2026-06-02 — Neon DB `fetch failed` / ETIMEDOUT in local dev (WSL2)

`HomePage → getTopProfile → buildLeaderboard → loadVerdictIndex → getAllVerdicts`
threw `TypeError: fetch failed` with `code: ETIMEDOUT`. The page still rendered
(the path is double-guarded: `loadVerdictIndex` catches + warns, `getTopProfile`
falls back to `dewaxindo`), but the leaderboard silently degraded to all-unknown
difficulty (skill scores 0, nobody ranked).

**Root cause:** WSL2 has no IPv6 egress. Neon's pooler host publishes both A
(IPv4, reachable) and AAAA (IPv6, "Network is unreachable" from WSL2). Node 24's
built-in `fetch` (undici Happy-Eyeballs / `autoSelectFamily`) attempts IPv6 and
surfaces ETIMEDOUT (~800ms) instead of falling back to the working IPv4. Sui RPC
was unaffected, which is why only the DB call failed.

**What didn't work:**
- `NODE_OPTIONS='--dns-result-order=ipv4first'` alone (already in the `dev`
  script) — still ETIMEDOUT. Reordering isn't enough; Happy-Eyeballs still races
  the unreachable IPv6 address and its error wins.

**What worked (verified against live Neon host, HTTP 400 = connected):**
- Add `--no-network-family-autoselection` alongside `ipv4first`:
  `NODE_OPTIONS='--dns-result-order=ipv4first --no-network-family-autoselection'`.
  Equivalent in-code: `net.setDefaultAutoSelectFamily(false)` +
  `dns.setDefaultResultOrder('ipv4first')`.

**Note for next time:**
- This is WSL2-only; Vercel has working IPv6, so the fix lives in the `dev`
  script (not `build`/`start`) to avoid changing production connection behavior.
- Standalone DB-touching scripts run via `tsx --env-file=.env.local` do NOT
  inherit this NODE_OPTIONS. If one ever throws ETIMEDOUT against Neon on WSL2,
  prefix it with the same NODE_OPTIONS.
