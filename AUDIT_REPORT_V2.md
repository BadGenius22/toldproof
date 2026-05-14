# Security Audit — TOLDPROOF prediction_vault.move v2

**Date**: 2026-05-14
**Auditor**: dewaxguard (thorough mode, Sui Move) — 3 parallel breadth agents + cross-referenced synthesis
**Target**: `move/prediction_vault/sources/prediction_vault.move` (663 lines)
**Tests reviewed**: `move/prediction_vault/tests/prediction_vault_tests.move` (1106 lines, 45 tests)
**Scope**: Sui Move v2 surface — the diff vs. v1. v1 was already audited (`AUDIT_REPORT.md`), all v1 findings (0C/0H/1M/4L/4I) addressed in commit `ebf7899`.

## Executive summary

The v2 changes are substantial: generic `Coin<T>` fee path, identity locks (first-claim-wins), three-role separation (admin/resolver/treasury_addr), reputation profile event publishing. The contract continues to follow Sui Move 2024 patterns correctly — `entry fun seal_approve` is right, BCS trailing-byte defense remains, event emission is comprehensive, OTW/init pattern is correct, no `public(friend)` usage.

**One High-severity finding** is genuinely critical for the project's value proposition: the identity-claim Tables are keyed on raw bytes with no normalization, so the entire impersonation defense can be bypassed via case-variant / Unicode-confusable / whitespace-padded aliases. This MUST be fixed before testnet redeploy.

**Four Medium-severity findings** are deploy-blocker-adjacent: admin lockout via `@0x0` rotation, coin overpayment forfeited to treasury, treasury defaults to deployer (bootstrap foot-gun), and `set_fee(0)` enables near-zero-cost sybil alias squatting. All have one-to-three-line fixes.

**Seven Low/Informational** items cover defense-in-depth, accessor ergonomics, and design tradeoffs (e.g., Seal IBE identity shared across same-unlock predictions — accepted as-canonical-pattern but documented).

**Recommendation**: apply the High + 4 Mediums + 2 Lows ("must-fix bundle") before testnet redeploy. Defer the rest to post-hackathon roadmap. Estimated patch: ~80 LOC + 8 new tests.

## Severity summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 1 |
| Medium | 4 |
| Low | 5 |
| Informational | 2 |
| **Total** | **12** |

## Must-fix bundle (deploy-blockers)

| ID | Severity | Title | Fix size |
|---|---|---|---|
| **H-01** | High | Identity normalization missing — case/whitespace/'@'/Unicode confusables bypass first-claim-wins | ~20 LOC + 3 tests |
| **M-01** | Medium | `set_admin` / `set_resolver` / `set_treasury_addr` accept `@0x0` and permanently brick governance | ~6 LOC + 3 tests |
| **M-02** | Medium | Coin overpayment forfeited to treasury (no split + refund) | ~10 LOC + 1 test |
| **M-03** | Medium | Treasury defaults to deployer — admin can call `set_fee<T>` before `set_treasury_addr` | ~3 LOC + 1 test |
| **M-04** | Medium | `set_fee<T>(0)` allowed — sybil seal attack at near-zero cost can squat alias namespace | ~3 LOC + 1 test |
| **L-04** | Low | `agent_alias_locked_to` aborts on missing key (asymmetric with `identity_count`, `fee_for`) | ~2 LOC + 1 test |

## Deferred to post-hackathon roadmap

| ID | Severity | Title | Why deferred |
|---|---|---|---|
| M-05 | Medium | Seal IBE identity shared across same-unlock-time predictions | Canonical Seal pattern; redesign is two-phase seal + per-prediction binding |
| L-01 | Low | No two-phase admin rotation (`propose` + `accept`) | Operational discipline solves it; deeper UX redesign |
| L-02 | Low | `publish_reputation_profile` has no monotonicity check on `version` | Indexers handle off-chain; cheap on-chain fix possible but not blocking |
| L-03 | Low | No `migrate()` entry for future package upgrades | Phase 3+ concern; build into v3 when needed |
| L-05 | Low | 10-year `MAX_LOCK_DURATION_MS` exceeds Walrus 53-epoch cap | Frontend already prevents over-cap unlocks |
| I-01 | Info | Loose bounds on `sealed_key` (4 KB) + `blob_id` (256 B) | Within Sui object limits; tighten in v3 |
| I-02 | Info | `reasoning_blob_id` 256 B is a side-channel for the trusted resolver | Resolver is trusted by design |

