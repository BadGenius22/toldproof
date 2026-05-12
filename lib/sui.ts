// Universal Sui helpers — safe for both browser and Node.
// Server-only helpers (keypair loading, JSON-RPC client construction) live in
// lib/sui-node.ts so the browser bundle doesn't pull in node:fs.

import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { Transaction } from '@mysten/sui/transactions';

export const CLOCK_ID = '0x6';

// Both the Node `getSuiClient()` and the dapp-kit `useCurrentClient()` return
// instances assignable to this type.
export type SuiClient = SuiJsonRpcClient;

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

// Build a PTB that calls seal_approve(id = bcs(unlock_ms), clock).
// Used to obtain `txBytes` for SealClient.decrypt — the key server dry-runs this
// to validate the time-lock policy before releasing the AES key.
export function sealApproveTx(args: {
  packageId: string;
  unlockAtMs: bigint;
}): Transaction {
  const tx = new Transaction();
  // BCS u64 = little-endian 8 bytes. Avoid Node Buffer for browser compat.
  const idBytes = new Uint8Array(8);
  const view = new DataView(idBytes.buffer);
  view.setBigUint64(0, args.unlockAtMs, true);
  tx.moveCall({
    target: `${args.packageId}::prediction_vault::seal_approve`,
    arguments: [
      tx.pure.vector('u8', Array.from(idBytes)),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

export interface SealedPredictionFields {
  publisher: string;
  x_handle: string;
  sealed_at_ms: string;
  unlock_at_ms: string;
  content_hash: number[] | string;
  blob_id: number[] | string;
  sealed_key: number[] | string;
  revealed: boolean;
  revealed_at_ms: string;
  revealed_plaintext: number[] | string;
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
