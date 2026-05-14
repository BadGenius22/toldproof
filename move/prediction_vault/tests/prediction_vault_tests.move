// Copyright (c) 2026 TOLDPROOF
// SPDX-License-Identifier: Apache-2.0

#[test_only, allow(implicit_const_copy)]
module toldproof::prediction_vault_tests;

use std::hash;
use std::string;
use sui::bcs;
use sui::clock;
use sui::coin;
use sui::sui::SUI;
use sui::test_scenario as ts;
use toldproof::prediction_vault::{Self, Registry, SealedPrediction};

// Stand-in for a non-SUI accepted coin (e.g. USDC). One-time witness pattern,
// but for tests we just need a phantom type. `coin::mint_for_testing<MOCK_USDC>`
// would require setup; for the "unaccepted coin" test we use SUI without
// registering it, then re-register and test the happy path with SUI.
public struct MOCK_USDC has drop {}

const ADMIN: address = @0xAA;
const ALICE: address = @0xBB;
const OTHER: address = @0xCC;
const AGENT_WALLET: address = @0xDD;
const AGENT_WALLET_2: address = @0xEE;
const TREASURY: address = @0xFAFA;

const SEAL_AT_MS: u64 = 1_000_000;
const PRE_UNLOCK_MS: u64 = 1_500_000;
const UNLOCK_AT_MS: u64 = 2_000_000;
const POST_UNLOCK_MS: u64 = 2_000_001;
const RESOLVE_AT_MS: u64 = 2_100_000;

const PLAINTEXT: vector<u8> = b"BTC > 85k by 2026-06-30";
const BLOB_ID: vector<u8> = b"walrus_blob_id_dummy_for_testing";
const SEALED_KEY: vector<u8> = b"seal_encrypted_aes_key_dummy_32b";
const REASONING_BLOB_ID: vector<u8> = b"walrus_reasoning_trace_blob_id";

// Agent fee for tests: 100M MIST = 0.1 SUI (≈$0.20 at $2/SUI)
const AGENT_FEE_MIST: u64 = 100_000_000;

fun handle(): string::String { b"alice".to_string() }
fun agent_alias(): string::String { b"toldproof-claude-v1".to_string() }

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

// ---------- seal_prediction (free path — humans) ----------

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
    assert!(prediction_vault::identity_count(&reg, handle()) == 1, 101);

    ts::return_shared(reg);
    c.destroy_for_testing();

    scenario.next_tx(ALICE);
    let pred = scenario.take_shared<SealedPrediction>();
    assert!(prediction_vault::publisher(&pred) == ALICE, 102);
    assert!(prediction_vault::unlock_at_ms(&pred) == UNLOCK_AT_MS, 103);
    assert!(prediction_vault::is_revealed(&pred) == false, 104);
    assert!(prediction_vault::entity_type(&pred) == prediction_vault::entity_human(), 105);
    assert!(prediction_vault::identity(&pred) == handle(), 106);
    ts::return_shared(pred);

    scenario.end();
}

#[test]
fun multiple_predictions_per_identity_appends_to_vector() {
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
    prediction_vault::seal_prediction(
        &mut reg, handle(), UNLOCK_AT_MS + 1, content_hash, BLOB_ID, SEALED_KEY, &c, scenario.ctx(),
    );
    prediction_vault::seal_prediction(
        &mut reg, handle(), UNLOCK_AT_MS + 2, content_hash, BLOB_ID, SEALED_KEY, &c, scenario.ctx(),
    );

    assert!(prediction_vault::total_count(&reg) == 3, 300);
    assert!(prediction_vault::identity_count(&reg, handle()) == 3, 301);
    assert!(prediction_vault::identity_count(&reg, b"someone_else".to_string()) == 0, 302);

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
    prediction_vault::reveal(&reg, &mut pred, PLAINTEXT, &c);

    ts::return_shared(pred);
    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

// ---------- Input validation negative tests ----------

#[test, expected_failure(abort_code = prediction_vault::EInvalidContentHash)]
fun seal_prediction_with_wrong_length_content_hash_aborts() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ALICE);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);

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

