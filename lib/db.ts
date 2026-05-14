// Postgres client — Neon serverless driver over HTTP.
// Works in Vercel Functions (Node + Edge) without connection pooling overhead.
// Reads DATABASE_URL from env at first use; throws if missing so the failure
// is obvious during local dev.

import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let cachedSql: NeonQueryFunction<false, false> | null = null;

function rawSql(): NeonQueryFunction<false, false> {
  if (cachedSql) return cachedSql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Provision Neon via Vercel Marketplace and pull the env: `vercel env pull .env.local`',
    );
  }
  cachedSql = neon(url);
  return cachedSql;
}

// Neon free tier suspends idle databases — the first query after a gap can
// take 3-8 sec to wake. Wrap the SQL function with transparent retry so a
// cold start during an OAuth round-trip doesn't surface as a 500 to the user.
function isTransientError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const msg = (e as { message?: string }).message ?? '';
  const code = (e as { code?: string; sourceError?: { cause?: { code?: string } } }).code
    ?? (e as { sourceError?: { cause?: { code?: string } } }).sourceError?.cause?.code;
  return (
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ENOTFOUND' ||
    msg.includes('fetch failed') ||
    msg.includes('Error connecting to database')
  );
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Tagged-template SQL function with transparent cold-start retry.
 * Retries up to 2 extra times (3 attempts total) on transient connection
 * errors, with 1s and 3s backoffs — covers Neon's typical wake window.
 */
export function getSql(): NeonQueryFunction<false, false> {
  const inner = rawSql();
  // Re-wrap as a tagged template that preserves the strings/values signature.
  const wrapped = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    return (async () => {
      const backoffs = [0, 1000, 3000];
      let lastErr: unknown;
      for (const wait of backoffs) {
        if (wait) await sleep(wait);
        try {
          return await inner(strings, ...values);
        } catch (e) {
          lastErr = e;
          if (!isTransientError(e)) throw e;
        }
      }
      throw lastErr;
    })();
  }) as unknown as NeonQueryFunction<false, false>;
  // Forward the .query method too (used by Pool-style raw queries).
  // The @neondatabase/serverless neon() return has .query attached.
  (wrapped as unknown as { query: unknown }).query = (
    inner as unknown as { query: unknown }
  ).query;
  return wrapped;
}

// Typed row shapes for the three tables in migrations/001_x_auth.sql.
// Keep these in sync with the schema; if you add a column, add it here too.

export interface XAccountLink {
  x_user_id: string;
  x_handle: string;
  wallet_address: string;
  access_token_enc: string;
  refresh_token_enc: string;
  token_expires_at: string; // ISO timestamp from Postgres
  created_at: string;
  updated_at: string;
}

export interface XOAuthState {
  state: string;
  code_verifier: string;
  wallet_address: string;
  expires_at: string;
  created_at: string;
}

export interface HandleReleaseRequest {
  id: string;
  x_handle: string;
  requesting_wallet: string;
  verification_code: string;
  status: 'pending' | 'verified' | 'expired' | 'cancelled';
  tweet_id: string | null;
  tweet_url: string | null;
  created_at: string;
  verified_at: string | null;
  expires_at: string;
}
