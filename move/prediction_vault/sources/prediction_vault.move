// Copyright (c) 2026 TOLDPROOF
// SPDX-License-Identifier: Apache-2.0

/// TOLDPROOF prediction vault.
///
/// Day 1 stub. Day 1 will flesh out:
/// - PredictionRegistry (shared object) + Prediction store
/// - seal_prediction entry (records blob_id + commitment + unlock_at_ms)
/// - reveal_prediction entry (owner posts reveal-text hash after unlock)
/// - seal_approve entry (Seal time-lock policy: assert clock >= unlock_at_ms)
///   key format: [pkg_id][bcs::to_bytes(unlock_ms)]
///
/// See docs/seal-notes.md for the canonical pattern reference.
module toldproof::prediction_vault;
