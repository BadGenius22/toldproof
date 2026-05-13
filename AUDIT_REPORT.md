# Security Audit — TOLDPROOF prediction_vault.move

**Date**: 2026-05-13
**Auditor**: dewaxguard (single-pass adaptation)
**Target**: `move/prediction_vault/sources/prediction_vault.move` (218 lines)
**Tests reviewed**: `move/prediction_vault/tests/prediction_vault_tests.move` (293 lines, 11 tests)
**Scope**: Sui Move module + tests only. X OAuth, Walrus/Seal infrastructure, frontend out of scope.

## Executive summary

The contract is small, idiomatic, and faithful to the canonical Seal time-lock pattern from `MystenLabs/seal/move/patterns/sources/tle.move`. `seal_approve` is correctly declared `entry` (not `public entry`), the BCS `id` parsing rejects trailing-byte attacks via `leftover.length() == 0`, and the hash gate on `reveal()` makes the anyone-can-reveal design safe against preimage forgery. **No Critical or High findings.** The one bug worth fixing before testnet is a missing length validation on `content_hash` (Medium) which lets a publisher (or a buggy frontend) accidentally seal a permanently un-revealable prediction. A handful of Low / Informational items cover edge cases, defense-in-depth, and test coverage. Headline recommendation: add `assert!(content_hash.length() == 32, ...)` to `seal_prediction`, and add the matching negative test before the testnet final deploy.

## Severity summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 1 |
| Low | 4 |
| Informational | 4 |

## Findings

### [M-01] Missing length check on `content_hash` permanently bricks a sealable prediction

**Severity**: Medium
**Location**: `prediction_vault.move:101` (parameter), `prediction_vault.move:159-160` (consumer)
**Category**: Input validation / Permanent state corruption

**Description**: `seal_prediction` accepts `content_hash: vector<u8>` and stores it verbatim into the new `SealedPrediction` (line 117). No length or shape validation is performed. At reveal time, `reveal()` computes `hash::sha2_256(plaintext)` (line 159) and asserts equality against the stored `content_hash` (line 160). `sha2_256` always returns a 32-byte vector, so if the caller stores a `content_hash` whose length is not 32 (e.g., truncated, empty, 64 bytes from a double-hash mistake, or a hex-encoded string accidentally passed as ASCII bytes), the assertion `computed == prediction.content_hash` can never hold for any `plaintext`. The prediction is then permanently unrevealable, and because the module has no admin path and no `delete` for `SealedPrediction`, recovery is impossible.

**Impact**: A publisher who passes a malformed `content_hash` (or whose frontend has a bug) permanently bricks their own prediction — they lose the ability to publish the reveal tweet, the prediction stays "locked forever" on the public profile, and the Walrus blob (paid up to 60 epochs) is orphaned. Also affects total_count integrity (a permanently unrevealable record stays in the count). For a hackathon demo where the judges might paste arbitrary hashes through a UI, this is a foot-gun rather than an exploit, but it is silent (no error until reveal time, which is unlock + 1 minute later).

**Trigger**: Any caller of `seal_prediction` who passes `content_hash.length() != 32`. No privilege required. Most likely cause: frontend bug, manual PTB construction, or a future API integration.

**Recommendation**: Add the length check at the top of `seal_prediction`, and a matching negative test.

```move
// In seal_prediction, after the unlock_at_ms check:
assert!(content_hash.length() == 32, EInvalidContentHash);
```

Add a new error code `const EInvalidContentHash: u64 = 5;`. Optionally also validate `blob_id.length() > 0` and `sealed_key.length() > 0` to fail fast on degenerate inputs (these are Low, see L-02).

**Evidence**:
```move
// prediction_vault.move:101
content_hash: vector<u8>,
// ...
// prediction_vault.move:117-118 (stored unchecked)
content_hash,
// prediction_vault.move:159-160 (consumed)
let computed = hash::sha2_256(plaintext);
assert!(computed == prediction.content_hash, EHashMismatch);
```
`sha2_256` is defined to return a 32-byte digest, so any stored hash with `length != 32` makes the equality check unsatisfiable.

---

### [L-01] Publisher-chosen empty plaintext (`content_hash = sha2_256(b"")`) makes the reveal pre-image trivially guessable

**Severity**: Low
**Location**: `prediction_vault.move:149-171`
**Category**: Edge case / Hash gate semantics

**Description**: The `reveal()` hash gate (line 160) treats `content_hash` as the only commitment to plaintext. If a publisher seals with `content_hash = sha2_256(b"")` (the well-known constant `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`), anyone can call `reveal(reg, &mut pred, b"", &clock)` after unlock and the contract will accept an empty `revealed_plaintext`. The same is true for any predictable / low-entropy plaintext (e.g., `b"yes"`, `b"no"`) — the hash gate protects against preimage forgery only when the plaintext has enough entropy.