#[test, expected_failure(abort_code = prediction_vault::EInvalidIdentity)]
fun seal_prediction_with_empty_identity_aborts() {
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

#[test, expected_failure(abort_code = prediction_vault::EInvalidIdentity)]
fun seal_prediction_with_oversized_identity_aborts() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ALICE);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);

    let content_hash = hash::sha2_256(PLAINTEXT);
    // 65 chars — exceeds the 64-char identity cap
    prediction_vault::seal_prediction(
        &mut reg,
        b"a-very-long-identity-that-is-definitely-too-long-for-our-limit-65".to_string(),
        UNLOCK_AT_MS,
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
    prediction_vault::seal_prediction(
        &mut reg, handle(), 18_446_744_073_709_551_615u64,
        content_hash, BLOB_ID, SEALED_KEY, &c, scenario.ctx(),
    );

    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

// ---------- BCS malformed id negative tests ----------

#[test, expected_failure(abort_code = prediction_vault::ENoAccess)]
fun seal_approve_with_trailing_garbage_aborts() {
    let ctx = &mut tx_context::dummy();
    let mut c = clock::create_for_testing(ctx);
    c.set_for_testing(POST_UNLOCK_MS);

    let mut id = bcs::to_bytes(&UNLOCK_AT_MS);
    id.push_back(0);
    prediction_vault::seal_approve_for_testing(id, &c);

    c.destroy_for_testing();
}

#[test, expected_failure]
fun seal_approve_with_truncated_id_aborts() {
    let ctx = &mut tx_context::dummy();
    let c = clock::create_for_testing(ctx);
    prediction_vault::seal_approve_for_testing(b"shorty", &c);
    c.destroy_for_testing();
}

// ---------- Resolution flow ----------

// Helper: get to a state where ALICE has sealed + revealed a prediction, ADMIN
// is the registered resolver (init sender), clock at RESOLVE_AT_MS.
fun seal_then_reveal(scenario: &mut ts::Scenario) {
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
    ts::return_shared(pred);
    ts::return_shared(reg);
    c.destroy_for_testing();
}

#[test]
fun init_sets_all_three_roles_to_deployer() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ADMIN);
    let reg = scenario.take_shared<Registry>();
    assert!(prediction_vault::registry_admin(&reg) == ADMIN, 400);
    assert!(prediction_vault::registry_resolver(&reg) == ADMIN, 401);
    assert!(prediction_vault::registry_treasury_addr(&reg) == ADMIN, 402);
    ts::return_shared(reg);
    scenario.end();
}

