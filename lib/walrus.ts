// Walrus storage wrapper via the public testnet HTTP publisher/aggregator.
// No WAL token required — the publisher pays storage fees on the user's behalf.
// For production: run your own publisher or use a managed provider (per /sui-dev ref 09).

import { env } from './env';

// Walrus epoch is ~1 day on testnet, ~14 days on mainnet (per /sui-dev ref 09).
// Per `walrus info`, max_epochs_ahead = 53 across networks. Testnet is the active
// target, so we compute against 1-day epochs.
const TESTNET_EPOCH_MS = 86_400_000; // 1 day
export const WALRUS_MAX_EPOCHS = 53;
const BUFFER_EPOCHS = 7; // safety margin so the blob outlives unlock time

/**
 * Compute Walrus `epochs` for a prediction unlocking at `unlockAtMs`.
 * Throws if the requested span exceeds Walrus's hard limit (~53 days on testnet).
 */
export function epochsForUnlock(unlockAtMs: number, now: number = Date.now()): number {
  const msAhead = unlockAtMs - now;
  if (msAhead <= 0) {
    throw new Error('Unlock must be in the future before computing storage epochs');
  }
  const needed = Math.ceil(msAhead / TESTNET_EPOCH_MS) + BUFFER_EPOCHS;
  if (needed > WALRUS_MAX_EPOCHS) {
    const maxDays = WALRUS_MAX_EPOCHS - BUFFER_EPOCHS;
    throw new Error(
      `Unlock is too far out for Walrus testnet (max ${maxDays} days). ` +
        `Pick a closer unlock, or wait for mainnet (~2 year horizon).`,
    );
  }
  // Floor at a reasonable minimum so very-short-unlock predictions still have headroom.
  return Math.max(needed, 10);
}

type PublishResponse =
  | { newlyCreated: { blobObject: { blobId: string; [k: string]: unknown } } }
  | { alreadyCertified: { blobId: string; [k: string]: unknown } };

export async function storeBlob(
  bytes: Uint8Array,
  epochs: number,
): Promise<{ blobId: string }> {
  const url = `${env.walrusPublisher}/v1/blobs?epochs=${epochs}`;
  const res = await fetch(url, {
    method: 'PUT',
    body: bytes as BodyInit,
  });
  if (!res.ok) {
    throw new Error(`Walrus publish failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as PublishResponse;
  const blobId =
    'newlyCreated' in data
      ? data.newlyCreated.blobObject.blobId
      : data.alreadyCertified.blobId;
  if (!blobId) {
    throw new Error(`Walrus publish: unexpected response shape: ${JSON.stringify(data)}`);
  }
  return { blobId };
}

export async function readBlob(blobId: string): Promise<Uint8Array> {
  const url = `${env.walrusAggregator}/v1/blobs/${blobId}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Walrus read failed (${res.status}) for blob ${blobId}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}
