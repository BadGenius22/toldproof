// Leaderboard data layer — computes a unified ranking of every identity
// (humans + AI agents) on the registry.
//
// "Ranked" entities have >= MIN_RANKED_RESOLVED resolved predictions so a
// single lucky guess doesn't crown them. Below that threshold they show in an
// "Up-and-comers" section so they're still visible but not gameable.

import {
  getPredictionsForIdentity,
  listAllIdentities,
  type PredictionView,
} from './registry';
import type { SuiClient } from './sui';
import { ENTITY_HUMAN, ENTITY_AGENT, type EntityType } from './sui';

// Minimum resolved predictions before an identity can be ranked.
// Low enough for hackathon demos, high enough that one lucky call doesn't
// instantly grab the top spot.
export const MIN_RANKED_RESOLVED = 3;

export interface LeaderboardEntry {
  identity: string;
  entityType: EntityType;
  publisher: string;
  stats: {
    sealed: number;
    revealed: number;
    resolved: number;
    hits: number;
    misses: number;
    hitRate: number; // 0..1 — undefined-equivalent uses 0
    pendingResolution: number; // revealed but agent hasn't resolved yet
    firstSealedAt: number;
    lastActivityMs: number;
  };
  isRanked: boolean;
}

export async function buildLeaderboard(client: SuiClient): Promise<LeaderboardEntry[]> {
  const identities = await listAllIdentities(client);
  const out: LeaderboardEntry[] = [];

  for (const identity of identities) {
    let predictions: PredictionView[];
    try {
      predictions = await getPredictionsForIdentity(client, identity);
    } catch {
      continue;
    }
    if (predictions.length === 0) continue;

    // Anchor entity type to the first prediction sealed under this identity
    // (matches the first-claim-wins lock semantics on Move side).
    const entityType = predictions[0]!.entityType;
    const publisher = predictions[0]!.publisher;

    const revealed = predictions.filter((p) => p.revealed).length;
    const resolved = predictions.filter((p) => p.resolved);
    const hits = resolved.filter((p) => p.hit).length;
    const misses = resolved.length - hits;
    const hitRate = resolved.length > 0 ? hits / resolved.length : 0;
    const pendingResolution = revealed - resolved.length;
    const firstSealedAt = Math.min(...predictions.map((p) => p.sealedAtMs));
    const lastActivityMs = Math.max(
      ...predictions.map((p) =>
        Math.max(p.sealedAtMs, p.revealedAtMs || 0, p.resolvedAtMs || 0),
      ),
    );

    out.push({
      identity,
      entityType,
      publisher,
      stats: {
        sealed: predictions.length,
        revealed,
        resolved: resolved.length,
        hits,
        misses,
        hitRate,
        pendingResolution,
        firstSealedAt,
        lastActivityMs,
      },
      isRanked: resolved.length >= MIN_RANKED_RESOLVED,
    });
  }

  return out;
}

// Sort by:
//   1. Ranked entries first
//   2. Within ranked: hit rate desc, then resolved count desc (more samples = more trust)
//   3. Within unranked: sealed count desc, then most recent activity
export function sortLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isRanked !== b.isRanked) return a.isRanked ? -1 : 1;
    if (a.isRanked) {
      if (a.stats.hitRate !== b.stats.hitRate) return b.stats.hitRate - a.stats.hitRate;
      return b.stats.resolved - a.stats.resolved;
    }
    if (a.stats.sealed !== b.stats.sealed) return b.stats.sealed - a.stats.sealed;
    return b.stats.lastActivityMs - a.stats.lastActivityMs;
  });
}

// Aggregate stats across the whole leaderboard — used in the page header.
export function aggregateStats(entries: LeaderboardEntry[]) {
  const total = entries.length;
  const humans = entries.filter((e) => e.entityType === ENTITY_HUMAN).length;
  const agents = entries.filter((e) => e.entityType === ENTITY_AGENT).length;
  const ranked = entries.filter((e) => e.isRanked).length;
  const totalSeals = entries.reduce((acc, e) => acc + e.stats.sealed, 0);
  const totalResolved = entries.reduce((acc, e) => acc + e.stats.resolved, 0);
  const totalHits = entries.reduce((acc, e) => acc + e.stats.hits, 0);
  const overallHitRate = totalResolved > 0 ? totalHits / totalResolved : 0;
  return {
    total,
    humans,
    agents,
    ranked,
    totalSeals,
    totalResolved,
    totalHits,
    overallHitRate,
  };
}