#[test]
fun resolve_hit_after_reveal_marks_hit() {
    let mut scenario = ts::begin(ADMIN);
    seal_then_reveal(&mut scenario);

    scenario.next_tx(ADMIN);
    let reg = scenario.take_shared<Registry>();
    let mut pred = scenario.take_shared<SealedPrediction>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(RESOLVE_AT_MS);

    prediction_vault::resolve(&reg, &mut pred, true, REASONING_BLOB_ID, &c, scenario.ctx());

    assert!(prediction_vault::is_resolved(&pred), 410);
    assert!(prediction_vault::hit(&pred), 411);
    assert!(prediction_vault::resolved_at_ms(&pred) == RESOLVE_AT_MS, 412);
    assert!(prediction_vault::reasoning_blob_id(&pred) == REASONING_BLOB_ID, 413);
    assert!(prediction_vault::resolver_of(&pred) == ADMIN, 414);

    ts::return_shared(pred);
    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

#[test]
fun resolve_miss_after_reveal_marks_miss() {
    let mut scenario = ts::begin(ADMIN);
    seal_then_reveal(&mut scenario);

    scenario.next_tx(ADMIN);
    let reg = scenario.take_shared<Registry>();
    let mut pred = scenario.take_shared<SealedPrediction>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(RESOLVE_AT_MS);

    prediction_vault::resolve(&reg, &mut pred, false, REASONING_BLOB_ID, &c, scenario.ctx());

    assert!(prediction_vault::is_resolved(&pred), 420);
    assert!(!prediction_vault::hit(&pred), 421);

    ts::return_shared(pred);
    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

#[test, expected_failure(abort_code = prediction_vault::ENotResolver)]
fun resolve_by_non_resolver_aborts() {
    let mut scenario = ts::begin(ADMIN);
    seal_then_reveal(&mut scenario);

    scenario.next_tx(ALICE);
    let reg = scenario.take_shared<Registry>();
    let mut pred = scenario.take_shared<SealedPrediction>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(RESOLVE_AT_MS);

    prediction_vault::resolve(&reg, &mut pred, true, REASONING_BLOB_ID, &c, scenario.ctx());

    ts::return_shared(pred);
    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

#[test, expected_failure(abort_code = prediction_vault::ENotRevealed)]
fun resolve_before_reveal_aborts() {
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

    scenario.next_tx(ADMIN);
    let reg = scenario.take_shared<Registry>();
    let mut pred = scenario.take_shared<SealedPrediction>();
    c.set_for_testing(POST_UNLOCK_MS);
    prediction_vault::resolve(&reg, &mut pred, true, REASONING_BLOB_ID, &c, scenario.ctx());

    ts::return_shared(pred);
    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

#[test, expected_failure(abort_code = prediction_vault::EAlreadyResolved)]
fun resolve_twice_aborts() {
    let mut scenario = ts::begin(ADMIN);
    seal_then_reveal(&mut scenario);

    scenario.next_tx(ADMIN);
    let reg = scenario.take_shared<Registry>();
    let mut pred = scenario.take_shared<SealedPrediction>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(RESOLVE_AT_MS);

    prediction_vault::resolve(&reg, &mut pred, true, REASONING_BLOB_ID, &c, scenario.ctx());
    prediction_vault::resolve(&reg, &mut pred, false, REASONING_BLOB_ID, &c, scenario.ctx());

    ts::return_shared(pred);
    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

#[test, expected_failure(abort_code = prediction_vault::EInvalidReasoningBlobId)]
fun resolve_with_empty_reasoning_blob_aborts() {
    let mut scenario = ts::begin(ADMIN);
    seal_then_reveal(&mut scenario);

    scenario.next_tx(ADMIN);
    let reg = scenario.take_shared<Registry>();
    let mut pred = scenario.take_shared<SealedPrediction>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(RESOLVE_AT_MS);

    prediction_vault::resolve(&reg, &mut pred, true, vector[], &c, scenario.ctx());

    ts::return_shared(pred);
    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

// ---------- Admin rotation entries ----------

#[test]
fun set_admin_rotates_authority() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ADMIN);
    let mut reg = scenario.take_shared<Registry>();
    assert!(prediction_vault::registry_admin(&reg) == ADMIN, 500);

    prediction_vault::set_admin(&mut reg, OTHER, scenario.ctx());
    assert!(prediction_vault::registry_admin(&reg) == OTHER, 501);

    ts::return_shared(reg);
    scenario.end();
}

#[test, expected_failure(abort_code = prediction_vault::ENotAdmin)]
fun set_admin_by_non_admin_aborts() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ALICE);
    let mut reg = scenario.take_shared<Registry>();
    prediction_vault::set_admin(&mut reg, ALICE, scenario.ctx());

    ts::return_shared(reg);
    scenario.end();
}

#[test]
fun set_resolver_admin_gated_rotates() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ADMIN);
    let mut reg = scenario.take_shared<Registry>();
    prediction_vault::set_resolver(&mut reg, OTHER, scenario.ctx());
    assert!(prediction_vault::registry_resolver(&reg) == OTHER, 510);

    ts::return_shared(reg);
    scenario.end();
}

#[test, expected_failure(abort_code = prediction_vault::ENotAdmin)]
fun set_resolver_by_non_admin_aborts() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ALICE);
    let mut reg = scenario.take_shared<Registry>();
    prediction_vault::set_resolver(&mut reg, ALICE, scenario.ctx());

    ts::return_shared(reg);
    scenario.end();
}

