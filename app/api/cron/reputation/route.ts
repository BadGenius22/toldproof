// Reputation Agent cron — runs periodically (every 15 min via vercel.json).
// For each identity with newly-resolved predictions, generates an updated
// reputation profile, writes it to Walrus, and emits a
// ReputationProfileUpdated event on Sui pointing to the new blob.
//
// The profile chains to its previous version (linked list on Walrus), giving
// subscribers a verifiable evolving record of each analyst/agent's track record.
//
// Auth: same Bearer-token pattern as the other crons.

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { getSuiClient, loadDevKeypair } from '../../../../lib/sui-node';
import { findDueForResolve } from '../../../../lib/scanner';
import { buildAndPublishProfile } from '../../../../lib/reputation';
import { env } from '../../../../lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function checkAuth(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return process.env.NODE_ENV !== 'production';
  }
  return req.headers.get('authorization') === `Bearer ${expected}`;
}

function loadAgentKeypair(): Ed25519Keypair {
  const envKey = process.env.REVEAL_BOT_PRIVATE_KEY;
  if (envKey) return Ed25519Keypair.fromSecretKey(envKey);
  return loadDevKeypair();
}

// Find the latest ReputationProfileUpdated event for `identity`. Returns the
// blob ID + version if a profile exists, or {blobId: '', version: 0} if not.
async function findLatestProfile(
  suiClient: ReturnType<typeof getSuiClient>,
  identity: string,
): Promise<{ blobId: string; version: number }> {
  const pkg = env.packageId;
  // Query events of type `{pkg}::prediction_vault::ReputationProfileUpdated`,
  // filter by identity (BCS-encoded matching is fiddly via RPC, so we just
  // page through events for this module and filter client-side).
  try {
    const res = await suiClient.queryEvents({
      query: { MoveEventType: `${pkg}::prediction_vault::ReputationProfileUpdated` },
      limit: 50,
      order: 'descending',
    });
    for (const e of res.data) {
      const fields = e.parsedJson as
        | { identity: string; profile_blob_id: number[] | string; version: string }
        | undefined;
      if (!fields) continue;
      if (fields.identity !== identity) continue;
      const blobBytes = Array.isArray(fields.profile_blob_id)
        ? new Uint8Array(fields.profile_blob_id)
        : new Uint8Array(Buffer.from(fields.profile_blob_id, 'base64'));
      return {
        blobId: new TextDecoder().decode(blobBytes),
        version: Number(fields.version),
      };
    }
  } catch (e) {
    console.warn(`[reputation] failed to query events for ${identity}:`, e);
  }
  return { blobId: '', version: 0 };
}

export async function GET(req: Request) {
  if (!checkAuth(req)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const suiClient = getSuiClient();
  const signer = loadAgentKeypair();

  // Strategy: find every identity that has AT LEAST ONE resolved prediction
  // since the last profile update. For hackathon scale, we just scan recent
  // PredictionResolved events and union the identities.
  const recentResolves = await suiClient.queryEvents({
    query: {
      MoveEventType: `${env.packageId}::prediction_vault::PredictionResolved`,
    },
    limit: 100,
    order: 'descending',
  });

  // Build a set of identities with recent resolutions. We need to look up the
  // prediction objects to get the identity (PredictionResolved event only
  // includes prediction_id). Cheap enough for hackathon scale.
  const identitySet = new Set<string>();
  for (const e of recentResolves.data) {
    const fields = e.parsedJson as { prediction_id: string } | undefined;
    if (!fields) continue;
    try {
      const obj = await suiClient.getObject({
        id: fields.prediction_id,
        options: { showContent: true },
      });
      const content = obj.data?.content;
      if (!content || content.dataType !== 'moveObject') continue;
      const predFields = content.fields as unknown as { identity: string };
      if (predFields.identity) identitySet.add(predFields.identity);
    } catch (err) {
      console.warn(`[reputation] failed to fetch ${fields.prediction_id}:`, err);
    }
  }

  // Also pick up identities that have revealed-but-unresolved predictions —
  // their profile might still need pending-count updates.
  const { due: dueResolves } = await findDueForResolve(suiClient);
  for (const d of dueResolves) identitySet.add(d.identity);

  const enrich = process.env.REPUTATION_ENRICH !== 'false';
  const results: Array<{
    identity: string;
    status: 'published' | 'skipped' | 'failed';
    version?: number;
    profileBlobId?: string;
    digest?: string;
    hitRate?: number;
    error?: string;
  }> = [];

  for (const identity of identitySet) {
    try {
      const prev = await findLatestProfile(suiClient, identity);
      const out = await buildAndPublishProfile({
        suiClient,
        signer,
        identity,
        previousProfileBlobId: prev.blobId,
        previousVersion: prev.version,
        enrich,
      });
      results.push({
        identity,
        status: 'published',
        version: out.version,
        profileBlobId: out.profileBlobId,
        digest: out.digest,
        hitRate: out.hitRate,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[reputation] ${identity}: ${msg}`);
      results.push({ identity, status: 'failed', error: msg });
    }
  }

  return Response.json({
    startedAt,
    durationMs: Date.now() - startedAt,
    enriched: enrich,
    identitiesScanned: identitySet.size,
    published: results.filter((r) => r.status === 'published').length,
    failed: results.filter((r) => r.status === 'failed').length,
    results,
  });
}
