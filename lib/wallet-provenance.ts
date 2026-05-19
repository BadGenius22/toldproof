// Wallet provenance — anti-gaming reputation hardening (V4 T1.1 + foundation
// for T1.2 / T1.4). Off-chain summarisation of public on-chain data: groups
// every alias owned by the same `publisher` address, computes per-alias
// skill stats, marks dormancy. The wallet-aggregate Skill Score (T1.2's
// canonical math fix) is also computed here so the WalletProvenance card
// can render it standalone.
//
// Pure functions are exported separately from the I/O fetcher so they can
// be tested in isolation. Spec: docs/design/V4_BUILD_SPEC_T1.md §T1.1.

import {
  getPredictionsForIdentity,
  listAllIdentities,
  type PredictionView,
} from './registry';
import type { SuiClient } from './sui';
import {
  DIFFICULTY_WEIGHTS,
  MIN_BOLD_CALLS,
  MIN_RANKED_RESOLVED,
  recencyWeight,
  wilsonLowerBound95,
  type VerdictLookup,
} from './leaderboard';
import { getAllVerdicts } from './verdict-store';

// ─── Shared constants ────────────────────────────────────────────────

export const DORMANT_MS = 30 * 24 * 60 * 60 * 1000;
export const ABANDONED_MS = 90 * 24 * 60 * 60 * 1000;
export const CHURN_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

// ─── Types ───────────────────────────────────────────────────────────

export type AliasState = 'active' | 'dormant' | 'abandoned';

export interface AliasSummary {
  /** Lowercased identity string (X handle for humans, alias for agents). */
  handle: string;
  /** 0x… Sui address that signed every seal under this alias. */
  publisher: string;
  /** Count of resolved predictions for this alias. */
  calls: number;
  /** Σ DIFFICULTY_WEIGHTS[hit prediction's difficulty]. */
  weightedHits: number;
  /** Σ DIFFICULTY_WEIGHTS[every resolved prediction's difficulty]. */
  weightedAttempts: number;
  /**
   * Wilson lower-bound × 100. `null` when the alias hasn't crossed the
   * bold-call floor — same gate the leaderboard uses to prevent single-
   * lucky-call ranks.
   */
  skillScore: number | null;
  /** Max(sealedAtMs, revealedAtMs, resolvedAtMs) across all preds. */
  lastActivityMs: number;
  state: AliasState;
  /** True if this row IS the profile being viewed. */
  isCurrent: boolean;
}

export interface WalletProvenance {
  /** 0x… Sui address that owns every alias in the list. */
  publisher: string;
  aliases: AliasSummary[];
  /** Σ weightedHits across aliases. */
  totalWeightedHits: number;
  /** Σ weightedAttempts across aliases. */
  totalWeightedAttempts: number;
  /**
   * Wallet-aggregate Skill Score (T1.2 math): Wilson lower-bound over the
   * SUM of difficulty-weighted hits + attempts. Sharded misses on alias B
   * drag this down vs alias A's per-alias score.
   */
  walletAggregateScore: number | null;
  /** Best per-alias score in the bundle (for the "vs alias-best" delta). */
  bestAliasScore: number | null;
  /** V4 T1.4 — behaviour signal: single / multi / churn / spam / null. */
  badge: BehaviorBadge;
}

// ─── Pure helpers ────────────────────────────────────────────────────

export function aliasState(lastActivityMs: number, nowMs: number): AliasState {
  const age = nowMs - lastActivityMs;
  if (age < DORMANT_MS) return 'active';
  if (age < ABANDONED_MS) return 'dormant';
  return 'abandoned';
}

/**
 * Pure: takes a publisher's predictions grouped by alias + the verdict
 * index, returns the WalletProvenance summary. No I/O. Tested in isolation.
 */