---

# Findings

### [H-01] Identity normalization missing — case/whitespace/'@'/Unicode confusables bypass first-claim-wins

**Severity**: High
**Location**: `prediction_vault.move:357-377` (create_prediction), `:86-90` (Registry comment promise)
**Category**: Invariant violation / impersonation defense bypass

**Description**: The contract claims at line 86-90 that identities are "lowercased, no '@'", but no on-chain normalization is enforced. `identity_claims: Table<String, u8>` and `agent_wallet_locks: Table<String, address>` are keyed on the raw `String` parameter, which is just a `vector<u8>` under the hood compared byte-for-byte.

This means the first-claim-wins invariant — **the entire identity-impersonation defense** — can be trivially bypassed by submitting any byte-variant of an already-claimed identity:

- Case: `"Elonmusk"` vs `"elonmusk"` → two distinct Table keys
- Trailing whitespace: `"elonmusk "` → distinct from `"elonmusk"`
- `@`-prefixed: `"@elonmusk"` → distinct
- Unicode NFD: `"café"` (decomposed) vs `"café"` (composed) → distinct
- Cyrillic confusables: `"elonmusk"` (Latin) vs `"еlonmusk"` (Cyrillic `е` U+0435) → indistinguishable to humans, distinct Table keys

**Impact**: The product's headline cryptographic guarantee — "this prediction is verifiably from THIS identity" — fails on byte-variant collisions. Concrete attacks:

1. **Cross-type impersonation**: A real human `elonmusk` seals as `ENTITY_HUMAN` with `identity = "elonmusk"`. Attacker submits a PTB with `identity = "Elonmusk"` as `ENTITY_AGENT` — succeeds. The product UI now has two profiles under what looks like the same handle.
2. **Agent-wallet-lock bypass**: A real agent `claude-v1` is locked to its operator's wallet. Attacker locks `"Claude-v1"` (capital C) to their own wallet from a different keypair — runs a parallel reputation under the visually-identical alias.
3. **Mass squatting**: Attacker pre-claims all case-variant permutations of popular handles for ~$0.001 each in gas.
4. **Indexer ambiguity**: The Reputation Agent's profile events become non-deterministic — multiple "elonmusk" profiles exist under different byte keys, the indexer must guess which is canonical.

**Likelihood**: Permissionless. Anyone can submit byte-variant PTBs. No special timing or sequencing required.

**Evidence**:
```move
// L86-87 — comment promise NOT enforced by code
public struct Registry has key {
    // ...
    /// identity (lowercased, no '@') → all prediction IDs sealed under it.
    /// Humans use x_handles, agents use aliases — same table, distinguished
    /// by `entity_type` on each SealedPrediction.
    by_identity: Table<String, vector<ID>>,
```

```move
// L357-377 — raw identity used as Table key
let il = identity.length();
assert!(il > 0 && il <= MAX_IDENTITY_LEN, EInvalidIdentity);

if (reg.identity_claims.contains(identity)) {
    let claimed_type = *reg.identity_claims.borrow(identity);
    assert!(claimed_type == entity_type, EIdentityClaimedByOtherType);
} else {
    reg.identity_claims.add(identity, entity_type);
};
```

The only validation is length (1..=64 bytes). Byte content is unconstrained.

**Recommendation**: Enforce a strict ASCII-only, lowercased charset on-chain. This eliminates the entire Unicode-confusable class and the case-variant class. Add a helper:

```move
const EInvalidIdentityCharset: u64 = 21;

// Allow: a-z (0x61-0x7A), 0-9 (0x30-0x39), '_' (0x5F), '-' (0x2D).
// Reject: uppercase, whitespace, '@', any byte > 0x7F (Unicode).
fun assert_canonical_identity(s: &String) {
    let bytes = s.as_bytes();
    let n = bytes.length();
    let mut i = 0;
    while (i < n) {
        let b = *bytes.borrow(i);
        let ok = (b >= 0x61 && b <= 0x7A)    // a-z
              || (b >= 0x30 && b <= 0x39)    // 0-9
              || b == 0x5F                   // _
              || b == 0x2D;                  // -
        assert!(ok, EInvalidIdentityCharset);
        i = i + 1;
    };
}
```

