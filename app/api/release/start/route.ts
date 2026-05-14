// POST /api/release/start
//
// User wants to reclaim a squatted X handle. We generate a one-time
// verification code, persist a release request (24h TTL), and return the
// tweet text the user should post from the X account they claim to own.
//
// The actual verification happens in /api/release/verify when the user
// pastes the tweet URL back.

import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getSql } from '../../../../lib/db';

export const runtime = 'nodejs';

interface StartBody {
  walletAddress: string;
  xHandle: string;
}

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    'http://localhost:3000'
  );
}

// "TOLDPROOF-" + 8 chars base32-ish (Crockford alphabet — no easily confused chars).
function generateCode(): string {
  const alphabet = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  const bytes = randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length];
  return `TOLDPROOF-${out}`;
}

export async function POST(req: Request) {
  let body: StartBody;
  try {
    body = (await req.json()) as StartBody;
  } catch {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }

  const wallet = body.walletAddress?.trim().toLowerCase();
  const xHandle = body.xHandle?.trim().toLowerCase().replace(/^@/, '');
  if (!wallet || !wallet.startsWith('0x') || wallet.length !== 66) {
    return NextResponse.json({ error: 'bad_input', detail: 'walletAddress' }, { status: 400 });
  }
  if (!xHandle) {
    return NextResponse.json({ error: 'bad_input', detail: 'xHandle' }, { status: 400 });
  }

  const sql = getSql();

  // If the handle isn't actually claimed, no release is needed — just OAuth.
  const existing = (await sql`
    SELECT wallet_address FROM x_account_links
    WHERE LOWER(x_handle) = LOWER(${xHandle})
    LIMIT 1
  `) as Array<{ wallet_address: string }>;

  if (existing.length === 0) {
    return NextResponse.json({ alreadyAvailable: true });
  }
  if (existing[0].wallet_address.toLowerCase() === wallet) {
    return NextResponse.json({ alreadyYours: true });
  }

  // Reuse an existing pending request for this (handle, wallet) pair if one
  // is still valid — idempotent across page reloads.
  const reuse = (await sql`
    SELECT verification_code, expires_at
    FROM handle_release_requests
    WHERE LOWER(x_handle) = LOWER(${xHandle})
      AND requesting_wallet = ${wallet}
      AND status = 'pending'
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1
  `) as Array<{ verification_code: string; expires_at: string }>;

  let code: string;
  let expiresAt: string;
  if (reuse.length > 0) {
    code = reuse[0].verification_code;
    expiresAt = reuse[0].expires_at;
  } else {
    code = generateCode();
    const insertion = (await sql`
      INSERT INTO handle_release_requests (
        x_handle, requesting_wallet, verification_code, expires_at
      ) VALUES (
        ${xHandle}, ${wallet}, ${code}, now() + interval '24 hours'
      )
      RETURNING expires_at
    `) as Array<{ expires_at: string }>;
    expiresAt = insertion[0].expires_at;
  }

  const tweetText = `Verifying my @toldproof claim · wallet ${wallet} · ${code}`;

  return NextResponse.json({
    code,
    tweetText,
    tweetIntent: `https://x.com/intent/post?text=${encodeURIComponent(tweetText)}`,
    expiresAt,
    appUrl: appUrl(),
  });
}
