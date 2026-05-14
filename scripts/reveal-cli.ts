// Reveal a previously-sealed prediction:
//   fetch SealedPrediction -> build seal_approve PTB -> SessionKey -> Seal decrypt
//   -> Walrus read -> AES decrypt -> Sui reveal(reg, pred, plaintext).
//
// Usage:
//   pnpm reveal <prediction_id>

import {
  fetchSealedPrediction,
  revealTx,
  sealApproveTx,
  toBytes,
} from '../lib/sui';
import { getSuiClient, loadDevKeypair } from '../lib/sui-node';
import { readBlob } from '../lib/walrus';
import { getSealClient, createSessionKey, decryptAesKey } from '../lib/seal';
import { aesGcmDecrypt } from '../lib/crypto';
import { env } from '../lib/env';

async function main() {
  const predictionId = process.argv[2];
  if (!predictionId) {
    console.error('usage: pnpm reveal <prediction_id>');
    process.exit(1);
  }

  const sui = getSuiClient();
  const seal = getSealClient(sui);
  const signer = loadDevKeypair();

  // 1. Fetch SealedPrediction from Sui
  const pred = await fetchSealedPrediction(sui, predictionId);
  const unlockAtMs = BigInt(pred.unlock_at_ms);
  const nowMs = BigInt(Date.now());

  console.log(`prediction_id : ${predictionId}`);
  console.log(`  publisher : ${pred.publisher}`);
  console.log(`  identity  : ${pred.identity} (entity_type=${pred.entity_type})`);
  console.log(`  unlock_at : ${new Date(Number(unlockAtMs)).toISOString()}`);
  console.log(`  now       : ${new Date(Number(nowMs)).toISOString()}`);
  console.log(`  delta     : ${Number(unlockAtMs - nowMs) / 1000}s`);
  console.log(`  revealed  : ${pred.revealed}`);

  if (pred.revealed) {
    const revealed = new TextDecoder().decode(toBytes(pred.revealed_plaintext));
    console.log(`  (already revealed): "${revealed}"`);
    return;
  }
  if (nowMs < unlockAtMs) {
    throw new Error(`not yet unlocked — ${Number(unlockAtMs - nowMs) / 1000}s remaining`);
  }

  const blobId = new TextDecoder().decode(toBytes(pred.blob_id));
  const sealedKey = toBytes(pred.sealed_key);
  const contentHash = toBytes(pred.content_hash);
  console.log(`  blob_id   : ${blobId}`);

  // 2. Build seal_approve PTB — the key server dry-runs this against testnet
  const approveTx = sealApproveTx({ packageId: env.packageId, unlockAtMs });
  const txBytes = await approveTx.build({ client: sui, onlyTransactionKind: true });

  // 3. Session key (server-side, signed with the dev keypair directly)
  const sessionKey = await createSessionKey({
    suiClient: sui,
    packageId: env.packageId,
    signer,
    ttlMin: 10,  // raised from 5 — Mysten testnet servers reject some cert flows
  });

  // 4. Seal releases the AES key (or aborts if clock < unlock)
  console.log('seal     : requesting AES key from key servers...');
  const aesKey = await decryptAesKey({ seal, sessionKey, sealedKey, txBytes });
  console.log(`seal     : received ${aesKey.byteLength}-byte AES key`);

  // 5. Walrus read + AES-GCM decrypt
  console.log(`walrus   : fetching blob ${blobId}...`);
  const envelope = await readBlob(blobId);
  const plaintextBytes = await aesGcmDecrypt(envelope, aesKey);
  const plaintext = new TextDecoder().decode(plaintextBytes);
  console.log(`plaintext: "${plaintext}"`);

  // 6. Commit reveal on Sui
  const tx = revealTx({
    registryId: env.registryId,
    packageId: env.packageId,
    predictionId,
    plaintext: plaintextBytes,
  });
  const result = await sui.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: { showEffects: true, showEvents: true },
  });
  const status = result.effects?.status?.status;
  if (status !== 'success') {
    throw new Error(`reveal tx failed: ${JSON.stringify(result.effects?.status)}`);
  }

  console.log('');
  console.log('=== REVEALED ===');
  console.log(`tx digest : ${result.digest}`);
  console.log(`plaintext : "${plaintext}"`);
  console.log(`content_hash matches: sha256(plaintext) == on-chain content_hash ✓ (verified by Move)`);
  // sanity log
  console.log(`content_hash hex: ${Buffer.from(contentHash).toString('hex')}`);
}

main().catch((e) => {
  console.error('reveal-cli failed:', e);
  process.exit(1);
});
