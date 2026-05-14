// Universal Sui helpers — safe for both browser and Node.
// Server-only helpers (keypair loading, JSON-RPC client construction) live in
// lib/sui-node.ts so the browser bundle doesn't pull in node:fs.

import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { Transaction } from '@mysten/sui/transactions';

export const CLOCK_ID = '0x6';

// Coin types accepted by the Registry's `seal_prediction_as_agent<T>` entry.
// SUI is always-on; USDC ships in the same deploy script via set_fee<USDC>().
// Add more coin types here as they're enabled.
export const SUI_TYPE = '0x2::sui::SUI';
export const USDC_TESTNET_TYPE =
  '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC';

// Both the Node `getSuiClient()` and the dapp-kit `useCurrentClient()` return
// instances assignable to this type.
export type SuiClient = SuiJsonRpcClient;

// ---------- Entity types ----------

export const ENTITY_HUMAN: number = 0;
export const ENTITY_AGENT: number = 1;
export type EntityType = typeof ENTITY_HUMAN | typeof ENTITY_AGENT;

// Default agent alias for wallets that don't register a custom name.
// Stays stable for a given wallet → easy to look up on /[alias].
export function defaultAgentAlias(walletAddress: string): string {
  const short = walletAddress.replace(/^0x/, '').slice(0, 8).toLowerCase();
  return `agent-${short}`;
}

// ---------- Seal entries ----------

