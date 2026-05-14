// On-chain Registry queries — direct reads, no Postgres dependency.
// Used by /[identity] profile page, /verify/[id], the leaderboard, and the agent crons.

import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { env } from './env';
import {
  fetchSealedPrediction,
  type SealedPredictionFields,
  type SuiClient,
  toBytes,
  ENTITY_HUMAN,
  ENTITY_AGENT,
  type EntityType,
} from './sui';

export interface PredictionView {
  id: string;
  publisher: string;
  // identity = x_handle for humans, agent alias for agents. Use entityType to disambiguate.
  identity: string;
  entityType: EntityType;
  sealedAtMs: number;
  unlockAtMs: number;
  revealed: boolean;
  revealedAtMs: number;
  revealedPlaintext: string;
  blobId: string;
  contentHashHex: string;
  // Resolution Agent attestation. `resolved=false` on revealed-but-unresolved
  // predictions the agent hasn't gotten to yet.
  resolved: boolean;
  hit: boolean;
  resolvedAtMs: number;
  reasoningBlobId: string;
  resolver: string;
}

// Convenience predicate — true if this prediction was sealed by an AI agent.
export function isAgentPrediction(p: PredictionView): boolean {
  return p.entityType === ENTITY_AGENT;
}

export function getSuiClientForReads(): SuiClient {
  return new SuiJsonRpcClient({
    url: env.suiRpc,
    network: env.suiNetwork as 'testnet' | 'mainnet' | 'devnet' | 'localnet',
  });
}

// Fetch the Registry, return the inner Table object id for `by_identity`.
// (v1 called this `by_handle` — the helper name kept its old shape for
// minimal call-site churn, but the field on Move side is now by_identity.)
export async function getByIdentityTableId(client: SuiClient): Promise<string> {
  const res = await client.getObject({
    id: env.registryId,
    options: { showContent: true },
  });
  const content = res.data?.content;
  if (!content || content.dataType !== 'moveObject') {
    throw new Error(`Registry ${env.registryId} not found or not a Move object`);
  }
  type RegistryShape = {
    by_identity: { fields: { id: { id: string }; size: string } };
    total_count: string;
    version: string;
  };
  const fields = content.fields as unknown as RegistryShape;
  return fields.by_identity.fields.id.id;
}

// Back-compat alias for callers still using the old name.
export const getByHandleTableId = getByIdentityTableId;

export async function getPredictionIdsForIdentity(
  client: SuiClient,
  identity: string,
): Promise<string[]> {
  const tableId = await getByIdentityTableId(client);
  let res;
  try {
    res = await client.getDynamicFieldObject({
      parentId: tableId,
      name: { type: '0x1::string::String', value: identity },
    });
  } catch {
    return [];
  }
  const content = res.data?.content;
  if (!content || content.dataType !== 'moveObject') return [];
  const fields = content.fields as unknown as { value: string[] };
  return fields.value ?? [];
}

// Back-compat alias.
export const getPredictionIdsForHandle = getPredictionIdsForIdentity;

function coerceEntityType(v: number | undefined): EntityType {
  return v === ENTITY_AGENT ? ENTITY_AGENT : ENTITY_HUMAN;
}

function parsePrediction(id: string, fields: SealedPredictionFields): PredictionView {
  const blobBytes = toBytes(fields.blob_id);
  const ch = toBytes(fields.content_hash);
  const plain = toBytes(fields.revealed_plaintext);
  const resolved = fields.resolved === true;
  const reasoningBlob = fields.reasoning_blob_id
    ? new TextDecoder().decode(toBytes(fields.reasoning_blob_id))
    : '';
  return {
    id,
    publisher: fields.publisher,
    identity: fields.identity,
    entityType: coerceEntityType(fields.entity_type),
    sealedAtMs: Number(fields.sealed_at_ms),
    unlockAtMs: Number(fields.unlock_at_ms),
    revealed: fields.revealed,
    revealedAtMs: Number(fields.revealed_at_ms),
    revealedPlaintext: fields.revealed ? new TextDecoder().decode(plain) : '',
    blobId: new TextDecoder().decode(blobBytes),
    contentHashHex: Array.from(ch)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
    resolved,
    hit: fields.hit === true,
    resolvedAtMs: Number(fields.resolved_at_ms ?? '0'),
    reasoningBlobId: reasoningBlob,
    resolver: fields.resolver ?? '',
  };
}

export async function getPredictionsForIdentity(
  client: SuiClient,
  identity: string,
): Promise<PredictionView[]> {
  const ids = await getPredictionIdsForIdentity(client, identity);
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
  out.sort((a, b) => b.sealedAtMs - a.sealedAtMs);
  return out;
}

// Back-compat alias.
export const getPredictionsForHandle = getPredictionsForIdentity;

// Page through every dynamic-field entry on the Registry's by_identity table.
// Returns the lowercased identity keys (X handles + agent aliases mixed).
// Used by the leaderboard + cron scanners.
export async function listAllIdentities(client: SuiClient): Promise<string[]> {
  const tableId = await getByIdentityTableId(client);
  const out: string[] = [];
  let cursor: string | null | undefined = null;
  do {
    const page = await client.getDynamicFields({
      parentId: tableId,
      cursor: cursor ?? undefined,
    });
    for (const entry of page.data) {
      const value = (entry as unknown as { name: { value: unknown } }).name.value;
      if (typeof value === 'string') out.push(value);
    }
    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);
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
