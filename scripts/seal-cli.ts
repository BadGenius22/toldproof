// Seal a prediction end-to-end:
//   AES-encrypt plaintext (random K) -> Walrus upload (testnet HTTP publisher)
//   -> Seal-encrypt K (id = bcs(unlock_ms)) -> Sui seal_prediction(reg, ...).
//
// Usage:
//   pnpm seal "<prediction text>" [unlock_seconds_from_now=60] [x_handle=cli]

import { sealPredictionTx } from '../lib/sui';
import { getSuiClient, loadDevKeypair } from '../lib/sui-node';
import { storeBlob } from '../lib/walrus';
import { getSealClient, encryptAesKey } from '../lib/seal';
import { aesGcmEncrypt, randomAesKey, sha256 } from '../lib/crypto';
import { env } from '../lib/env';

async function main() {
  const [text, unlockSecStr, xHandleArg] = process.argv.slice(2);
  if (!text) {
    console.error('usage: pnpm seal "<prediction text>" [unlock_seconds_from_now=60] [x_handle=cli]');
    process.exit(1);
  }
  const unlockSec = Number(unlockSecStr ?? 60);
  const unlockAtMs = BigInt(Date.now() + unlockSec * 1000);
  const xHandle = xHandleArg ?? 'cli';

  const sui = getSuiClient();
  const seal = getSealClient(sui);
  const signer = loadDevKeypair();
  const address = signer.getPublicKey().toSuiAddress();

  console.log(`signer   : ${address}`);
  console.log(`x_handle : ${xHandle}`);
  console.log(`unlock   : ${new Date(Number(unlockAtMs)).toISOString()} (in ${unlockSec}s)`);

  // 1. AES envelope: random key + GCM encrypt
  const plaintext = new TextEncoder().encode(text);
  const aesKey = randomAesKey();
  const ciphertext = await aesGcmEncrypt(plaintext, aesKey);

  // 2. Walrus stores the AES ciphertext (HTTP publisher, no WAL needed)
  console.log(`walrus   : uploading ${ciphertext.byteLength}-byte envelope...`);
  const { blobId } = await storeBlob(ciphertext, 30);
  console.log(`walrus   : blob_id=${blobId}`);

  // 3. Seal encrypts ONLY the 32-byte AES key, gated by unlock_at_ms
  const sealedKey = await encryptAesKey({ seal, aesKey, unlockAtMs, packageId: env.packageId });
  console.log(`seal     : sealed_key=${sealedKey.byteLength} bytes`);

  // 4. Content hash (SHA-256) for reveal-time verification
  const contentHash = await sha256(plaintext);

  // 5. Sui Move call: prediction_vault::seal_prediction
  const tx = sealPredictionTx({
    registryId: env.registryId,
    packageId: env.packageId,
    xHandle,
    unlockAtMs,
    contentHash,
    blobIdBytes: new TextEncoder().encode(blobId),
    sealedKey,
  });

  const result = await sui.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: { showEffects: true, showObjectChanges: true },
  });

  const status = result.effects?.status?.status;
  if (status !== 'success') {
    throw new Error(`seal_prediction tx failed: ${JSON.stringify(result.effects?.status)}`);
  }

  const created = result.objectChanges?.find(
    (c: { type: string; objectType?: string }) =>
      c.type === 'created' &&
      'objectType' in c &&
      typeof c.objectType === 'string' &&
      c.objectType.endsWith('::prediction_vault::SealedPrediction'),
  );
  if (!created || created.type !== 'created') {
    throw new Error('seal_prediction succeeded but no SealedPrediction was created');
  }

  console.log('');
  console.log('=== SEALED ===');
  console.log(`prediction_id : ${created.objectId}`);
  console.log(`blob_id       : ${blobId}`);
  console.log(`unlock_at_ms  : ${unlockAtMs}`);
  console.log(`x_handle      : ${xHandle}`);
  console.log(`tx digest     : ${result.digest}`);
  console.log('');
  console.log(`To reveal after unlock: pnpm reveal ${created.objectId}`);
}

main().catch((e) => {
  console.error('seal-cli failed:', e);
  process.exit(1);
});
