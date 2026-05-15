// POST /api/x/post-tweet
//
// Posts a tweet from the signed-in user's X account. Used by the auto-tweet
// feature: when a user locks a prediction and has the "auto-tweet" checkbox
// on, the form POSTs here AFTER the on-chain seal succeeds.
//
// Request body: { predictionId, unlockAtMs }
// Response (200): { tweet: { id, url, text } }
// Response (401): { error: 'no_session' }
// Response (403): { error: 'scope_missing' } — user needs to re-OAuth
// Response (400/500): { error, detail }
//
// The tweet text is server-controlled (not user-supplied) so we can
// guarantee it follows X automation policy and includes the verify link.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  SESSION_COOKIE_NAME,
  verifySession,
} from '../../../../lib/session';
import { postTweet, TweetScopeError } from '../../../../lib/x-api';

export const runtime = 'nodejs';

interface PostTweetBody {
  predictionId: string;
  unlockAtMs: number;
}

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://toldproof.xyz'
  );
}

function buildTweetText(args: { predictionId: string; unlockAtMs: number }): string {
  const url = `${appUrl()}/verify/${args.predictionId}`;
  // Format the open date in a way that fits in the tweet. We use the user's
  // server-side TZ-naive date — close enough for a tweet (Twitter clients
  // will show their own local time on the verify page anyway).
  const date = new Date(args.unlockAtMs);
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `🔒 Locked a prediction on @toldproof. Opens ${dateStr}. The text is hidden until then, the fingerprint is already on Sui. Verify: ${url}`;
}

export async function POST(req: Request) {
  let body: PostTweetBody;
  try {
    body = (await req.json()) as PostTweetBody;
  } catch {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }

  if (!body.predictionId || typeof body.unlockAtMs !== 'number') {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }

  const jar = await cookies();
  const session = verifySession(jar.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 });
  }

  const text = buildTweetText({
    predictionId: body.predictionId,
    unlockAtMs: body.unlockAtMs,
  });

  try {
    const tweet = await postTweet({ xUserId: session.xUserId, text });
    return NextResponse.json({ tweet });
  } catch (e) {
    if (e instanceof TweetScopeError) {
      return NextResponse.json(
        {
          error: 'scope_missing',
          detail:
            'Your X access token was issued before we added tweet posting. Sign out + sign in with X again to grant posting permission.',
        },
        { status: 403 },
      );
    }
    console.error('[x/post-tweet] failed:', e);
    return NextResponse.json(
      {
        error: 'post_failed',
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