export function summarisePublisher(
  publisher: string,
  predictionsByAlias: Map<string, PredictionView[]>,
  currentHandle: string,
  verdictsByPredictionId: Map<string, VerdictLookup>,
  nowMs: number,
): WalletProvenance {
  const lcCurrent = currentHandle.toLowerCase();
  const aliases: AliasSummary[] = [];

  for (const [handle, preds] of predictionsByAlias.entries()) {
    const resolved = preds.filter((p) => p.resolved);

    let weightedHits = 0;
    let weightedAttempts = 0;
    let boldCalls = 0;
    for (const p of resolved) {
      const v = verdictsByPredictionId.get(p.id);
      if (!v) continue;
      // V4 T1.3 — same recency decay as computeSkillStats. Keeps the
      // wallet-aggregate consistent with per-alias scores.
      const anchor = p.resolvedAtMs ?? p.sealedAtMs;
      const w = DIFFICULTY_WEIGHTS[v.difficulty] * recencyWeight(anchor, nowMs);
      weightedAttempts += w;
      if (p.hit) weightedHits += w;
      if (v.difficulty === 'medium' || v.difficulty === 'hard') boldCalls += 1;
    }

    const eligibleForScore =
      resolved.length >= MIN_RANKED_RESOLVED &&
      boldCalls >= MIN_BOLD_CALLS &&
      weightedAttempts > 0;
    const skillScore = eligibleForScore
      ? Math.round(wilsonLowerBound95(weightedHits, weightedAttempts) * 100)
      : null;

    let lastActivityMs = 0;
    for (const p of preds) {
      lastActivityMs = Math.max(
        lastActivityMs,
        p.sealedAtMs,
        p.revealedAtMs || 0,
        p.resolvedAtMs || 0,
      );
    }

    aliases.push({
      handle: handle.toLowerCase(),
      publisher,
      calls: resolved.length,
      weightedHits,
      weightedAttempts,
      skillScore,
      lastActivityMs,
      state: aliasState(lastActivityMs, nowMs),
      isCurrent: handle.toLowerCase() === lcCurrent,
    });
  }

  // Sort: current first, then by calls desc, then by lastActivity desc.
  aliases.sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    if (a.calls !== b.calls) return b.calls - a.calls;
    return b.lastActivityMs - a.lastActivityMs;
  });

  // Wallet-aggregate (T1.2 math): Wilson over the sum.
  let totalWeightedHits = 0;
  let totalWeightedAttempts = 0;
  for (const a of aliases) {
    totalWeightedHits += a.weightedHits;
    totalWeightedAttempts += a.weightedAttempts;
  }
  const walletAggregateScore =
    totalWeightedAttempts > 0
      ? Math.round(wilsonLowerBound95(totalWeightedHits, totalWeightedAttempts) * 100)
      : null;

  const scoredAliases = aliases.filter((a) => a.skillScore !== null);
  const bestAliasScore = scoredAliases.length
    ? Math.max(...scoredAliases.map((a) => a.skillScore as number))
    : null;

  return {
    publisher,
    aliases,
    totalWeightedHits,
    totalWeightedAttempts,
    walletAggregateScore,
    bestAliasScore,
    badge: deriveBehaviorBadge(aliases, nowMs),
  };
}

// ─── Behaviour badge derivation (V4 T1.4) ────────────────────────────

export type BehaviorBadge = 'single' | 'multi' | 'churn' | 'spam' | null;

export interface BehaviorBadgeRule {
  variant: NonNullable<BehaviorBadge>;
  label: string;
  rule: string;
  /** Plain-English signal shown on hover / docs page. */
  signal: string;
}

export const BEHAVIOR_BADGE_RULES: BehaviorBadgeRule[] = [
  {
    variant: 'spam',
    label: '⏹ Identity-spam',
    rule: 'aliasCount ≥ 10',
    signal:
      'Strong warning. Auto-demoted from the default leaderboard view; surface via opt-in toggle only.',
  },
  {
    variant: 'churn',
    label: '! Alias-churner',
    rule:
      'aliasCount ≥ 4 in trailing 90d AND ≥ 50% of those aliases became dormant within 30d',
    signal: 'Warning — looks like sharded reputation. Surface but don\'t suppress.',
  },
  {
    variant: 'multi',
    label: '◇ Multi-persona',
    rule:
      '2-3 aliases, all currently active, none ever abandoned',
    signal: 'Legitimate segmentation — like a person operating two parallel handles.',
  },
  {
    variant: 'single',
    label: '⚡ Single-caller',
    rule: 'aliasCount = 1 AND ≥ 10 resolved predictions',
    signal: 'High-trust. One alias, sustained track record.',
  },
];

