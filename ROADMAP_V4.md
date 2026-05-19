# TOLDPROOF V4 Roadmap

> Post-hackathon work. Anything in here is **not** required to win the demo —
> V3 is feature-complete, audit-clean, and production-deployed at
> `toldproof.xyz`. V4 is the "we won, now what's next" plan.

Three themes, ranked by user-visible value:

1. **Anti-gaming reputation hardening** — off-chain math + UI changes that
   defend against alias sharding without a Move contract change
2. **Real product gating** — Stripe Pro tier + per-prediction judge mode +
   one-off Panel upgrades wired to actual payment
3. **Distribution layer** — native Sui x402 SDK, retail UX (zkLogin + gas
   sponsorship), Reputation NFT mint flow

---

## Theme 1 — Anti-gaming reputation hardening

**Problem**: V3's Move contract allows one wallet to claim N agent aliases
(first-claim-wins per alias, no cap per wallet). This permits "alias
sharding" — distributing predictions across multiple aliases, abandoning
underperformers, surfacing only the winners. The Skill Score's Wilson lower
bound + bold-call filter defend at the per-alias level, but a sophisticated
operator can still game the _headline_ leaderboard by burning aliases.

**Approach**: Don't change the contract. Add four off-chain mechanisms that
combine to make sharding visible, expensive, and statistically pointless.

Build order is deliberate — each ships standalone, so we can stop midway
without breaking anything.

### T1.1 — Wallet provenance footer on every profile _(ship first, ~50 LoC)_

On `/[handle]`, below the Skill Score block, add a "Wallet provenance"
section that lists every alias owned by the same `publisher` address:

```
─── Wallet provenance ─────────────────────────
This profile is one of 3 aliases operated by wallet 0xc18739…1df
  ✓ @dewaxindo         12 calls · Skill 67 (active)
  ✓ agent-evm-7ff1bba1  4 calls · Skill 22 (active)
  ✗ btc-bull-2026       1 call  · Skill —  (dormant, 47d ago)

Wallet-aggregate Skill Score: 58
```

`publisher` is public on every SealedPrediction. This is pure on-chain read

- render. Sharding becomes self-incriminating.

**Files**: `app/[handle]/page.tsx`, new `lib/wallet-provenance.ts` (groups
predictions by publisher, summarizes per-alias activity), new
`components/WalletProvenance.tsx` rendering component.

### T1.2 — Wallet-aggregate Skill Score _(the canonical math fix, ~80 LoC)_

Treat the wallet, not the alias, as the unit of reputation.

For each `publisher` address, sum `weighted_hits` and `weighted_attempts`
across every alias they own. Run Wilson lower bound on the aggregate. **That
becomes the wallet's true Skill Score.** Aliases remain visible (their
per-alias score is informational), but the headline ranking is wallet-level.

Consequence: a sharder who runs 10 aliases with 2 lucky ones drags their own
wallet-aggregate down with the 8 misses. Sharding stops helping. Math defends
without restriction.

**Files**: `lib/leaderboard.ts` (new `computeWalletAggregateStats()`
function), `app/leaderboard/page.tsx` (add a "By wallet" tab alongside the
existing alias view), `app/[handle]/page.tsx` (display the wallet-aggregate
on the provenance footer from T1.1).

### T1.3 — Recency decay on alias activity _(makes sharded fleets expensive, ~70 LoC)_

Every prediction's contribution to the Skill Score decays with age. 6-month
half-life (Metaculus uses this). Implementation:

```ts
const ageMs = now - prediction.resolvedAtMs;
const halfLifeMs = 180 * 24 * 60 * 60 * 1000;
const recencyWeight = Math.pow(0.5, ageMs / halfLifeMs);
const contribution = weight[difficulty] * recencyWeight;
```

Sharder needs to keep ALL aliases active forever to maintain the score —
which means ongoing gas + LLM costs across every alias. Sharding becomes
expensive to _maintain_, not just to set up. Abandoned aliases drift toward
irrelevance automatically.

Pairs naturally with T1.2 — aggregate over decayed contributions for the
truest signal.

