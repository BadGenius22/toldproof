# TOLDPROOF — CLAUDE.md

> Project instructions for Claude Code. Read this before writing any code in this repo.

## What We Are Building

Cryptographic receipts for crypto Twitter. Users seal predictions on Sui + Walrus + Seal with a time-locked decryption policy; a public X bot verifies whether anyone's "I called it" claim has a matching sealed prediction.

## The Customer

Crypto-native X users frustrated by hindsight farming — fake "I told you so" posts, fake hiring announcements, fake success stories. They want to credibilize their own calls publicly AND call out fakes by other accounts.

The hackathon judges (Sui Foundation, Mysten leadership, Walrus partners) are the *first* customer. Optimize the demo for them; user acquisition is a post-prize problem.

## MVP Scope

The MVP must do these things. **Nothing else.**

1. Connect Sui wallet (Sui Wallet / Slush) + link an X handle via OAuth.
2. Seal a prediction: form takes text + unlock timestamp → encrypts via Seal time-lock → uploads ciphertext to Walrus → records `(blob_id, hash, x_handle, unlock_at, owner)` on a Sui Move contract.
3. Public profile page at `/[x_handle]` lists every sealed prediction (locked + revealed) for that handle.
4. Verification page at `/[id]` shows proof metadata for a specific prediction.
5. Optional auto-tweet on seal (user OAuth posts: "Sealed prediction at [t]. Verifies on [unlock]. Proof: toldproof.xyz/[id]").
6. Auto-tweet on reveal via cron: when the time-lock expires, a watcher decrypts and quote-tweets the original seal-tweet.
7. `@toldproof verify` bot: listens for mentions containing "verify", checks if the parent tweet's author has a matching sealed prediction, replies with verdict (neutral wording — see Non-Negotiables).
8. Hit/miss tracking per address (simple counter; reputation NFT is stretch only).

### Explicitly OUT of MVP scope

- Voice, avatars, character customization (not this product)
- NSFW content of any kind (regulatory exclusion zone)
- Vague-claim parsing or NLP — predictions are free-text, judged by humans on reveal
- Oracle integration for auto-resolution (Pyth/Switchboard) — manual claim resolution v1
- Subscription billing / Stripe integration
- Reputation NFT minting (defer to stretch goals after hackathon)
- Polymarket / Metaculus integration
- Mobile-native app (web app responsive only)
- Multi-language support
- Private mode (hash-only public, ciphertext private) — defer if time-constrained
- Email notifications
- Webhooks / API for third-party developers

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
- **Move contract changes require the user to review every diff before mainnet deploy.** Testnet deploys are auto.
- **Every `seal_approve` function must be tested with at least one positive and one negative case** before being deployed to mainnet.
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

## Definition of Done (MVP)

The MVP is finished when ALL of these are true:

1. **Sealed prediction end-to-end on mainnet**: a user can connect wallet, type prediction, click seal, and the result is verifiable at `toldproof.xyz/verify/[id]` with a real Walrus blob and Sui object.
2. **Time-locked reveal works**: a test prediction set 1 hour out actually unlocks and decrypts via Seal on schedule.
3. **X auto-tweet on seal** works for the user OAuth path.
4. **Reveal watcher** posts the reveal tweet within 10 minutes of unlock time.
5. **`@toldproof verify`** replies to mention within 5 minutes with the correct verdict (verified or no-proof-found).
6. **Public profile page** shows all sealed predictions for a given X handle.
7. **60-second demo video** is filmed, edited, and uploaded — covers seal → reveal → callout flow.
8. **DeepSurge submission page** is live with project description, video link, GitHub link, mainnet package ID, and screenshots.
9. **Mainnet Move contracts** have been reviewed by user and pass the seal_approve test cases (positive + negative).
10. **README.md** at the project root explains the architecture in under 200 lines for hackathon judges.

## Quick references

- Spec: `spec.md`
- Build plan: `buildplan.md`
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
