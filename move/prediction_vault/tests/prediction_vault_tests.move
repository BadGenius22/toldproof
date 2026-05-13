// Copyright (c) 2026 TOLDPROOF
// SPDX-License-Identifier: Apache-2.0

#[test_only, allow(implicit_const_copy)]
module toldproof::prediction_vault_tests;

use std::hash;
use std::string;
use sui::bcs;
use sui::clock;
use sui::test_scenario as ts;
use toldproof::prediction_vault::{Self, Registry, SealedPrediction};

const ADMIN: address = @0xAA;
const ALICE: address = @0xBB;

const SEAL_AT_MS: u64 = 1_000_000;
const PRE_UNLOCK_MS: u64 = 1_500_000;
const UNLOCK_AT_MS: u64 = 2_000_000;
const POST_UNLOCK_MS: u64 = 2_000_001;

const PLAINTEXT: vector<u8> = b"BTC > 85k by 2026-06-30";
const BLOB_ID: vector<u8> = b"walrus_blob_id_dummy_for_testing";
const SEALED_KEY: vector<u8> = b"seal_encrypted_aes_key_dummy_32b";

fun handle(): string::String { b"alice".to_string() }

// ---------- seal_approve (time-lock policy) ----------

#[test]
fun seal_approve_after_unlock_passes() {
    let ctx = &mut tx_context::dummy();
    let mut c = clock::create_for_testing(ctx);
    c.set_for_testing(POST_UNLOCK_MS);

    let id = bcs::to_bytes(&UNLOCK_AT_MS);
    prediction_vault::seal_approve_for_testing(id, &c);

    c.destroy_for_testing();
}

#[test, expected_failure(abort_code = prediction_vault::ENoAccess)]
fun seal_approve_before_unlock_aborts() {
    let ctx = &mut tx_context::dummy();
    let mut c = clock::create_for_testing(ctx);
    c.set_for_testing(PRE_UNLOCK_MS);

    let id = bcs::to_bytes(&UNLOCK_AT_MS);
    prediction_vault::seal_approve_for_testing(id, &c);

    c.destroy_for_testing();
}

#[test, expected_failure(abort_code = prediction_vault::ENoAccess)]
fun seal_approve_at_exact_unlock_minus_one_aborts() {
    let ctx = &mut tx_context::dummy();
    let mut c = clock::create_for_testing(ctx);
    c.set_for_testing(UNLOCK_AT_MS - 1);

    let id = bcs::to_bytes(&UNLOCK_AT_MS);
    prediction_vault::seal_approve_for_testing(id, &c);

    c.destroy_for_testing();
}

#[test]
fun seal_approve_at_exact_unlock_passes() {
    let ctx = &mut tx_context::dummy();
    let mut c = clock::create_for_testing(ctx);
    c.set_for_testing(UNLOCK_AT_MS);

    let id = bcs::to_bytes(&UNLOCK_AT_MS);
    prediction_vault::seal_approve_for_testing(id, &c);

    c.destroy_for_testing();
}

// ---------- seal_prediction ----------

#[test]
fun seal_prediction_creates_shared_object_and_indexes() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ALICE);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);

    let content_hash = hash::sha2_256(PLAINTEXT);
    prediction_vault::seal_prediction(
        &mut reg,
        handle(),
        UNLOCK_AT_MS,
        content_hash,
        BLOB_ID,
        SEALED_KEY,
        &c,
        scenario.ctx(),
    );

    assert!(prediction_vault::total_count(&reg) == 1, 100);
    assert!(prediction_vault::handle_count(&reg, handle()) == 1, 101);

    ts::return_shared(reg);
    c.destroy_for_testing();

    scenario.next_tx(ALICE);
    let pred = scenario.take_shared<SealedPrediction>();
    assert!(prediction_vault::publisher(&pred) == ALICE, 102);
    assert!(prediction_vault::unlock_at_ms(&pred) == UNLOCK_AT_MS, 103);
    assert!(prediction_vault::is_revealed(&pred) == false, 104);
    ts::return_shared(pred);

    scenario.end();
}