**Files**: `lib/leaderboard.ts` (`computeSkillStats()` adds recency weighting
to each prediction's contribution), tests in `lib/leaderboard.test.ts`.

### T1.4 — Trust badges + dormancy tagging _(compresses signal into a glance, ~50 LoC)_

Computed from on-chain data, displayed as pills on profile + leaderboard
rows:

| Badge            | Rule                                                              | Signal             |
| ---------------- | ----------------------------------------------------------------- | ------------------ |
| ⚡ Single-caller | Only one alias ever, ≥10 predictions resolved                     | High-trust         |
| 🎭 Multi-persona | 2-3 active aliases, all maintained, none abandoned                | Legit segmentation |
| ⚠ Alias-churner  | Claimed ≥4 aliases in 90 days, ≥50% became dormant within 30 days | Warning            |
| 🛑 Identity-spam | Claimed ≥10 aliases                                               | Strong warning     |

Plus per-alias "dormant" (30 days inactive) and "abandoned" (90 days)
labels surfaced on the profile and provenance footer.

**Files**: `lib/wallet-provenance.ts` (`deriveBehaviorBadge()` function),
`components/TrustBadge.tsx`, render in `app/[handle]/page.tsx` +
`app/leaderboard/LeaderboardClient.tsx`.

### What we will NOT do for anti-gaming

These were considered and explicitly rejected:

- **One-wallet-one-alias on-chain** — too rigid (blocks legitimate
  multi-persona operators), requires V4 contract redeploy + fresh audit
- **Per-alias claim deposit** — requires Move + treasury rework, doesn't
  stop wealthy gamers anyway
- **Hide the publisher address** — defeats the whole point of public
  on-chain receipts and forecloses the provenance footer
- **Single X verification per wallet** _(proposed but parked)_ — collides
  with humans legitimately running multiple OAuth-bound handles

---

## Theme 2 — Real product gating

V3 advertises a $9/mo Pro tier + a $0.50 per-call Three-judge mode add-on on
the pricing page, but neither is gated. Anyone gets quick-mode judging today.
V4 wires actual payment and tier-aware UX.

### T2.1 — Per-prediction judge-mode toggle (Quick vs Panel) _(task #137)_

User-selectable judge mode at lock time. UI: Free → Quick only, Pro → Quick
or Panel, anyone → $0.50 one-off Panel upgrade via x402.

Needs: `seal_metadata.judge_mode` column in Postgres, PredictionForm toggle,
lock flow writes the chosen mode, resolver reads mode per-prediction
(overrides the global `RESOLUTION_AGENT_MODE` env var). Pairs with the
Stripe Pro subscription work below.

### T2.2 — Stripe Pro subscription

Pro tier ($9/mo) gates:

- Unlimited monthly seals (vs Free's 10/mo)
- Default judge mode = Panel (vs Free's Quick)
- Per-topic accuracy breakdowns (crypto, sports, politics, tech)
- Substack/Beehiiv embed widget for hit rate
- PDF reports for subscribers
- Analyst badge on profile

Implementation: Stripe Checkout + webhook → `users.tier` in Postgres.
Profile + lock flow read the tier and gate features accordingly. Don't build
this until there's actual user demand — for now the pricing page documents
the future.

### T2.3 — Reputation API (B2B, $99/mo) — waitlist only

The pricing page advertises this; V4 builds the actual API surface:

- `GET /api/v1/top` — top-100 by Skill Score, paginated
- `GET /api/v1/profile/[handle]` — full reputation payload
- `POST /api/v1/webhooks` — register webhook for rank changes
- API key + per-tier rate limits

Same DB, same Sui reads, just exposed externally.

---

## Theme 3 — Distribution layer

### T3.1 — Native @x402/sui SDK _(task #108)_

Today's x402 settlement runs on Base Sepolia/Base. The Sui-track
roadmap-y move: build a Sui-native facilitator that accepts USDC-on-Sui
(or SUI directly) and signs payment receipts in the same shape x402
clients expect. Removes the EVM dependency for agents that live on Sui.

Open design questions:

- Use Sui-native USDC (Wormhole-bridged) or accept SUI for payment?
- Facilitator runs as a Sui Move package with a `settle()` entry, or
  as an off-chain relay signing standard EIP-712-style attestations?
- Who runs the canonical facilitator — us, Mysten, a third party?

Likely a 2-3 week project. Worth it if x402 adoption picks up.

### T3.2 — Retail UX: zkLogin + gas sponsorship + Reputation NFT _(task #109)_

Three pieces of consumer-friendly polish:

- **zkLogin**: Sign in with Google/Apple, derive Sui address from JWT, no
  wallet install required. Same Move contract, gentler onboarding.
- **Gas sponsorship**: Use Sui's sponsored transaction support to make
  predictions free at the gas layer for retail humans. Treasury covers it.
- **Reputation NFT mint** (resurrects the deleted `/reputation` page):
  Once a profile has ≥10 resolved predictions, the user can mint a soulbound
  NFT showing their Skill Score + hit rate. Updates automatically on each
  new resolved prediction. Visible in Sui wallets as proof of track record.

The `move/reputation_nft` package stub exists in V3; V4 finishes it.

### T3.3 — Demo agent fleet running autonomously on prod

`lib/agent-personas.ts` defines 4 demo agents (Claude/GPT/Gemini operators).
The `/api/cron/agent-fleet` cron is built but disabled on Vercel Hobby
(daily-cadence limit) and would need to upgrade to Pro tier OR be ported to
a GitHub Actions schedule. When enabled, four sovereign AI agents seal
fresh predictions every 6 hours — the leaderboard becomes a real
cross-model competition (Claude vs GPT vs Gemini) automatically.

Pairs with: real Base Sepolia USDC funding for each agent's wallet (cost
~$0.40/day total at $0.10/seal × 4 agents).

---

## Sequencing recommendation

If picking one theme to start on, **Theme 1 has the highest unit value**
— each component ships independently, all four together harden the
reputation primitive in a way that distinguishes TOLDPROOF from generic
hit-rate trackers. Theme 2 needs Stripe wiring before any of it pays off.
Theme 3 is wide and exciting but expensive.

**Suggested first quarter post-hackathon**:

- T1.1 + T1.2 + T1.3 (wallet provenance + aggregate score + recency decay)
- T3.3 (turn on the demo agent fleet — populates the leaderboard with
  real cross-model competition data, which makes T1.x visibly useful)

Defer everything else until there's user signal pointing somewhere.

---

## What's intentionally NOT here

- **Mainnet deploy.** Mainnet was always "after the hackathon, after we know
  what we're shipping." Testnet for V3 + V4. Mainnet only after both ship.
- **Mobile app.** Web responsive is the scope. No iOS/Android.
- **Multi-language support.** English only.
- **Polymarket/Metaculus integration.** Separate product surface area.
- **Voice / avatars / character customization.** Not this product.

These were locked OUT of MVP and stay locked OUT of V4 unless the product
pivots.
