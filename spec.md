# TOLDPROOF — Project Spec

**Date locked**: 2026-05-12
**Target**: Sui Overflow 2026 — Walrus Track
**Submission deadline**: 2026-06-21
**Founder**: solo
**Domain**: toldproof.xyz (owned; optional defensive: toldproof.com / toldproof.app if available)
**X handle**: @toldproof (manual check at x.com/toldproof — fallback @toldproofapp)
**GitHub org**: github.com/toldproof

---

## One-line pitch

**"TOLDPROOF. Cryptographic receipts for crypto Twitter. Sealed predictions, verifiable proof — or stop pretending you called it."**

Tagline variants:
- "Cryptographic proof you called it before it happened."
- "Sealed predictions. No hindsight farming."
- "Show the toldproof."

---

## Why this idea (decision context)

Evaluated five paths before locking:

| Option | Decision | Reason |
|---|---|---|
| DeepBook Idea 2 (PLP + Hedge Vault) | Killed | Backtest showed hedge drag > PLP yield at all realistic horizons; depends on Mysten shipping longer-dated oracles |
| DeepBook Idea 1 reframed (Smart PLP Vault) | Backup only | Only 1% APY on testnet; thin volume; no clear demo moment |
| MemWal-MCP for Claude Code memory | Killed | Anthropic ships native memory; no defensible paid customer |
| Audit memory for security auditors | Deferred | Strong founder-market fit but narrow market |
| AI Companion with vendor-proof memory | Deferred to phase 2 | Strong PMF but consumer app category penalty + Mysten owns the same pitch |
| **TOLDPROOF — sealed predictions** | **LOCKED** | Native Walrus+Seal fit; past winner template; X-integrable; founder pain confirmed |

Founder validation: experienced the hindsight-farming problem directly on X. Fake "I called it" tweets, fake hiring claims, fake success stories from engagement-farming accounts. This is the pain.

---

## Customer + pain

**Primary customer (post-launch)**: crypto analysts, traders, journalists, researchers — anyone whose credibility depends on making public claims that should be verifiable later.

**Secondary customer**: cynical X users who want to call out fakes (free distribution channel).

**Hackathon judges**: Sui Foundation engineers, Mysten leadership, Walrus ecosystem partners. The pitch must land for this audience first — they overlap with the eventual customer base (crypto-native).

**The pain in one sentence**: crypto Twitter is full of hindsight farming. Nobody has cryptographically anchored proof of when a claim was made, so the loudest voices win regardless of truth.

---

## Why Walrus + Seal + Sui is the right stack

Each property is load-bearing:

| Walrus property | Why it matters for Toldproof |
|---|---|
| Immutable blob storage | Sealed prediction cannot be edited or deleted after timestamp |
| Verifiable provenance | Anyone can confirm a blob existed at time T |
| Public, decentralized | No central operator can be subpoenaed or pressured |

| Seal property | Why it matters |
|---|---|
| IBE with custom Move `seal_approve` | Encode arbitrary unlock conditions: time, oracle event, multi-sig, etc. |
| Time-lock encryption pattern | THE core primitive — encrypt now, auto-decrypt at unlock time |
| Decentralized key servers | Decryption doesn't depend on a single company's uptime |

| Sui property | Why it matters |
|---|---|
| Programmable Move contracts | Reputation NFT, subscription gating, custom prediction types |
| Cheap transactions | Per-prediction tx fee under $0.01 |
| Existing wallet UX (Sui Wallet, Slush) | No new wallet education needed for crypto-native users |

If you stripped any one of these, the product weakens materially. That's why this is hackathon-defensible.

---

## V1 feature scope (10-12 days)

### Core (must-have)
1. Sui wallet connect + X OAuth (link X handle to Sui address)
2. **Seal a prediction**: form (text + unlock date) → encrypt via Seal time-lock → upload ciphertext to Walrus → record metadata on Sui Move contract
3. **Auto-tweet on seal**: optional auto-post to user's X with verification link
4. **Public profile page**: `toldproof.xyz/@username` shows every sealed prediction + hit/miss record
5. **Verification page**: paste any URL or hash → see proof of when/what was sealed
6. **Auto-tweet on reveal**: when time-lock unlocks, optional auto-post with proven prediction

