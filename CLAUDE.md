# TOLDPROOF — CLAUDE.md

> Project instructions for Claude Code. Read this before writing any code in this repo.

## What We Are Building

Verifiable reputation for humans and AI agents. Anyone — a human via Sui wallet + X OAuth, or an AI agent via MCP + x402 payments — seals a prediction on Sui + Walrus + Seal with a time-locked decryption policy. At unlock, an AI Resolution Agent reads the plaintext, checks what actually happened (web search + price feeds), and stamps hit or miss on Sui with its full reasoning anchored to Walrus. A public X bot verifies "I called it" claims, and a single leaderboard ranks humans and AI agents side-by-side on cryptographically-attested track records.

## The Customer

Two surfaces, one primitive:

1. **Humans** — crypto-native X users frustrated by hindsight farming (fake "I told you so" posts, fake hiring announcements, fake success stories). They want to credibilize their own calls publicly AND call out fakes by other accounts.
2. **AI agent builders** — anyone shipping an agent that makes claims about the world (forecasters, research agents, signal callers). They need a public, vendor-neutral benchmark for "which agent actually calls things right" — something HumanEval and MMLU don't provide.

The hackathon judges (Sui Foundation, Mysten leadership, Walrus partners) are the *first* customer. Optimize the demo for them; user acquisition is a post-prize problem.

## Current Scope (what's shipped + what's left)

The product covers BOTH surfaces — humans and AI agents — on the same contract and the same leaderboard. The list below is the locked feature set. **Nothing else.**

### Human path
1. Connect Sui wallet (Sui Wallet / Slush) + link an X handle via OAuth.
2. Seal a prediction: form takes text + unlock timestamp → encrypts via Seal time-lock → uploads ciphertext to Walrus → records `(blob_id, hash, x_handle, unlock_at, owner)` on the Sui Move contract.
3. Public profile page at `/[x_handle]` lists every sealed prediction (locked + revealed) for that handle.
4. Verification page at `/[id]` shows proof metadata for a specific prediction.
5. Optional auto-tweet on seal (user OAuth posts: "Sealed prediction at [t]. Verifies on [unlock]. Proof: toldproof.xyz/[id]").
6. Auto-tweet on reveal via cron: when the time-lock expires, a watcher decrypts and quote-tweets the original seal-tweet.
7. `@toldproof verify` bot: listens for mentions containing "verify", checks if the parent tweet's author has a matching sealed prediction, replies with verdict (neutral wording — see Non-Negotiables).
8. Hit/miss tracking per address (simple counter; reputation NFT is stretch only).

### AI agent path
9. MCP server at `/api/mcp/mcp` — any MCP-compatible agent (Claude Desktop, Cursor, AI SDK) can discover the `seal_prediction` tool.
10. x402 payments — agent pays $0.10 USDC on Base per seal; no wallet, no signup, no API key.
11. Agent identity locks — first-claim-wins on alias, alias bound to first wallet to prevent impersonation.
12. Demo agent fleet — 4 sovereign agents seeded on a 6-hour cron to populate the leaderboard.

### Resolution + reputation (shared)
13. AI Resolution Agent (cron) — at unlock, reads plaintext, runs tool-use loop (web search via Tavily + price feeds via CoinGecko), commits hit/miss on Sui with full reasoning trace anchored to Walrus.
14. Multi-agent consensus mode — Claude + GPT + Gemini work the problem in parallel; a fourth model synthesizes. Pro tier.
15. Versioned Walrus reputation profiles — per-identity profile chain, each linked to the previous via Walrus blob ID.
16. Unified leaderboard at `/leaderboard` — humans and AI agents ranked side-by-side by calibration score.

### Explicitly OUT of scope

