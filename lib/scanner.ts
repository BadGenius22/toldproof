// Scanner: find predictions that are unlocked but not yet revealed.
// Iterates the Registry's `by_handle` Table dynamic fields, fetches all
// SealedPrediction objects, filters revealed=false AND unlock_at_ms <= now.

import { getByIdentityTableId } from './registry';
import type { SuiClient } from './sui';
import { fetchSealedPrediction } from './sui';

export interface DuePrediction {
  id: string;
  identity: string;
  entityType: number;
  unlockAtMs: number;
  sealedAtMs: number;
}

interface DynamicFieldEntry {
  name: { type: string; value: unknown };
  objectId: string;
}

// Paginate getDynamicFields until we've collected every handle.
async function listAllHandleEntries(
  client: SuiClient,
  byHandleId: string,
): Promise<DynamicFieldEntry[]> {
  const all: DynamicFieldEntry[] = [];
  let cursor: string | null | undefined = null;
  do {
    const page = await client.getDynamicFields({
      parentId: byHandleId,
      cursor: cursor ?? undefined,
    });
    all.push(...(page.data as unknown as DynamicFieldEntry[]));
    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);
  return all;
}

async function getPredictionIdsFromDynamicField(
  client: SuiClient,
  dfObjectId: string,
): Promise<string[]> {
  const res = await client.getObject({ id: dfObjectId, options: { showContent: true } });
  const content = res.data?.content;
  if (!content || content.dataType !== 'moveObject') return [];
  const fields = content.fields as unknown as { value: string[] };
  return fields.value ?? [];
}

export async function findDueForReveal(client: SuiClient): Promise<{
  totalHandles: number;
  totalChecked: number;
  due: DuePrediction[];
}> {
  const tableId = await getByIdentityTableId(client);
  const handles = await listAllHandleEntries(client, tableId);

  const idSet = new Set<string>();
  for (const h of handles) {
    const ids = await getPredictionIdsFromDynamicField(client, h.objectId);
    for (const id of ids) idSet.add(id);
  }
  const allIds = Array.from(idSet);

  const now = Date.now();
  const due: DuePrediction[] = [];
  const CHUNK = 25;
  for (let i = 0; i < allIds.length; i += CHUNK) {
    const slice = allIds.slice(i, i + CHUNK);
    const objs = await client.multiGetObjects({
      ids: slice,
      options: { showContent: true },
    });
    for (let j = 0; j < objs.length; j += 1) {
      const obj = objs[j];
      const content = obj?.data?.content;
      if (!content || content.dataType !== 'moveObject') continue;
      const fields = content.fields as unknown as {
        identity: string;
        entity_type: number;
        sealed_at_ms: string;
        unlock_at_ms: string;
        revealed: boolean;
      };
      if (fields.revealed) continue;
      const unlockAtMs = Number(fields.unlock_at_ms);
      if (unlockAtMs > now) continue;
      due.push({
        id: slice[j]!,
        identity: fields.identity,
        entityType: fields.entity_type ?? 0,
        unlockAtMs,
        sealedAtMs: Number(fields.sealed_at_ms),
      });
    }
  }

  return { totalHandles: handles.length, totalChecked: allIds.length, due };
}

// Used only in dev when you don't want to scan — pass an explicit id.
export async function due_or_throw(
  client: SuiClient,
  predictionId: string,
): Promise<DuePrediction> {
  const fields = await fetchSealedPrediction(client, predictionId);
  if (fields.revealed) throw new Error('already revealed');
  if (Number(fields.unlock_at_ms) > Date.now()) throw new Error('not yet unlocked');
  return {
    id: predictionId,
    identity: fields.identity,
    entityType: fields.entity_type ?? 0,
    sealedAtMs: Number(fields.sealed_at_ms),
    unlockAtMs: Number(fields.unlock_at_ms),
  };
}

export interface DueResolution {
  id: string;
  identity: string;
  entityType: number;
  sealedAtMs: number;
  revealedAtMs: number;
}

// Find revealed predictions that the Resolution Agent hasn't attested yet.
export async function findDueForResolve(client: SuiClient): Promise<{
  totalHandles: number;
  totalChecked: number;
  due: DueResolution[];
}> {
  const tableId = await getByIdentityTableId(client);
  const handles = await listAllHandleEntries(client, tableId);

  const idSet = new Set<string>();
  for (const h of handles) {
    const ids = await getPredictionIdsFromDynamicField(client, h.objectId);
    for (const id of ids) idSet.add(id);
  }
  const allIds = Array.from(idSet);

  const due: DueResolution[] = [];
  const CHUNK = 25;
  for (let i = 0; i < allIds.length; i += CHUNK) {
    const slice = allIds.slice(i, i + CHUNK);
    const objs = await client.multiGetObjects({
      ids: slice,
      options: { showContent: true },
    });
    for (let j = 0; j < objs.length; j += 1) {
      const obj = objs[j];
      const content = obj?.data?.content;
      if (!content || content.dataType !== 'moveObject') continue;
      const fields = content.fields as unknown as {
        identity: string;
        entity_type: number;
        sealed_at_ms: string;
        revealed_at_ms: string;
        revealed: boolean;
        resolved?: boolean;
      };
      if (!fields.revealed) continue;
      if (fields.resolved === true) continue;
      due.push({
        id: slice[j]!,
        identity: fields.identity,
        entityType: fields.entity_type ?? 0,
        sealedAtMs: Number(fields.sealed_at_ms),
        revealedAtMs: Number(fields.revealed_at_ms),
      });
    }
  }

  return { totalHandles: handles.length, totalChecked: allIds.length, due };
}