### Hero feature — the demo moment
7. **`@toldproof verify` bot**: reply to any tweet with `@toldproof verify` → bot checks claimant's address for matching sealed prediction → replies with verdict

### Stretch (post-hackathon)
- Reputation NFT (hit rate → on-chain reputation score)
- Subscription tier ($9.99/mo: unlimited seals, custom Walrus Sites domain)
- Creator tier ($29.99/mo: monetize prediction feed via Seal subscription pattern)
- Structured prediction types (price > X by date) with auto-resolution via Pyth/Switchboard
- Polymarket / Metaculus integration

---

## Architecture

```
User
 -> Connects Sui Wallet + X OAuth
 -> Types prediction "BTC > $85k by 2026-06-30"

Toldproof frontend (Next.js + Walrus Sites)
 1. Encrypt with Seal (time-lock identity: pkg_id || bcs(unlock_ts))
 2. Upload ciphertext to Walrus -> get blob_id
 3. Call Move: record_prediction(blob_id, hash, x_handle, unlock_at)
 4. Trigger X auto-post (optional)

Sui Move contracts
 - prediction_vault.move
   - record_prediction(blob_id, hash, x_handle, unlock_at)
   - custom seal_approve: validate clock.timestamp_ms >= unlock_at
 - reputation_nft.move
   - mint when hit_count >= threshold AND time_window >= 30d

X integration
 - Sealing: auto-post via user OAuth ("Sealed at [t]. Verifies [unlock].")
 - Reveal: bot watcher (Vercel cron) -> decrypt unlocked predictions -> post reveal tweet
 - Verify bot: listens for "@toldproof verify" mentions -> queries Move contract -> replies verdict

Storage
 - Walrus: encrypted prediction blobs (small, cheap, public)
 - Sui object: blob_id reference, hash commitment, x_handle, unlock_at, reveal_hash (once revealed)
```

---

## X integration details

### API tier
- **X API Basic tier** — $100/mo
- 10k tweet reads/month, 50k user-context posts/month, 3k app-context posts/month
- Bot account (`@toldproof`) uses app context for verify replies (~3000/month plenty for hackathon)
- User posts use their own OAuth (no cost to us)

### Three integration points

**1. Seal-to-tweet (user-initiated)**
- After successful seal, optional checkbox: "auto-post to X"
- Tweet template: `Sealed prediction at [ISO timestamp]. Verifies on [unlock date]. Proof: toldproof.xyz/[id]`
- Rich preview card (Open Graph image) shows seal metadata

**2. Reveal-to-tweet (automated)**
- Vercel cron watches unlocked predictions
- For predictions that were auto-tweeted on seal: bot quote-tweets the original seal-tweet with: `VERIFIED: [decrypted prediction]. Sealed [seal date]. Proof: toldproof.xyz/[id]`

**3. Verify bot (mention-triggered)**
- `@toldproof` account listens for mentions containing "verify"
- Parses parent tweet's claim (the tweet being verified)
- Looks up parent tweet author's X handle in our DB
- Queries Move contract for any sealed predictions from that address
- Replies with verdict:
  - `toldproof verified ✓ Sealed [date]. Proof: toldproof.xyz/[id]`
  - `No toldproof found for this claim. Show the receipt 👀 toldproof.xyz`

### Defamation / TOS guardrails
- Bot wording: never "this user is lying" — always "no toldproof found"
- Disclaimer in bot bio: "Absence of proof is not proof of falsehood."
- Rate limit per user account (max N verifications/day to prevent harassment campaigns)
- Compliance with X automation policy: bot is reactive (only replies when tagged), not promotional spam

---

## The 60-second demo video script

