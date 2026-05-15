// POST /api/reveal/[id]
//
// Owner-initiated manual reveal. Same pipeline as the cron, but for a single
// prediction. Useful when:
//   - Vercel Hobby crons only run once daily and the user wants their seal open NOW
//   - Local dev (no Vercel cron firing at all)
//   - Demo recordings where waiting for the next cron tick is awkward
//
// Auth: none. Seal's time-lock policy is the gate — the decryption key won't
// be released until `now >= unlock_at_ms`. The Move `reveal` function also
// re-checks the clock and aborts otherwise. So anyone POSTing before unlock
// gets a clean rejection at the SDK layer; anyone POSTing after unlock just
// helps the system make progress.
//
// In-flight dedupe protects against double-click + concurrent owner+cron races:
// the second concurrent call piggy-backs on the first call's promise so we
// don't burn two Move transactions for one prediction.
//
// The cron at /api/cron/reveal continues to run on its own schedule; this is
// purely additive.

import { SealClient } from '@mysten/seal';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { getSuiClient, loadDevKeypair } from '../../../../lib/sui-node';
import { revealOnce, type RevealResult } from '../../../../lib/reveal';
import { env } from '../../../../lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Map<predictionId, in-flight promise>. Cleared as soon as a call resolves.
// Per-instance (Fluid Compute reuses these), so a second concurrent owner
// click on the same prediction lands on the same promise. Cross-instance
// double-fire still possible but bounded — Move-level revealed-once enforces
// at-most-one mutation regardless.
const inFlight = new Map<string, Promise<RevealResult>>();

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  if (!/^0x[0-9a-fA-F]{64}$/.test(id)) {
    return Response.json({ error: 'invalid_id' }, { status: 400 });
  }

  // Piggy-back on an existing reveal-in-progress to avoid duplicate tx attempts.
  const existing = inFlight.get(id);
  if (existing) {
    try {
      const result = await existing;
      return Response.json({ ok: true, deduped: true, ...result });
    } catch (e) {
      return Response.json(
        { error: 'reveal_failed', detail: e instanceof Error ? e.message : String(e) },
        { status: 409 },
      );
    }
  }

  const promise = doReveal(id);
  inFlight.set(id, promise);

  try {
    const result = await promise;
    return Response.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Map known errors from revealOnce to clean HTTP codes.
    if (msg.includes('already revealed')) {
      return Response.json({ error: 'already_revealed' }, { status: 409 });
    }
    if (msg.includes('not yet unlocked')) {
      return Response.json({ error: 'not_yet_unlocked' }, { status: 409 });
    }
    console.error('[api/reveal] failed:', e);
    return Response.json({ error: 'reveal_failed', detail: msg }, { status: 500 });
  } finally {
    inFlight.delete(id);
  }
}

function loadCronKeypair(): Ed25519Keypair {
  const envKey = process.env.REVEAL_BOT_PRIVATE_KEY;
  if (envKey) return Ed25519Keypair.fromSecretKey(envKey);
  return loadDevKeypair();
}

async function doReveal(predictionId: string): Promise<RevealResult> {
  const suiClient = getSuiClient();
  const sealServers = [
    { objectId: env.sealKeyServer1, weight: 1 },
    { objectId: env.sealKeyServer2, weight: 1 },
    { objectId: env.sealKeyServer3, weight: 1 },
  ].filter((s) => s.objectId);
  const sealClient = new SealClient({
    suiClient,
    serverConfigs: sealServers,
    verifyKeyServers: false,
  });
  const signer = loadCronKeypair();

  return revealOnce({ suiClient, sealClient, signer, predictionId });
}
