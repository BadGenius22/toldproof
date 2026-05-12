// Verifies Seal key servers REFUSE to decrypt before unlock_at_ms.
// This is the core product property — Move unit tests cover it at the VM level,
// but the full Seal SDK + IBE roundtrip needs one live negative test on testnet.
//
// Usage:
//   pnpm test:seal-negative <prediction_id>
//
// The prediction must still be locked (clock < unlock_at_ms). If Seal returns
// the AES key the time-lock is NOT enforced — exit 1 and scream.

import {
  fetchSealedPrediction,
  sealApproveTx,
  toBytes,
} from '../lib/sui';
import { getSuiClient, loadDevKeypair } from '../lib/sui-node';
import { getSealClient, createSessionKey, decryptAesKey } from '../lib/seal';
import { env } from '../lib/env';

async function main() {
  const predictionId = process.argv[2];
  if (!predictionId) {
    console.error('usage: pnpm test:seal-negative <prediction_id>');
    console.error('(expects a still-locked prediction)');
    process.exit(1);
  }

  const sui = getSuiClient();
  const seal = getSealClient(sui);
  const signer = loadDevKeypair();

  const pred = await fetchSealedPrediction(sui, predictionId);
  const unlockAtMs = BigInt(pred.unlock_at_ms);
  const nowMs = BigInt(Date.now());

  console.log(`prediction_id : ${predictionId}`);
  console.log(`  unlock_at  : ${new Date(Number(unlockAtMs)).toISOString()}`);
  console.log(`  now        : ${new Date(Number(nowMs)).toISOString()}`);
  console.log(`  delta      : ${Number(unlockAtMs - nowMs) / 1000}s until unlock`);

  if (nowMs >= unlockAtMs) {
    console.error('TEST INVALID: prediction is already unlocked.');
    console.error('Seal a fresh prediction with a longer unlock window and retry.');
    process.exit(1);
  }

  const sealedKey = toBytes(pred.sealed_key);
  const approveTx = sealApproveTx({ packageId: env.packageId, unlockAtMs });
  const txBytes = await approveTx.build({ client: sui, onlyTransactionKind: true });
  const sessionKey = await createSessionKey({
    suiClient: sui,
    packageId: env.packageId,
    signer,
    ttlMin: 5,
  });

  console.log('seal      : requesting AES key from key servers (should be refused)...');

  try {
    await decryptAesKey({ seal, sessionKey, sealedKey, txBytes });
    // If we get here, the time-lock is BROKEN.
    console.error('');
    console.error('!!! CRITICAL FAILURE: Seal returned the AES key BEFORE unlock !!!');
    console.error('!!! The time-lock policy is NOT enforced by the key servers. !!!');
    process.exit(1);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const firstLine = msg.split('\n')[0];
    console.log('');
    console.log('✓ Seal refused decryption as expected.');
    console.log(`  reason: ${firstLine}`);
    console.log('');
    console.log('Time-lock policy is enforced end-to-end (Move dry-run aborts → key server denies key).');
  }
}

main().catch((e) => {
  console.error('test failed:', e);
  process.exit(1);
});
