// Copyright (c) 2026 TOLDPROOF
// SPDX-License-Identifier: Apache-2.0

/// TOLDPROOF prediction vault — cryptographic receipts for crypto Twitter.
///
/// Users seal a prediction (Walrus ciphertext + Seal-encrypted AES key) onto the
/// shared `Registry`. After `unlock_at_ms`, the Seal time-lock policy releases
/// the AES key; the reveal cron decrypts and posts the plaintext back via
/// `reveal()`. Plaintext is committed on-chain with a SHA-256 check against the
/// seal-time content hash, so the reveal is verifiable end-to-end.
module toldproof::prediction_vault;

use std::string::String;
use sui::bcs;
use sui::clock::Clock;
use sui::event;
use std::hash;
use sui::table::{Self, Table};

// ---------- Error codes ----------

const ENoAccess: u64 = 0;
const EAlreadyRevealed: u64 = 1;
const EHashMismatch: u64 = 2;
const EInvalidPackageVersion: u64 = 3;
const EUnlockInPast: u64 = 4;

// ---------- Versioning ----------

const VERSION: u64 = 1;

// ---------- One-Time Witness ----------

public struct PREDICTION_VAULT has drop {}

// ---------- Shared state ----------

/// Shared singleton: the directory of every sealed prediction.
public struct Registry has key {
    id: UID,
    version: u64,
    by_handle: Table<String, vector<ID>>,
    total_count: u64,
}

/// Shared per-prediction object.
public struct SealedPrediction has key {
    id: UID,
    publisher: address,
    x_handle: String,             // lowercased, no leading '@'
    sealed_at_ms: u64,
    unlock_at_ms: u64,
    content_hash: vector<u8>,     // sha256(plaintext)
    blob_id: vector<u8>,          // Walrus blob ID (ascii bytes)
    sealed_key: vector<u8>,       // Seal-encrypted AES key (EncryptedObject bytes)
    revealed: bool,
    revealed_at_ms: u64,
    revealed_plaintext: vector<u8>,
}

// ---------- Events ----------

public struct PredictionSealed has copy, drop {
    prediction_id: ID,
    publisher: address,
    x_handle: String,
    sealed_at_ms: u64,
    unlock_at_ms: u64,
    content_hash: vector<u8>,
    blob_id: vector<u8>,
}

public struct PredictionRevealed has copy, drop {
    prediction_id: ID,
    revealed_at_ms: u64,
    content_hash: vector<u8>,
}

// ---------- Init ----------

fun init(_otw: PREDICTION_VAULT, ctx: &mut TxContext) {
    let registry = Registry {
        id: object::new(ctx),
        version: VERSION,
        by_handle: table::new(ctx),
        total_count: 0,
    };
    transfer::share_object(registry);
}

fun check_version(reg: &Registry) {
    assert!(reg.version == VERSION, EInvalidPackageVersion);
}

// ---------- Seal a prediction ----------

public fun seal_prediction(
    reg: &mut Registry,
    x_handle: String,
    unlock_at_ms: u64,
    content_hash: vector<u8>,
    blob_id: vector<u8>,
    sealed_key: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    check_version(reg);
    let now = clock.timestamp_ms();
    assert!(unlock_at_ms > now, EUnlockInPast);

    let prediction = SealedPrediction {
        id: object::new(ctx),
        publisher: ctx.sender(),
        x_handle,
        sealed_at_ms: now,
        unlock_at_ms,
        content_hash,
        blob_id,
        sealed_key,
        revealed: false,
        revealed_at_ms: 0,
        revealed_plaintext: vector[],
    };
    let pid = object::id(&prediction);

    if (!reg.by_handle.contains(prediction.x_handle)) {
        reg.by_handle.add(prediction.x_handle, vector[]);
    };
    let list = reg.by_handle.borrow_mut(prediction.x_handle);
    list.push_back(pid);

    reg.total_count = reg.total_count + 1;

    event::emit(PredictionSealed {
        prediction_id: pid,
        publisher: prediction.publisher,
        x_handle: prediction.x_handle,
        sealed_at_ms: prediction.sealed_at_ms,
        unlock_at_ms: prediction.unlock_at_ms,
        content_hash: prediction.content_hash,
        blob_id: prediction.blob_id,
    });

    transfer::share_object(prediction);
}

// ---------- Reveal after unlock ----------

public fun reveal(
    reg: &Registry,
    prediction: &mut SealedPrediction,
    plaintext: vector<u8>,
    clock: &Clock,
) {
    check_version(reg);
    assert!(!prediction.revealed, EAlreadyRevealed);
    assert!(clock.timestamp_ms() >= prediction.unlock_at_ms, ENoAccess);

    let computed = hash::sha2_256(plaintext);
    assert!(computed == prediction.content_hash, EHashMismatch);

    prediction.revealed = true;
    prediction.revealed_at_ms = clock.timestamp_ms();
    prediction.revealed_plaintext = plaintext;

    event::emit(PredictionRevealed {
        prediction_id: object::id(prediction),
        revealed_at_ms: prediction.revealed_at_ms,
        content_hash: prediction.content_hash,
    });
}

// ---------- Seal access policy (time-lock) ----------

/// Pure check, no abort. Used by `seal_approve` and tests.
/// id = bcs::to_bytes(&unlock_at_ms).
fun check_unlock(id: vector<u8>, c: &Clock): bool {
    let mut prepared = bcs::new(id);
    let unlock_time = prepared.peel_u64();
    let leftover = prepared.into_remainder_bytes();
    leftover.length() == 0 && c.timestamp_ms() >= unlock_time
}

/// Seal time-lock policy. Called by the Seal key server during decryption
/// dry-run. MUST be `entry` (not `public entry`) so other packages cannot
/// compose it. See docs/seal-notes.md.
entry fun seal_approve(id: vector<u8>, c: &Clock) {
    assert!(check_unlock(id, c), ENoAccess);
}

// ---------- Read accessors ----------

public fun total_count(reg: &Registry): u64 {
    reg.total_count
}

public fun handle_count(reg: &Registry, x_handle: String): u64 {
    if (!reg.by_handle.contains(x_handle)) return 0;
    reg.by_handle.borrow(x_handle).length()
}

public fun unlock_at_ms(p: &SealedPrediction): u64 { p.unlock_at_ms }
public fun is_revealed(p: &SealedPrediction): bool { p.revealed }
public fun publisher(p: &SealedPrediction): address { p.publisher }
public fun content_hash(p: &SealedPrediction): vector<u8> { p.content_hash }
public fun revealed_plaintext(p: &SealedPrediction): vector<u8> { p.revealed_plaintext }

// ---------- Test helpers ----------

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(PREDICTION_VAULT {}, ctx)
}

#[test_only]
public fun seal_approve_for_testing(id: vector<u8>, c: &Clock) {
    assert!(check_unlock(id, c), ENoAccess)
}