Call this at the top of `create_prediction()` BEFORE any Table operations. Document the rule in CLAUDE.md / spec: identities are `[a-z0-9_-]{1,64}`.

**Negative tests required**: uppercase rejected, `'@'`-prefixed rejected, whitespace rejected, Unicode rejected.

**Existing tests covering this**: NO. Every existing test uses lowercase ASCII handles.

---

### [M-01] `set_admin` / `set_resolver` / `set_treasury_addr` accept `@0x0` and permanently brick governance

**Severity**: Medium
**Location**: `prediction_vault.move:523-533` (set_admin), `:537-547` (set_resolver), `:550-560` (set_treasury_addr)

**Description**: All three role-rotation entries accept any `new_*: address` argument without validation. A single fat-finger PTB during a rotation ceremony can permanently brick governance:

- `set_admin(@0x0)` → all four admin-gated paths (`set_admin`, `set_resolver`, `set_treasury_addr`, `set_fee`) become uncallable forever. The protocol's economic + resolution layer freezes.
- `set_resolver(@0x0)` → all future `resolve()` and `publish_reputation_profile` calls abort. Reputation system freezes; revealed predictions accumulate forever without verdicts.
- `set_treasury_addr(@0x0)` → all agent-seal fees burned to address-zero.

**Impact**: Permanent loss of governance (set_admin case) or core protocol functions (set_resolver case) or all paid revenue (set_treasury case). Recovery requires a full package upgrade — operationally non-trivial.

**Evidence**:
```move
// L523-533 — no validation on new_admin
public fun set_admin(reg: &mut Registry, new_admin: address, ctx: &TxContext) {
    check_version(reg);
    assert_admin(reg, ctx);
    let old = reg.admin;
    reg.admin = new_admin;  // <-- could be @0x0
    event::emit(AdminRotated { ... });
}
```
Same pattern at L537 and L550.

**Recommendation**: Add zero-address guards to all three:
```move
const EInvalidAddress: u64 = 22;
// In each rotation entry, immediately after assert_admin:
assert!(new_admin != @0x0, EInvalidAddress);  // for set_admin
assert!(new_resolver != @0x0, EInvalidAddress);  // for set_resolver
assert!(new_addr != @0x0, EInvalidAddress);  // for set_treasury_addr
```

**Existing tests covering this**: NO. All rotation tests use real addresses.

---

### [M-02] `seal_prediction_as_agent` consumes the entire `Coin<T>` — agent overpayment silently forfeited to treasury

**Severity**: Medium
**Location**: `prediction_vault.move:288-330` (seal_prediction_as_agent)

