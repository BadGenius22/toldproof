// Seal SDK wrappers. Threshold 2-of-2 Mysten testnet committee per /sui-dev recipe.
// @mysten/seal 1.1.x takes packageId + id as hex strings (not Uint8Array).

import { SealClient, SessionKey } from '@mysten/seal';
import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { toHex } from '@mysten/sui/utils';
import { bcs } from '@mysten/sui/bcs';
import { env } from './env';
import type { SuiClient } from './sui';

function ensure0x(s: string): string {
  return s.startsWith('0x') ? s : `0x${s}`;
}

export function getSealClient(suiClient: SuiClient): SealClient {
  // 2-of-3 diverse committee per /sui-dev recipe. Drop empty entries so dev
  // can fall back to 2-of-2 by unsetting NEXT_PUBLIC_SEAL_KEY_SERVER_3.
  const serverConfigs = [
    { objectId: env.sealKeyServer1, weight: 1 },
    { objectId: env.sealKeyServer2, weight: 1 },
    { objectId: env.sealKeyServer3, weight: 1 },
  ].filter((s) => s.objectId);
  // verifyKeyServers: false skips an extra on-chain check that each configured
  // server object exists in the published key-server registry. We already trust
  // the operator set (Mysten + Ruby Nodes + a third operator) by hard-coding
  // their objectIds in NEXT_PUBLIC_SEAL_KEY_SERVER_*; the registry check would
  // just re-verify what env config already pins. Safe to skip in this trust
  // model; revisit if NEXT_PUBLIC_SEAL_KEY_SERVER_* ever becomes user-supplied.
  return new SealClient({
    suiClient,
    serverConfigs,
    verifyKeyServers: false,
  });
}

// Seal IBE identity (without pkg-id prefix; the key server prepends it).
// time-lock pattern: id = bcs::to_bytes(unlock_at_ms). Returned as hex string.
export function unlockMsToIdHex(unlockAtMs: bigint): string {
  const bytes = bcs.u64().serialize(unlockAtMs).toBytes();
  return ensure0x(toHex(bytes));
}

export async function encryptAesKey(args: {
  seal: SealClient;
  aesKey: Uint8Array;
  unlockAtMs: bigint;
  packageId: string;
}): Promise<Uint8Array> {
  const { encryptedObject } = await args.seal.encrypt({
    threshold: env.sealThreshold,
    packageId: ensure0x(args.packageId),
    id: unlockMsToIdHex(args.unlockAtMs),
    data: args.aesKey,
  });
  return encryptedObject;
}

// Server-side session key: pass the signer directly so SessionKey auto-signs
// the personal-message challenge inside getCertificate(). The manual
// setPersonalMessageSignature() path triggers an internal
// verifyPersonalMessageSignature call that we've observed failing intermittently
// (server then rejects with "Invalid certificate time or ttl" — misleading).
// Auto-sign skips that verification entirely.
export async function createSessionKey(args: {
  suiClient: SuiClient;
  packageId: string;
  signer: Ed25519Keypair;
  ttlMin?: number;
}): Promise<SessionKey> {
  return await SessionKey.create({
    address: args.signer.getPublicKey().toSuiAddress(),
    packageId: ensure0x(args.packageId),
    ttlMin: args.ttlMin ?? 10,
    signer: args.signer,
    suiClient: args.suiClient,
  });
}

export async function decryptAesKey(args: {
  seal: SealClient;
  sessionKey: SessionKey;
  sealedKey: Uint8Array;
  txBytes: Uint8Array;
}): Promise<Uint8Array> {
  return await args.seal.decrypt({
    data: args.sealedKey,
    sessionKey: args.sessionKey,
    txBytes: args.txBytes,
  });
}
