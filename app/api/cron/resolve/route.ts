// Resolution Agent cron — every 5 minutes via Vercel Cron (see vercel.json).
// Scans the Registry for revealed-but-unresolved predictions and asks the
// Resolution Agent (Claude Sonnet via Vercel AI Gateway) to attest a verdict
// for each, anchoring the reasoning trace to Walrus.
//
// Auth: same Bearer-token pattern as /api/cron/reveal — Vercel sends
// `Authorization: Bearer ${CRON_SECRET}` on protected crons.
//
// Local dev:
//   curl -H "Authorization: Bearer ${CRON_SECRET}" http://localhost:3000/api/cron/resolve

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { getSuiClient, loadDevKeypair } from '../../../../lib/sui-node';
import { findDueForResolve } from '../../../../lib/scanner';
import { resolveOnce } from '../../../../lib/resolve';
import { checkCronAuth } from '../../../../lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// LLM call + Walrus PUT + Sui tx per prediction; give the cron room.
export const maxDuration = 300;

function loadAgentKeypair(): Ed25519Keypair {
  // We reuse the reveal-cron keypair as the Resolution Agent for v1 — one bot
  // wallet handles both reveal + resolve. Rotation to a dedicated agent
  // keypair later is a single set_resolver() tx.
  const envKey = process.env.REVEAL_BOT_PRIVATE_KEY;
  if (envKey) return Ed25519Keypair.fromSecretKey(envKey);
  return loadDevKeypair();
}

export async function GET(req: Request) {
  if (!checkCronAuth(req, '/api/cron/resolve')) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const suiClient = getSuiClient();
  const signer = loadAgentKeypair();
  const agentAddr = signer.getPublicKey().toSuiAddress();

  const { totalHandles, totalChecked, due } = await findDueForResolve(suiClient);

  const results: Array<{
    id: string;
    identity: string;
    entityType: number;
    status: 'resolved' | 'failed';
    hit?: boolean;
    confidence?: number;
    reasoningBlobId?: string;
    digest?: string;
    error?: string;
  }> = [];

  for (const pred of due) {
    try {
      const out = await resolveOnce({
        suiClient,
        signer,
        predictionId: pred.id,
      });
      results.push({
        id: pred.id,
        identity: pred.identity,
        entityType: pred.entityType,
        status: 'resolved',
        hit: out.hit,
        confidence: out.confidence,
        reasoningBlobId: out.reasoningBlobId,
        digest: out.digest,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // Common, expected failure: "not yet revealed" / "already resolved" /
      // "ENotResolver" if the registry's resolver address doesn't match the
      // cron keypair (call set_resolver first). Log but don't crash the loop.
      console.error(`[resolve] ${pred.id}: ${msg}`);
      results.push({
        id: pred.id,
        identity: pred.identity,
        entityType: pred.entityType,
        status: 'failed',
        error: msg,
      });
    }
  }

  return Response.json({
    startedAt,
    durationMs: Date.now() - startedAt,
    agent: agentAddr,
    totalHandles,
    totalChecked,
    candidates: due.length,
    resolved: results.filter((r) => r.status === 'resolved').length,
    failed: results.filter((r) => r.status === 'failed').length,
    results,
  });
}
