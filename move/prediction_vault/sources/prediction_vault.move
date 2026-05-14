// Copyright (c) 2026 TOLDPROOF
// SPDX-License-Identifier: Apache-2.0

/// TOLDPROOF prediction vault — verifiable reputation infrastructure for
/// humans AND AI agents.
///
/// Two seal paths:
///   * seal_prediction()           — humans, free, identity = X handle
///   * seal_prediction_as_agent<T> — AI agents, paid in Coin<T>, identity = alias
///
/// Common reveal + resolve flow after that. Resolution Agent attests outcomes
/// and anchors reasoning to Walrus. Identity is first-claim-wins per entity
/// type; agent aliases are additionally locked to their first wallet so
/// impersonators cannot dilute an agent's track record.
module toldproof::prediction_vault;

use std::string::String;
use std::type_name;
use std::hash;
use sui::bcs;
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::event;
use sui::table::{Self, Table};

// ---------- Error codes ----------

const ENoAccess: u64 = 0;
const EAlreadyRevealed: u64 = 1;
const EHashMismatch: u64 = 2;
const EInvalidPackageVersion: u64 = 3;
const EUnlockInPast: u64 = 4;
// Audit-derived input validation:
const EInvalidContentHash: u64 = 5;
const EInvalidBlobId: u64 = 6;
const EInvalidSealedKey: u64 = 7;
const EInvalidIdentity: u64 = 8;
const EUnlockTooFar: u64 = 9;
const EPlaintextTooLarge: u64 = 10;
// Resolution flow:
const ENotResolver: u64 = 11;
const ENotRevealed: u64 = 12;
const EAlreadyResolved: u64 = 13;
const EInvalidReasoningBlobId: u64 = 14;
// v2: agent payment + admin + identity locks
const ENotAdmin: u64 = 15;
const ENotEnoughFee: u64 = 16;
const ECoinNotAccepted: u64 = 17;
const EIdentityClaimedByOtherType: u64 = 18;
const EAgentAliasLockedToOtherWallet: u64 = 19;
// v2: reputation profile publishing
const EInvalidProfileBlobId: u64 = 20;
const EInvalidIdentityCharset: u64 = 21;
const EInvalidAddress: u64 = 22;
const ETreasuryNotInitialized: u64 = 23;
const EFeeTooLow: u64 = 24;

// ---------- Versioning ----------

const VERSION: u64 = 2;

// ---------- Entity types ----------

const ENTITY_HUMAN: u8 = 0;
const ENTITY_AGENT: u8 = 1;

// ---------- Input bounds (UX safety rails) ----------

const CONTENT_HASH_LEN: u64 = 32;            // SHA-256 output length
// MAX_IDENTITY_LEN covers BOTH human x_handles (X caps at 15) and agent
// aliases (we allow longer, multi-segment names like "toldproof-claude-v1").
// 64 is a reasonable upper bound — long enough for descriptive aliases,
// short enough to keep on-chain string storage cheap.
const MAX_IDENTITY_LEN: u64 = 64;
const MAX_BLOB_ID_LEN: u64 = 256;            // Walrus blob_id ascii bytes
const MAX_SEALED_KEY_LEN: u64 = 4096;        // Seal EncryptedObject bytes
const MAX_PLAINTEXT_LEN: u64 = 65_536;       // reveal-time plaintext cap (64 KB)
const MAX_LOCK_DURATION_MS: u64 = 10 * 365 * 24 * 60 * 60 * 1000;  // ~10 years
// Floor for paid agent seals — prevents zero-fee sybil alias squatting.
// 10M MIST = 0.01 SUI ≈ $0.02 at $2/SUI.
const MIN_FEE_FLOOR_MIST: u64 = 10_000_000;

// ---------- One-Time Witness ----------

public struct PREDICTION_VAULT has drop {}

// ---------- Shared state ----------

/// Shared singleton: the directory of every sealed prediction across every
/// entity type, plus the economic + identity-lock state.
public struct Registry has key {
    id: UID,
    version: u64,
    /// identity (lowercased, no '@') → all prediction IDs sealed under it.
    /// Humans use x_handles, agents use aliases — same table, distinguished
    /// by `entity_type` on each SealedPrediction.
    by_identity: Table<String, vector<ID>>,
    total_count: u64,

