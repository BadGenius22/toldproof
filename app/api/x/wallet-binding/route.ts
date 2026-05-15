// GET /api/x/wallet-binding?wallet=0x...
//
// Public read-only check. Returns the X handle bound to a given wallet, if
// any. Used by the UI to detect "welcome back" state when a wallet that
// previously OAuth'd is reconnected — we offer a one-click re-sign-in
// without making the user type or pick.
//
// Why not just auto-restore the session: issuing a session cookie based on
// a wallet address alone would let anyone with the public wallet address
// impersonate that X handle in our app. Wallet ownership at the API layer
// requires either (a) a SIWE-style signed message, or (b) a fresh OAuth
// round-trip. For hackathon scope we use (b) — it's near-instant when the
// user's X session is still warm. Hardening to (a) is a v1.1 roadmap item.

import { NextResponse } from 'next/server';
import { getSql } from '../../../../lib/db';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const wallet = url.searchParams.get('wallet')?.trim().toLowerCase();

  if (!wallet || !wallet.startsWith('0x') || wallet.length !== 66) {
    return NextResponse.json({ binding: null });
  }

  const sql = getSql();
  const rows = (await sql`
    SELECT x_handle FROM x_account_links
    WHERE wallet_address = ${wallet}
    LIMIT 1
  `) as Array<{ x_handle: string }>;

  if (rows.length === 0) {
    return NextResponse.json({ binding: null });
  }

  return NextResponse.json({
    binding: { xHandle: rows[0].x_handle },
  });
}
