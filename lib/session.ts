// HMAC-signed session cookie. Stateless: the entire session payload lives in
// the cookie, signed with SESSION_SECRET. No server-side lookup on the hot path.
//
// We only put NON-sensitive identifiers in the payload (X handle, X user ID,
// wallet address, issued-at timestamp). OAuth access/refresh tokens stay in
// Postgres, encrypted by lib/crypto-vault.ts.

import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'tp_session';
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface SessionPayload {
  walletAddress: string;
  xHandle: string;
  xUserId: string;
  iat: number; // issued at, ms epoch
}

function loadSecret(): string {
  const raw = process.env.SESSION_SECRET;
  if (!raw) {
    throw new Error(
      'SESSION_SECRET is not set. Generate with: ' +
        `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`,
    );
  }
  return raw;
}

function base64urlEncode(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64url');
}

function base64urlDecode(s: string): string {
  return Buffer.from(s, 'base64url').toString('utf8');
}

function sign(body: string): string {
  return createHmac('sha256', loadSecret()).update(body).digest('base64url');
}

/**
 * Build a signed cookie value: `<base64url payload>.<base64url HMAC>`.
 */
export function signSession(payload: Omit<SessionPayload, 'iat'>): string {
  const full: SessionPayload = { ...payload, iat: Date.now() };
  const body = base64urlEncode(JSON.stringify(full));
  return `${body}.${sign(body)}`;
}

/**
 * Verifies a cookie value. Returns null on any tamper, expiry, or shape error.
 * Never throws — callers can treat null as "no session".
 */
export function verifySession(token: string | undefined | null): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot < 1 || dot === token.length - 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(body);
  try {
    if (
      sig.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return null;
    }
  } catch {
    return null;
  }
  let payload: SessionPayload;
  try {
    payload = JSON.parse(base64urlDecode(body)) as SessionPayload;
  } catch {
    return null;
  }
  if (
    typeof payload.iat !== 'number' ||
    typeof payload.walletAddress !== 'string' ||
    typeof payload.xHandle !== 'string' ||
    typeof payload.xUserId !== 'string'
  ) {
    return null;
  }
  if (payload.iat + MAX_AGE_SECONDS * 1000 < Date.now()) return null;
  return payload;
}

export const SESSION_COOKIE_OPTIONS = {
  name: COOKIE_NAME,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: MAX_AGE_SECONDS,
};

export { COOKIE_NAME as SESSION_COOKIE_NAME };

/**
 * Read the session payload off a Request's Cookie header. Never throws —
 * returns null when the cookie is absent, tampered, expired, or malformed.
 * Use this from API routes that want optional session context without
 * hitting next/headers (works in both edge and node runtimes).
 */
export function getSessionFromCookie(req: Request): SessionPayload | null {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  // Cookie header is `name=value; name2=value2; ...` — find ours by exact
  // name match. Don't split-and-trim naively because cookie values may
  // contain `=` (base64url payloads).
  const prefix = `${COOKIE_NAME}=`;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      const raw = trimmed.slice(prefix.length);
      return verifySession(decodeURIComponent(raw));
    }
  }
  return null;
}
