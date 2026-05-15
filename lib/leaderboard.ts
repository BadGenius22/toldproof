// Leaderboard data layer — computes a unified ranking of every identity
// (humans + AI agents) on the registry.
//
// Ranking uses a difficulty-weighted Skill Score computed via Wilson lower
// bound at 95% confidence. Trivial predictions (already-true-at-lock) have
// zero weight, so spam-farming them does not move the ranking. See the
// project's CLAUDE.md and the audit-report notes for the design rationale.
//
// "Ranked" entities also pass a bold-call filter (>= 2 medium-or-hard calls)
// — borrowed from Manifold's lesson that small-sample gaming requires
// structural eligibility, not just math.

import {
  getPredictionsForIdentity,
  listAllIdentities,
  type PredictionView,
} from './registry';
import type { SuiClient } from './sui';
import { ENTITY_HUMAN, ENTITY_AGENT, type EntityType } from './sui';
import {
  getAllVerdicts,
  type DifficultyLevel,
  type IdentityVerdictRow,
} from './verdict-store';

// Minimum resolved predictions before an identity can be ranked.
// Low enough for hackathon demos, high enough that one lucky call doesn't
// instantly grab the top spot.
export const MIN_RANKED_RESOLVED = 3;

// Minimum medium-or-hard resolved calls to qualify for the headline
// leaderboard. Below this you appear in "Up-and-comers". This is the
// anti-spam structural gate.
export const MIN_BOLD_CALLS = 2;

// Difficulty weights for Skill Score. trivial=0 is the load-bearing
// anti-spam choice — already-true-at-lock predictions contribute zero to
// the ranking regardless of hit/miss. easy=0.3 gently credits straightforward
// macro calls. medium=1.0 is the baseline. hard=2.0 boosts contrarian calls.
export const DIFFICULTY_WEIGHTS: Record<DifficultyLevel, number> = {
  trivial: 0.0,
  easy: 0.3,
  medium: 1.0,
  hard: 2.0,
};

export interface DifficultyMix {
  trivial: number;
  easy: number;
  medium: number;
  hard: number;
  unknown: number; // resolved on-chain but no DB verdict row yet
}

export interface SkillStats {
  // 0..100 — Wilson lower bound on the difficulty-weighted hit rate.
  // 0 means no qualifying calls or all-trivial.
  score: number;
  // Same idea but the raw weighted ratio without Wilson (for display).
  rawWeightedHitRate: number;
  // Σ of difficulty weights across resolved predictions. "Effective"
  // sample size — a trivial call adds 0, a hard call adds 2.
  weightedAttempts: number;
  // Σ of difficulty weights across resolved + hit predictions.
  weightedHits: number;
  // Count of medium + hard resolved calls. Drives the bold-call filter.
  boldCalls: number;
  // Visible distribution for the profile histogram.
  mix: DifficultyMix;
}

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
  skill: SkillStats;
  isRanked: boolean;
}

export async function buildLeaderboard(client: SuiClient): Promise<LeaderboardEntry[]> {
  const identities = await listAllIdentities(client);
  const out: LeaderboardEntry[] = [];

  // Pull all verdict rows once and index by prediction_id. The DB write
  // happens at resolve-time so the lookup is fast (in-memory map).
  const verdictsByPredictionId = await loadVerdictIndex();

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

    const skill = computeSkillStats(resolved, verdictsByPredictionId);

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
      skill,
      // Headline ranking eligibility: enough resolved calls AND enough bold
      // calls (medium-or-hard). The bold-call gate is what prevents
      // trivial-spam profiles from cracking the top of the board.
      isRanked:
        resolved.length >= MIN_RANKED_RESOLVED &&
        skill.boldCalls >= MIN_BOLD_CALLS,
    });
  }

  return out;
}

// ─── Skill score math ─────────────────────────────────────────────────

export interface VerdictLookup {
  difficulty: DifficultyLevel;
}

async function loadVerdictIndex(): Promise<Map<string, VerdictLookup>> {
  const map = new Map<string, VerdictLookup>();
  try {
    const rows = await getAllVerdicts();
    for (const r of rows) {
      map.set(r.prediction_id, { difficulty: r.difficulty });
    }
  } catch (e) {
    // DB unavailable — leaderboard falls back to "unknown" difficulty on
    // every resolved prediction, which means skill score = 0 across the
    // board (no one ranks). This is loud-and-obvious vs silently wrong.
    console.warn('[leaderboard] verdict DB load failed:', e);
  }
  return map;
}

export function computeSkillStats(
  resolved: PredictionView[],
  verdictsByPredictionId: Map<string, VerdictLookup>,
): SkillStats {
  const mix: DifficultyMix = { trivial: 0, easy: 0, medium: 0, hard: 0, unknown: 0 };
  let weightedHits = 0;
  let weightedAttempts = 0;
  let boldCalls = 0;

  for (const p of resolved) {
    const v = verdictsByPredictionId.get(p.id);
    if (!v) {
      mix.unknown += 1;
      continue;
    }
    const w = DIFFICULTY_WEIGHTS[v.difficulty];
    mix[v.difficulty] += 1;
    weightedAttempts += w;
    if (p.hit) weightedHits += w;
    if (v.difficulty === 'medium' || v.difficulty === 'hard') boldCalls += 1;
  }

  const rawWeightedHitRate = weightedAttempts > 0 ? weightedHits / weightedAttempts : 0;
  const score = weightedAttempts > 0
    ? Math.round(wilsonLowerBound95(weightedHits, weightedAttempts) * 100)
    : 0;

  return {
    score,
    rawWeightedHitRate,
    weightedAttempts,
    weightedHits,
    boldCalls,
    mix,
  };
}

/**
 * Wilson score interval lower bound at 95% confidence for a Bernoulli
 * proportion. Returns a value in [0, 1].
 *
 * Why Wilson, not raw p: with small samples a raw "3/3 = 100%" overstates
 * skill. Wilson gives that profile less credit until the sample grows. The
 * formula is from Wilson (1927); the prediction-market application is
 * documented in Evan Miller's "How Not To Sort By Average Rating."
 *
 * Note: we pass non-integer "successes" and "trials" because difficulty
 * weights make these continuous. Wilson's formula generalizes cleanly — we
 * treat weightedHits as effective successes and weightedAttempts as
 * effective trials. This is a pragmatic extension; a fully rigorous
 * treatment would use a continuous-version Wilson or a Beta-binomial. For
 * leaderboard sorting at hackathon scale, the discrete-style formula is
 * close enough and easy to reason about.
 */
export function wilsonLowerBound95(successes: number, trials: number): number {
  if (trials <= 0) return 0;
  const z = 1.96; // 95% confidence
  const p = successes / trials;
  const numerator =
    p + (z * z) / (2 * trials) - z * Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials));
  const denominator = 1 + (z * z) / trials;
  const lower = numerator / denominator;
  return Math.max(0, Math.min(1, lower));
}

// Sort by:
//   1. Ranked entries first (passed the bold-call gate)
//   2. Within ranked: skill score desc, then bold-call count desc, then
//      resolved count desc (tiebreakers favor depth + breadth of evidence)
//   3. Within unranked: sealed count desc, then most recent activity
export function sortLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isRanked !== b.isRanked) return a.isRanked ? -1 : 1;
    if (a.isRanked) {
      if (a.skill.score !== b.skill.score) return b.skill.score - a.skill.score;
      if (a.skill.boldCalls !== b.skill.boldCalls) return b.skill.boldCalls - a.skill.boldCalls;
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
