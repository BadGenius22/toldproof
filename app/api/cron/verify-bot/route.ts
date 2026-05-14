// @toldproof verify bot — Vercel cron every 5 min.
//
// Flow per tick:
//   1. List recent @toldproof mentions (since the last seen ID).
//   2. For each mention containing "verify": fetch the parent tweet.
//   3. Look up the parent author's handle in on-chain Registry.by_handle.
//   4. Compose a defamation-safe verdict (see lib/verify-bot.ts).
//   5. Reply.
//
// Until X_BOT_BEARER_TOKEN is set the route returns a "skipped: X not configured"
// response — the cron still runs but does nothing. This unblocks the architecture
// without blocking on Day-0's X API Basic-tier approval status.

import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { getXBotClient, fetchTweet } from '../../../../lib/x';
import { composeVerdict } from '../../../../lib/verify-bot';
import { env } from '../../../../lib/env';
import { checkCronAuth } from '../../../../lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// In-memory dedup across this tick. Cross-tick dedup comes from the X API
// `since_id` cursor — until we have Postgres we use the highest seen ID, kept
// in module-scope memory (warm functions only — Vercel cold starts reset it,
// which is acceptable because we re-fetch with a small max_results window).
const seenMentions = new Set<string>();
let lastSeenMentionId: string | null = null;

export async function GET(req: Request) {
  if (!checkCronAuth(req, '/api/cron/verify-bot')) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const xClient = getXBotClient(process.env.X_BOT_BEARER_TOKEN);
  if (!xClient) {
    return Response.json({
      ok: true,
      skipped: 'X_BOT_BEARER_TOKEN not configured — cron registered but inactive',
    });
  }

  const startedAt = Date.now();
  const suiClient = new SuiJsonRpcClient({
    url: env.suiRpc,
    network: env.suiNetwork as 'testnet' | 'mainnet' | 'devnet' | 'localnet',
  });

  // 1. Fetch new mentions
  const mentions = await xClient.getMentions({
    sinceId: lastSeenMentionId ?? undefined,
    max: 20,
  });

  const results: Array<{
    mentionId: string;
    parentTweetId?: string;
    parentAuthor?: string;
    verdict?: string;
    skipped?: string;
    replyTweetId?: string | null;
    error?: string;
  }> = [];

  for (const m of mentions) {
    if (seenMentions.has(m.id)) {
      results.push({ mentionId: m.id, skipped: 'already seen this tick' });
      continue;
    }
    seenMentions.add(m.id);
    // bump cursor
    if (!lastSeenMentionId || BigInt(m.id) > BigInt(lastSeenMentionId)) {
      lastSeenMentionId = m.id;
    }

    try {
      // The bot is reactive only — only respond when "verify" appears.
      if (!/\bverify\b/i.test(m.text)) {
        results.push({ mentionId: m.id, skipped: 'no "verify" keyword' });
        continue;
      }

      // 2. Find the parent tweet — that's the claim being verified.
      if (!m.inReplyToTweetId) {
        results.push({ mentionId: m.id, skipped: 'mention is not a reply' });
        continue;
      }
      const parent = await fetchTweet(process.env.X_BOT_BEARER_TOKEN!, m.inReplyToTweetId);
      if (!parent || !parent.authorHandle) {
        results.push({ mentionId: m.id, parentTweetId: m.inReplyToTweetId, skipped: 'parent unfetchable' });
        continue;
      }

      // 3. On-chain lookup + 4. compose verdict
      const verdict = await composeVerdict(suiClient, parent.authorHandle);

      // 5. Reply
      const reply = await xClient.postTweet(verdict.text, { replyToTweetId: m.id });
      results.push({
        mentionId: m.id,
        parentTweetId: m.inReplyToTweetId,
        parentAuthor: parent.authorHandle,
        verdict: verdict.kind,
        replyTweetId: reply?.id ?? null,
      });
    } catch (e: unknown) {
      results.push({
        mentionId: m.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return Response.json({
    ok: true,
    elapsedMs: Date.now() - startedAt,
    cursorAt: lastSeenMentionId,
    processed: results.length,
    results,
  });
}
