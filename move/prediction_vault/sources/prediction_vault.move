// Copyright (c) 2026 TOLDPROOF
// SPDX-License-Identifier: Apache-2.0

/// TOLDPROOF prediction vault.
///
/// Day 1 will flesh this module out per the recipe in docs/seal-notes.md and
/// ~/.claude/skills/sui-dev/references/11-toldproof-stack.md:
///   - PREDICTION_VAULT (OTW) + init claiming a shared, versioned `Registry`
///   - `Registry { id, version, by_handle: Table<String, vector<ID>>, total_count }`
///   - `SealedPrediction { id, publisher, x_handle, unlock_at_ms, content_hash,
///       blob_id, sealed_key, revealed, revealed_at_ms, revealed_plaintext }`
///   - `seal_prediction(...)` records ciphertext metadata + indexes by handle
///   - `reveal(...)` checks `clock.timestamp_ms() >= unlock_at_ms`, verifies
///       SHA-256(plaintext) == content_hash, writes plaintext on-chain
///   - `seal_approve(id: vector<u8>, c: &Clock)` — Seal time-lock policy.
///       id = bcs::to_bytes(unlock_ms); MUST be `entry` (not `public entry`).
///
/// Day 1 acceptance: positive `seal_approve` test (after unlock) + negative
/// test (before unlock), per CLAUDE.md non-negotiables.
module toldproof::prediction_vault;