    // ----- Roles -----
    /// Admin: controls fees, rotates roles, rotates treasury destination.
    /// Initialized to deployer at init; rotate to a hot wallet via set_admin().
    admin: address,
    /// Resolution Agent's Sui address. Only this address can call resolve().
    /// Initialized to deployer; rotate to the AI agent's keypair via set_resolver().
    resolver: address,
    /// Where agent-seal fees auto-forward to every paid seal. Initialized to
    /// deployer; rotate to a revenue-receiving wallet via set_treasury_addr().
    treasury_addr: address,
    /// True once set_treasury_addr has been called at least once. Forces
    /// the bootstrap order rotate-treasury → enable-fees, so paid seals
    /// can never silently forward to the deployer's hot wallet.
    treasury_initialized: bool,

    // ----- Economics -----
    /// Per-coin fee for paid agent seals.
    /// Key = canonical type-name bytes from std::type_name (e.g. for SUI:
    /// "0000…0002::sui::SUI"). Value = required minimum fee amount in that
    /// coin's smallest unit (MIST for SUI, microUSDC for USDC).
    /// Admin populates via set_fee<T>().
    fees: Table<vector<u8>, u64>,

    // ----- Identity locks (first-claim-wins) -----
    /// identity → entity_type that first sealed under it. Subsequent seals
    /// under the same identity with a different entity_type abort. Prevents
    /// "elonmusk" from being claimed by both a human and an agent.
    identity_claims: Table<String, u8>,
    /// agent_alias → wallet that first claimed it. Subsequent agent seals
    /// under the same alias must be from the same wallet. Prevents
    /// impersonators from spinning up new wallets to dilute an agent's track
    /// record. Humans are NOT wallet-locked (multiple wallets can seal under
    /// an x_handle until off-chain X OAuth verification ships).
    agent_wallet_locks: Table<String, address>,
}

/// Shared per-prediction object. Same shape for humans and agents — entity
/// type and identity are stored explicitly so indexers + UIs can route.
public struct SealedPrediction has key {
    id: UID,
    publisher: address,
    identity: String,             // x_handle for humans, alias for agents
    entity_type: u8,              // ENTITY_HUMAN or ENTITY_AGENT
    sealed_at_ms: u64,
    unlock_at_ms: u64,
    content_hash: vector<u8>,     // sha256(plaintext)
    blob_id: vector<u8>,          // Walrus blob ID (ascii bytes)
    sealed_key: vector<u8>,       // Seal-encrypted AES key (EncryptedObject bytes)
    revealed: bool,
    revealed_at_ms: u64,
    revealed_plaintext: vector<u8>,
    // Resolution Agent attestation (populated by resolve()).
    resolved: bool,
    hit: bool,
    resolved_at_ms: u64,
    reasoning_blob_id: vector<u8>,
    resolver: address,            // which agent wallet attested
}

// ---------- Events ----------

public struct PredictionSealed has copy, drop {
    prediction_id: ID,
    publisher: address,
    identity: String,
    entity_type: u8,
    sealed_at_ms: u64,
    unlock_at_ms: u64,
    content_hash: vector<u8>,
    blob_id: vector<u8>,
}

/// Emitted IN ADDITION to PredictionSealed when an agent pays a fee. Lets
/// indexers compute revenue + agent volume without scanning every seal event.
public struct AgentSealFeePaid has copy, drop {
    prediction_id: ID,
    payer: address,
    coin_type: vector<u8>,
    fee_paid: u64,
    treasury_addr: address,
}

public struct HumanSealFeePaid has copy, drop {
    prediction_id: ID,
    payer: address,
    coin_type: vector<u8>,
    fee_paid: u64,
    treasury_addr: address,
}

public struct PredictionRevealed has copy, drop {
    prediction_id: ID,
    revealed_at_ms: u64,
    content_hash: vector<u8>,
}

public struct PredictionResolved has copy, drop {
    prediction_id: ID,
    resolver: address,
    hit: bool,
    resolved_at_ms: u64,
    reasoning_blob_id: vector<u8>,
}