**Impact**: A publisher who is careless with low-entropy plaintexts allows third parties to "race" the reveal cron and post the (trivial) reveal on-chain. The user-facing impact is small (the revealed string is still what the publisher committed), but the `PredictionRevealed` event then shows a third party as the reveal-submitter (via `tx.sender` of the reveal), which could confuse off-chain analytics. The intended design is that the reveal cron always wins the race because it triggers within minutes of unlock; this finding flags the edge case where a publisher with a guessable plaintext loses that guarantee.

**Trigger**: Any user who calls `reveal()` after unlock for a prediction whose plaintext is a known/guessable string and the cron has not yet fired.

**Recommendation**: This is largely user-education, but if you want defense-in-depth, salt the commitment: store `content_hash = sha2_256(plaintext || salt)` where `salt` is a 16-byte random nonce kept in the Walrus blob (or in the AES-encrypted payload). That way reveal requires both decrypting the Walrus blob (to learn the salt) AND knowing the plaintext, and the trivial-plaintext attack disappears. Document the recommendation in `seal-notes.md`.

**Evidence**: `sha2_256(b"")` is a known constant. `reveal()` only checks hash equality, with no minimum entropy or length requirement on plaintext.

---

### [L-02] `blob_id` and `sealed_key` length not validated; degenerate values silently accepted

**Severity**: Low
**Location**: `prediction_vault.move:102-103`, `prediction_vault.move:118-119`
**Category**: Input validation

**Description**: `seal_prediction` stores `blob_id` and `sealed_key` verbatim without any length check (lines 118-119). An empty `blob_id` produces a SealedPrediction that can never be decrypted off-chain (no Walrus blob to fetch), but on-chain state remains "valid." An empty `sealed_key` similarly breaks the off-chain decrypt flow. There is no permanent fund/data loss path — the publisher only griefs themselves — but the failure is silent until reveal time.

**Impact**: Publisher self-grief. Frontend bug surface: a UI that constructs a PTB with missing fields will produce on-chain entries that look valid but are unrevealable. The reveal cron will fail at the Walrus fetch step, and there is no on-chain abort that surfaces the error.

**Trigger**: Any caller who passes empty / malformed `blob_id` or `sealed_key`. No privilege required.

**Recommendation**: Add minimal sanity checks:
```move
assert!(blob_id.length() > 0, EInvalidBlobId);
assert!(sealed_key.length() > 0, EInvalidSealedKey);
```
Optionally cap upper bounds (e.g., `sealed_key.length() < 1024`) to prevent storage-bloat griefing on the publisher's own gas.

**Evidence**:
```move
// prediction_vault.move:102-103
blob_id: vector<u8>,
sealed_key: vector<u8>,
```
Both stored unchecked into the SealedPrediction (lines 118-119).

---

### [L-03] Empty `x_handle` is silently stored as a Table key

**Severity**: Low
**Location**: `prediction_vault.move:114`, `prediction_vault.move:126-130`
**Category**: Input validation / Index hygiene

**Description**: `seal_prediction` accepts any `x_handle: String`, including `""`. The empty string is added to `Registry.by_handle` as a valid Table key on line 127, and subsequent empty-handle seals append to the same vector. The public profile page at `/[handle]` for `handle = ""` is undefined and may shadow a real route in Next.js. This is not exploitable for fund/data loss, but it pollutes the public index with a "garbage bucket" entry that any random caller can add to.

**Impact**: Index hygiene only. A `""` bucket in `by_handle` becomes a public dumping ground. Frontend must defend against rendering `/handle/` (no segment) or treating it as an alias for "everyone."

**Trigger**: Any caller who passes `x_handle = b"".to_string()`. The README's documented behavior is "lowercased, no leading '@'" (line 50 comment) but no validation enforces that.

**Recommendation**: Add a minimum-length check and a basic shape constraint:
```move
assert!(x_handle.length() > 0 && x_handle.length() <= 15, EInvalidXHandle);
```
(X handles are 1–15 chars per their API rules.) The "lowercased, no '@'" normalization is the frontend's job; the contract just needs a sanity floor/ceiling.

**Evidence**: Line 114 stores `x_handle` directly into the `SealedPrediction`. Line 126-127 inserts it as a Table key. No precondition is checked.

---

### [L-04] `unlock_at_ms` upper bound not enforced; `u64::MAX` permanently locks the prediction (publisher self-grief)

**Severity**: Low
**Location**: `prediction_vault.move:109`
**Category**: Edge case / Input validation

**Description**: `seal_prediction` enforces `unlock_at_ms > now` (line 109) but no upper bound. A publisher who passes `unlock_at_ms = u64::MAX` (or any value beyond a reasonable horizon, e.g., year 9999) seals a prediction whose `seal_approve` time-lock will not release until that timestamp. The prediction is effectively permanently locked. Recovery is impossible (no admin path).