```
[0:00] "Crypto Twitter is full of liars."
[0:03] [Screen recording: scrolling fake "I called this" tweets]
[0:08] "Watch this." [Cut to Toldproof app]
[0:10] Types prediction. Click "Seal."
[0:13] Sui wallet popup -> approve -> Walrus blob created (show blob_id)
[0:16] X auto-tweet appears live: "Sealed prediction. Verifies 2026-06-30."
[0:20] [Time-lapse / cut to future moment]
[0:23] Reveal tweet appears: "VERIFIED: I predicted [X]. Proof: toldproof.xyz/0xabc"
[0:28] "Now watch this." [Cut to a fake influencer tweet]
[0:31] Reply with: "@toldproof verify"
[0:34] Bot replies: "No toldproof found. Show the receipt 👀"
[0:38] "Or seal yours: toldproof.xyz"
[0:43] "Built on Sui, Walrus, Seal. Cryptographically sealed. Cannot be edited, deleted, or faked."
[0:50] "TOLDPROOF. Receipts for crypto Twitter."
[0:55] "Sui Overflow 2026."
[0:60] End card.
```

Three technical moments visible (seal, reveal, callout). Three emotional beats (frustration, satisfaction, victory). One clear call to action.

---

## Growth loop (no marketing budget required)

1. User seals a prediction -> auto-tweet with verification link -> followers see it
2. Some followers convert ("I should seal mine too")
3. When predictions resolve, reveal tweets generate engagement
4. Skeptical users summon `@toldproof verify` on fake claims -> bot does free entertainment work
5. Bot follower count grows -> Toldproof becomes a Twitter institution
6. Influencers under pressure: seal predictions or lose credibility
7. "Toldproof seal" becomes a credibility signal — same dynamic that made Community Notes a Twitter institution

Free flywheel because:
- Calling out fakes is free entertainment for users
- The defensive response (seal your predictions) creates a new norm
- Once the norm exists, every serious analyst needs it

---

## Build timeline (10-12 days)

| Day | Deliverable |
|---|---|
| 1 | Move contracts: `prediction_vault.move` with custom `seal_approve` (time-based); `reputation_nft.move` scaffold |
| 2 | Walrus integration: encrypt -> upload -> hash -> store reference on Sui object |
| 3 | Frontend scaffolding: wallet connect (mysten/dapp-kit), X OAuth, prediction form |
| 4 | End-to-end happy path: seal a prediction on testnet, decrypt at unlock |
| 5 | Public profile pages, verification lookup |
| 6 | Reputation tracking: hit/miss counter per address |
| 7 | X auto-tweet on seal + reveal (user OAuth path) |
| 8 | `@toldproof` bot account: mention listener, verify-reply flow |
| 9 | Polish: Walrus Sites deploy, copy, styling |
| 10 | Demo video filming + edit |
| 11 | Mainnet deployment, soft launch to 5-10 crypto Twitter contacts |
| 12 | DeepSurge submission + iteration buffer |

---

## Tech stack

- **Frontend**: Next.js 16 (App Router) + Tailwind + shadcn/ui
- **Wallet**: @mysten/dapp-kit
- **Walrus SDK**: official TypeScript SDK from sdk.mystenlabs.com/walrus
- **Seal**: Seal TypeScript SDK + custom Move package for `seal_approve`
- **Move contracts**: Sui Move 2024.beta — two packages (`prediction_vault`, `reputation_nft`)
- **X integration**: X API v2 Basic tier, OAuth 2.0 for user posting, app-context for bot
- **Hosting**: Vercel (primary) + Walrus Sites (backup domain, demo flex)
- **Database**: Postgres on Vercel Marketplace (only for: X handle <-> Sui address mapping, indexing speedup; the source of truth is always on-chain)
- **Cron**: Vercel cron for bot watcher (reveal poster, mention listener)
- **Payments (post-hackathon)**: Stripe for subscriptions

---

## Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Mysten ships competing flagship | Low | Move fast; X integration is the moat — Mysten won't build an X bot |
| X API approval delays | Med | Apply for Basic tier on day 1; start dev with free tier |
| Defamation when bot says "no proof" | Med | Strictly neutral wording; disclaimers |
| X TOS / automation policy | Med | Register bot under X automation policy; reactive only (never spam) |
| Vague predictions hard to verify | Low | v1 only timestamps; v2 adds structured prediction types |
| Seal key server reliability | Low | Use multiple key servers via committee mode |
| Walrus mainnet stability | Low | Mainnet has been live and stable per docs |
| User wants private predictions | Low | Add private mode (hash on-chain, ciphertext only revealed by owner) in v1 if time |
| Mass-sealing spam to game reputation | Low | Cooldown + minimum-time-window in reputation NFT mint logic |

---

## Strategic positioning notes

**Hackathon-first strategy committed.** Validation via 10 user interviews skipped — betting on the win to deliver:
- Mysten / Walrus Twitter amplification (100-500k impressions in crypto ecosystem)
- Possible $50-200k grant
- Speaker slot / blog feature
- Mysten relationship for follow-on partnership conversations

User acquisition is a **post-prize problem.** Hackathon prize converts to runway, which converts to acquisition spend.

**Realistic win odds: 70-80%** based on:
- Native Walrus+Seal fit (vs grafted-on integrations)
- Past winner template (Aver.Email, perma.ws, Chronos all in this provenance family)
- 60-second demo lands instantly
- Audience overlap between distribution channel (X) and judges (crypto-native)
- Only 1 Walrus track submission currently (Agentic Punk NFTs) — first dev-tool entry available

---

## Phase 2 (post-hackathon) — what stays parked

- AI Companion / journal app with vendor-proof memory remains the larger-PMF play
- After winning Toldproof, founder has: Mysten relationship, Walrus/Seal technical credibility, possibly grant funding, Twitter following from build-in-public
- Those resources make the AI companion play viable in month 3-6 with proper user validation
- Toldproof and AI Companion share the same stack — code is reusable

---

## Next 24 hours

| Hour | Task |
|---|---|
| 0-1 | Confirm `toldproof.xyz` (owned) is on Cloudflare and enable Email Routing. Optional defensive secondaries: check `toldproof.com` / `toldproof.app` availability. |
| 1-2 | Reserve X handle `@toldproof` (manual check at x.com/toldproof — fallback `@toldproofapp` or `@toldproofhq`) |
| 2-3 | Apply for X API Basic tier ($100/mo) at developer.x.com |
| 3-4 | Sketch Move contract: `prediction_vault.move` outline (200 lines target). Custom `seal_approve` with time-based unlock. Reputation NFT mint logic outline. Move module name: `toldproof::prediction_vault`. |
| 4-6 | Set up Next.js project skeleton on Vercel: wallet connect, X OAuth, blank prediction form |
| 6-8 | Pull MemWal / Walrus / Seal SDK locally; run hello-world `walrus.put(blob)` and verify retrieval |
| 8-10 | Sketch demo video script in detail (commit to the words before writing the code) |
| 10-12 | DM 5 crypto Twitter contacts with a one-sentence pitch: "Building toldproof.xyz — a tool that cryptographically seals predictions so you can prove you called it. Beta in 10 days — interested?" |
| 12-24 | Initial Move contract draft on testnet; verify `seal_approve` flow works with a manual decrypt after timestamp |

---

## Reference materials

- DeepBook Predict feasibility recon: `/mnt/c/Brain/Dewaxindo Workspace/raw-sources/audit/deepbook-predict-feasibility.md`
- DeepBook backtests (decision data): `/home/dewaxindo/Hackathon/Sui/backtest.py`, `backtest_idea1.py`, `backtest_result.txt`, `backtest_idea1_result.txt`
- Walrus docs: https://docs.wal.app
- MemWal docs: https://docs.memwal.ai
- Seal docs: https://seal-docs.wal.app
- Sui Overflow 2026 portal: https://www.deepsurge.xyz
- Competing Walrus entry (NFT angle, non-overlapping): https://www.deepsurge.xyz/projects/d543ef69-81b0-47b5-a951-5441cae8f165
- Solo founders framework reference: `/mnt/c/Brain/Dewaxindo Workspace/raw-sources/personal/Claude Code for Solo Founders The Complete Guide From Idea to First Paying.md`
