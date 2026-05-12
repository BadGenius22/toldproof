// Walrus storage wrapper via the public testnet HTTP publisher/aggregator.
// No WAL token required — the publisher pays storage fees on the user's behalf.
// For production: run your own publisher or use a managed provider (per /sui-dev ref 09).

import { env } from './env';

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