#[test]
fun set_treasury_addr_rotates() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ADMIN);
    let mut reg = scenario.take_shared<Registry>();
    prediction_vault::set_treasury_addr(&mut reg, TREASURY, scenario.ctx());
    assert!(prediction_vault::registry_treasury_addr(&reg) == TREASURY, 520);

    ts::return_shared(reg);
    scenario.end();
}

#[test, expected_failure(abort_code = prediction_vault::ENotAdmin)]
fun set_treasury_addr_by_non_admin_aborts() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ALICE);
    let mut reg = scenario.take_shared<Registry>();
    prediction_vault::set_treasury_addr(&mut reg, TREASURY, scenario.ctx());

    ts::return_shared(reg);
    scenario.end();
}

#[test]
fun set_fee_registers_coin() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ADMIN);
    let mut reg = scenario.take_shared<Registry>();
    assert!(!prediction_vault::is_coin_accepted<SUI>(&reg), 530);
    assert!(prediction_vault::fee_for<SUI>(&reg) == 0, 531);

    // M-03: must rotate treasury_addr off the deployer before fees can be set.
    prediction_vault::set_treasury_addr(&mut reg, TREASURY, scenario.ctx());

    prediction_vault::set_fee<SUI>(&mut reg, AGENT_FEE_MIST, scenario.ctx());
    assert!(prediction_vault::is_coin_accepted<SUI>(&reg), 532);
    assert!(prediction_vault::fee_for<SUI>(&reg) == AGENT_FEE_MIST, 533);

    // Re-set updates rather than aborts
    prediction_vault::set_fee<SUI>(&mut reg, AGENT_FEE_MIST * 2, scenario.ctx());
    assert!(prediction_vault::fee_for<SUI>(&reg) == AGENT_FEE_MIST * 2, 534);

    ts::return_shared(reg);
    scenario.end();
}

#[test, expected_failure(abort_code = prediction_vault::ENotAdmin)]
fun set_fee_by_non_admin_aborts() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ALICE);
    let mut reg = scenario.take_shared<Registry>();
    prediction_vault::set_fee<SUI>(&mut reg, AGENT_FEE_MIST, scenario.ctx());

    ts::return_shared(reg);
    scenario.end();
}

// ---------- Paid agent seals ----------

// Helper: deploy + admin rotates treasury_addr to TREASURY + admin sets fee
// Per M-03: set_fee aborts with ETreasuryNotInitialized until treasury_addr
// has been rotated off the deployer, so rotation must happen first.
fun setup_paid_agent_seal(scenario: &mut ts::Scenario) {
    prediction_vault::init_for_testing(scenario.ctx());
    scenario.next_tx(ADMIN);
    let mut reg = scenario.take_shared<Registry>();
    prediction_vault::set_treasury_addr(&mut reg, TREASURY, scenario.ctx());
    prediction_vault::set_fee<SUI>(&mut reg, AGENT_FEE_MIST, scenario.ctx());
    ts::return_shared(reg);
}

#[test]
fun agent_seal_with_correct_fee_succeeds_and_forwards_to_treasury() {
    let mut scenario = ts::begin(ADMIN);
    setup_paid_agent_seal(&mut scenario);

    scenario.next_tx(AGENT_WALLET);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);

    let content_hash = hash::sha2_256(PLAINTEXT);
    let fee = coin::mint_for_testing<SUI>(AGENT_FEE_MIST, scenario.ctx());
    prediction_vault::seal_prediction_as_agent<SUI>(
        &mut reg, agent_alias(), UNLOCK_AT_MS,
        content_hash, BLOB_ID, SEALED_KEY,
        fee, &c, scenario.ctx(),
    );

    assert!(prediction_vault::total_count(&reg) == 1, 600);
    assert!(prediction_vault::identity_count(&reg, agent_alias()) == 1, 601);

    ts::return_shared(reg);
    c.destroy_for_testing();

    // Verify the SealedPrediction is entity_type=agent
    scenario.next_tx(AGENT_WALLET);
    let pred = scenario.take_shared<SealedPrediction>();
    assert!(prediction_vault::entity_type(&pred) == prediction_vault::entity_agent(), 602);
    assert!(prediction_vault::identity(&pred) == agent_alias(), 603);
    assert!(prediction_vault::publisher(&pred) == AGENT_WALLET, 604);
    ts::return_shared(pred);

    // Verify TREASURY received the fee coin (test_scenario records the transfer)
    scenario.next_tx(TREASURY);
    let received = scenario.take_from_address<coin::Coin<SUI>>(TREASURY);
    assert!(received.value() == AGENT_FEE_MIST, 605);
    scenario.return_to_sender(received);

    scenario.end();
}