#[test]
fun multiple_predictions_per_handle_appends_to_vector() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ALICE);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);

    let content_hash = hash::sha2_256(PLAINTEXT);

    // Seal 3 predictions for the same x_handle
    prediction_vault::seal_prediction(
        &mut reg, handle(), UNLOCK_AT_MS, content_hash, BLOB_ID, SEALED_KEY, &c, scenario.ctx(),
    );
    prediction_vault::seal_prediction(
        &mut reg, handle(), UNLOCK_AT_MS + 1, content_hash, BLOB_ID, SEALED_KEY, &c, scenario.ctx(),
    );
    prediction_vault::seal_prediction(
        &mut reg, handle(), UNLOCK_AT_MS + 2, content_hash, BLOB_ID, SEALED_KEY, &c, scenario.ctx(),
    );

    // by_handle[handle()] should have 3 entries; total_count should be 3
    assert!(prediction_vault::total_count(&reg) == 3, 300);
    assert!(prediction_vault::handle_count(&reg, handle()) == 3, 301);

    // Different handle starts at 0
    assert!(prediction_vault::handle_count(&reg, b"someone_else".to_string()) == 0, 302);

    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

#[test, expected_failure(abort_code = prediction_vault::EUnlockInPast)]
fun seal_prediction_with_unlock_in_past_aborts() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ALICE);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(POST_UNLOCK_MS);

    let content_hash = hash::sha2_256(PLAINTEXT);
    prediction_vault::seal_prediction(
        &mut reg, handle(), UNLOCK_AT_MS, content_hash, BLOB_ID, SEALED_KEY, &c, scenario.ctx(),
    );

    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

// ---------- reveal ----------

#[test]
fun reveal_after_unlock_with_correct_plaintext_works() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ALICE);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);

    let content_hash = hash::sha2_256(PLAINTEXT);
    prediction_vault::seal_prediction(
        &mut reg, handle(), UNLOCK_AT_MS, content_hash, BLOB_ID, SEALED_KEY, &c, scenario.ctx(),
    );
    ts::return_shared(reg);

    scenario.next_tx(ALICE);
    let reg = scenario.take_shared<Registry>();
    let mut pred = scenario.take_shared<SealedPrediction>();
    c.set_for_testing(POST_UNLOCK_MS);

    prediction_vault::reveal(&reg, &mut pred, PLAINTEXT, &c);

    assert!(prediction_vault::is_revealed(&pred), 200);
    assert!(prediction_vault::revealed_plaintext(&pred) == PLAINTEXT, 201);
    // Audit I-02: invariant revealed_at_ms >= unlock_at_ms holds after reveal.
    assert!(prediction_vault::revealed_at_ms(&pred) >= prediction_vault::unlock_at_ms(&pred), 202);
    assert!(prediction_vault::sealed_at_ms(&pred) < prediction_vault::unlock_at_ms(&pred), 203);

    ts::return_shared(pred);
    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

#[test, expected_failure(abort_code = prediction_vault::ENoAccess)]
fun reveal_before_unlock_aborts() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ALICE);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);

    let content_hash = hash::sha2_256(PLAINTEXT);
    prediction_vault::seal_prediction(
        &mut reg, handle(), UNLOCK_AT_MS, content_hash, BLOB_ID, SEALED_KEY, &c, scenario.ctx(),
    );
    ts::return_shared(reg);

    scenario.next_tx(ALICE);
    let reg = scenario.take_shared<Registry>();
    let mut pred = scenario.take_shared<SealedPrediction>();
    c.set_for_testing(PRE_UNLOCK_MS);

    prediction_vault::reveal(&reg, &mut pred, PLAINTEXT, &c);

    ts::return_shared(pred);
    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

#[test, expected_failure(abort_code = prediction_vault::EHashMismatch)]
fun reveal_with_wrong_plaintext_aborts() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ALICE);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);

    let content_hash = hash::sha2_256(PLAINTEXT);
    prediction_vault::seal_prediction(
        &mut reg, handle(), UNLOCK_AT_MS, content_hash, BLOB_ID, SEALED_KEY, &c, scenario.ctx(),
    );
    ts::return_shared(reg);

    scenario.next_tx(ALICE);
    let reg = scenario.take_shared<Registry>();
    let mut pred = scenario.take_shared<SealedPrediction>();
    c.set_for_testing(POST_UNLOCK_MS);

    prediction_vault::reveal(&reg, &mut pred, b"wrong plaintext", &c);

    ts::return_shared(pred);
    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

