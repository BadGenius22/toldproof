// GET /api/x/auth/callback?code=...&state=...
//
// X redirects the user here after they authorize the app. We:
//   1. Validate the state + load the stashed code_verifier
//   2. Exchange code → access_token + refresh_token via X's token endpoint
//   3. Call /2/users/me to read the user's stable ID + handle
//   4. Check that no OTHER wallet has already bound this handle (squat guard)
//   5. Upsert x_account_links (tokens encrypted at rest)
//   6. Set the session cookie
//   7. Redirect back to /lock with a success or error flag

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSql } from '../../../../../lib/db';
import { decryptToken, encryptToken } from '../../../../../lib/crypto-vault';
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  signSession,
} from '../../../../../lib/session';
import {
  exchangeCodeForTokens,
  fetchUserInfo,
} from '../../../../../lib/x-oauth';

export const runtime = 'nodejs';

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    'http://localhost:3000'
  );
}

function redirectWithError(error: string, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ error, ...extra });
  return NextResponse.redirect(`${appUrl()}/lock?${params.toString()}`);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const xError = url.searchParams.get('error');

  // User clicked "Cancel" on X's consent screen.
  if (xError) {
    return redirectWithError('x_oauth_cancelled');
  }
  if (!code || !state) {
    return redirectWithError('missing_code_or_state');
  }

  const sql = getSql();

  // 1. Validate state + load verifier. Delete the row in the same query so
  // it can't be replayed.
  const rows = (await sql`
    DELETE FROM x_oauth_state
    WHERE state = ${state} AND expires_at > now()
    RETURNING code_verifier, wallet_address
  `) as Array<{ code_verifier: string; wallet_address: string }>;

  if (rows.length === 0) {
    return redirectWithError('state_expired_or_invalid');
  }
  const { code_verifier: codeVerifier, wallet_address: walletAddress } = rows[0];

  // 2. Exchange code for tokens.
  let tokens;
  try {
    tokens = await exchangeCodeForTokens({ code, codeVerifier });
  } catch (e) {
    console.error('[x/callback] token exchange failed:', e);
    return redirectWithError('token_exchange_failed');
  }

  // 3. Fetch the user's X profile.
  let xUser;
  try {
    xUser = await fetchUserInfo(tokens.access_token);
  } catch (e) {
    console.error('[x/callback] /2/users/me failed:', e);
    return redirectWithError('user_info_failed');
  }

  const xHandle = xUser.username; // X enforces uniqueness; keep original case for display
  const xUserId = xUser.id;
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  // Swap _normal for _400x400 so the profile renders a high-res avatar.
  const avatarUrl =
    typeof xUser.profile_image_url === 'string' && xUser.profile_image_url.length > 0
      ? xUser.profile_image_url.replace('_normal.', '_400x400.')
      : null;
  const displayName = typeof xUser.name === 'string' && xUser.name.length > 0 ? xUser.name : null;

  // 4. Squat guard. If another wallet already bound this handle, redirect to
  // the release flow rather than overwriting.
  const existing = (await sql`
    SELECT wallet_address FROM x_account_links
    WHERE LOWER(x_handle) = LOWER(${xHandle})
    LIMIT 1
  `) as Array<{ wallet_address: string }>;

  if (existing.length > 0 && existing[0].wallet_address !== walletAddress) {
    return redirectWithError('handle_taken', {
      handle: xHandle,
      heldBy: existing[0].wallet_address,
    });
  }

  // 5. Upsert binding. Encrypt tokens at rest.
  const accessEnc = encryptToken(tokens.access_token);
  const refreshEnc = encryptToken(tokens.refresh_token);

  await sql`
    INSERT INTO x_account_links (
      x_user_id, x_handle, wallet_address,
      access_token_enc, refresh_token_enc, token_expires_at,
      avatar_url, display_name,
      created_at, updated_at
    )
    VALUES (
      ${xUserId}, ${xHandle}, ${walletAddress},
      ${accessEnc}, ${refreshEnc}, ${expiresAt},
      ${avatarUrl}, ${displayName},
      now(), now()
    )
    ON CONFLICT (x_user_id) DO UPDATE SET
      x_handle = EXCLUDED.x_handle,
      wallet_address = EXCLUDED.wallet_address,
      access_token_enc = EXCLUDED.access_token_enc,
      refresh_token_enc = EXCLUDED.refresh_token_enc,
      token_expires_at = EXCLUDED.token_expires_at,
      avatar_url = COALESCE(EXCLUDED.avatar_url, x_account_links.avatar_url),
      display_name = COALESCE(EXCLUDED.display_name, x_account_links.display_name),
      updated_at = now()
  `;

  // 6. Set session cookie.
  const cookieJar = await cookies();
  cookieJar.set(
    SESSION_COOKIE_NAME,
    signSession({ walletAddress, xHandle, xUserId }),
    SESSION_COOKIE_OPTIONS,
  );

  // 7. Redirect back to /lock with success flag. Frontend reads ?verified=1 and
  // refreshes the OAuth state in the form.
  // Suppress unused-import warning — decryptToken is exported for future use.
  void decryptToken;

  return NextResponse.redirect(`${appUrl()}/lock?verified=1&handle=${encodeURIComponent(xHandle)}`);
}
