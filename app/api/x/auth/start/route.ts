// POST /api/x/auth/start
//
// Kicks off the X OAuth 2.0 PKCE flow. Caller passes the Sui wallet address
// they want to bind to their X handle. We generate state + code_verifier,
// stash them in Postgres (5 min TTL), and return the X authorize URL.
//
// The frontend should then redirect window.location to authorizeUrl. We use
// a redirect (not popup) because popups break on mobile.

import { NextResponse } from 'next/server';
import { getSql } from '../../../../../lib/db';
import {
  buildAuthorizeUrl,
  deriveCodeChallenge,
  generateCodeVerifier,
  generateState,
} from '../../../../../lib/x-oauth';

export const runtime = 'nodejs';

interface StartBody {
  walletAddress: string;
}

export async function POST(req: Request) {
  let body: StartBody;
  try {
    body = (await req.json()) as StartBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const wallet = body.walletAddress?.trim().toLowerCase();
  if (!wallet || !wallet.startsWith('0x') || wallet.length !== 66) {
    return NextResponse.json(
      { error: 'walletAddress must be a 0x-prefixed 64-hex Sui address' },
      { status: 400 },
    );
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = deriveCodeChallenge(codeVerifier);

  // Stash state + verifier so the callback can reconstruct them. 5 min TTL.
  const sql = getSql();
  await sql`
    INSERT INTO x_oauth_state (state, code_verifier, wallet_address, expires_at)
    VALUES (${state}, ${codeVerifier}, ${wallet}, now() + interval '5 minutes')
  `;

  const authorizeUrl = buildAuthorizeUrl({ state, codeChallenge });

  return NextResponse.json({ authorizeUrl });
}
