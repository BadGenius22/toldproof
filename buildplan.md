# TOLDPROOF — Build Plan

> Day-by-day execution plan from setup to mainnet submission.
> Start date: 2026-05-12. Target submission: 2026-05-23 (11 days; buffer to 2026-06-21 deadline).
> If a day slips, the priority order below stays — drop scope from the bottom up, not the top down.

---

## Day 0 — Pre-flight (today, 4-6 hours)

**Goal**: All accounts, domains, and dev environment ready. Zero application code written yet.

| Task | Outcome | Time |
|---|---|---|
| Confirm `toldproof.xyz` (owned) is on Cloudflare nameservers and enable Email Routing → forward `hello@toldproof.xyz` to project Gmail. Optional: check `toldproof.com` / `toldproof.app` availability as defensive secondaries. | Domain ready + email routing live | 30m |
| Reserve X handle `@toldproof` (manual check at x.com/toldproof; fallback `@toldproofapp` or `@toldproofhq`) | Bot account created, profile filled out with disclaimer | 30m |
| Apply for X API Basic tier ($100/mo) at developer.x.com | Application submitted; expect 1-2 day approval | 20m |
| Sign in to: Anthropic console, Vercel, Resend, Neon (Postgres), Plausible | All accounts active | 30m |
| Install/verify `sui` CLI, `walrus` CLI, Node 24 LTS, pnpm | All CLI tools working | 30m |
| Fund Sui testnet wallet from `faucet.sui.io` | At least 10 SUI testnet | 10m |
| Fund Walrus testnet WAL from Walrus Discord faucet | At least 10 WAL testnet | 10m |
| Run MemWal/Walrus hello-world: `walrus store hello.txt && walrus read [id]` | Verified Walrus testnet works end-to-end | 30m |
| Read Seal `Design.md` and `ExamplePatterns.md` (time-lock pattern especially) | Understand `seal_approve` shape, IBE identity composition | 1h |
| Create empty Next.js project: `pnpm create next-app toldproof --typescript --tailwind --app` | Scaffolding committed to git, pushed to GitHub (`github.com/toldproof`) | 30m |
| Initialize `move/prediction_vault` package: `sui move new prediction_vault` | Empty Move package committed | 20m |
| Write 60-second demo video script (commit the words before the code) | Script locked in `demo.md` (create later in day 8) | 1h |

**Day 0 Definition of Done**: domain + X handle + GitHub repo + Next.js scaffold + empty Move package + testnet wallets funded + Walrus hello-world confirmed.

---

## Day 1 — Move contracts (localnet first deploy)

**Goal**: First version of `prediction_vault.move` deployed to **localnet** (`sui start --with-faucet`); `seal_approve` works for time-lock. Testnet deploy is reserved for Day 10 (final phase).

**Required**: Invoke `/sui-dev` skill before writing the module — the canonical blueprint lives in `~/.claude/skills/sui-dev/references/11-toldproof-stack.md`.

### Module structure: `prediction_vault.move`

```move
module toldproof::prediction_vault;

use sui::clock::Clock;
use sui::event;
use sui::object;
use sui::table::Table;
use std::string::String;

const ENotUnlocked: u64 = 1;
const EAlreadyRevealed: u64 = 2;

public struct PredictionRegistry has key {
    id: UID,
    predictions: Table<ID, Prediction>,
    by_x_handle: Table<String, vector<ID>>,
}

public struct Prediction has store {
    id: ID,
    owner: address,
    x_handle: String,
    walrus_blob_id: String,
    commitment_hash: vector<u8>,
    sealed_at_ms: u64,
    unlock_at_ms: u64,
    revealed: bool,
    reveal_text_hash: vector<u8>,  // hash of plaintext after reveal
}

public struct PredictionSealed has copy, drop {
    id: ID,
    owner: address,
    x_handle: String,
    walrus_blob_id: String,
    sealed_at_ms: u64,
    unlock_at_ms: u64,
}

public struct PredictionRevealed has copy, drop {
    id: ID,
    owner: address,
    revealed_at_ms: u64,
    reveal_text_hash: vector<u8>,
}

// Entry: anyone can seal a prediction
public entry fun seal_prediction(
    registry: &mut PredictionRegistry,
    x_handle: String,
    walrus_blob_id: String,
    commitment_hash: vector<u8>,
    unlock_at_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) { /* ... */ }

// Entry: owner reveals after unlock
public entry fun reveal_prediction(
    registry: &mut PredictionRegistry,
    prediction_id: ID,
    reveal_text_hash: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) { /* ... */ }

// Seal-required entry: validates time-lock unlock condition
entry fun seal_approve(id: vector<u8>, c: &Clock) {
    let mut prepared = bcs::new(id);
    let t = prepared.peel_u64();
    let leftovers = prepared.into_remainder_bytes();
    assert!(leftovers.length() == 0, EInvalidId);
    assert!(c.timestamp_ms() >= t, ENotUnlocked);
}
```