#[test, expected_failure(abort_code = prediction_vault::ENotEnoughFee)]
fun agent_seal_with_insufficient_fee_aborts() {
    let mut scenario = ts::begin(ADMIN);
    setup_paid_agent_seal(&mut scenario);

    scenario.next_tx(AGENT_WALLET);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);

    let content_hash = hash::sha2_256(PLAINTEXT);
    let fee = coin::mint_for_testing<SUI>(AGENT_FEE_MIST - 1, scenario.ctx());
    prediction_vault::seal_prediction_as_agent<SUI>(
        &mut reg, agent_alias(), UNLOCK_AT_MS,
        content_hash, BLOB_ID, SEALED_KEY,
        fee, &c, scenario.ctx(),
    );

    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

#[test, expected_failure(abort_code = prediction_vault::ECoinNotAccepted)]
fun agent_seal_with_unregistered_coin_aborts() {
    let mut scenario = ts::begin(ADMIN);
    // NOTE: init only — no set_fee for any coin
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(AGENT_WALLET);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);

    let content_hash = hash::sha2_256(PLAINTEXT);
    let fee = coin::mint_for_testing<SUI>(AGENT_FEE_MIST, scenario.ctx());
    prediction_vault::seal_prediction_as_agent<SUI>(
        &mut reg, agent_alias(), UNLOCK_AT_MS,
        content_hash, BLOB_ID, SEALED_KEY,
        fee, &c, scenario.ctx(),
    );

    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

// ---------- Identity-claim + agent-wallet-lock (first-claim-wins) ----------

#[test, expected_failure(abort_code = prediction_vault::EIdentityClaimedByOtherType)]
fun agent_cannot_claim_identity_already_used_by_human() {
    let mut scenario = ts::begin(ADMIN);
    setup_paid_agent_seal(&mut scenario);

    // ALICE seals as human under "dewaxindo"
    scenario.next_tx(ALICE);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);
    let content_hash = hash::sha2_256(PLAINTEXT);
    prediction_vault::seal_prediction(
        &mut reg, b"dewaxindo".to_string(), UNLOCK_AT_MS,
        content_hash, BLOB_ID, SEALED_KEY, &c, scenario.ctx(),
    );
    ts::return_shared(reg);
    c.destroy_for_testing();

    // AGENT_WALLET tries to seal as agent under "dewaxindo" — must abort
    scenario.next_tx(AGENT_WALLET);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);
    let fee = coin::mint_for_testing<SUI>(AGENT_FEE_MIST, scenario.ctx());
    prediction_vault::seal_prediction_as_agent<SUI>(
        &mut reg, b"dewaxindo".to_string(), UNLOCK_AT_MS,
        content_hash, BLOB_ID, SEALED_KEY,
        fee, &c, scenario.ctx(),
    );

    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

#[test, expected_failure(abort_code = prediction_vault::EIdentityClaimedByOtherType)]
fun human_cannot_claim_identity_already_used_by_agent() {
    let mut scenario = ts::begin(ADMIN);
    setup_paid_agent_seal(&mut scenario);

    // AGENT_WALLET seals as agent under "claude-v1"
    scenario.next_tx(AGENT_WALLET);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);
    let content_hash = hash::sha2_256(PLAINTEXT);
    let fee = coin::mint_for_testing<SUI>(AGENT_FEE_MIST, scenario.ctx());
    prediction_vault::seal_prediction_as_agent<SUI>(
        &mut reg, b"claude-v1".to_string(), UNLOCK_AT_MS,
        content_hash, BLOB_ID, SEALED_KEY,
        fee, &c, scenario.ctx(),
    );
    ts::return_shared(reg);
    c.destroy_for_testing();

    // ALICE tries to seal as human under "claude-v1" — must abort
    scenario.next_tx(ALICE);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);
    prediction_vault::seal_prediction(
        &mut reg, b"claude-v1".to_string(), UNLOCK_AT_MS,
        content_hash, BLOB_ID, SEALED_KEY, &c, scenario.ctx(),
    );

    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

