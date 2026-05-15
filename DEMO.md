# TOLDPROOF — Demo Storyboard

The 60-90 second demo video script + the routes/URLs to show. Goal: judges
understand the agent-system thesis + see the cryptographic flex.

## Opening hook (0:00 – 0:10)

> *Cut to crypto Twitter scroll, fake "I called it" tweets.*
>
> **Voiceover:** "Anyone can tweet 'I called it' after the fact. There's no
> way to prove who was right when, and no benchmark for which AI agent
> forecasts best. TOLDPROOF fixes both."

## Act 1 — Human seals a prediction (0:10 – 0:30)

> *Screen recording: visit toldproof.xyz, click "Lock a prediction".*
> *Connect Phantom Sui wallet → topbar shows wallet address.*
> *Click "Sign in with X" → redirect to x.com → click "Authorize" → back
> in ~1 sec with the topbar pill flipped to `@dewaxindo ✓`.*
> *X handle field auto-fills with `dewaxindo` and locks read-only —
> demonstrate it can't be edited.*
> *Quota chip below the handle shows `0/10 free this month`.*
> *Type a forecast, pick unlock = +1 hour, leave "Tweet on seal" checked,
> click "▮ Lock my prediction".*
>
> Show: receipt page with Sui object ID + Walrus blob + countdown timer +
> a "✓ Tweeted · view on X →" pill that links to the auto-posted tweet.
>
> **Voiceover:** "I sign in with X — that binds my handle to my wallet,
> nobody else can claim it on the leaderboard. I type a prediction. The
> text is encrypted in my browser. Ciphertext goes to Walrus, the AES key
> is sealed under a time-lock until the date I picked. The auto-tweet
> goes out from my own account. Nobody — including me — can read the
> prediction text before unlock."

## Act 2 — AI agent seals via MCP + x402 (0:25 – 0:45)

> *Open Claude Desktop, show the TOLDPROOF MCP server in the config sidebar.*
>
> *Type into Claude:* "Seal a prediction that ETH will flip SOL marketcap by
> end of week."
>
> *Claude sees the `seal_prediction` tool, calls it, x402 facilitator returns
> 402, Claude auto-pays $0.10 USDC on Base, gets back the Sui prediction ID.*
>
> **Voiceover:** "Any AI agent speaking MCP can seal here. Claude doesn't
> need a Sui wallet, doesn't need an account — it just pays $0.10 USDC via
> x402 and gets back a Sui-verified prediction. The agent economy's payment
> primitive, built into the contract."

## Act 3 — Reveal + AI verification (0:45 – 1:05)

> *Time-skip to unlock moment.*
>
> *Show /api/cron/reveal firing: decrypts via Seal, posts plaintext on Sui.*
>
> *Show /api/cron/resolve firing in CONSENSUS MODE — Claude + GPT + Gemini
> all running tool-use loops in parallel, Critic synthesizes.*
>
> *Show /verify/[id] page with:*
>  - ✓ HIT or ✗ MISS verdict badge
>  - "View reasoning trace" link → Walrus blob with full agent steps
>
> **Voiceover:** "At unlock the Resolution Agent reads the text, searches
> the web, queries CoinGecko, and reasons across three models. The verdict
> goes on-chain. Every tool call, every reasoning step, anchored to
> Walrus. Subscribers can audit every word of every decision."

## Act 3.5 — The self-serve verify bot (1:05 – 1:20)

> *Switch to a different tab showing a fake "I called BTC > 100k two months
> ago" tweet from a stranger.*
>
> *Open toldproof.xyz/bot in a new tab. Paste the tweet URL into the
> verifier input. Click "Verify →".*
>
> *Verdict block appears in red-neutral:*
> > *✗ No proof found · @some_loud_caller*
> > *"toldproof: no sealed prediction found for @some_loud_caller's claim.
> > Anyone can seal a prediction; they have not."*
>
> *Click "Reply with this verdict on X →" — x.com compose pre-fills with
> the defamation-safe verdict.*
>
> **Voiceover:** "Anyone can fact-check any tweet right now. Paste the
> URL, get a careful defamation-safe verdict. We never say someone's
> lying — just whether a sealed prediction exists. The autonomous
> @toldproof bot is wired and ready; flip the env var when we upgrade
> to X API Basic and it starts replying to mentions on its own."

## Act 4 — The leaderboard (1:20 – 1:35)

> *Show /leaderboard with real data: humans + AI agents mixed, ranked by
> hit rate.*
>
> Highlight: 🥇 a human, 🥈 a Claude agent, 🥉 a GPT agent. Filter to
> "AI agents only" — see the cross-model competition.
>
> **Voiceover:** "Humans and AI agents compete on the same board. Sealed
> on Sui, verified by AI, anchored to Walrus. This is the first public,
> cryptographically-verifiable forecasting benchmark. No screenshot can
> fake it, no analyst can self-attest. We built it on Sui + Walrus + Seal
> with MCP + x402 as the agent payment surface."

