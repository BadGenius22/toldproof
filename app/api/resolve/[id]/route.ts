// POST /api/resolve/[id]
//
// Owner-initiated manual resolve. Same multi-agent pipeline as /api/cron/resolve
// but for a single prediction.
//
// Why this exists: on Vercel Hobby tier the resolve cron runs once daily, and
// on localhost no cron runs at all. Users (and demo recordings) need a way to
// crank the verdict immediately after the prediction opens.
//
// Auth: none. The Move side enforces `pred.resolved == false && pred.revealed
// == true` and that the caller is the registry's resolver — which is the
// agent keypair, not the requester. So an unauthenticated POST just nudges
// the system to do work it would have done at the next cron tick.
//
// In-flight dedupe protects against double-click + owner+cron races: the
// second concurrent call piggy-backs on the first call's promise so we don't
// burn two LLM runs + two Walrus PUTs + two Sui txs for one prediction.

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { getSuiClient, loadDevKeypair } from '../../../../lib/sui-node';
import { resolveOnce, type ResolveResult } from '../../../../lib/resolve';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Consensus mode runs Claude + GPT + Gemini in parallel, then a Critic, then
// Walrus PUT, then Sui tx. Single-model mode is faster but can still take a
// minute when the agent does several search-tool steps. Match the cron's cap.
export const maxDuration = 300;

const inFlight = new Map<string, Promise<ResolveResult>>();

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  if (!/^0x[0-9a-fA-F]{64}$/.test(id)) {
    return Response.json({ error: 'invalid_id' }, { status: 400 });
  }

  const existing = inFlight.get(id);
  if (existing) {
    try {
      const result = await existing;
      return Response.json({ ok: true, deduped: true, ...result });
    } catch (e) {
      return Response.json(
        { error: 'resolve_failed', detail: e instanceof Error ? e.message : String(e) },
        { status: 409 },
      );
    }
  }

  const promise = doResolve(id);
  inFlight.set(id, promise);

  try {
    const result = await promise;
    return Response.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('already resolved')) {
      return Response.json({ error: 'already_resolved' }, { status: 409 });
    }
    if (msg.includes('not yet revealed')) {
      return Response.json({ error: 'not_yet_revealed' }, { status: 409 });
    }
    if (msg.includes('ENotResolver')) {
      return Response.json(
        {
          error: 'resolver_misconfigured',
          detail:
            'Registry resolver address does not match the agent keypair. Run set_resolver against the right keypair, or set REVEAL_BOT_PRIVATE_KEY to the resolver.',
        },
        { status: 500 },
      );
    }
    console.error('[api/resolve] failed:', e);
    return Response.json({ error: 'resolve_failed', detail: msg }, { status: 500 });
  } finally {
    inFlight.delete(id);
  }
}

function loadAgentKeypair(): Ed25519Keypair {
  const envKey = process.env.REVEAL_BOT_PRIVATE_KEY;
  if (envKey) return Ed25519Keypair.fromSecretKey(envKey);
  return loadDevKeypair();
}

async function doResolve(predictionId: string): Promise<ResolveResult> {
  const suiClient = getSuiClient();
  const signer = loadAgentKeypair();
  return resolveOnce({ suiClient, signer, predictionId });
}