#[test, expected_failure(abort_code = prediction_vault::EAgentAliasLockedToOtherWallet)]
fun agent_alias_locked_to_first_wallet_blocks_impersonators() {
    let mut scenario = ts::begin(ADMIN);
    setup_paid_agent_seal(&mut scenario);

    // AGENT_WALLET claims "claude-v1"
    scenario.next_tx(AGENT_WALLET);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);
    let content_hash = hash::sha2_256(PLAINTEXT);
    let fee = coin::mint_for_testing<SUI>(AGENT_FEE_MIST, scenario.ctx());
    prediction_vault::seal_prediction_as_agent<SUI>(
        &mut reg, b"claude-v1".to_string(), UNLOCK_AT_MS,
        content_hash, BLOB_ID, SEALED_KEY,
        fee, &c, scenario.ctx(),
    );
    ts::return_shared(reg);
    c.destroy_for_testing();

    // AGENT_WALLET_2 (different wallet) tries to seal under "claude-v1" — must abort
    scenario.next_tx(AGENT_WALLET_2);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);
    let fee2 = coin::mint_for_testing<SUI>(AGENT_FEE_MIST, scenario.ctx());
    prediction_vault::seal_prediction_as_agent<SUI>(
        &mut reg, b"claude-v1".to_string(), UNLOCK_AT_MS,
        content_hash, BLOB_ID, SEALED_KEY,
        fee2, &c, scenario.ctx(),
    );

    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

// ---------- Reputation profile publishing ----------

#[test]
fun publish_reputation_profile_by_resolver_succeeds() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ADMIN); // ADMIN is the default resolver
    let reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(RESOLVE_AT_MS);

    prediction_vault::publish_reputation_profile(
        &reg,
        handle(),
        b"profile_v1_walrus_blob_id",
        vector[],  // no previous version
        1,
        &c,
        scenario.ctx(),
    );

    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

#[test, expected_failure(abort_code = prediction_vault::ENotResolver)]
fun publish_reputation_profile_by_non_resolver_aborts() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ALICE); // not the resolver
    let reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(RESOLVE_AT_MS);

    prediction_vault::publish_reputation_profile(
        &reg,
        handle(),
        b"profile_v1",
        vector[],
        1,
        &c,
        scenario.ctx(),
    );

    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

#[test, expected_failure(abort_code = prediction_vault::EInvalidProfileBlobId)]
fun publish_reputation_profile_with_empty_blob_aborts() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ADMIN);
    let reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(RESOLVE_AT_MS);

    prediction_vault::publish_reputation_profile(
        &reg,
        handle(),
        vector[],  // empty blob_id
        vector[],
        1,
        &c,
        scenario.ctx(),
    );

    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

#[test]
fun publish_reputation_profile_with_prev_version_linkage() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ADMIN);
    let reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(RESOLVE_AT_MS);

    // v1
    prediction_vault::publish_reputation_profile(
        &reg, handle(),
        b"profile_v1", vector[], 1,
        &c, scenario.ctx(),
    );
    // v2 referencing v1
    prediction_vault::publish_reputation_profile(
        &reg, handle(),
        b"profile_v2",
        b"profile_v1",  // chains to v1
        2,
        &c, scenario.ctx(),
    );

    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

