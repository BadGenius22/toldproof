// User-context X API helper.
//
// Wraps the OAuth access token lifecycle: reads from DB, refreshes if
// expired (or within a 60s safety window), updates DB with the rotated
// tokens, and returns a fresh access token ready for use. Then provides
// thin wrappers around the X API endpoints we need.
//
// This is the missing piece from the "first call to X after 2h would 401"
// problem — every X API call goes through getValidAccessToken so the token
// is always fresh.

import { getSql } from './db';
import { decryptToken, encryptToken } from './crypto-vault';
import { refreshAccessToken } from './x-oauth';

const POST_TWEET_URL = 'https://api.x.com/2/tweets';

// Refresh tokens whose expiry is within this many ms — covers the case
// where a token would expire mid-call. 60s is plenty given X tokens have
// 2h lifetimes.
const REFRESH_SAFETY_WINDOW_MS = 60_000;

interface AccountTokens {
  x_user_id: string;
  access_token_enc: string;
  refresh_token_enc: string;
  token_expires_at: string;
}

/**
 * Returns a valid access token for the given X user ID. Refreshes via the
 * stored refresh token if the access token is expired or close to it.
 * Updates the DB row with new tokens on refresh.
 *
 * Throws if no binding exists OR if the refresh itself fails (e.g. user
 * revoked the app at x.com/settings/connected_apps). Callers should catch
 * and surface a "please re-sign-in with X" message.
 */
export async function getValidAccessToken(xUserId: string): Promise<string> {
  const sql = getSql();
  const rows = (await sql`
    SELECT x_user_id, access_token_enc, refresh_token_enc, token_expires_at
    FROM x_account_links
    WHERE x_user_id = ${xUserId}
    LIMIT 1
  `) as AccountTokens[];

  if (rows.length === 0) {
    throw new Error(`No X account binding for user ${xUserId}`);
  }
  const row = rows[0];

  const expiresAt = new Date(row.token_expires_at).getTime();
  const needsRefresh = expiresAt - Date.now() < REFRESH_SAFETY_WINDOW_MS;

  if (!needsRefresh) {
    return decryptToken(row.access_token_enc);
  }

  // Refresh: exchange refresh_token for a fresh access_token (and usually a
  // rotated refresh_token). Persist whatever X gives us back.
  const refreshTokenPlain = decryptToken(row.refresh_token_enc);
  const fresh = await refreshAccessToken(refreshTokenPlain);

  const newAccessEnc = encryptToken(fresh.access_token);
  const newRefreshEnc = encryptToken(fresh.refresh_token);
  const newExpiresAt = new Date(Date.now() + fresh.expires_in * 1000).toISOString();

  await sql`
    UPDATE x_account_links SET
      access_token_enc = ${newAccessEnc},
      refresh_token_enc = ${newRefreshEnc},
      token_expires_at = ${newExpiresAt},
      updated_at = now()
    WHERE x_user_id = ${xUserId}
  `;

  return fresh.access_token;
}

export interface PostedTweet {
  id: string;
  text: string;
  url: string;
}

export class TweetScopeError extends Error {
  constructor() {
    super('Token does not have tweet.write scope. User needs to re-sign-in with X.');
    this.name = 'TweetScopeError';
  }
}

/**
 * Posts a tweet from the user's account using their OAuth access token.
 *
 * Detects the scope-insufficient case (403 from /2/tweets when the token
 * was issued before tweet.write was added to our scope set) and throws
 * TweetScopeError — the API route catches this and tells the user to
 * re-sign-in.
 */
export async function postTweet(args: {
  xUserId: string;
  text: string;
}): Promise<PostedTweet> {
  const accessToken = await getValidAccessToken(args.xUserId);

  const res = await fetch(POST_TWEET_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: args.text }),
  });

  if (res.status === 403) {
    const errText = await res.text();
    // X returns 403 with a "oauth1-permissions-are-missing" or similar
    // signal when the token lacks the requested scope. Treat any 403 on
    // post as a scope problem — re-auth fixes it.
    console.warn('[x-api/postTweet] 403 — likely missing tweet.write scope:', errText);
    throw new TweetScopeError();
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`X POST /2/tweets failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { data: { id: string; text: string } };
  // Need to know the author's username to build the canonical tweet URL.
  // We could fetch /2/users/me again, but we already know the handle from
  // our DB binding — caller can pass it through if needed. Default to
  // x.com/i/web/status/<id> which works regardless of handle.
  return {
    id: data.data.id,
    text: data.data.text,
    url: `https://x.com/i/web/status/${data.data.id}`,
  };
}
