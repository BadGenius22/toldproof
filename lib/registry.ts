// On-chain Registry queries — direct reads, no Postgres dependency.
// Used by the public profile page (`/[handle]`) and by any future indexer.

import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { env } from './env';
import {
  fetchSealedPrediction,
  type SealedPredictionFields,
  type SuiClient,
  toBytes,
} from './sui';

export interface PredictionView {
  id: string;
  publisher: string;
  xHandle: string;
  sealedAtMs: number;
  unlockAtMs: number;
  revealed: boolean;
  revealedAtMs: number;
  revealedPlaintext: string;
  blobId: string;
  contentHashHex: string;
}

export function getSuiClientForReads(): SuiClient {
  return new SuiJsonRpcClient({
    url: env.suiRpc,
    network: env.suiNetwork as 'testnet' | 'mainnet' | 'devnet' | 'localnet',
  });
}

// Fetch the Registry, return the inner Table object id (`by_handle.fields.id.id`).
// The Sui RPC formats the Table struct as `{ fields: { id: { id }, size } }`.
export async function getByHandleTableId(client: SuiClient): Promise<string> {
  const res = await client.getObject({
    id: env.registryId,
    options: { showContent: true },
  });
  const content = res.data?.content;
  if (!content || content.dataType !== 'moveObject') {
    throw new Error(`Registry ${env.registryId} not found or not a Move object`);
  }
  // Type assertion: we know the shape from prediction_vault::Registry.
  type RegistryShape = {
    by_handle: { fields: { id: { id: string }; size: string } };
    total_count: string;
    version: string;
  };
  const fields = content.fields as unknown as RegistryShape;
  return fields.by_handle.fields.id.id;
}

export async function getPredictionIdsForHandle(
  client: SuiClient,
  handle: string,
): Promise<string[]> {
  const byHandleId = await getByHandleTableId(client);
  let res;
  try {
    res = await client.getDynamicFieldObject({
      parentId: byHandleId,
      name: { type: '0x1::string::String', value: handle },
    });
  } catch {
    return [];
  }
  const content = res.data?.content;
  if (!content || content.dataType !== 'moveObject') return [];
  // Field<String, vector<ID>> → fields: { id, name, value: string[] }
  const fields = content.fields as unknown as { value: string[] };
  return fields.value ?? [];
}

function parsePrediction(id: string, fields: SealedPredictionFields): PredictionView {
  const blobBytes = toBytes(fields.blob_id);
  const ch = toBytes(fields.content_hash);
  const plain = toBytes(fields.revealed_plaintext);
  return {
    id,
    publisher: fields.publisher,
    xHandle: fields.x_handle,
    sealedAtMs: Number(fields.sealed_at_ms),
    unlockAtMs: Number(fields.unlock_at_ms),
    revealed: fields.revealed,
    revealedAtMs: Number(fields.revealed_at_ms),
    revealedPlaintext: fields.revealed ? new TextDecoder().decode(plain) : '',
    blobId: new TextDecoder().decode(blobBytes),
    contentHashHex: Array.from(ch)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
  };
}

export async function getPredictionsForHandle(
  client: SuiClient,
  handle: string,
): Promise<PredictionView[]> {
  const ids = await getPredictionIdsForHandle(client, handle);
  if (ids.length === 0) return [];
  const res = await client.multiGetObjects({
    ids,
    options: { showContent: true },
  });
  const out: PredictionView[] = [];
  for (let i = 0; i < res.length; i += 1) {
    const obj = res[i];
    const content = obj?.data?.content;
    if (!content || content.dataType !== 'moveObject') continue;
    out.push(parsePrediction(ids[i]!, content.fields as unknown as SealedPredictionFields));
  }
  // Newest-sealed first
  out.sort((a, b) => b.sealedAtMs - a.sealedAtMs);
  return out;
}

export async function getPredictionView(
  client: SuiClient,
  predictionId: string,
): Promise<PredictionView | null> {
  try {
    const fields = await fetchSealedPrediction(client, predictionId);
    return parsePrediction(predictionId, fields);
  } catch {
    return null;
  }
}
