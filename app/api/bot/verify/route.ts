// POST /api/bot/verify
//
// Self-serve version of the @toldproof bot, runnable on X API Free tier.
// Instead of polling X for mentions (which requires Basic tier), we let
// users paste a tweet URL directly. We extract the author handle from the
// URL itself — no X API call needed — and look up sealed predictions for
// that handle on-chain.
//
// Defamation-safe verdict text comes from lib/verify-bot.ts (same code path
// the autonomous bot will use once Basic tier lights up).

import { NextResponse } from 'next/server';
import { composeVerdict } from '../../../../lib/verify-bot';
import { getSuiClientForReads } from '../../../../lib/registry';

export const runtime = 'nodejs';

interface VerifyBody {
  tweetUrl: string;
}

// Tweet URLs look like:
//   https://x.com/{handle}/status/{id}
//   https://twitter.com/{handle}/status/{id}
//   https://x.com/i/web/status/{id}   (no handle — can't verify)
const HANDLE_FROM_URL = /(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/\d+/i;

export async function POST(req: Request) {
  let body: VerifyBody;
  try {
    body = (await req.json()) as VerifyBody;
  } catch {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }

  const url = body.tweetUrl?.trim();
  if (!url) {
    return NextResponse.json({ error: 'bad_input', detail: 'tweetUrl required' }, { status: 400 });
  }

  const match = url.match(HANDLE_FROM_URL);
  if (!match) {
    return NextResponse.json(
      {
        error: 'unparseable_url',
        detail:
          'Could not extract the author handle from this URL. Expected x.com/{handle}/status/{id} format.',
      },
      { status: 400 },
    );
  }
  const xHandle = match[1].toLowerCase();

  // Compose the verdict against the on-chain Registry. Same code path the
  // autonomous bot uses — same defamation-safe wording.
  const client = getSuiClientForReads();
  const verdict = await composeVerdict(client, xHandle);

  return NextResponse.json({
    xHandle,
    verdict: {
      kind: verdict.kind, // 'matched' | 'no_proof'
      text: verdict.text,
    },
    predictions:
      verdict.kind === 'matched'
        ? verdict.predictions.map((p) => ({
            id: p.id,
            unlockAtMs: p.unlockAtMs,
            revealed: p.revealed,
            resolved: p.resolved,
            hit: p.hit,
          }))
        : [],
  });
}