public struct ResolverRotated has copy, drop {
    old_resolver: address,
    new_resolver: address,
    rotated_at_epoch: u64,
}

public struct AdminRotated has copy, drop {
    old_admin: address,
    new_admin: address,
    rotated_at_epoch: u64,
}

public struct TreasuryAddrRotated has copy, drop {
    old_treasury: address,
    new_treasury: address,
    rotated_at_epoch: u64,
}

public struct FeeSet has copy, drop {
    coin_type: vector<u8>,
    fee_amount: u64,
}

/// Emitted when the Reputation Agent publishes an updated profile for an
/// identity. The actual profile JSON lives on Walrus at `profile_blob_id`.
/// Indexers + the UI track the latest version per identity by querying for the
/// highest `version` from this event stream.
///
/// Reputation profiles include aggregated stats (hit rate, calibration,
/// per-domain accuracy) computed by the agent from the identity's resolved
/// predictions, plus an LLM-generated narrative summary. The profile IS the
/// agent's persistent memory of "what this analyst is good at" — versioned,
/// linked to its predecessor, fully auditable on Walrus.
public struct ReputationProfileUpdated has copy, drop {
    identity: String,
    profile_blob_id: vector<u8>,
    previous_blob_id: vector<u8>, // empty for version 1
    version: u64,
    published_at_ms: u64,
    publisher: address,
}

// ---------- Init ----------

fun init(_otw: PREDICTION_VAULT, ctx: &mut TxContext) {
    let sender = ctx.sender();
    let registry = Registry {
        id: object::new(ctx),
        version: VERSION,
        by_identity: table::new(ctx),
        total_count: 0,
        // All three roles start as deployer. Post-deploy admin rotates them
        // via set_admin / set_resolver / set_treasury_addr.
        admin: sender,
        resolver: sender,
        treasury_addr: sender,
        treasury_initialized: false,
        fees: table::new(ctx),
        identity_claims: table::new(ctx),
        agent_wallet_locks: table::new(ctx),
    };
    transfer::share_object(registry);
}

fun check_version(reg: &Registry) {
    assert!(reg.version == VERSION, EInvalidPackageVersion);
}

fun assert_admin(reg: &Registry, ctx: &TxContext) {
    assert!(ctx.sender() == reg.admin, ENotAdmin);
}

// Canonical identity charset: ASCII a-z, 0-9, '_', '-'. Rejecting
// uppercase, whitespace, '@' and any byte > 0x7F closes case-variant
// and Unicode-confusable bypasses around the first-claim-wins lock.
fun assert_canonical_identity(s: &String) {
    let bytes = s.as_bytes();
    let n = bytes.length();
    let mut i = 0;
    while (i < n) {
        let b = *bytes.borrow(i);
        let ok = (b >= 0x61 && b <= 0x7A)    // a-z
              || (b >= 0x30 && b <= 0x39)    // 0-9
              || b == 0x5F                    // _
              || b == 0x2D;                   // -
        assert!(ok, EInvalidIdentityCharset);
        i = i + 1;
    };
}

// ---------- Seal a prediction (free path — humans) ----------

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
    let pid = create_prediction(
        reg,
        x_handle,
        ENTITY_HUMAN,
        unlock_at_ms,
        content_hash,
        blob_id,
        sealed_key,
        clock,
        ctx,
    );
    // No fee event for humans — silence is the free-tier signal.
    let _ = pid;
}

// ---------- Seal a prediction (paid path — agents) ----------