#[test, expected_failure(abort_code = prediction_vault::EAlreadyRevealed)]
fun reveal_twice_aborts() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ALICE);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);

    let content_hash = hash::sha2_256(PLAINTEXT);
    prediction_vault::seal_prediction(
        &mut reg, handle(), UNLOCK_AT_MS, content_hash, BLOB_ID, SEALED_KEY, &c, scenario.ctx(),
    );
    ts::return_shared(reg);

    scenario.next_tx(ALICE);
    let reg = scenario.take_shared<Registry>();
    let mut pred = scenario.take_shared<SealedPrediction>();
    c.set_for_testing(POST_UNLOCK_MS);

    prediction_vault::reveal(&reg, &mut pred, PLAINTEXT, &c);
    prediction_vault::reveal(&reg, &mut pred, PLAINTEXT, &c);  // expect abort

    ts::return_shared(pred);
    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

// ---------- Input validation negative tests (AUDIT_REPORT M-01 / L-02 / L-03 / L-04) ----------

#[test, expected_failure(abort_code = prediction_vault::EInvalidContentHash)]
fun seal_prediction_with_wrong_length_content_hash_aborts() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ALICE);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);

    // 16-byte vector — not a SHA-256 output
    let bad_hash: vector<u8> = vector[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16];
    prediction_vault::seal_prediction(
        &mut reg, handle(), UNLOCK_AT_MS, bad_hash, BLOB_ID, SEALED_KEY, &c, scenario.ctx(),
    );

    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

#[test, expected_failure(abort_code = prediction_vault::EInvalidBlobId)]
fun seal_prediction_with_empty_blob_id_aborts() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ALICE);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);

    let content_hash = hash::sha2_256(PLAINTEXT);
    prediction_vault::seal_prediction(
        &mut reg, handle(), UNLOCK_AT_MS, content_hash, vector[], SEALED_KEY, &c, scenario.ctx(),
    );

    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

#[test, expected_failure(abort_code = prediction_vault::EInvalidSealedKey)]
fun seal_prediction_with_empty_sealed_key_aborts() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ALICE);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);

    let content_hash = hash::sha2_256(PLAINTEXT);
    prediction_vault::seal_prediction(
        &mut reg, handle(), UNLOCK_AT_MS, content_hash, BLOB_ID, vector[], &c, scenario.ctx(),
    );

    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

#[test, expected_failure(abort_code = prediction_vault::EInvalidXHandle)]
fun seal_prediction_with_empty_handle_aborts() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ALICE);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);

    let content_hash = hash::sha2_256(PLAINTEXT);
    prediction_vault::seal_prediction(
        &mut reg, b"".to_string(), UNLOCK_AT_MS, content_hash, BLOB_ID, SEALED_KEY, &c, scenario.ctx(),
    );

    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

#[test, expected_failure(abort_code = prediction_vault::EInvalidXHandle)]
fun seal_prediction_with_oversized_handle_aborts() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ALICE);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);

    let content_hash = hash::sha2_256(PLAINTEXT);
    // 16 chars — exceeds X's 15-char max
    prediction_vault::seal_prediction(
        &mut reg, b"abcdefghijklmnop".to_string(), UNLOCK_AT_MS,
        content_hash, BLOB_ID, SEALED_KEY, &c, scenario.ctx(),
    );

    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

#[test, expected_failure(abort_code = prediction_vault::EUnlockTooFar)]
fun seal_prediction_with_far_future_unlock_aborts() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ALICE);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);

    let content_hash = hash::sha2_256(PLAINTEXT);
    // u64::MAX — far beyond the 10-year cap
    prediction_vault::seal_prediction(
        &mut reg, handle(), 18_446_744_073_709_551_615u64,
        content_hash, BLOB_ID, SEALED_KEY, &c, scenario.ctx(),
    );

    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

// ---------- BCS malformed id negative tests (AUDIT_REPORT I-03) ----------

#[test, expected_failure(abort_code = prediction_vault::ENoAccess)]
fun seal_approve_with_trailing_garbage_aborts() {
    let ctx = &mut tx_context::dummy();
    let mut c = clock::create_for_testing(ctx);
    c.set_for_testing(POST_UNLOCK_MS);

    // BCS u64 LE bytes for UNLOCK_AT_MS, then a stray trailing byte
    let mut id = bcs::to_bytes(&UNLOCK_AT_MS);
    id.push_back(0);  // now 9 bytes — fails leftover.length() == 0
    prediction_vault::seal_approve_for_testing(id, &c);

    c.destroy_for_testing();
}

#[test, expected_failure]
fun seal_approve_with_truncated_id_aborts() {
    // Any abort is acceptable here — peel_u64 aborts on under-length input.
    let ctx = &mut tx_context::dummy();
    let c = clock::create_for_testing(ctx);
    prediction_vault::seal_approve_for_testing(b"shorty", &c);
    c.destroy_for_testing();
}