- Voice, avatars, character customization (not this product)
- NSFW content of any kind (regulatory exclusion zone)
- Subscription billing / Stripe integration (defer to post-hackathon)
- Reputation NFT minting (defer to stretch goals after hackathon)
- Polymarket / Metaculus integration
- Mobile-native app (web app responsive only)
- Multi-language support
- Email notifications
- Public webhooks / API for third-party developers (MCP is the only agent surface for now)

Every time you're tempted to add something not in this list, stop and ask: does this help win the hackathon demo? If no, it's out.

## Tech Stack

Locked. Do not substitute without explicit user approval.

- **Frontend**: Next.js 16 (App Router) + TypeScript strict mode + Tailwind v4 + shadcn/ui
- **Wallet**: `@mysten/dapp-kit` for Sui wallet connect
- **Walrus**: `@mysten/walrus` TypeScript SDK
- **Seal**: Seal TypeScript SDK + custom Move package for `seal_approve`
- **Move**: Sui Move 2024.beta — two packages (`prediction_vault`, `reputation_nft` stub)
- **X integration**: X API v2 Basic tier ($100/mo), OAuth 2.0 for user posts, app-context for `@toldproof` bot
- **Hosting**: Vercel (primary). Walrus Sites as backup domain — thematic flex for the demo.
- **Database**: Postgres on Vercel Marketplace (Neon). ONLY for: X handle ↔ Sui address index, reveal queue, bot mention dedupe. Source of truth is always on-chain.
- **Cron**: Vercel Cron Jobs for reveal-watcher and bot-mention-listener
- **AI Gateway**: not used in v1 (no LLM in the product)
- **Analytics**: Vercel Analytics + Plausible
- **CI**: GitHub Actions for `forge`/`sui move build`/typecheck/lint on every PR

## Non-Negotiables

Violating any of these is a workflow error. Stop and ask before proceeding.

### Security
- **Never log Seal decryption keys, IBE master keys, or user OAuth tokens.** Use environment variables; redact in any structured logging.
- **Localnet deploys (`sui client test-publish --build-env testnet`) are auto.** Testnet deploy is the **FINAL phase** for this hackathon — every Move diff requires user review before publishing to testnet. Mainnet is deferred to post-hackathon.
- **Every `seal_approve` function must be tested with at least one positive and one negative case** before being deployed to testnet.
- **Wallet connection failures must be handled gracefully** — never silent-fail.
- **Postgres credentials are not committed to git, even encrypted.** Use Vercel env vars.

### Walrus / Seal correctness
- **Ciphertexts on Walrus are permanent.** Never write code assuming a blob can be deleted or modified. If a user wants "delete," it means "stop referencing this blob in our index" — the blob itself remains.
- **The IBE identity used for Seal must include the package ID prefix** — see oracle.move L71 in the Predict reference; Seal docs Design.md for the pattern.
- **Time-lock identities use `[pkg_id][bcs::to_bytes(unlock_ms)]`** — never just the timestamp.
- **Key servers**: use committee mode (MPC) where available, single-server only for testnet development.

### X / legal
- **Bot wording is legally sensitive.** Never assert a claim is false. Use: "No sealed prediction found for this claim." Never: "This user is lying." Disclaimer in bot bio: "Absence of proof is not proof of falsehood."
- **Comply with X automation policy.** Bot is reactive only (replies when tagged) — never proactive, never promotional, never bulk DM.
- **Rate limit verifications per user account** (max 5/day per requester) to prevent harassment campaigns.
- **No NSFW content in any UI, copy, or example data.** This is a regulatory exclusion zone.

### Code quality
- **TypeScript strict mode on.** No `any`. No `// @ts-ignore` without a `// REASON: ...` comment that names a hard constraint.
- **Every new API route and component must have error handling.** Failures return structured errors, never raw thrown exceptions, never silent 500s.
- **Production-ready code only.** No `TODO: fix this later` hacks. If something is half-built, finish it or remove it before commit.
- **Tests for the demo path are mandatory** before mainnet deploy. The seal → wait → reveal flow must have an integration test that runs in CI against testnet.
- **No comments that name the task or PR.** Comments explain WHY only when non-obvious; never WHAT.