| Task | DoD |
|---|---|
| Write `prediction_vault.move` following the `/sui-dev` skill recipe (`11-toldproof-stack.md`) | `sui move build` passes |
| Write minimum tests: positive `seal_approve` (after unlock) + negative (before unlock), plus reveal happy/sad paths | `sui move test` — all green |
| Initialize shared `Registry` object in `init` (OTW + versioned) | Module publishes with one Registry singleton |
| Start localnet: `sui start --with-faucet --force-regenesis` (background) | RPC at `127.0.0.1:9000`, faucet at `127.0.0.1:9123` reachable |
| Switch env + fund: `sui client switch --env local && sui client faucet` | `sui client gas` shows ≥1 SUI |
| Publish: `sui client test-publish --build-env testnet --gas-budget 200000000` | Package ID + Registry ID recorded in `.env.local` (gitignored) |
| Manual end-to-end via `sui client call`: seal_prediction → seal_approve(before unlock = abort) → wait → seal_approve(after unlock = success) | Full flow exercised on localnet |
| Switch back to testnet env (`sui client switch --env testnet`) for build/test ergonomics | `sui move build`/`test` runs cleanly without `--build-env` flag |

**Day 1 DoD**: Move package on localnet, package + Registry IDs recorded in `.env.local`, 10 unit tests passing, full end-to-end seal_prediction + seal_approve(before/after) exercised on a live network.

---

## Day 2 — Walrus + Seal SDK integration in TypeScript

**Goal**: A node script that takes a prediction string + unlock time, encrypts via Seal, uploads to Walrus, calls the Move contract, and gets back a prediction ID.

> **Network split from here onward**: Move contract calls stay on **localnet** (fast, free, deterministic). Walrus uploads and Seal key-server calls require **testnet** (no localnet equivalents). Practically: `lib/walrus.ts` and `lib/seal.ts` point at testnet endpoints, while `lib/sui.ts` points at `http://127.0.0.1:9000`. Once the user's testnet wallet is funded, this split disappears (everything moves to testnet for Day 10's final phase).
>
> **Required**: Invoke `/sui-dev` skill and follow `references/{09,10,11}.md` for Walrus, Seal, and the integrated recipe.

### Files to create

- `lib/walrus.ts` — wraps `@mysten/walrus` SDK: `storeBlob(bytes, epochs)`, `readBlob(blobId)`
- `lib/seal.ts` — wraps Seal SDK: `encryptWithTimelock(plaintext, unlockMs, pkgId)`, `requestDecryption(ciphertext, identity)`
- `lib/sui.ts` — wraps Sui calls: `sealPrediction({ xHandle, walrusBlobId, commitmentHash, unlockMs })`
- `scripts/seal-cli.ts` — local CLI to seal a prediction without UI: `tsx scripts/seal-cli.ts "BTC > 85k by June 30" --unlock 2026-06-30T00:00:00Z`

### Tasks

| Task | DoD |
|---|---|
| Implement `lib/walrus.ts` with store + read | `tsx scripts/walrus-test.ts` stores and retrieves a blob |
| Implement `lib/seal.ts` with time-lock encrypt | Returns ciphertext, encryption-key (for verification) |
| Implement `lib/sui.ts` `sealPrediction` | Successfully calls Move contract on testnet, returns prediction ID |
| Write `scripts/seal-cli.ts` integration | End-to-end: encrypt → Walrus → Sui contract → returns prediction ID |
| Verify retrieval: write `scripts/reveal-cli.ts` that decrypts a prediction *after* unlock time | Successfully decrypts a previously sealed prediction |

**Day 2 DoD**: a single CLI command can seal a prediction and another can reveal it after unlock. End-to-end without UI.

---

## Day 3 — Next.js wallet connect + prediction form (UI scaffolding)

**Goal**: A user can navigate to `/seal`, connect wallet, type a prediction + unlock date, click submit, and complete the same flow that the CLI does on day 2.

### Routes to create

- `/` — landing page (placeholder text, headline + CTA only)
- `/seal` — prediction form
- `/verify/[id]` — verification page (stub — just shows raw metadata for now)