// Free path — humans seal under their X handle.
export function sealPredictionTx(args: {
  registryId: string;
  packageId: string;
  xHandle: string;
  unlockAtMs: bigint;
  contentHash: Uint8Array;
  blobIdBytes: Uint8Array;
  sealedKey: Uint8Array;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${args.packageId}::prediction_vault::seal_prediction`,
    arguments: [
      tx.object(args.registryId),
      tx.pure.string(args.xHandle),
      tx.pure.u64(args.unlockAtMs),
      tx.pure.vector('u8', Array.from(args.contentHash)),
      tx.pure.vector('u8', Array.from(args.blobIdBytes)),
      tx.pure.vector('u8', Array.from(args.sealedKey)),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

// Paid path — AI agents seal under an alias, paying a fee in `feeCoinType`.
//
// For SUI: omit `feeSourceCoinId` and we'll split the fee from gas (recommended).
// For USDC (or any non-SUI coin): the agent must own a coin object of type
// `feeCoinType` with at least `feeAmount` balance — pass its objectId as
// `feeSourceCoinId` and we'll split exact-amount from it.
//
// The `feeAmount` is in the coin's smallest unit:
//   SUI:  100_000_000n MIST          ≈ $0.20 at ~$2/SUI
//   USDC: 200_000n     microUSDC     = $0.20 exact (USDC has 6 decimals)
export function sealPredictionAsAgentTx(args: {
  registryId: string;
  packageId: string;
  agentAlias: string;
  unlockAtMs: bigint;
  contentHash: Uint8Array;
  blobIdBytes: Uint8Array;
  sealedKey: Uint8Array;
  feeCoinType: string;
  feeAmount: bigint;
  feeSourceCoinId?: string;
}): Transaction {
  const tx = new Transaction();

  const feeSource = args.feeSourceCoinId ? tx.object(args.feeSourceCoinId) : tx.gas;
  const [feeCoin] = tx.splitCoins(feeSource, [tx.pure.u64(args.feeAmount)]);

  tx.moveCall({
    target: `${args.packageId}::prediction_vault::seal_prediction_as_agent`,
    typeArguments: [args.feeCoinType],
    arguments: [
      tx.object(args.registryId),
      tx.pure.string(args.agentAlias),
      tx.pure.u64(args.unlockAtMs),
      tx.pure.vector('u8', Array.from(args.contentHash)),
      tx.pure.vector('u8', Array.from(args.blobIdBytes)),
      tx.pure.vector('u8', Array.from(args.sealedKey)),
      feeCoin,
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

// ---------- Reveal + resolve ----------

export function revealTx(args: {
  registryId: string;
  packageId: string;
  predictionId: string;
  plaintext: Uint8Array;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${args.packageId}::prediction_vault::reveal`,
    arguments: [
      tx.object(args.registryId),
      tx.object(args.predictionId),
      tx.pure.vector('u8', Array.from(args.plaintext)),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

// Reputation Agent publishes an updated profile blob. Only the resolver
// address can call. Profile JSON lives on Walrus at `profileBlobId`; the
// emitted event lets indexers + the UI find the latest version per identity.
export function publishReputationProfileTx(args: {
  registryId: string;
  packageId: string;
  identity: string;
  profileBlobIdBytes: Uint8Array;
  previousBlobIdBytes: Uint8Array; // empty for v1
  version: bigint;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${args.packageId}::prediction_vault::publish_reputation_profile`,
    arguments: [
      tx.object(args.registryId),
      tx.pure.string(args.identity),
      tx.pure.vector('u8', Array.from(args.profileBlobIdBytes)),
      tx.pure.vector('u8', Array.from(args.previousBlobIdBytes)),
      tx.pure.u64(args.version),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

// AI agent attests outcome. Reasoning trace stored on Walrus; only the address
// registered as `Registry.resolver` can call.
export function resolvePredictionTx(args: {
  registryId: string;
  packageId: string;
  predictionId: string;
  hit: boolean;
  reasoningBlobIdBytes: Uint8Array;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${args.packageId}::prediction_vault::resolve`,
    arguments: [
      tx.object(args.registryId),
      tx.object(args.predictionId),
      tx.pure.bool(args.hit),
      tx.pure.vector('u8', Array.from(args.reasoningBlobIdBytes)),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

// ---------- Admin entries (gated to Registry.admin) ----------

export function setAdminTx(args: {
  registryId: string;
  packageId: string;
  newAdminAddr: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${args.packageId}::prediction_vault::set_admin`,
    arguments: [tx.object(args.registryId), tx.pure.address(args.newAdminAddr)],
  });
  return tx;
}

export function setResolverTx(args: {
  registryId: string;
  packageId: string;
  newResolverAddr: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${args.packageId}::prediction_vault::set_resolver`,
    arguments: [tx.object(args.registryId), tx.pure.address(args.newResolverAddr)],
  });
  return tx;
}

export function setTreasuryAddrTx(args: {
  registryId: string;
  packageId: string;
  newTreasuryAddr: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${args.packageId}::prediction_vault::set_treasury_addr`,
    arguments: [tx.object(args.registryId), tx.pure.address(args.newTreasuryAddr)],
  });
  return tx;
}

// Set the fee for coin type `T` (or update an existing fee). Pass `feeAmount = 0n`
// only for testing/promotional cases — production should always require >= cost.
export function setFeeTx(args: {
  registryId: string;
  packageId: string;
  coinType: string;
  feeAmount: bigint;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${args.packageId}::prediction_vault::set_fee`,
    typeArguments: [args.coinType],
    arguments: [tx.object(args.registryId), tx.pure.u64(args.feeAmount)],
  });
  return tx;
}

// ---------- Seal access policy ----------

export function sealApproveTx(args: {
  packageId: string;
  unlockAtMs: bigint;
}): Transaction {
  const tx = new Transaction();
  const idBytes = new Uint8Array(8);
  const view = new DataView(idBytes.buffer);
  view.setBigUint64(0, args.unlockAtMs, true);
  tx.moveCall({
    target: `${args.packageId}::prediction_vault::seal_approve`,
    arguments: [tx.pure.vector('u8', Array.from(idBytes)), tx.object(CLOCK_ID)],
  });
  return tx;
}

// ---------- On-chain field shape ----------

export interface SealedPredictionFields {
  publisher: string;
  identity: string;
  entity_type: number;
  sealed_at_ms: string;
  unlock_at_ms: string;
  content_hash: number[] | string;
  blob_id: number[] | string;
  sealed_key: number[] | string;
  revealed: boolean;
  revealed_at_ms: string;
  revealed_plaintext: number[] | string;
  // Resolution Agent attestation
  resolved?: boolean;
  hit?: boolean;
  resolved_at_ms?: string;
  reasoning_blob_id?: number[] | string;
  resolver?: string;
}

export async function fetchSealedPrediction(
  client: SuiClient,
  predictionId: string,
): Promise<SealedPredictionFields> {
  const res = await client.getObject({
    id: predictionId,
    options: { showContent: true },
  });
  const content = res.data?.content;
  if (!content || content.dataType !== 'moveObject') {
    throw new Error(`prediction ${predictionId} not found or not a Move object`);
  }
  return content.fields as unknown as SealedPredictionFields;
}

// Sui RPC returns vector<u8> either as base64 string or as number[] depending on
// the field's annotation. Coerce both to Uint8Array (browser-safe).
export function toBytes(v: number[] | string | Uint8Array): Uint8Array {
  if (v instanceof Uint8Array) return v;
  if (Array.isArray(v)) return new Uint8Array(v);
  // base64 string fallback
  if (typeof atob === 'function') {
    const binary = atob(v);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  }
  // Node fallback (CLI scripts)
  return new Uint8Array(Buffer.from(v, 'base64'));
}