// Note on the self-transfer lint: the change refund is intentionally a
// self-transfer (sender pays Coin<T>, gets the unused portion back). The
// alternative (returning the change Coin) would change the public ABI and
// require every caller PTB to handle the return value. The self-transfer is
// the simpler ergonomic for agent integrators.
#[allow(lint(self_transfer))]
/// Agent-only seal. Pays `fee` in any coin type the admin has registered via
/// set_fee<T>(). Fee auto-forwards to the Registry's treasury_addr — no
/// on-chain balance accumulation.
public fun seal_prediction_as_agent<T>(
    reg: &mut Registry,
    agent_alias: String,
    unlock_at_ms: u64,
    content_hash: vector<u8>,
    blob_id: vector<u8>,
    sealed_key: vector<u8>,
    fee: Coin<T>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Look up the required fee for this coin type
    let type_bytes_ascii = type_name::with_defining_ids<T>().into_string();
    let type_bytes = *type_bytes_ascii.as_bytes();
    assert!(reg.fees.contains(type_bytes), ECoinNotAccepted);
    let required = *reg.fees.borrow(type_bytes);
    let paid = fee.value();
    assert!(paid >= required, ENotEnoughFee);

    // Split exactly `required` to treasury; refund any excess to sender so
    // a caller passing an oversized Coin<T> doesn't silently overpay.
    let mut fee = fee;
    let exact = coin::split(&mut fee, required, ctx);
    let treasury_dest = reg.treasury_addr;
    transfer::public_transfer(exact, treasury_dest);
    if (fee.value() > 0) {
        transfer::public_transfer(fee, ctx.sender());
    } else {
        coin::destroy_zero(fee);
    };

    let pid = create_prediction(
        reg,
        agent_alias,
        ENTITY_AGENT,
        unlock_at_ms,
        content_hash,
        blob_id,
        sealed_key,
        clock,
        ctx,
    );

    event::emit(AgentSealFeePaid {
        prediction_id: pid,
        payer: ctx.sender(),
        coin_type: type_bytes,
        fee_paid: required,  // amount kept by treasury, not the original Coin value
        treasury_addr: treasury_dest,
    });
}

// ---------- Seal a prediction (paid path — humans, overage / pay-as-you-go) ----------

#[allow(lint(self_transfer))]
/// Paid human seal. Same fee table as the agent path (single price oracle),
/// but stamps the SealedPrediction with entity_type = HUMAN and skips the
/// agent wallet-lock. Use this when a human has exhausted their off-chain
/// free quota and wants to keep sealing.
///
/// Off-chain layer is responsible for picking between this and the free
/// `seal_prediction` path; the contract just enforces "if you call the
/// paid path, you pay the on-chain fee".
public fun seal_prediction_paid<T>(
    reg: &mut Registry,
    identity: String,
    unlock_at_ms: u64,
    content_hash: vector<u8>,
    blob_id: vector<u8>,
    sealed_key: vector<u8>,
    fee: Coin<T>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let type_bytes_ascii = type_name::with_defining_ids<T>().into_string();
    let type_bytes = *type_bytes_ascii.as_bytes();
    assert!(reg.fees.contains(type_bytes), ECoinNotAccepted);
    let required = *reg.fees.borrow(type_bytes);
    let paid = fee.value();
    assert!(paid >= required, ENotEnoughFee);

    let mut fee = fee;
    let exact = coin::split(&mut fee, required, ctx);
    let treasury_dest = reg.treasury_addr;
    transfer::public_transfer(exact, treasury_dest);
    if (fee.value() > 0) {
        transfer::public_transfer(fee, ctx.sender());
    } else {
        coin::destroy_zero(fee);
    };

    let pid = create_prediction(
        reg,
        identity,
        ENTITY_HUMAN,
        unlock_at_ms,
        content_hash,
        blob_id,
        sealed_key,
        clock,
        ctx,
    );

    event::emit(HumanSealFeePaid {
        prediction_id: pid,
        payer: ctx.sender(),
        coin_type: type_bytes,
        fee_paid: required,
        treasury_addr: treasury_dest,
    });
}