### Components to create

- `components/wallet-connect.tsx` — uses `@mysten/dapp-kit` `ConnectButton`
- `components/prediction-form.tsx` — text area + date-time picker + submit button
- `components/prediction-card.tsx` — display of a single prediction (locked or revealed states)

### Tasks

| Task | DoD |
|---|---|
| Configure `@mysten/dapp-kit` provider at app root | `ConnectButton` works in browser, connects Sui Wallet / Slush |
| Build `/seal` page with form | User can fill text + date and click submit |
| Wire submit handler to `lib/sui.ts` `sealPrediction` | Submitting seals a real testnet prediction; success state shows prediction ID + verify link |
| Handle errors: wallet not connected, tx rejected, network failure | Error states display with clear messaging |
| Add basic styling via shadcn/ui components | Visual baseline: black + white + one accent color |

**Day 3 DoD**: web UI can seal a prediction on testnet end-to-end.

---

## Day 4 — Public profile + verification pages + X OAuth

**Goal**: A user can link their X handle, view their public profile, and any visitor can verify a prediction.

### Routes

- `/[handle]` — public profile page showing all sealed predictions for an X handle
- `/verify/[id]` — full verification page (timestamp, hash, owner address, X handle, blob ID, decryption status)
- `/api/x/auth/route.ts` — X OAuth callback
- `/api/x/link/route.ts` — link X handle to Sui address (writes to Postgres)

### Tasks

| Task | DoD |
|---|---|
| Set up Neon Postgres via Vercel Marketplace | DB URL in env; migrations run |
| Schema: `x_handle_links (sui_address pk, x_handle, x_id, linked_at)`, `prediction_index (prediction_id pk, x_handle, status, sealed_at, unlock_at)` | Migrations applied |
| Implement X OAuth 2.0 flow with "Sign in with X" | User can link their X handle to wallet address |
| Build `/[handle]` page | Lists predictions for that handle (locked + revealed) |
| Build `/verify/[id]` page | Shows full metadata, decryption status, "verify on Sui Explorer" link |
| Add `/api/predictions/index` route to populate predictions table from Sui events | Newly sealed predictions appear in profile within 30s |

**Day 4 DoD**: full read path works. Anyone can visit a profile, see predictions, and click into verification details.

---

## Day 5 — X auto-tweet on seal (user OAuth posts)

**Goal**: When a user seals a prediction, the app optionally posts a tweet from their X account.

### Tasks

| Task | DoD |
|---|---|
| Implement `lib/x.ts` X API v2 client | `postTweet(accessToken, text)` works |
| Add "auto-post to X" checkbox to `/seal` form | UI element renders, defaults to checked |
| After successful seal, call `/api/x/post` with tweet template | Tweet posted from user's account |
| Tweet template: `Sealed prediction at [ISO]. Verifies on [unlock]. Proof: toldproof.xyz/verify/[id]` | Tweet appears in user's timeline |
| OG image generator: `/api/og/[id]` returns dynamic image with seal metadata | Twitter card preview shows seal hash + timestamps |
| Handle: user dismissed OAuth, expired token, X rate limit | Graceful fallback — seal still succeeds even if tweet fails |

**Day 5 DoD**: sealing a prediction with auto-post enabled results in a tweet from the user's X account with a verification link and rich preview.

---

## Day 6 — Reveal watcher (cron) + reveal tweet

**Goal**: Vercel cron checks for unlocked predictions every 10 minutes; decrypts them via Seal; posts a reveal tweet quote-tweeting the original.

### Tasks

| Task | DoD |
|---|---|
| Add Vercel cron job: `app/api/cron/reveal/route.ts` running every 10m | Cron registered; can confirm via logs |
| Watcher logic: query `prediction_index` for `unlock_at <= now AND status=sealed` | Returns predictions ready to reveal |
| For each: request decryption from Seal key server, fetch ciphertext from Walrus, decrypt | Plaintext recovered |
| Compute hash of plaintext; call `reveal_prediction` Move entry | On-chain state updated; `PredictionRevealed` event emitted |
| If `seal_tweet_id` exists for this prediction: quote-tweet with `VERIFIED: [text]. Sealed [date]. Proof: toldproof.xyz/verify/[id]` | Reveal tweet posted, linked to original |
| If no original tweet: post standalone reveal tweet from bot account | Bot tweets reveal |
| Update `prediction_index.status = revealed` | DB consistency |
| Idempotency: ensure repeat cron runs don't double-tweet | Watcher checks `status` before processing |

