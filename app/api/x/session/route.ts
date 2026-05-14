// GET /api/x/session
//
// Reads the signed session cookie and returns the user's binding info.
// Returns 200 with { walletAddress, xHandle, xUserId, verifiedAt } if a valid
// session exists; otherwise returns 200 with { session: null }. Never 401 —
// "not signed in" is a normal state, not an error.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  SESSION_COOKIE_NAME,
  verifySession,
} from '../../../../lib/session';

export const runtime = 'nodejs';

export async function GET() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySession(token);

  if (!session) {
    return NextResponse.json({ session: null });
  }

  return NextResponse.json({
    session: {
      walletAddress: session.walletAddress,
      xHandle: session.xHandle,
      xUserId: session.xUserId,
      verifiedAt: new Date(session.iat).toISOString(),
    },
  });
}

// POST /api/x/session — sign out (clear cookie). Same path, different verb.
export async function DELETE() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
