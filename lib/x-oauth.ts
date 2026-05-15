// X (Twitter) OAuth 2.0 client — PKCE flow.
//
// Reference: https://docs.x.com/resources/fundamentals/authentication/oauth-2-0/authorization-code
//
// We are a CONFIDENTIAL CLIENT (server-side) — so the token endpoint requires
// HTTP Basic auth with client_id:client_secret in addition to the PKCE
// code_verifier. This is X's documented requirement; missing the Basic header
// gives a confusing "client authentication failed" error.

import { createHash, randomBytes } from 'node:crypto';

// Use the x.com domain so users already logged in at x.com see no login prompt.
// twitter.com still works but is a separate cookie domain — if a user signed
// up after the X rebrand they may only have x.com session cookies, and being
// sent to twitter.com makes the OAuth screen look like "log in again".
const AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize';
const TOKEN_URL = 'https://api.x.com/2/oauth2/token';
const USERS_ME_URL = 'https://api.x.com/2/users/me';

// Scopes:
//   users.read     — read the user's profile (/2/users/me) after OAuth
//   tweet.read     — required even for /2/users/me (X quirk)
//   tweet.write    — post tweets from the user's account (auto-tweet on seal)
//   offline.access — get a refresh_token so we can post tweets >2h after OAuth
//
// IMPORTANT: changing this scope set means existing access tokens DON'T have
// the new scope. Affected users need to sign out + sign in again. After
// re-OAuth their new tokens cover the wider scope set. The /api/x/post-tweet
// endpoint detects scope-insufficient errors and tells the user to re-auth.
const SCOPES = ['users.read', 'tweet.read', 'tweet.write', 'offline.access'].join(' ');

function loadClientCreds(): { id: string; secret: string } {
  const id = process.env.X_CLIENT_ID;
  const secret = process.env.X_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error(
      'X_CLIENT_ID and X_CLIENT_SECRET must be set. Get them from developer.x.com → your App → Keys and tokens → OAuth 2.0 Client ID and Client Secret. Make sure you enabled OAuth 2.0 in Settings → User authentication settings first.',
    );
  }
  return { id, secret };
}

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    'http://localhost:3000'
  );
}

export function callbackUrl(): string {
  return `${appUrl()}/api/x/auth/callback`;
}

// ---------- PKCE helpers ----------

export function generateCodeVerifier(): string {
  // 32 random bytes → 43-char base64url, well inside X's 43–128 range.
  return randomBytes(32).toString('base64url');
}

export function deriveCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function generateState(): string {
  return randomBytes(24).toString('base64url');
}

// ---------- Authorize URL builder ----------

/**
 * Build the URL we redirect the user to. The user signs in on X and clicks
 * "Authorize app"; X then redirects back to our callbackUrl with ?code=&state=.
 */
export function buildAuthorizeUrl(args: {
  state: string;
  codeChallenge: string;
}): string {
  const { id } = loadClientCreds();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: id,
    redirect_uri: callbackUrl(),
    scope: SCOPES,
    state: args.state,
    code_challenge: args.codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

// ---------- Token exchange ----------

export interface XTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number; // seconds, typically 7200 (2h)
  scope: string;
}

export async function exchangeCodeForTokens(args: {
  code: string;
  codeVerifier: string;
}): Promise<XTokenResponse> {
  const { id, secret } = loadClientCreds();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: args.code,
    redirect_uri: callbackUrl(),
    code_verifier: args.codeVerifier,
    client_id: id, // X requires client_id in the body too, alongside Basic auth
  });
  const basic = Buffer.from(`${id}:${secret}`).toString('base64');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`X token exchange failed (${res.status}): ${text}`);
  }
  return (await res.json()) as XTokenResponse;
}

// ---------- Refresh ----------

export async function refreshAccessToken(refreshToken: string): Promise<XTokenResponse> {
  const { id, secret } = loadClientCreds();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: id,
  });
  const basic = Buffer.from(`${id}:${secret}`).toString('base64');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`X refresh failed (${res.status}): ${text}`);
  }
  return (await res.json()) as XTokenResponse;
}

// ---------- User info ----------

export interface XUserInfo {
  id: string;       // stable numeric user ID
  username: string; // handle, no @
  name: string;     // display name
}

export async function fetchUserInfo(accessToken: string): Promise<XUserInfo> {
  const res = await fetch(USERS_ME_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`X /2/users/me failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { data: XUserInfo };
  return data.data;
}