#[test]
fun same_wallet_can_seal_multiple_predictions_under_same_alias() {
    let mut scenario = ts::begin(ADMIN);
    setup_paid_agent_seal(&mut scenario);

    // First seal
    scenario.next_tx(AGENT_WALLET);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);
    let content_hash = hash::sha2_256(PLAINTEXT);
    let fee = coin::mint_for_testing<SUI>(AGENT_FEE_MIST, scenario.ctx());
    prediction_vault::seal_prediction_as_agent<SUI>(
        &mut reg, agent_alias(), UNLOCK_AT_MS,
        content_hash, BLOB_ID, SEALED_KEY,
        fee, &c, scenario.ctx(),
    );

    // Second seal — same wallet, same alias — should succeed
    let fee2 = coin::mint_for_testing<SUI>(AGENT_FEE_MIST, scenario.ctx());
    prediction_vault::seal_prediction_as_agent<SUI>(
        &mut reg, agent_alias(), UNLOCK_AT_MS + 1,
        content_hash, BLOB_ID, SEALED_KEY,
        fee2, &c, scenario.ctx(),
    );

    assert!(prediction_vault::identity_count(&reg, agent_alias()) == 2, 700);
    assert!(prediction_vault::agent_alias_locked_to(&reg, agent_alias()) == AGENT_WALLET, 701);

    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

// ---------- Audit fixes: H-01, M-01, M-02, M-03, M-04, L-04 ----------

// M-01: set_admin must reject @0x0 — otherwise admin authority is permanently
// burned and treasury_addr is frozen on whatever it was last set to.
#[test, expected_failure(abort_code = prediction_vault::EInvalidAddress)]
fun set_admin_with_zero_address_aborts() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ADMIN);
    let mut reg = scenario.take_shared<Registry>();
    prediction_vault::set_admin(&mut reg, @0x0, scenario.ctx());

    ts::return_shared(reg);
    scenario.end();
}

// M-01: set_resolver must reject @0x0 — otherwise resolve() becomes
// permanently un-callable and predictions can never be attested.
#[test, expected_failure(abort_code = prediction_vault::EInvalidAddress)]
fun set_resolver_with_zero_address_aborts() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ADMIN);
    let mut reg = scenario.take_shared<Registry>();
    prediction_vault::set_resolver(&mut reg, @0x0, scenario.ctx());

    ts::return_shared(reg);
    scenario.end();
}

// M-01: set_treasury_addr must reject @0x0 — otherwise every paid agent
// seal would burn its fee coin to the dead address.
#[test, expected_failure(abort_code = prediction_vault::EInvalidAddress)]
fun set_treasury_with_zero_address_aborts() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ADMIN);
    let mut reg = scenario.take_shared<Registry>();
    prediction_vault::set_treasury_addr(&mut reg, @0x0, scenario.ctx());

    ts::return_shared(reg);
    scenario.end();
}

// M-03: set_fee must abort until treasury_addr has been rotated off the
// deployer. Prevents the misconfiguration where agent fees forward to the
// admin's deploy wallet.
#[test, expected_failure(abort_code = prediction_vault::ETreasuryNotInitialized)]
fun set_fee_before_treasury_init_aborts() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ADMIN);
    let mut reg = scenario.take_shared<Registry>();
    prediction_vault::set_fee<SUI>(&mut reg, AGENT_FEE_MIST, scenario.ctx());

    ts::return_shared(reg);
    scenario.end();
}

// M-04: set_fee must reject values below MIN_FEE_FLOOR_MIST. Eliminates the
// admin foot-gun of accidentally posting a dust-priced agent path.
#[test, expected_failure(abort_code = prediction_vault::EFeeTooLow)]
fun set_fee_below_floor_aborts() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ADMIN);
    let mut reg = scenario.take_shared<Registry>();
    prediction_vault::set_treasury_addr(&mut reg, TREASURY, scenario.ctx());
    // MIN_FEE_FLOOR_MIST is 10_000_000 in the source; 1_000_000 is below.
    prediction_vault::set_fee<SUI>(&mut reg, 1_000_000, scenario.ctx());

    ts::return_shared(reg);
    scenario.end();
}