/**
 * Computes the trust badge for a wallet from its alias summaries. Rules
 * are checked in priority order (spam > churn > multi > single); first
 * match wins. Returns `null` when no rule applies (insufficient data).
 *
 * Pure, deterministic. Tested in wallet-provenance.test.ts.
 */
export function deriveBehaviorBadge(
  aliases: AliasSummary[],
  nowMs: number,
): BehaviorBadge {
  const total = aliases.length;
  if (total === 0) return null;

  // Spam — sheer alias count
  if (total >= 10) return 'spam';

  // Churn — many recent claims, mostly dormant within 30d
  const recent = aliases.filter(
    (a) => nowMs - a.lastActivityMs <= CHURN_WINDOW_MS,
  );
  if (recent.length >= 4) {
    const wentDormantFast = recent.filter(
      (a) => a.state === 'dormant' || a.state === 'abandoned',
    ).length;
    if (wentDormantFast / recent.length >= 0.5) return 'churn';
  }

  // Multi — legit segmentation: 2-3 aliases, all active, no abandons
  if (total >= 2 && total <= 3) {
    const allActive = aliases.every((a) => a.state === 'active');
    const noAbandoned = aliases.every((a) => a.state !== 'abandoned');
    if (allActive && noAbandoned) return 'multi';
  }

  // Single — disciplined, sustained
  if (total === 1) {
    const calls = aliases[0]?.calls ?? 0;
    if (calls >= 10) return 'single';
  }

  return null;
}

// ─── I/O ─────────────────────────────────────────────────────────────

/**
 * Fetches every alias owned by the publisher of `currentHandle`. Returns
 * `null` if the handle has no on-chain predictions yet (caller renders the
 * "unavailable" placeholder).
 *
 * Cost today: O(N) RPC calls where N = identities in the Registry. At
 * hackathon scale (~10s of identities) this is fine. Optimize later via
 * publisher event filter when N grows.
 */
export async function getProvenanceForHandle(
  client: SuiClient,
  currentHandle: string,
  nowMs: number = Date.now(),
): Promise<WalletProvenance | null> {
  const lcHandle = currentHandle.toLowerCase();

  // Step 1 — current handle's predictions tell us the publisher.
  let ownPreds: PredictionView[] = [];
  try {
    ownPreds = await getPredictionsForIdentity(client, lcHandle);
  } catch {
    return null;
  }
  if (ownPreds.length === 0) return null;
  const publisher = ownPreds[0]!.publisher;

  // Step 2 — walk all identities, collect ones that share the publisher.
  const predictionsByAlias = new Map<string, PredictionView[]>();
  predictionsByAlias.set(lcHandle, ownPreds);

  let allIdentities: string[] = [];
  try {
    allIdentities = await listAllIdentities(client);
  } catch {
    // If we can't list, fall through with just the current alias.
  }
  for (const id of allIdentities) {
    const lc = id.toLowerCase();
    if (lc === lcHandle) continue;
    try {
      const preds = await getPredictionsForIdentity(client, lc);
      const ours = preds.filter((p) => p.publisher === publisher);
      if (ours.length > 0) predictionsByAlias.set(lc, ours);
    } catch {
      // skip dead identities silently
    }
  }

  // Step 3 — pull all verdicts (best-effort; DB unavailable = null scores).
  const verdictsByPredictionId = new Map<string, VerdictLookup>();
  try {
    const verdicts = await getAllVerdicts();
    for (const v of verdicts) {
      verdictsByPredictionId.set(v.prediction_id, { difficulty: v.difficulty });
    }
  } catch (e) {
    console.warn('[wallet-provenance] verdict DB load failed:', e);
  }

  return summarisePublisher(
    publisher,
    predictionsByAlias,
    lcHandle,
    verdictsByPredictionId,
    nowMs,
  );
}