**Description**: The fee path takes `fee: Coin<T>` by value and after asserting `paid >= required`, transfers the **entire** coin to `treasury_addr`. No `coin::split` for change. An agent passing a 1 SUI coin when the fee is 0.1 SUI silently overpays 0.9 SUI (and the contract's `FeeSet` event still claims `required` was paid).

**Impact**: Silent overpayment foot-gun. Most well-built clients use `splitCoins([required])` in their PTB and won't trip this, but a hand-crafted PTB, a misconfigured indexer, or any flow that passes the user's full balance coin will silently overpay. Mid-flow PTBs are common in MCP server contexts (where the relay wallet uses dynamic coin selection).

**Evidence**:
```move
// L304-309 — entire coin forwarded, no split
let required = *reg.fees.borrow(type_bytes);
let paid = fee.value();
assert!(paid >= required, ENotEnoughFee);

let treasury_dest = reg.treasury_addr;
transfer::public_transfer(fee, treasury_dest);  // <-- entire coin
```

**Recommendation**: Split exactly `required` from `fee`, refund the remainder to `ctx.sender()`:
```move
let mut fee = fee;  // make mutable
let paid = fee.value();
assert!(paid >= required, ENotEnoughFee);

let exact = coin::split(&mut fee, required, ctx);
transfer::public_transfer(exact, treasury_dest);
if (fee.value() > 0) {
    transfer::public_transfer(fee, ctx.sender());
} else {
    coin::destroy_zero(fee);
};
```

**Existing tests covering this**: NO. Test L771 uses `coin::mint_for_testing(AGENT_FEE_MIST)` (exact amount), so the overpay branch is never exercised. Add test: mint `AGENT_FEE_MIST * 2`, assert treasury received exactly `AGENT_FEE_MIST` and sender got the rest back.

---

### [M-03] `treasury_addr` defaults to deployer; admin can call `set_fee<T>` before `set_treasury_addr`

**Severity**: Medium
**Location**: `prediction_vault.move:233-244` (init), `:288-330` (seal_prediction_as_agent), `:567-579` (set_fee)

**Description**: At `init()`, `treasury_addr = sender` (the deployer's address). If the operator forgets to call `set_treasury_addr` post-deploy but DOES call `set_fee<T>`, every paid agent seal silently forwards fees to the deployer's wallet indefinitely.

For a hackathon where the deployer is a hot wallet on a dev laptop, this is a non-trivial loss-of-funds risk. The deploy script handles this correctly (set_treasury_addr is called in the same script), but any manual deploy or any deployment that fails between publish and the admin txs leaves the system in this stuck state.

**Impact**: Revenue silently diverted to a wallet that may be compromised or lost. No on-chain guarantee from the contract.

**Recommendation**: Require treasury rotation before fees can be set. Cheapest:
```move
// In set_fee<T>:
assert!(reg.treasury_addr != reg.admin, ETreasuryNotInitialized);
```

This forces the bootstrap order: `set_admin(phantom) → set_treasury_addr(treasury_wallet) → set_fee<T>(...)`. The deploy script already does this in this order.

**Existing tests covering this**: NO. Helper `setup_paid_agent_seal` correctly rotates treasury, so the "treasury == admin" path is untested.

---

### [M-04] `set_fee<T>(0)` allowed — sybil seal attack can squat alias namespace at near-zero cost

**Severity**: Medium
**Location**: `prediction_vault.move:567-579` (set_fee), `:370-377` (agent_wallet_locks)

**Description**: `set_fee<T>` accepts `fee_amount = 0`. The function's docstring (L562) explicitly describes this as "effectively-free path for testing or promo events." Combined with first-claim-wins agent-alias wallet locks (L370-377), this enables a permanent squatting attack.

During any 0-fee window:
1. Generate 10,000 throwaway wallets.
2. For each, seal a junk prediction under a curated alias list (`gpt-5`, `claude-opus-5`, `vitalik`, `grok-3-pro`, `anthropic-internal`, etc.).
3. Each seal costs only gas (~$0.001).
4. Total cost: ~$10. Locks 10,000 high-value aliases permanently.
5. Attacker sells alias-controlling wallets back to legitimate agents, or runs reputation-griefing seals under each.

Even at the default non-zero fee (`AGENT_FEE_MIST = 0.1 SUI ≈ $0.20`), squatting 10K aliases costs $2K — still cheap for griefing a competitor.

**Impact**: Permanent alias-namespace squatting. The wallet-lock was supposed to prevent dilution, but it locks aliases to the FIRST wallet — which can be an attacker rather than the legitimate operator.

**Recommendation**: Add a minimum-fee floor for non-test environments:
```move
const MIN_FEE_FLOOR_MIST: u64 = 10_000_000; // 0.01 SUI ≈ $0.02
// In set_fee<T>:
assert!(fee_amount >= MIN_FEE_FLOOR_MIST, EFeeTooLow);
```

Admins who want promos can do them off-chain (refunds). Document the policy in the README. Optional v2: reservation prefix for admin-curated official aliases (e.g., `_official-claude` requires admin signature).

**Existing tests covering this**: NO.

---

### [L-04] `agent_alias_locked_to` accessor aborts on missing alias — asymmetric with other accessors

**Severity**: Low
**Location**: `prediction_vault.move:611-613`

**Description**: The read accessor `agent_alias_locked_to(reg, alias): address` calls `*reg.agent_wallet_locks.borrow(alias)` directly without a `contains` guard. If the alias has never been claimed, this aborts the entire devInspect / dryRun transaction.

Compare to `identity_count` (L598-601) and `fee_for` (L619-624), both of which check `contains` and return a sentinel (0 / empty). The asymmetry is a UI integration foot-gun.

**Impact**: A frontend code path that calls `agent_alias_locked_to` for an unlocked alias gets a non-recoverable error instead of an explicit "not found". For a hackathon demo where judges paste arbitrary aliases into a search box, this crashes the profile page.

**Evidence**:
```move
// L611-613 — aborts on missing key
public fun agent_alias_locked_to(reg: &Registry, alias: String): address {
    *reg.agent_wallet_locks.borrow(alias)
}
```

**Recommendation**:
```move
public fun agent_alias_locked_to(reg: &Registry, alias: String): address {
    if (!reg.agent_wallet_locks.contains(alias)) return @0x0;
    *reg.agent_wallet_locks.borrow(alias)
}
```

**Existing tests covering this**: PARTIAL — happy-path tested, no negative test for unlocked alias.

---

# Deferred findings (post-hackathon roadmap)

### [M-05] Seal IBE identity shared across same-unlock-time predictions

**Severity**: Medium (Walrus-track context: design tradeoff)
**Location**: `prediction_vault.move:583-592` (check_unlock + seal_approve)

**Description**: The IBE identity for the Seal time-lock is derived only from `unlock_at_ms`. Any caller who fetches the Seal key for unlock-time `T` can decrypt every prediction sealed for time `T`, and (due to the hash gate at L437) can call `reveal()` first, front-running the publisher.

**Why deferred**: This is the canonical Seal pattern (matches `MystenLabs/seal/move/patterns/sources/tle.move`). Per-prediction binding requires a two-phase seal flow (share object → encrypt key under `bcs(unlock_ms || object_id)` → second tx to attach sealed_key). Substantial redesign; the current design is intentional for the hackathon. **Document this limitation in the README + seal-notes.md.**

### [L-01] No two-phase admin rotation

A `propose_admin` + `accept_admin` flow would catch fat-finger rotations to syntactically-valid-but-unsignable addresses. Operational discipline (multisig) solves it for production. ~15 LOC.

### [L-02] `publish_reputation_profile` has no monotonicity check on `version`

A compromised resolver key can emit `version = u64::MAX` and lock out future legitimate versions under "highest wins" indexer semantics. Indexers can dedupe off-chain. ~10 LOC fix tracks last published version per identity on-chain.

### [L-03] No `migrate()` entry for future package upgrades

`check_version()` aborts on `reg.version != VERSION = 2`. A v3 upgrade has no path to bump the version without a `migrate()` entry. Phase 3+ concern; add when needed.

### [L-05] 10-year `MAX_LOCK_DURATION_MS` exceeds Walrus 53-epoch cap

The frontend `epochsForUnlock()` already enforces `unlock <= 46 days` for Walrus testnet, throwing an error before the Move call. Mainnet (14-day epochs × 53 = ~2 years) still under 10 years. Frontend cap is the right place; document the cliff in the README.

### [I-01] Loose bounds on `sealed_key` (4 KB) and `blob_id` (256 B)

Real Walrus blob IDs are 22-44 chars; real Seal `EncryptedObject` is ~356 bytes. Caps are 4-5× too generous. Within Sui object limits; tighten in v3.

### [I-02] `reasoning_blob_id` 256 B is a side-channel for the trusted resolver

The resolver can write arbitrary 256-byte payloads. Trusted by design.

---

# Test coverage assessment

- Existing: 45 tests covering all v2 entry functions (seal_prediction, seal_prediction_as_agent, reveal, resolve, publish_reputation_profile, all 4 admin rotations).
- **Gaps from this audit**:
  - No test for `set_admin(@0x0)` (M-01)
  - No test for fee overpayment behavior (M-02)
  - No test for `set_fee<T>` called before `set_treasury_addr` (M-03)
  - No test for `set_fee<T>(0)` enabling 0-fee seal (M-04)
  - No test for byte-variant identity (case, whitespace, '@') bypass (H-01)
  - No test for `agent_alias_locked_to` on unlocked alias (L-04)

After applying the must-fix bundle, **8 new negative tests** should be added covering each fix point.

# Recommendation

Apply the **must-fix bundle (H-01, M-01, M-02, M-03, M-04, L-04)** before testnet redeploy. Estimated ~80 LOC of Move + ~8 new tests. The fixes are mechanical, well-scoped, and don't introduce new attack surface.

Defer M-05 (Seal IBE binding) + L-01 / L-02 / L-03 / L-05 / I-01 / I-02 to a documented post-hackathon roadmap.

Run `sui move test` → all 45 existing + 8 new tests should pass. Then proceed with `pnpm deploy:v2`.
