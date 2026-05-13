// Shared reveal logic — used by scripts/reveal-cli.ts (Node CLI) and
// app/api/cron/reveal/route.ts (Vercel cron). Pure function: callers pass in
// pre-constructed clients + signer, we orchestrate the decrypt + Move call.

import type { SealClient } from '@mysten/seal';
import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { env } from './env';
import { aesGcmDecrypt } from './crypto';
import { readBlob } from './walrus';
import { createSessionKey, decryptAesKey } from './seal';
import {
  revealTx,
  sealApproveTx,
  toBytes,
  fetchSealedPrediction,
  type SuiClient,
} from './sui';

export interface RevealResult {
  predictionId: string;
  digest: string;
  plaintext: string;
}

// Reveal a single prediction. Assumes clock >= unlock_at_ms and !already_revealed
// — checks are also enforced by the Move side, so a stale call aborts cleanly.
export async function revealOnce(opts: {
  suiClient: SuiClient;
  sealClient: SealClient;
  signer: Ed25519Keypair;
  predictionId: string;
}): Promise<RevealResult> {
  const { suiClient, sealClient, signer, predictionId } = opts;

  // 1. Re-fetch on the way in so stale callers don't try to reveal already-revealed
  //    predictions (would just abort with EAlreadyRevealed, but cleaner to short-circuit).
  const pred = await fetchSealedPrediction(suiClient, predictionId);
  if (pred.revealed) {
    throw new Error(`prediction ${predictionId} is already revealed`);
  }
  const unlockAtMs = BigInt(pred.unlock_at_ms);
  if (BigInt(Date.now()) < unlockAtMs) {
    throw new Error(`prediction ${predictionId} not yet unlocked`);
  }

  const blobId = new TextDecoder().decode(toBytes(pred.blob_id));
  const sealedKey = toBytes(pred.sealed_key);

  // 2. Build seal_approve PTB — Seal key servers dry-run this on testnet
  const approveTx = sealApproveTx({ packageId: env.packageId, unlockAtMs });
  const txBytes = await approveTx.build({ client: suiClient, onlyTransactionKind: true });

  // 3. Session key signed by the cron/CLI keypair (no wallet popup)
  const sessionKey = await createSessionKey({
    suiClient,
    packageId: env.packageId,
    signer,
    ttlMin: 5,
  });

  // 4. Seal releases AES key (refuses if clock < unlock — won't happen here, but
  //    Move-level enforcement is still in effect)
  const aesKey = await decryptAesKey({ seal: sealClient, sessionKey, sealedKey, txBytes });

  // 5. Walrus read + AES-GCM decrypt
  const envelope = await readBlob(blobId);
  const plaintextBytes = await aesGcmDecrypt(envelope, aesKey);
  const plaintext = new TextDecoder().decode(plaintextBytes);

  // 6. Commit reveal on Sui — Move verifies content_hash and aborts on mismatch
  const tx = revealTx({
    registryId: env.registryId,
    packageId: env.packageId,
    predictionId,
    plaintext: plaintextBytes,
  });
  const result = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: { showEffects: true },
  });

  const status = result.effects?.status?.status;
  if (status !== 'success') {
    throw new Error(`reveal tx failed: ${JSON.stringify(result.effects?.status)}`);
  }

  return { predictionId, digest: result.digest, plaintext };
}