**Day 6 DoD**: a prediction sealed with `unlock_at = now + 30 minutes` is automatically decrypted and tweeted out within 10 minutes of unlock.

---

## Day 7 — `@toldproof verify` bot

**Goal**: The bot responds to mentions like `@toldproof verify` with a verdict.

### Tasks

| Task | DoD |
|---|---|
| Vercel cron: `app/api/cron/verify-bot/route.ts` every 5 minutes | Cron registered |
| Listen for mentions of `@toldproof` containing the word "verify" | Returns list of new mention tweet IDs |
| For each mention: get parent tweet (the one being verified) | Parent tweet author + text retrieved |
| Lookup parent author's X handle in `x_handle_links` | Returns Sui address or null |
| If linked: query `prediction_index` for any predictions matching the claim's timeframe | Returns matching predictions (or empty) |
| Reply to mention: verdict per matched/not-matched, neutral wording (see CLAUDE.md non-negotiables) | Reply tweet posted |
| Deduplication: never reply to the same mention twice | `bot_replies` table tracks processed mention IDs |
| Rate limit: max 5 verifications per requester per day | Returns "rate limited" message gracefully |

### Verdict reply templates

```
Match found:
"toldproof verified ✓ Sealed [date]. Proof: toldproof.xyz/verify/[id]"

No match:
"No toldproof found for this claim from this account. Seal yours: toldproof.xyz"

Account not linked:
"This account hasn't linked an X handle to a Sui address via toldproof.xyz. No verifiable record exists yet."
```

**Day 7 DoD**: reply to a test tweet with `@toldproof verify`; bot replies within 5 minutes with one of the three verdict types.

---

## Day 8 — Polish, copy, landing page, Walrus Sites deploy

**Goal**: The product looks like a real launch, not a hackathon weekend.

### Tasks

| Task | DoD |
|---|---|
| Rewrite landing page copy: headline, 3 benefits, "how it works" 3-step, FAQ | Real copy in place, not Lorem Ipsum |
| Add screenshots and animated GIFs to landing | Visual proof points above the fold |
| Pricing section: free + Pro ($9.99/mo coming soon) | Clear future monetization signal |
| Footer: GitHub link, Sui Overflow badge, "built on Walrus + Seal" | Trust signals |
| Deploy landing page to Walrus Sites as `toldproof.wal.app` (or equivalent) | Walrus Sites mirror live — demo flex |
| Mobile responsive review | All pages work on mobile |
| Performance audit: Core Web Vitals, image optimization | LCP < 2.5s, CLS < 0.1 |
| Write `demo.md` with full 60s video script | Script locked, frame-by-frame |
| Draft README.md for project root | <200 lines, explains architecture for judges |

**Day 8 DoD**: production-quality polish on every page; Walrus Sites backup domain live; demo script finalized.

---

## Day 9 — Demo video filming + edit

**Goal**: A 60-second video that lands the pitch.

### Tasks

| Task | DoD |
|---|---|
| Set up screen recording (Loom, ScreenStudio, or OBS) at 4K | Recording at 4K, clear audio |
| Record each scene per the demo script — multiple takes | All clips on disk |
| Edit in CapCut / iMovie / DaVinci Resolve | 60s cut |
| Add captions (75% of viewers watch muted on Twitter) | Captions burned in |
| Add background music (royalty-free, subtle) | Music doesn't overpower voiceover |
| Voiceover: record + sync OR use AI narration (ElevenLabs) | Clear narration |
| Export 1080p MP4 + upload to YouTube + Twitter | Public links live |
| Test playback on phone | Works on mobile |

**Day 9 DoD**: a 60-second public video on YouTube + Twitter that follows the script.

---

## Day 10 — Testnet deploy (FINAL phase) + soft launch

**Goal**: Move contracts published on **Sui testnet** (not mainnet — mainnet is deferred to post-hackathon), Vercel production pointed at testnet, soft launch to a small group.

> **Why testnet, not mainnet**: Past Sui Overflow winners (Aver.Email, perma.ws, Chronos) submitted on testnet. Judges accept this. Mainnet adds 0 hackathon points and adds rugpull-style risk (Walrus permanence, Seal key-server commitments, real $$). The final-phase testnet deploy lets us exercise the full production stack — real Walrus, real Seal committee, real `@toldproof` bot traffic — without any of mainnet's irreversibility.

### Tasks