**Impact**: Publisher-only self-grief. A buggy frontend that multiplies units wrong (e.g., seconds → milliseconds → microseconds) can produce a "year 2262 timestamp" without raising an error. The Walrus blob is paid up to 60 epochs (~2 months) and orphaned thereafter.

**Trigger**: Any caller who passes `unlock_at_ms` far in the future. No privilege required.

**Recommendation**: Cap `unlock_at_ms` to a sane window from `now`, e.g., 10 years:
```move
const MAX_LOCK_DURATION_MS: u64 = 10 * 365 * 24 * 60 * 60 * 1000; // ~10y
assert!(unlock_at_ms <= now + MAX_LOCK_DURATION_MS, EUnlockTooFar);
```
This is purely a UX safety rail; the time-lock crypto is unaffected.

**Evidence**: Line 109 `assert!(unlock_at_ms > now, EUnlockInPast);` — only lower-bound check.

---

### [I-01] `total_count` is never decremented; permanently unrevealable predictions stay counted forever

**Severity**: Informational
**Location**: `prediction_vault.move:132`
**Category**: Invariant / Indexing semantics

**Description**: `Registry.total_count` is incremented on every `seal_prediction` (line 132) and never decremented. There is no `delete_prediction` path (intentional per the project's "Walrus is permanent" stance). This is consistent with the design and is not a bug — but combined with M-01 / L-02 / L-04, bricked predictions inflate `total_count` and `by_handle[h].length()` without contributing to any usable reveal. Off-chain analytics that interpret `total_count` as "active predictions" should be aware.

**Impact**: None on-chain. Off-chain dashboards may overstate "active predictions."

**Recommendation**: Document the semantics in the README (`total_count = lifetime seals, including unrevealable`). No code change.

**Evidence**: Line 132 `reg.total_count = reg.total_count + 1;` is the only writer. No decrementer exists.

---

### [I-02] `revealed_at_ms >= unlock_at_ms` invariant is unstated and untested

**Severity**: Informational
**Location**: `prediction_vault.move:157, 163`
**Category**: Invariant documentation / Test gap

**Description**: `reveal()` requires `clock.timestamp_ms() >= unlock_at_ms` (line 157) before setting `revealed_at_ms = clock.timestamp_ms()` (line 163). So the invariant `revealed_at_ms >= unlock_at_ms` always holds once `revealed == true`. This is correct, but no test asserts it explicitly, and it's not documented in any field-level comment. Future refactors might invert the assertion or re-order the writes; an explicit invariant check would protect against that.

**Impact**: None today. Documentation / regression-protection only.

**Recommendation**: Add a one-line assertion in the existing `reveal_after_unlock_with_correct_plaintext_works` test:
```move
assert!(prediction_vault::is_revealed(&pred), 200);
let rt = /* expose revealed_at_ms via a new accessor */;
assert!(rt >= UNLOCK_AT_MS, 202);
```
Optionally add an accessor `pub fun revealed_at_ms(p: &SealedPrediction): u64`.

**Evidence**: Lines 157 and 163 establish the invariant; no test exercises it.

---

### [I-03] BCS trailing-byte attack on `seal_approve` id is correctly defended, but the negative case is untested

**Severity**: Informational
**Location**: `prediction_vault.move:177-182`
**Category**: Test gap

**Description**: `check_unlock` correctly handles the "id with extra trailing bytes" attack by checking `leftover.length() == 0` (line 181). A truncated id (<8 bytes) aborts inside `peel_u64`. An oversized id (>8 bytes) is rejected by the `leftover` check. This is sound. However, none of the four `seal_approve_*` tests pass a malformed id — they all use `bcs::to_bytes(&UNLOCK_AT_MS)` (exactly 8 bytes). The defense is correct but uncovered, so a future refactor that drops the `leftover.length() == 0` clause would not be caught by the test suite.

**Impact**: None today. Regression protection only.

**Recommendation**: Add two negative-case tests:
```move
#[test, expected_failure(abort_code = prediction_vault::ENoAccess)]
fun seal_approve_with_trailing_garbage_aborts() {
    let ctx = &mut tx_context::dummy();
    let mut c = clock::create_for_testing(ctx);
    c.set_for_testing(POST_UNLOCK_MS);
    let mut id = bcs::to_bytes(&UNLOCK_AT_MS);
    id.push_back(0); // 9 bytes
    prediction_vault::seal_approve_for_testing(id, &c);
    c.destroy_for_testing();
}

#[test, expected_failure] // peel_u64 aborts internally
fun seal_approve_with_truncated_id_aborts() {
    let ctx = &mut tx_context::dummy();
    let c = clock::create_for_testing(ctx);
    prediction_vault::seal_approve_for_testing(b"shorty", &c);
    abort 0 // unreachable
}
```

**Evidence**: Line 181 has the defense; tests at lines 30-76 exercise only well-formed ids.

---

### [I-04] `revealed_plaintext` size is bounded only by the Sui object limit (≈250 KB); no in-contract cap

**Severity**: Informational
**Location**: `prediction_vault.move:164`
**Category**: Edge case

**Description**: `reveal()` writes `prediction.revealed_plaintext = plaintext` (line 164) with no size cap. A pathological publisher who seals a multi-hundred-kilobyte plaintext (and computes its hash correctly) would trigger a Sui object-size-limit abort during the `reveal` transaction. The on-chain state is safe — no partial write — but the reveal cron would fail repeatedly until manual intervention. This is publisher self-grief only.

**Impact**: Publisher-only. Cron operator burns gas on retries.

**Recommendation**: Add a soft cap (e.g., 64 KB, generous for a tweet-length prediction):
```move
assert!(plaintext.length() <= 65536, EPlaintextTooLarge);
```
This makes the failure mode "abort with a known error code at reveal" instead of "fail the whole tx because of object-size limits."

**Evidence**: Line 164 writes plaintext unchecked.

---

## Coverage statement

- [x] Time-lock policy `seal_approve` / `check_unlock` — line-by-line, including BCS parsing edge cases, `entry` vs `public entry` modifier, exact-boundary clock semantics.
- [x] Hash gate `reveal()` — every branch, low-entropy preimage attack, length-mismatch unsatisfiability, double-reveal guard.
- [x] State invariants on `Registry` and `SealedPrediction` — `total_count`, `by_handle` synchronization, ordering of writes vs event emission.
- [x] Sui Move 2024 anti-patterns cross-referenced against `~/.claude/skills/sui-dev/references/{01,02,10,11}-*.md` — OTW, `init`, `key` struct UID-first, `transfer::share_object` vs `transfer::transfer`, event abilities, no `public(friend)`.
- [x] Test file `prediction_vault_tests.move` — read end-to-end, `expected_failure` codes verified against actual error constants, gaps catalogued.
- [x] Versioning / `check_version` — confirmed it aborts on mismatch; upgrade implications noted (out of scope for findings).
- [x] All public function entry points reviewed for access control, parameter validation, and post-conditions.

## Positive observations

- **`seal_approve` modifier is correct (`entry`, not `public entry`)** — matches the canonical pattern from `seal/move/patterns/sources/tle.move` and the `sui-dev` skill anti-pattern catalogue. Other packages cannot compose this and bypass dry-run isolation.
- **BCS trailing-byte defense is correct** — `leftover.length() == 0` (line 181) closes the "extra-bytes" attack that a less careful implementation would miss.
- **Hash gate is the right primitive for an anyone-can-reveal design** — SHA-256 preimage resistance is the entire safety story, and the contract leans on it cleanly. The `revealed_plaintext` write happens AFTER the hash check, so a failed reveal leaves state untouched.
- **Idiomatic Sui Move 2024** — OTW with `drop`-only, `init` consumes it, all shared objects properly use `transfer::share_object`, `id: UID` first in every `key` struct, events have `copy, drop`, no deprecated `public(friend)`, no `object::delete` shenanigans, `check_version` gate on all mutators.
- **Tests cover the critical positive + negative pairs the project's `CLAUDE.md` mandates**: `seal_approve` before/after unlock, exact-unlock boundary, double-reveal, wrong-plaintext, unlock-in-past. The expected-failure codes reference the actual error constants, not generic aborts.

## Recommended next steps

1. **Before testnet final deploy (Day 10)** — Fix **M-01** (`content_hash` length check) and add its negative test. This is the only finding that can silently brick a real user's prediction.
2. **Same PR** — Add the `blob_id`/`sealed_key`/`x_handle` length checks (**L-02**, **L-03**) and the `unlock_at_ms` upper bound (**L-04**). All five new asserts together are ~10 lines and one error code; cheap defense-in-depth.
3. **Same PR** — Add the two BCS-malformed-id tests (**I-03**) and the `revealed_at_ms` invariant assertion (**I-02**). Pure regression protection; ~30 lines of test code.
4. **Document in `seal-notes.md` / README** — The low-entropy-plaintext caveat (**L-01**) and the `total_count = lifetime seals` semantics (**I-01**). If you have appetite for a small design change, the salted-commitment recommendation from L-01 is worth considering — it eliminates the trivial-reveal race without changing the contract's public interface.
5. **Post-hackathon, before mainnet** — Revisit the `Registry` upgrade story (versioned shared objects, ref `06`). The current `check_version == 1` gate aborts cleanly on mismatch, which is correct, but you'll want a documented migration path before users have non-trivial value sealed.