/// Shared internals between the free + paid seal paths. Enforces input
/// validation, identity-claim, and wallet-lock rules; creates the
/// SealedPrediction shared object; updates by_identity index; emits
/// PredictionSealed. Returns the new object ID for callers that need to
/// emit follow-up events (fee event).
fun create_prediction(
    reg: &mut Registry,
    identity: String,
    entity_type: u8,
    unlock_at_ms: u64,
    content_hash: vector<u8>,
    blob_id: vector<u8>,
    sealed_key: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
): ID {
    check_version(reg);
    let now = clock.timestamp_ms();
    assert!(unlock_at_ms > now, EUnlockInPast);
    assert!(unlock_at_ms <= now + MAX_LOCK_DURATION_MS, EUnlockTooFar);
    assert!(content_hash.length() == CONTENT_HASH_LEN, EInvalidContentHash);
    let bl = blob_id.length();
    assert!(bl > 0 && bl <= MAX_BLOB_ID_LEN, EInvalidBlobId);
    let sl = sealed_key.length();
    assert!(sl > 0 && sl <= MAX_SEALED_KEY_LEN, EInvalidSealedKey);
    let il = identity.length();
    assert!(il > 0 && il <= MAX_IDENTITY_LEN, EInvalidIdentity);
    assert_canonical_identity(&identity);

    // Identity-claim check (first-claim-wins per entity type).
    if (reg.identity_claims.contains(identity)) {
        let claimed_type = *reg.identity_claims.borrow(identity);
        assert!(claimed_type == entity_type, EIdentityClaimedByOtherType);
    } else {
        reg.identity_claims.add(identity, entity_type);
    };

    // Agent-alias wallet lock (additional layer for agent identities only).
    let sender = ctx.sender();
    if (entity_type == ENTITY_AGENT) {
        if (reg.agent_wallet_locks.contains(identity)) {
            let locked_wallet = *reg.agent_wallet_locks.borrow(identity);
            assert!(locked_wallet == sender, EAgentAliasLockedToOtherWallet);
        } else {
            reg.agent_wallet_locks.add(identity, sender);
        };
    };

    let prediction = SealedPrediction {
        id: object::new(ctx),
        publisher: sender,
        identity,
        entity_type,
        sealed_at_ms: now,
        unlock_at_ms,
        content_hash,
        blob_id,
        sealed_key,
        revealed: false,
        revealed_at_ms: 0,
        revealed_plaintext: vector[],
        resolved: false,
        hit: false,
        resolved_at_ms: 0,
        reasoning_blob_id: vector[],
        resolver: @0x0,
    };
    let pid = object::id(&prediction);

    if (!reg.by_identity.contains(prediction.identity)) {
        reg.by_identity.add(prediction.identity, vector[]);
    };
    let list = reg.by_identity.borrow_mut(prediction.identity);
    list.push_back(pid);

    reg.total_count = reg.total_count + 1;

    event::emit(PredictionSealed {
        prediction_id: pid,
        publisher: prediction.publisher,
        identity: prediction.identity,
        entity_type: prediction.entity_type,
        sealed_at_ms: prediction.sealed_at_ms,
        unlock_at_ms: prediction.unlock_at_ms,
        content_hash: prediction.content_hash,
        blob_id: prediction.blob_id,
    });

    transfer::share_object(prediction);
    pid
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
    assert!(plaintext.length() <= MAX_PLAINTEXT_LEN, EPlaintextTooLarge);

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

// ---------- Resolution (AI agent attestation) ----------

public fun resolve(
    reg: &Registry,
    prediction: &mut SealedPrediction,
    hit: bool,
    reasoning_blob_id: vector<u8>,
    clock: &Clock,
    ctx: &TxContext,
) {
    check_version(reg);
    assert!(ctx.sender() == reg.resolver, ENotResolver);
    assert!(prediction.revealed, ENotRevealed);
    assert!(!prediction.resolved, EAlreadyResolved);
    let bl = reasoning_blob_id.length();
    assert!(bl > 0 && bl <= MAX_BLOB_ID_LEN, EInvalidReasoningBlobId);

    prediction.resolved = true;
    prediction.hit = hit;
    prediction.resolved_at_ms = clock.timestamp_ms();
    prediction.reasoning_blob_id = reasoning_blob_id;
    prediction.resolver = ctx.sender();

    event::emit(PredictionResolved {
        prediction_id: object::id(prediction),
        resolver: prediction.resolver,
        hit,
        resolved_at_ms: prediction.resolved_at_ms,
        reasoning_blob_id: prediction.reasoning_blob_id,
    });
}

// ---------- Reputation profile publication ----------

/// Reputation Agent publishes an updated profile for an identity. The actual
/// profile JSON lives on Walrus; this entry emits an indexable event so the
/// UI + leaderboard can find the latest version per identity.
///
/// Gated to the resolver address (same as the Resolution Agent — one agent
/// system, two roles). `previous_blob_id` should be empty for version 1 and
/// the prior profile's blob_id for later versions — gives subscribers a
/// linked-list audit trail.
public fun publish_reputation_profile(
    reg: &Registry,
    identity: String,
    profile_blob_id: vector<u8>,
    previous_blob_id: vector<u8>,
    version: u64,
    clock: &Clock,
    ctx: &TxContext,
) {
    check_version(reg);
    assert!(ctx.sender() == reg.resolver, ENotResolver);
    let il = identity.length();
    assert!(il > 0 && il <= MAX_IDENTITY_LEN, EInvalidIdentity);
    let bl = profile_blob_id.length();
    assert!(bl > 0 && bl <= MAX_BLOB_ID_LEN, EInvalidProfileBlobId);
    // previous_blob_id may be empty (first version); otherwise capped.
    assert!(previous_blob_id.length() <= MAX_BLOB_ID_LEN, EInvalidProfileBlobId);

    event::emit(ReputationProfileUpdated {
        identity,
        profile_blob_id,
        previous_blob_id,
        version,
        published_at_ms: clock.timestamp_ms(),
        publisher: ctx.sender(),
    });
}

// ---------- Admin entries ----------

/// Rotate admin authority. Only the current admin can call.
public fun set_admin(reg: &mut Registry, new_admin: address, ctx: &TxContext) {
    check_version(reg);
    assert_admin(reg, ctx);
    // Rotating to @0x0 would permanently lock out governance.
    assert!(new_admin != @0x0, EInvalidAddress);
    let old = reg.admin;
    reg.admin = new_admin;
    event::emit(AdminRotated {
        old_admin: old,
        new_admin,
        rotated_at_epoch: ctx.epoch(),
    });
}

/// Rotate the Resolution Agent address. Admin-gated (was resolver-gated in v1
/// but admin is the cleaner authority — resolver is just an operational role).
public fun set_resolver(reg: &mut Registry, new_resolver: address, ctx: &TxContext) {
    check_version(reg);
    assert_admin(reg, ctx);
    // Rotating to @0x0 would freeze the reputation system — nothing could resolve.
    assert!(new_resolver != @0x0, EInvalidAddress);
    let old = reg.resolver;
    reg.resolver = new_resolver;
    event::emit(ResolverRotated {
        old_resolver: old,
        new_resolver,
        rotated_at_epoch: ctx.epoch(),
    });
}

/// Rotate the treasury destination. All future agent seal fees forward here.
public fun set_treasury_addr(reg: &mut Registry, new_addr: address, ctx: &TxContext) {
    check_version(reg);
    assert_admin(reg, ctx);
    // Rotating to @0x0 would burn every future fee.
    assert!(new_addr != @0x0, EInvalidAddress);
    let old = reg.treasury_addr;
    reg.treasury_addr = new_addr;
    reg.treasury_initialized = true;
    event::emit(TreasuryAddrRotated {
        old_treasury: old,
        new_treasury: new_addr,
        rotated_at_epoch: ctx.epoch(),
    });
}

/// Set or update the required fee for coin type `T`. Use this to enable a
/// new coin (e.g. add USDC support post-deploy) or adjust an existing fee
/// as the underlying coin's USD price moves.
///
/// Bootstrap order is enforced: treasury_addr must be rotated off the
/// deployer before any fee can be enabled, and fee_amount must clear
/// MIN_FEE_FLOOR_MIST so an admin can't accidentally open a zero-fee
/// alias-squatting path.
public fun set_fee<T>(reg: &mut Registry, fee_amount: u64, ctx: &TxContext) {
    check_version(reg);
    assert_admin(reg, ctx);
    assert!(reg.treasury_initialized, ETreasuryNotInitialized);
    assert!(fee_amount >= MIN_FEE_FLOOR_MIST, EFeeTooLow);
    let type_bytes_ascii = type_name::with_defining_ids<T>().into_string();
    let type_bytes = *type_bytes_ascii.as_bytes();
    if (reg.fees.contains(type_bytes)) {
        let f = reg.fees.borrow_mut(type_bytes);
        *f = fee_amount;
    } else {
        reg.fees.add(type_bytes, fee_amount);
    };
    event::emit(FeeSet { coin_type: type_bytes, fee_amount });
}

// ---------- Seal access policy (time-lock) ----------

fun check_unlock(id: vector<u8>, c: &Clock): bool {
    let mut prepared = bcs::new(id);
    let unlock_time = prepared.peel_u64();
    let leftover = prepared.into_remainder_bytes();
    leftover.length() == 0 && c.timestamp_ms() >= unlock_time
}

entry fun seal_approve(id: vector<u8>, c: &Clock) {
    assert!(check_unlock(id, c), ENoAccess);
}

// ---------- Read accessors ----------

public fun total_count(reg: &Registry): u64 { reg.total_count }

public fun identity_count(reg: &Registry, identity: String): u64 {
    if (!reg.by_identity.contains(identity)) return 0;
    reg.by_identity.borrow(identity).length()
}

public fun is_identity_claimed(reg: &Registry, identity: String): bool {
    reg.identity_claims.contains(identity)
}

public fun identity_claim_type(reg: &Registry, identity: String): u8 {
    *reg.identity_claims.borrow(identity)
}

// Returns @0x0 sentinel for an unclaimed alias so UI devInspect probes
// can read the lock without catching an abort.
public fun agent_alias_locked_to(reg: &Registry, alias: String): address {
    if (!reg.agent_wallet_locks.contains(alias)) return @0x0;
    *reg.agent_wallet_locks.borrow(alias)
}

public fun registry_admin(reg: &Registry): address { reg.admin }
public fun registry_resolver(reg: &Registry): address { reg.resolver }
public fun registry_treasury_addr(reg: &Registry): address { reg.treasury_addr }

public fun fee_for<T>(reg: &Registry): u64 {
    let type_bytes_ascii = type_name::with_defining_ids<T>().into_string();
    let type_bytes = *type_bytes_ascii.as_bytes();
    if (!reg.fees.contains(type_bytes)) return 0;
    *reg.fees.borrow(type_bytes)
}

public fun is_coin_accepted<T>(reg: &Registry): bool {
    let type_bytes_ascii = type_name::with_defining_ids<T>().into_string();
    let type_bytes = *type_bytes_ascii.as_bytes();
    reg.fees.contains(type_bytes)
}

public fun unlock_at_ms(p: &SealedPrediction): u64 { p.unlock_at_ms }
public fun sealed_at_ms(p: &SealedPrediction): u64 { p.sealed_at_ms }
public fun is_revealed(p: &SealedPrediction): bool { p.revealed }
public fun revealed_at_ms(p: &SealedPrediction): u64 { p.revealed_at_ms }
public fun publisher(p: &SealedPrediction): address { p.publisher }
public fun identity(p: &SealedPrediction): String { p.identity }
public fun entity_type(p: &SealedPrediction): u8 { p.entity_type }
public fun content_hash(p: &SealedPrediction): vector<u8> { p.content_hash }
public fun revealed_plaintext(p: &SealedPrediction): vector<u8> { p.revealed_plaintext }
public fun is_resolved(p: &SealedPrediction): bool { p.resolved }
public fun hit(p: &SealedPrediction): bool { p.hit }
public fun resolved_at_ms(p: &SealedPrediction): u64 { p.resolved_at_ms }
public fun reasoning_blob_id(p: &SealedPrediction): vector<u8> { p.reasoning_blob_id }
public fun resolver_of(p: &SealedPrediction): address { p.resolver }

// ---------- Public constants ----------

public fun entity_human(): u8 { ENTITY_HUMAN }
public fun entity_agent(): u8 { ENTITY_AGENT }

// ---------- Test helpers ----------

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(PREDICTION_VAULT {}, ctx)
}

#[test_only]
public fun seal_approve_for_testing(id: vector<u8>, c: &Clock) {
    assert!(check_unlock(id, c), ENoAccess)
}
