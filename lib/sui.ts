// Sui client + keypair loading + Move call helpers for the CLI scripts.
// Uses the new @mysten/sui 2.x JSON-RPC client.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64 } from '@mysten/sui/utils';
import { env } from './env';

const CLOCK_ID = '0x6';

export type SuiClient = SuiJsonRpcClient;

export function getSuiClient(): SuiClient {
  return new SuiJsonRpcClient({
    url: env.suiRpc,
    network: env.suiNetwork as 'testnet' | 'mainnet' | 'devnet' | 'localnet',
  });
}

// Loads the same keypair that `sui client` uses from ~/.sui/sui_config/sui.keystore.
// Format: JSON array of base64 strings, each = [flag(1) || secret(32)] for ed25519 (flag=0x00).
export function loadDevKeypair(): Ed25519Keypair {
  const path = join(homedir(), '.sui/sui_config/sui.keystore');
  const keys = JSON.parse(readFileSync(path, 'utf-8')) as string[];
  if (!keys[0]) throw new Error(`keystore at ${path} is empty`);
  const raw = fromBase64(keys[0]);
  const secret = raw.byteLength === 33 ? raw.slice(1) : raw;
  if (secret.byteLength !== 32) {
    throw new Error(`unexpected ed25519 secret length: ${secret.byteLength}`);
  }
  return Ed25519Keypair.fromSecretKey(secret);
}

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
  const idBytes = Buffer.alloc(8);
  idBytes.writeBigUInt64LE(args.unlockAtMs);
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
// the field's annotation. Coerce both to Uint8Array.
export function toBytes(v: number[] | string | Uint8Array): Uint8Array {
  if (v instanceof Uint8Array) return v;
  if (Array.isArray(v)) return new Uint8Array(v);
  return new Uint8Array(Buffer.from(v, 'base64'));
}
