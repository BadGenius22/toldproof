// Reveal watcher cron — Vercel triggers this every 5 minutes (see vercel.json).
// Scans the Registry for unlocked-but-unrevealed predictions, runs the full
// Seal -> Walrus -> AES -> Move reveal pipeline for each, then optionally posts
// the reveal tweet if X_BOT_BEARER_TOKEN is set.
//
// Local dev: curl -H "Authorization: Bearer ${CRON_SECRET}" http://localhost:3000/api/cron/reveal

import { SealClient } from '@mysten/seal';
import { getSuiClient, loadDevKeypair } from '../../../../lib/sui-node';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { findDueForReveal } from '../../../../lib/scanner';
import { revealOnce } from '../../../../lib/reveal';
import { getXBotClient, revealTweetText } from '../../../../lib/x';
import { env } from '../../../../lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function checkAuth(req: Request): boolean {
  // Vercel cron sends `Authorization: Bearer ${CRON_SECRET}` for protected crons.
  // We accept the same header for local testing.
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // No secret configured — only allow when explicitly in dev
    return process.env.NODE_ENV !== 'production';
  }
  return req.headers.get('authorization') === `Bearer ${expected}`;
}

function loadCronKeypair(): Ed25519Keypair {
  // Production: env var (Bech32 suiprivkey1...). Local dev: ~/.sui/sui_config/sui.keystore.
  const envKey = process.env.REVEAL_BOT_PRIVATE_KEY;
  if (envKey) return Ed25519Keypair.fromSecretKey(envKey);
  return loadDevKeypair();
}

export async function GET(req: Request) {
  if (!checkAuth(req)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
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
  const xClient = getXBotClient(process.env.X_BOT_BEARER_TOKEN);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://toldproof.xyz';

  const { totalHandles, totalChecked, due } = await findDueForReveal(suiClient);

  const results: Array<{
    id: string;
    identity: string;
    entityType: number;
    status: 'revealed' | 'failed';
    digest?: string;
    tweetId?: string | null;
    error?: string;
  }> = [];

  for (const pred of due) {
    try {
      const { digest, plaintext } = await revealOnce({
        suiClient,
        sealClient,
        signer,
        predictionId: pred.id,
      });
      // Post a reveal tweet ONLY for human-entity predictions — agents don't
      // have X accounts in v2 (identity is a wallet alias, not an X handle).
      let tweetId: string | null = null;
      if (xClient && pred.entityType === 0) {
        const tweet = await xClient.postTweet(
          revealTweetText({
            xHandle: pred.identity,
            plaintext,
            predictionId: pred.id,
            sealedAtMs: pred.sealedAtMs,
            appUrl,
          }),
        );
        tweetId = tweet?.id ?? null;
      }
      results.push({
        id: pred.id,
        identity: pred.identity,
        entityType: pred.entityType,
        status: 'revealed',
        digest,
        tweetId,
      });
    } catch (e: unknown) {
      results.push({
        id: pred.id,
        identity: pred.identity,
        entityType: pred.entityType,
        status: 'failed',
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return Response.json({
    ok: true,
    elapsedMs: Date.now() - startedAt,
    scanned: { totalHandles, totalChecked },
    dueCount: due.length,
    xEnabled: xClient !== null,
    results,
  });
}
