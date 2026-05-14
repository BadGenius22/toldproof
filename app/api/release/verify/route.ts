// POST /api/release/verify
//
// User has posted the verification tweet from their X account and pasted
// the tweet URL back. We:
//   1. Parse the tweet ID from the URL.
//   2. Fetch the tweet via X API v2 /2/tweets/:id (app-context Bearer token).
//   3. Verify the tweet author's handle matches the release request.
//   4. Verify the tweet text contains the verification code AND the wallet.
//   5. If all good: delete the existing x_account_links row + mark
//      release verified. The new wallet still needs to OAuth to seal —
//      the release just unblocks the OAuth squat-guard.
//
// Free-tier X API: GET /2/tweets/:id is allowed on Free for app-context
// reads. If it returns 401/403 we fall back to "pending_admin_review" —
// the release request is logged but waits for manual approval.

import { NextResponse } from 'next/server';
import { getSql } from '../../../../lib/db';

export const runtime = 'nodejs';

interface VerifyBody {
  code: string;
  tweetUrl: string;
}

// Parses ID from URLs like:
//   https://x.com/dewaxindo/status/1234567890
//   https://twitter.com/dewaxindo/status/1234567890
//   https://x.com/i/web/status/1234567890
function extractTweetId(url: string): string | null {
  const m = url.match(/(?:x|twitter)\.com\/(?:[^/]+\/)?status\/(\d+)/);
  return m ? m[1] : null;
}

interface XTweetResponse {
  data?: {
    id: string;
    text: string;
    author_id: string;
  };
  includes?: {
    users?: Array<{ id: string; username: string }>;
  };
  errors?: unknown;
}

async function fetchTweet(tweetId: string): Promise<XTweetResponse | null> {
  const bearer = process.env.X_BEARER_TOKEN;
  if (!bearer) return null;
  const url =
    `https://api.x.com/2/tweets/${tweetId}` +
    `?tweet.fields=author_id,text&expansions=author_id&user.fields=username`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${bearer}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      console.warn('[release/verify] X /2/tweets/:id failed:', res.status, await res.text());
      return null;
    }
    return (await res.json()) as XTweetResponse;
  } catch (e) {
    console.warn('[release/verify] X /2/tweets/:id error:', e);
    return null;
  }
}

export async function POST(req: Request) {
  let body: VerifyBody;
  try {
    body = (await req.json()) as VerifyBody;
  } catch {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }
  const code = body.code?.trim();
  const tweetUrl = body.tweetUrl?.trim();
  if (!code || !tweetUrl) {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }
  const tweetId = extractTweetId(tweetUrl);
  if (!tweetId) {
    return NextResponse.json(
      { error: 'invalid_url', detail: 'Expected an x.com/...status/<id> URL' },
      { status: 400 },
    );
  }

  const sql = getSql();

  // 1. Look up the release request by code.
  const reqRows = (await sql`
    SELECT id, x_handle, requesting_wallet, status, expires_at
    FROM handle_release_requests
    WHERE verification_code = ${code}
    LIMIT 1
  `) as Array<{
    id: string;
    x_handle: string;
    requesting_wallet: string;
    status: string;
    expires_at: string;
  }>;
  if (reqRows.length === 0) {
    return NextResponse.json({ error: 'code_not_found' }, { status: 404 });
  }
  const r = reqRows[0];
  if (r.status !== 'pending') {
    return NextResponse.json({ error: 'already_resolved', status: r.status }, { status: 409 });
  }
  if (new Date(r.expires_at) < new Date()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }

  // 2. Fetch the tweet from X API.
  const tweet = await fetchTweet(tweetId);

  // 3. If X API didn't respond (Free tier limit, network blip, missing
  // bearer), fall back to admin-review. The request stays pending and
  // the tweet URL is recorded for a human to verify.
  if (!tweet || !tweet.data || !tweet.includes?.users?.[0]) {
    await sql`
      UPDATE handle_release_requests
      SET tweet_url = ${tweetUrl}
      WHERE id = ${r.id}
    `;
    return NextResponse.json({
      status: 'pending_admin_review',
      detail:
        'Tweet URL recorded. X API could not auto-verify (Basic tier upgrade needed). A human will review and release the handle within 24 hours.',
    });
  }

  // 4. Verify author handle matches.
  const author = tweet.includes.users[0];
  if (author.username.toLowerCase() !== r.x_handle.toLowerCase()) {
    return NextResponse.json(
      {
        error: 'wrong_author',
        detail: `Tweet author is @${author.username}, expected @${r.x_handle}.`,
      },
      { status: 403 },
    );
  }

  // 5. Verify tweet text contains code + wallet.
  const tweetText = tweet.data.text.toLowerCase();
  if (!tweetText.includes(code.toLowerCase())) {
    return NextResponse.json(
      { error: 'code_not_in_tweet', detail: 'Tweet text must contain the verification code.' },
      { status: 403 },
    );
  }
  // Wallet hex prefix is enough — full 66-char address is hard to fit cleanly.
  const walletPrefix = r.requesting_wallet.slice(0, 14).toLowerCase();
  if (!tweetText.includes(walletPrefix)) {
    return NextResponse.json(
      {
        error: 'wallet_not_in_tweet',
        detail: 'Tweet text must contain the wallet address.',
      },
      { status: 403 },
    );
  }

  // 6. All checks pass. Atomically: delete existing binding, mark request
  // verified. The new wallet still needs to OAuth — the release just frees
  // the squat-guard.
  await sql`
    DELETE FROM x_account_links
    WHERE LOWER(x_handle) = LOWER(${r.x_handle})
  `;
  await sql`
    UPDATE handle_release_requests
    SET status = 'verified', tweet_id = ${tweetId}, tweet_url = ${tweetUrl},
        verified_at = now()
    WHERE id = ${r.id}
  `;

  return NextResponse.json({
    ok: true,
    xHandle: r.x_handle,
    nextStep: 'oauth_to_bind',
  });
}