| Task | DoD |
|---|---|
| **Final review of Move contracts** (user reviews every diff against localnet code) | User approval recorded in commit message |
| Re-run all tests | `sui move test` — all green |
| Confirm sui client env is testnet, wallet funded | `sui client active-env` = `testnet`, `sui client gas` shows ≥ 2 SUI |
| Publish: `sui client publish --gas-budget 200000000` | Package ID + Registry ID captured |
| Update `.env.production` with testnet package + Registry IDs | App points to testnet |
| Deploy app to Vercel production | `toldproof.xyz` live |
| Test testnet end-to-end: seal a real prediction (unlock 10 min out), wait, reveal | Full flow on testnet — Walrus blob, Seal key release, reveal tweet |
| Soft launch: DM 5–10 crypto Twitter contacts with the demo video + URL | At least 2–3 real sealed predictions from non-self accounts |
| Build-in-public tweet: announce the project with the demo video | Tweet posted |

**Day 10 DoD**: live on **testnet**; tested end-to-end with real users; demo video shared. Mainnet is parked.

---

## Day 11 — DeepSurge submission + iteration buffer

**Goal**: Hackathon submission live on DeepSurge with full materials.

### Tasks

| Task | DoD |
|---|---|
| Create project page on deepsurge.xyz | Page exists |
| Fill out: name (TOLDPROOF), description (under 500 chars), track (Special — Walrus), media files | All fields complete |
| Links: GitHub (github.com/toldproof), demo video, live URL (toldproof.xyz), Walrus Sites mirror, Sui package ID | All filled |
| Project description: 2-3 paragraphs with problem, solution, what makes it unique | Description matches `spec.md` summary |
| Upload logo + screenshots | At least 3 visuals |
| Submit and verify it appears in `/projects?status=submitted` | Public submission confirmed |
| React to feedback / DMs from soft launch | Iterations applied if critical |

**Day 11 DoD**: hackathon entry submitted and publicly visible on DeepSurge.

---

## Days 12-30 — Iteration buffer + distribution

Use remaining time (deadline is 2026-06-21) for:

- Iterate on judge / community feedback
- Build the reputation NFT (stretch goal)
- Add structured prediction types (price > X by date) with Pyth/Switchboard auto-resolution
- More demo content: a thread of sealed predictions from the founder; "the call I sealed for the hackathon judges" meta-moment
- Sign up early users — target 25 sealed predictions across non-founder accounts before final judging
- Twitter build-in-public: 2-3 posts per week through end of deadline
- Outreach to Sui ecosystem partners (Talus, Polymarket, Metaculus) for integration discussions

---

## Priority drop order (if days slip)

If you can't complete the full plan, drop in this order from the bottom up:

1. **First to drop**: Day 11 iteration buffer (just submit on time)
2. **Then**: Day 8 polish features (FAQ, perfect copy)
3. **Then**: Day 8 Walrus Sites mirror (nice-to-have, not essential)
4. **Then**: Day 7 rate limiting (acceptable risk for hackathon scope)
5. **Then**: Day 5 OG image generator (text-only tweets still work)

**Do not drop**: Move contract + Seal time-lock (Day 1-2), wallet connect (Day 3), reveal watcher (Day 6), bot reply (Day 7), demo video (Day 9), **testnet final deploy** (Day 10), submission (Day 11).

---

## Decision points along the way

- **End of Day 2**: if Walrus + Seal SDK integration is harder than expected (>1 day over budget), simplify to Walrus-only (skip Seal for v1, just commit a hash on-chain and post plaintext later). Pivot announcement in Day 3 stand-up.
- **End of Day 5**: if X API Basic tier still not approved, fall back to free tier — limits demo throughput but doesn't kill the flow.
- **End of Day 8**: testnet IS the final-phase target. If Walrus or Seal flows have stability issues by EOD 8, fall back to a recorded Loom of the full flow on localnet for the demo, and explain "testnet stability deferred to post-hackathon" in the submission.
- **End of Day 10**: if reveal watcher or verify bot has bugs in soft launch, demo can show them in a controlled environment (Loom recording) — don't let live bugs kill the submission. Mainnet is NOT a Day-10 fallback; it's parked entirely.

---

## Daily standup template

Each morning, paste this into a note before starting:

```
Day [N]
Yesterday DoD met? [Y/N — what's left]
Today's top 3:
  1.
  2.
  3.
Top blocker / question to user:
Energy / focus check:
```

End of each day, check off the DoD bullets in this plan. If unmet, decide: push to tomorrow, drop from MVP, or escalate.