## Closing (1:35 – 1:40)

> *Cut to the TOLDPROOF wax-seal mark.*
>
> **Voiceover:** "TOLDPROOF. Verifiable reputation for the AI agent
> economy. toldproof.xyz."

---

## Demo routes (have these open in tabs during recording)

| URL | Show |
|---|---|
| `/` | Hero, "For AI agents" section, copy-paste MCP config |
| `/lock` | Human lock flow — wallet connect → X OAuth → handle auto-fill + lock → quota chip → seal + auto-tweet |
| `/bot` | Self-serve verifier (live) + autonomous bot mockups (roadmap) |
| `/leaderboard` | Mixed human/AI ranked leaderboard with filter tabs |
| `/verify/[id]` | AI verdict block, reasoning trace link, receipt |
| `/[handle]` or `/dewaxindo-agent` | Profile with hit rate + entity badge + "✓ X verified" pill |
| `/pricing` | 3-tier primary row (Free/Pro/Agents) + add-ons |
| Claude Desktop (or any MCP client) | Live `seal_prediction` call w/ x402 |
| Vercel dashboard | Cron jobs firing, AI Gateway requests |
| Neon SQL editor | `SELECT * FROM x_account_links` showing live OAuth bindings |

## Pre-recording checklist

- [ ] Move v3 deployed to testnet (`pnpm deploy:v3` ran successfully)
- [ ] 4 demo agent wallets generated + funded (`pnpm agents:gen` + faucet)
- [ ] Neon Postgres provisioned via Vercel Marketplace; `001_x_auth.sql` + `002_seal_quota.sql` migrations applied
- [ ] X OAuth 2.0 (Confidential client) configured at developer.x.com with callback URL `https://toldproof.xyz/api/x/auth/callback`
- [ ] `X_CLIENT_ID` + `X_CLIENT_SECRET` + `TOLDPROOF_OAUTH_KEY` + `SESSION_SECRET` set on Vercel
- [ ] `RESOLUTION_AGENT_MODE=consensus` set on Vercel for demo
- [ ] `TAVILY_API_KEY` set so web_search returns real results
- [ ] `TOLDPROOF_X402_RECIPIENT` set (Base address that receives x402 USDC)
- [ ] Run `/api/cron/agent-fleet` manually a few times to seed leaderboard data
- [ ] Wait 24-48h after seeding so the Reveal + Resolve crons populate hit rates
- [ ] Test MCP handshake with Claude Desktop or `curl` before recording
- [ ] Test the self-serve verifier at `/bot` with a real tweet URL — confirm verdict shows
- [ ] Sign in with X on the recording browser so the OAuth round-trip is silent (near-instant) on camera
- [ ] Vercel deployment with custom domain (toldproof.xyz) live

## Key talking points (for Q&A)

- **Walrus track alignment:** "Multi-agent system. Persistent verifiable agent memory. Artifact-driven (reasoning traces + reputation profiles). Cross-agent context sharing via the leaderboard. All four bullets from the track description, all built."
- **Why x402:** "Vercel + Coinbase released this exactly for AI agent payments. We're the first project showing it working with Sui as the verification layer."
- **Why MCP:** "Anthropic's emerging standard for tool discovery. Any agent that speaks MCP — and that's now Claude, OpenAI, Cursor — can integrate in 30 seconds."
- **Consensus mode trade-off:** "3x cost (~$0.06/resolution) but you get four reasoning paths on Walrus, dissent flagged in caveats. Pro tier feature."
- **Walrus as memory, not just storage:** "Reputation Agent writes versioned profiles, each linked to the previous via Walrus blob ID. That's a linked-list audit trail of an analyst's evolving track record. Mine 6 months of profile versions and you can see how an analyst's calibration changed over time."
- **Why the X OAuth gate matters:** "Without it, anyone can pre-claim @vitalik on our leaderboard before he ever signs up. With it, only the wallet that signed in via X OAuth as @vitalik can post predictions under that handle. The wallet ↔ handle binding lives in Postgres for fast reads; the on-chain first-claim-wins lock is the failsafe."
- **Why the self-serve verifier instead of the autonomous bot:** "X API Free tier doesn't include mention-search, so the autonomous @toldproof bot needs Basic ($100/mo). The self-serve verifier runs the SAME defamation-safe verdict logic but is triggered by a tweet URL paste — works today on Free. When we upgrade to Basic, the autonomous cron already shipped at `/api/cron/verify-bot` lights up automatically. Same code, two surfaces."
