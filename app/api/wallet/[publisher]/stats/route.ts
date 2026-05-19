// GET /api/wallet/[publisher]/stats
//
// Returns the wallet-aggregate Skill Score + per-alias breakdown for one
// publisher address. Drives:
//   • the headline number on /[handle] when the WalletProvenance card
//     can't render server-side for any reason
//   • external integrations that need the wallet's reputation programmatically
//   • future B2B Reputation API surface (V4 T2.3 builds on this shape)
//
// Cached 60s — wallets don't sprout new aliases per minute, and the
// leaderboard's revalidate is also 60s, so we stay consistent.
//
// Spec: docs/design/V4_BUILD_SPEC_T1.md §T1.2.

import { NextResponse } from 'next/server';
import { getSuiClientForReads } from '../../../../../lib/registry';
import {
  buildLeaderboard,
  buildWalletLeaderboard,
} from '../../../../../lib/leaderboard';

export const runtime = 'nodejs';
export const revalidate = 60;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ publisher: string }> },
) {
  const { publisher } = await ctx.params;
  if (!/^0x[0-9a-fA-F]{64}$/.test(publisher)) {
    return NextResponse.json({ error: 'invalid_publisher' }, { status: 400 });
  }

  try {
    const client = getSuiClientForReads();
    const entries = await buildLeaderboard(client);
    const groups = buildWalletLeaderboard(entries);
    const wallet = groups.find(
      (g) => g.publisher.toLowerCase() === publisher.toLowerCase(),
    );
    if (!wallet) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    // Trim drill-down to the fields a caller actually needs — strip the
    // verbose per-alias `stats` and `skill.mix` to keep the payload tight.
    return NextResponse.json({
      publisher: wallet.publisher,
      primaryIdentity: wallet.primaryIdentity,
      primaryEntityType: wallet.primaryEntityType,
      aliasCount: wallet.aliasCount,
      totalSealed: wallet.totalSealed,
      totalResolved: wallet.totalResolved,
      totalHits: wallet.totalHits,
      walletAggregateScore: wallet.walletAggregateScore,
      weightedHits: wallet.weightedHits,
      weightedAttempts: wallet.weightedAttempts,
      boldCalls: wallet.boldCalls,
      isRanked: wallet.isRanked,
      lastActivityMs: wallet.lastActivityMs,
      aliases: wallet.aliases.map((a) => ({
        identity: a.identity,
        entityType: a.entityType,
        resolved: a.stats.resolved,
        hitRate: a.stats.hitRate,
        skillScore: a.skill.score,
        boldCalls: a.skill.boldCalls,
        lastActivityMs: a.stats.lastActivityMs,
        isRanked: a.isRanked,
      })),
    });
  } catch (e) {
    console.error('[api/wallet/stats]', e);
    return NextResponse.json(
      { error: 'fetch_failed', detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
