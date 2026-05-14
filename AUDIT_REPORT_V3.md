# Security Audit Report — TOLDPROOF prediction_vault v3

**Date**: 2026-05-14
**Auditor**: `/dewaxguard core` (multi-agent pipeline, Claude Opus 4.7)
**Mode**: Core (right-sized for delta surface — see Scope)
**Scope**: `./move/prediction_vault` — Sui Move 2024 contract
**Language/Version**: Sui Move 2024.beta
**Build Status**: clean (`sui move build`)
**Tests**: 62/62 passing (`sui move test`)
**Prior audits**: v1 (`AUDIT_REPORT.md` — 0C/0H/1M/4L/4I, addressed), v2 (`AUDIT_REPORT_V2.md` — 0C/1H/4M/5L/2I, addressed)

---

## Executive Summary

This is a **delta audit** of the `prediction_vault` Move package, focused on the
changes introduced after the v2 audit cycle. Two categories of change were in
scope:

1. **V2 fix-bundle regression check** — the six fixes from `AUDIT_REPORT_V2.md`
   (H-01 identity charset whitelist, M-01 zero-address rotation guards × 3,
   M-02 fee refund-on-overpay, M-03 treasury-initialization gate, M-04 fee
   floor, L-04 sentinel return) are now in source. Verify no regressions.
2. **New surface: `seal_prediction_paid<T>`** — a paid human seal path mirroring
   the existing `seal_prediction_as_agent<T>` but stamping `entity_type=HUMAN`
   and skipping the agent wallet-lock. Plus a parallel `HumanSealFeePaid` event.

**Result: clean.** No new High, Medium, or Low findings. All six V2 fixes are
in place at the documented line numbers with no introduced bypass. The new
function is a byte-faithful mirror of the agent path with only the two
intended differences (entity type tag and event struct). Three
**Informational** observations are recorded for design transparency.