// M-02: an agent that overpays must get the change refunded — not have
// the whole coin swept to treasury.
#[test]
fun agent_seal_overpay_returns_change() {
    let mut scenario = ts::begin(ADMIN);
    setup_paid_agent_seal(&mut scenario);

    scenario.next_tx(AGENT_WALLET);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);

    let overpay = AGENT_FEE_MIST + 50_000_000;
    let content_hash = hash::sha2_256(PLAINTEXT);
    let fee = coin::mint_for_testing<SUI>(overpay, scenario.ctx());
    prediction_vault::seal_prediction_as_agent<SUI>(
        &mut reg, agent_alias(), UNLOCK_AT_MS,
        content_hash, BLOB_ID, SEALED_KEY,
        fee, &c, scenario.ctx(),
    );

    ts::return_shared(reg);
    c.destroy_for_testing();

    // Treasury received EXACTLY required, not the inflated amount.
    scenario.next_tx(TREASURY);
    let received = scenario.take_from_address<coin::Coin<SUI>>(TREASURY);
    assert!(received.value() == AGENT_FEE_MIST, 800);
    scenario.return_to_sender(received);

    // Agent wallet received the change (overpay - required).
    scenario.next_tx(AGENT_WALLET);
    let change = scenario.take_from_address<coin::Coin<SUI>>(AGENT_WALLET);
    assert!(change.value() == overpay - AGENT_FEE_MIST, 801);
    scenario.return_to_sender(change);

    scenario.end();
}

// H-01: identity charset must reject uppercase ASCII. Canonical form is
// [a-z0-9_-]; uppercase breaks identity-lock determinism because two
// strings differing only in case would otherwise map to two separate
// identity buckets.
#[test, expected_failure(abort_code = prediction_vault::EInvalidIdentityCharset)]
fun identity_with_uppercase_aborts() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ALICE);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);
    let content_hash = hash::sha2_256(PLAINTEXT);
    prediction_vault::seal_prediction(
        &mut reg, b"Alice".to_string(), UNLOCK_AT_MS,
        content_hash, BLOB_ID, SEALED_KEY, &c, scenario.ctx(),
    );

    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

// H-01: identity charset must reject '@' (and other symbols not in the
// canonical set). Prevents X-handle-style strings with sigils.
#[test, expected_failure(abort_code = prediction_vault::EInvalidIdentityCharset)]
fun identity_with_at_sign_aborts() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ALICE);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);
    let content_hash = hash::sha2_256(PLAINTEXT);
    prediction_vault::seal_prediction(
        &mut reg, b"@alice".to_string(), UNLOCK_AT_MS,
        content_hash, BLOB_ID, SEALED_KEY, &c, scenario.ctx(),
    );

    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

// H-01: non-ASCII bytes (e.g. UTF-8 multi-byte) must be rejected. Each
// multi-byte unicode character contains bytes outside the [a-z0-9_-] set.
#[test, expected_failure(abort_code = prediction_vault::EInvalidIdentityCharset)]
fun identity_with_unicode_aborts() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ALICE);
    let mut reg = scenario.take_shared<Registry>();
    let mut c = clock::create_for_testing(scenario.ctx());
    c.set_for_testing(SEAL_AT_MS);
    let content_hash = hash::sha2_256(PLAINTEXT);
    // "café" — the 'é' is a 2-byte UTF-8 sequence (0xC3 0xA9), both
    // outside the canonical charset.
    prediction_vault::seal_prediction(
        &mut reg, b"caf\xC3\xA9".to_string(), UNLOCK_AT_MS,
        content_hash, BLOB_ID, SEALED_KEY, &c, scenario.ctx(),
    );

    ts::return_shared(reg);
    c.destroy_for_testing();
    scenario.end();
}

// L-04: agent_alias_locked_to returns the sentinel @0x0 for an unclaimed
// alias instead of aborting. Lets the TS layer probe-without-catch.
#[test]
fun agent_alias_locked_to_returns_sentinel_for_missing() {
    let mut scenario = ts::begin(ADMIN);
    prediction_vault::init_for_testing(scenario.ctx());

    scenario.next_tx(ALICE);
    let reg = scenario.take_shared<Registry>();
    let unclaimed = b"never-claimed".to_string();
    assert!(prediction_vault::agent_alias_locked_to(&reg, unclaimed) == @0x0, 900);

    ts::return_shared(reg);
    scenario.end();
}