### Scope discipline
- **MVP scope is locked.** When tempted to add a feature, re-read the MVP Scope section above.
- **No backwards-compatibility shims for code that hasn't shipped to users yet.** This is a 12-day build; YAGNI applies aggressively.
- **No abstraction layer for a single use case.** Three similar functions beats a premature factory pattern.

### Copy & language (user-facing text only)
- **Plain English. No jargon.** Every word the customer reads — buttons, labels, headings, error messages, empty states, tooltips, badges — must make sense to someone who has never used a blockchain or an AI agent.
- **Translate the jargon you'd reach for reflexively.** Reference table (extend over time):
  - "attest" → "decide" / "give a verdict"
  - "ciphertext" → "scrambled text"
  - "encrypt" / "seal" → "lock" / "scramble"
  - "decrypt" → "open" / "unscramble"
  - "tx digest" / "tx hash" → drop, or "receipt id"
  - "on-chain" → "on Sui" or drop
  - "off-chain" → drop, or name the actual system ("in our database")
  - "AI inference" → "the AI checks" / "the AI decides"
  - "trivial / non-trivial" → "obvious / surprising"
  - "verified" stays — common English word, not crypto jargon
- **Brand names (Sui, Walrus, Seal) are fine** but explain once when first introduced on a page (e.g. "Sui — the blockchain that records this receipt").
- **Code comments, variable names, and `lib/` internals are exempt.** Those are for developers; technical names are appropriate there.
- **Test**: would a non-crypto friend understand this without asking what a word means? If not, simplify.

## File Structure

```
/
├── CLAUDE.md                          # this file
├── spec.md                            # what + why
├── buildplan.md                       # day-by-day plan
├── README.md                          # public-facing
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── vercel.ts                          # config-as-code
├── move/
│   ├── prediction_vault/
│   │   ├── Move.toml
│   │   ├── sources/
│   │   │   └── prediction_vault.move  # main contract + seal_approve
│   │   └── tests/
│   └── reputation_nft/                # stretch — stub for v1
│       ├── Move.toml
│       └── sources/
├── app/                               # Next.js App Router
│   ├── (marketing)/
│   │   └── page.tsx                   # landing page
│   ├── seal/
│   │   └── page.tsx                   # seal a prediction
│   ├── verify/
│   │   └── [id]/
│   │       └── page.tsx               # verification page
│   ├── [handle]/
│   │   └── page.tsx                   # public profile by X handle
│   ├── api/
│   │   ├── x/
│   │   │   ├── auth/route.ts          # OAuth callback
│   │   │   └── post/route.ts          # user-context tweet posting
│   │   ├── seal/route.ts              # server-side seal helper (if needed)
│   │   └── cron/
│   │       ├── reveal/route.ts        # nightly reveal watcher
│   │       └── verify-bot/route.ts    # mention listener (every 5min)
│   ├── layout.tsx
│   └── globals.css
├── lib/
│   ├── walrus.ts                      # @mysten/walrus wrapper
│   ├── seal.ts                        # Seal SDK wrapper
│   ├── sui.ts                         # Sui RPC + Move call helpers
│   ├── x.ts                           # X API v2 client
│   └── db.ts                          # Postgres queries
├── components/
│   ├── ui/                            # shadcn primitives
│   ├── wallet-connect.tsx
│   ├── prediction-form.tsx
│   └── prediction-card.tsx
└── scripts/
    ├── deploy-testnet.ts
    ├── deploy-mainnet.ts              # gated — confirm-prompt
    └── seed-bot.ts
```

## Definition of Done

The build is finished when ALL of these are true:

1. **Human seal end-to-end on testnet**: a user can connect wallet, sign in with X, type a prediction, click seal, and the result is verifiable at `toldproof.xyz/verify/[id]` with a real Walrus blob and Sui object.
2. **AI agent seal end-to-end via MCP + x402**: an agent (Claude Desktop or AI SDK) can discover the `seal_prediction` tool, pay $0.10 USDC on Base, and get a Sui-verified prediction back — no signup required.
3. **Time-locked reveal works**: a test prediction set 1 hour out actually unlocks and decrypts via Seal on schedule.
4. **AI Resolution Agent attests outcomes**: at unlock, the resolve cron reads the plaintext, runs the tool-use loop, and commits hit/miss on Sui with reasoning anchored to Walrus.
5. **X auto-tweet on seal** works for the user OAuth path.
6. **Reveal watcher** posts the reveal tweet within 10 minutes of unlock time.
7. **`@toldproof verify`** (self-serve at `/bot` today, autonomous cron behind X API Basic) returns the correct verdict — verified or no-proof-found — with defamation-safe wording.
8. **Public profile page** shows all sealed predictions for a given X handle, including hit rate.
9. **Mixed leaderboard** ranks humans and AI agents side-by-side at `/leaderboard`.
10. **60-second demo video** is filmed, edited, and uploaded — covers human seal → agent seal → reveal → leaderboard flow.
11. **DeepSurge submission page** is live with project description, video link, GitHub link, testnet package ID, and screenshots.
12. **Testnet Move contracts** have been reviewed by user and pass the seal_approve test cases (positive + negative).
13. **README.md** at the project root explains the architecture for hackathon judges.

## Required skill usage

**Before writing or modifying any code that touches Sui Move, the Sui TypeScript SDK (`@mysten/sui`, `@mysten/dapp-kit`), Walrus (`@mysten/walrus`), or Seal (`@mysten/seal`)** — invoke the `/sui-dev` skill and consult its reference files. This is non-negotiable. The skill encodes anti-patterns that compile fine but fail in production (`public entry` vs `entry` for `seal_approve`, single-server vs threshold key-server config, envelope encryption vs direct Seal of large payloads, etc.). Always cross-check the canonical recipe in `~/.claude/skills/sui-dev/references/11-toldproof-stack.md` before fleshing out any new file or function.

Exceptions: pure UI styling/copy text, non-Sui dependency upgrades, README edits.

## Development environment

| Phase | Active sui env | Move target | Walrus / Seal target |
|---|---|---|---|
| Dev (Days 1–9) | `sui client switch --env testnet` (for build/test ergonomics) | localnet via `sui client test-publish --build-env testnet` | testnet (no local equivalents exist) |
| Final deploy (Day 10) | `sui client switch --env testnet` | testnet via `sui client publish` | testnet |
| Post-hackathon | — | mainnet | mainnet |

Daily commands inside `move/prediction_vault/`:
- `sui move build` — compile (testnet env active is fine).
- `sui move test` — run all 10 tests.
- For localnet publish: `sui client switch --env local && sui client test-publish --build-env testnet --gas-budget 200000000` (then switch back to `testnet`).

## Quick references

- Spec: `spec.md`
- Build plan: `buildplan.md`
- Seal recipe: `docs/seal-notes.md`
- sui-dev skill: `~/.claude/skills/sui-dev/references/`
- Sui docs: https://docs.sui.io
- Walrus docs: https://docs.wal.app
- Seal docs: https://seal-docs.wal.app
- MemWal docs: https://docs.memwal.ai
- Move book: https://move-book.com
- Mysten dapp-kit: https://sdk.mystenlabs.com/dapp-kit
- X API docs: https://docs.x.com/x-api

## When in doubt

- If you're tempted to add a feature: re-read MVP Scope above. If unclear, ask the user.
- If you're tempted to skip the time-lock test or seal_approve test: don't. These are the on-chain guarantees we are selling — they cannot be wrong.
- If you're tempted to make the bot's verdict wording more punchy: don't. Defamation safety is non-negotiable.
- If you're considering a refactor "for cleanliness": don't. Ship the demo, then refactor.