A test-coverage gap surfaced by recon (cross-direction collision tests between
the paid human path and the agent path) was closed in this audit cycle — see
`agent_cannot_claim_alias_already_used_by_paid_human` (test #62).

The contract is **ready for testnet redeployment.** No required code changes.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |
| Informational | 3 |

### Components Audited

| Component | Path | Lines | Description |
|-----------|------|-------|-------------|
| `prediction_vault` | `move/prediction_vault/sources/prediction_vault.move` | ~720 | Sui Move package: seal / reveal / resolve / reputation profile. Three seal paths share state via shared `Registry`. |
| Test suite | `move/prediction_vault/tests/prediction_vault_tests.move` | ~1500 | 62 tests covering happy paths + negative branches across all three seal paths + admin rotations. |

---

## Audit Pipeline Executed

| Phase | Status | Notes |
|---|---|---|
| Phase 1 — Recon (combined) | ✓ | Delta surface mapped at `scratchpad-v3/recon.md` |
| Phase 3 — Breadth (3 parallel agents) | ✓ | Economic+Invariant, Execution+Access, First-Principles+Vector. 28 coverage items, 3 Info findings. |
| Phase 4a — Inventory | ✓ inline | 3 findings consolidated below |
| Phase 4a.5 — Semantic Invariants | n/a | No new state surface beyond what breadth covered |
| Phase 4b — Depth | skipped | No UNCERTAIN findings to drill on. All breadth verdicts were CONFIRMED-Informational or VERIFIED-SAFE. |
| Phase 4c — Chain Analysis | n/a | No chainable findings |
| Phase 5 — Verification | ✓ | Existing `sui move test` covers all paths; one test added for cross-direction collision (62/62 passing) |
| Phase 5d — Validator | n/a | No Medium+ findings to score |
| Phase 6 — Report | ✓ this doc | |

**Pipeline right-sizing rationale**: Core mode prescribes 25-45 agents for a
fresh codebase. This audit's delta surface is *one new function plus a fix-bundle
verification*, so the breadth fleet was right-sized to 3 agents instead of 8,
and depth was skipped because breadth produced zero UNCERTAIN verdicts. The
core-mode rigor (parallel adversarial breadth angles, file:line citations,
trust-assumption-aware severity) is preserved; the agent count is matched to
surface size.

---

## Informational Findings

### [I-01] Denomination-blind `MIN_FEE_FLOOR_MIST`

**Severity**: Informational (after `FULLY_TRUSTED` downgrade — admin sets fees)
**Location**: `prediction_vault.move:83` — `const MIN_FEE_FLOOR_MIST: u64 = 10_000_000`

**Description**:
The fee floor is denominated in the coin's smallest unit, applied uniformly
regardless of which coin type the admin registers. Because different coin
types have different decimal precisions, the same numeric floor produces
wildly different USD floors:

| Coin | Decimals | 10M floor in coin units | Approx USD floor |
|---|---|---|---|
| SUI | 9 | 0.01 SUI | $0.02 |
| USDC | 6 | 10 USDC | $10.00 |
| USDT | 6 | 10 USDT | $10.00 |
| WBTC | 8 | 0.1 BTC | ~$6,000 |
| Hypothetical 18-dec memecoin | 18 | 0.00000001 token | dust |

The floor was designed as a sybil-prevention guard against `set_fee<T>(0)`
(the V2 M-04 finding). It correctly prevents that for SUI, but admin
discretion is now required when registering any non-SUI coin.

**Impact**:
Admin foot-gun, not a user-impacting bug. If admin registers a 18-decimal
coin with `fee = MIN_FEE_FLOOR_MIST`, the V2 zero-fee sybil scenario reopens
in that coin's denomination. The admin is FULLY_TRUSTED per
`CLAUDE.md`, so this is a documentation/UX concern not a security flaw.

**Recommendation**:
Document the denomination convention in the `set_fee<T>` doc comment ("supply
`fee_amount` in the coin's smallest unit; ensure the resulting USD value
exceeds your spam-prevention threshold"). Optional future enhancement: a
per-coin floor table parameterized at registration time. Not blocking.

---

### [I-02] `HumanSealFeePaid` / `AgentSealFeePaid` event divergence

**Severity**: Informational (design observation)
**Location**: `prediction_vault.move:174-188` — two event struct definitions

**Description**:
`AgentSealFeePaid` and `HumanSealFeePaid` are structurally identical (same
five fields: `prediction_id, payer, coin_type, fee_paid, treasury_addr`).
They could be unified into a single `SealFeePaid` event with the entity type
joined from `SealedPrediction.entity_type`.

**Impact**:
None. Two structurally-identical events make indexers slightly more verbose
(must subscribe to both topics) and downstream analytics must remember to
sum across both for total revenue. Not a security or correctness issue.

**Recommendation**:
If a future version rationalizes the event schema, unify to a single
`SealFeePaid { prediction_id, payer, coin_type, fee_paid, treasury_addr }`
event and let consumers join on `entity_type` from the prediction object.
Migrating events is a breaking change for indexers, so defer until there's
another forced version bump.

---

### [I-03] Admin rotation entries permit re-merging to a single pointer

**Severity**: Informational (FULLY_TRUSTED actor, design observation)
**Location**: `prediction_vault.move:635-685` — `set_admin` / `set_resolver` / `set_treasury_addr`

**Description**:
The three rotation entries each reject `@0x0` (V2 M-01 guard) but do NOT
prevent rotating any of the three to the *same* address as one of the
others. A misconfigured admin could call `set_resolver(admin_addr)` or
`set_treasury_addr(admin_addr)` and collapse the role separation that V2
introduced.

**Impact**:
None for a well-operated deployment. The admin is FULLY_TRUSTED per
`CLAUDE.md`, and the V2 M-03 fix already requires `set_treasury_addr` to be
called explicitly before `set_fee<T>` can succeed — so the most common
"accidentally use deployer as treasury" mistake is blocked.

**Recommendation**:
None required. Optional future enhancement: a `require_distinct_roles` flag
in the registry that enforces `admin != resolver`, `admin != treasury_addr`,
`resolver != treasury_addr`. Not blocking for current threat model.

---

## V2 Fix-Bundle Regression Verification

Every V2 fix is present at HEAD with no introduced bypass:

| V2 Finding | Fix | Verified At | Status |
|---|---|---|---|
| H-01 — Identity charset bypass | `assert_canonical_identity(&identity)` enforces `[a-z0-9_-]` | called from `create_prediction` at L466 | ✓ in place, plus 3 new negative tests (uppercase / `@` / UTF-8) |
| M-01a — `set_admin(@0x0)` | `assert!(new_admin != @0x0, EInvalidAddress)` | `prediction_vault.move:640` | ✓ in place + negative test `set_admin_with_zero_address_aborts` |
| M-01b — `set_resolver(@0x0)` | `assert!(new_resolver != @0x0, EInvalidAddress)` | `prediction_vault.move:656` | ✓ in place + negative test |
| M-01c — `set_treasury_addr(@0x0)` | `assert!(new_addr != @0x0, EInvalidAddress)` | `prediction_vault.move:671` | ✓ in place + negative test |
| M-02 — Agent overpay loss | `coin::split` → `transfer(exact)` → refund-or-destroy_zero | `prediction_vault.move:343-353` | ✓ in place + `agent_seal_overpay_returns_change` test |
| M-03 — `set_fee` before treasury rotation | `assert!(reg.treasury_initialized, ETreasuryNotInitialized)` | `prediction_vault.move:631` + `treasury_initialized` field initialized `false` at init | ✓ in place + `set_fee_before_treasury_init_aborts` test |
| M-04 — Zero-fee sybil | `assert!(fee_amount >= MIN_FEE_FLOOR_MIST, EFeeTooLow)` | `prediction_vault.move:633` | ✓ in place + `set_fee_below_floor_aborts` test |
| L-04 — `agent_alias_locked_to` abort on missing | `if (!contains) return @0x0` sentinel | `prediction_vault.move:678-679` | ✓ in place + `agent_alias_locked_to_returns_sentinel_for_missing` test |

**Regression count: 0**

---

## New Function Coverage: `seal_prediction_paid<T>`

The new entry function at `prediction_vault.move:395-442` was audited along
ten distinct angles across the three breadth agents:

**Verified safe (no findings):**

1. **Fee-burn on abort** (E2) — Sui Move atomic rollback covers all abort
   points downstream of the L416 `transfer::public_transfer(exact, treasury)`
   call. If `create_prediction` aborts (e.g. identity-type collision), the
   entire tx reverts and the treasury transfer is undone.

2. **Cross-path entity arbitrage** (E3) — the type-lock invariant at L478
   (`identity_claims[identity] = entity_type`) is symmetric across all three
   seal paths. Cross-claiming entity types is self-sabotage, not an exploit.

3. **Treasury front-running** (E4) — `&mut Registry` serializes
   `set_treasury_addr` with seal paths in the Sui scheduler; admin is
   FULLY_TRUSTED for the destination choice.

4. **Identity-type uniqueness** (I1) — single mutation site at L478,
   immutable post-write, all 3 paths funnel through L474-479.

5. **Agent wallet-lock isolation** (I2) — the new path hardcodes
   `ENTITY_HUMAN` at L426, structurally unreachable from the
   `agent_wallet_locks` mutation block at L483-490 (guarded by
   `entity_type == ENTITY_AGENT`).

6. **Counter consistency** (I3) — `total_count` and `by_identity` counters
   increment in the same unconditional block at L513-519.

7. **Coin conservation** (I4) — Move linear types + `coin::split` invariant
   + `destroy_zero`-on-exact branch enforce `input = treasury_out + refund_out`.

8. **Event-state parity** (I5) — `HumanSealFeePaid` has a single emit site
   at L435, structurally unreachable from other paths.

9. **Drift between paid paths** (EX1-EX5) — byte-faithful mirror of
   `seal_prediction_as_agent<T>` (agent at L332-382, human at L395-442) with
   only the two intended differences. Fee-table lookup, coin split direction,
   refund target (`ctx.sender()`), destroy_zero path, `create_prediction`
   argument order, and abort ordering all match.

10. **Type confusion via generic `T`** (V1) —
    `type_name::with_defining_ids<T>()` correctly canonicalizes the type
    identity; no shadow-type confusion path exists.

---

## Test Coverage

| Suite | Pre-V3 | Post-V3 | Delta |
|---|---|---|---|
| `sui move test` | 61 | **62** | +1 (`agent_cannot_claim_alias_already_used_by_paid_human` — closes a cross-direction collision gap recon flagged) |
| `vitest` (TypeScript) | 26 | 26 | — |
| **Total** | 87 | **88** | +1 |

All tests pass at HEAD. The new test covers the previously-untested direction:
paid-human claims an alias → agent path attempting the same alias must abort
with `EIdentityClaimedByOtherType`. Complements the existing tests covering
the four other cross-direction collisions.

---

## Out-of-Scope Notes

The following items are correctly out-of-scope for this contract layer but
deserve a forward-pointer for the v1.1 implementation:

1. **Off-chain quota enforcement** (the "10 free per month" policy) lives in
   the API layer (Postgres + monthly reset cron + frontend gate). The
   contract correctly has no concept of free-quota — both free and paid
   human paths are permissionless at the chain level. A determined user who
   bypasses the UI can always call `seal_prediction` directly. The
   `seal_prediction_paid<T>` path is the *opt-in* commitment to pay; nothing
   on-chain forces an honest user through it. This matches the design intent
   recorded in this audit's `recon.md` §3 (FPC-1).

2. **X OAuth identity binding** is the off-chain mechanism preventing
   front-running of popular handles. First-claim-wins (`identity_claims`)
   on-chain is the failsafe; the OAuth layer is the first line of defense.
   This is pre-existing v1/v2 design, not a v3 concern.

3. **Pro subscription billing** ($9/mo, embed widget, private mode) is
   off-chain and not part of this audit. The contract simply doesn't
   distinguish Pro users from free users beyond the quota-routing decision
   made at the API layer.

---

## Priority Remediation Order

**No required remediations.**

Optional documentation improvements (Informational):

1. **I-01**: Add a doc-comment paragraph to `set_fee<T>` noting that
   `fee_amount` is denominated in the coin's smallest unit and the admin is
   responsible for ensuring the resulting USD value clears their spam-prevention
   threshold.
2. **I-02**: When a future package upgrade rationalizes the event schema,
   merge `HumanSealFeePaid` + `AgentSealFeePaid` → `SealFeePaid`.
3. **I-03**: If desired, add a `require_distinct_roles` post-condition to
   the rotation entries to prevent admin = resolver = treasury collapses.

---

## Appendix A — Audit Artifacts

| File | Contents |
|---|---|
| `scratchpad-v3/meta.md` | Audit scope + baseline build/test status |
| `scratchpad-v3/recon.md` | Phase 1 surface map + cross-function interaction matrix |
| `scratchpad-v3/breadth_A_econ_invariant.md` | 1 finding + 8 verified-safe (Economic + Invariant angles) |
| `scratchpad-v3/breadth_B_exec_access.md` | 2 findings + 12 verified-safe (Execution + Access angles) |
| `scratchpad-v3/breadth_C_firstprinc_vector.md` | 0 findings + 11 verified-safe (First-Principles + Vector angles) |

## Appendix B — Auditor Verdict

The `prediction_vault` package is **cleared for testnet redeployment** at
the current `HEAD`. The V2 fix bundle is correctly applied with no
regressions, and the new `seal_prediction_paid<T>` function introduces no
new security surface beyond what is intended and already covered by the
test suite (now 62 tests).

The three Informational observations are design-time considerations, not
security defects. None block deployment.
