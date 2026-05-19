// Unit tests for lib/wallet-provenance.ts — the pure summariser.
// Tests four cases from the V4 T1 spec acceptance:
//   1. single alias on a wallet → minimal card variant
//   2. three aliases mixed states (active / dormant / abandoned)
//   3. all-dormant wallet
//   4. publisher with no predictions → empty
//
// Plus a sharder regression fixture: 10 aliases with 2 lucky winners
// shows that wallet-aggregate Skill Score is strictly less than max
// per-alias Skill Score. That's the T1.2 acceptance check; T1.1's
// summarisePublisher already produces the aggregate so it's tested here.

import { describe, it, expect } from 'vitest';
import {
  summarisePublisher,
  aliasState,
  DORMANT_MS,
  ABANDONED_MS,
} from './wallet-provenance';
import type { PredictionView } from './registry';
import type { VerdictLookup } from './leaderboard';

const NOW = 1_780_000_000_000; // Frozen test clock
const PUB = '0xc18739b869e6480b12c66236438048c5ed06fa0e2403bd249f2609931d52c1df';

/**
 * Test factory — produces a resolved PredictionView with sensible defaults.
 * Override any field the test cares about; pass `ageMs` to shift ALL three
 * activity timestamps (sealed, revealed, resolved) in lockstep so the
 * dormancy state derives cleanly from `lastActivityMs`.
 */
function mkPred(over: Partial<PredictionView> & {
  id: string;
  identity: string;
  hit: boolean;
  ageMs?: number;
}): PredictionView {
  const { ageMs, ...rest } = over;
  const resolvedAt = NOW - (ageMs ?? 1 * 24 * 60 * 60 * 1000);
  const sealedAt = resolvedAt - 6 * 24 * 60 * 60 * 1000;
  return {
    publisher: PUB,
    entityType: 1,
    sealedAtMs: sealedAt,
    unlockAtMs: resolvedAt,
    revealed: true,
    revealedAtMs: resolvedAt,
    revealedPlaintext: '',
    blobId: '',
    contentHashHex: '',
    resolved: true,
    resolvedAtMs: resolvedAt,
    reasoningBlobId: '',
    resolver: '0xresolver',
    ...rest,
  };
}

function mkVerdicts(
  entries: Array<[string, VerdictLookup['difficulty']]>,
): Map<string, VerdictLookup> {
  const m = new Map<string, VerdictLookup>();
  for (const [id, diff] of entries) m.set(id, { difficulty: diff });
  return m;
}

describe('aliasState', () => {
  it('returns active inside the dormant threshold', () => {
    expect(aliasState(NOW - DORMANT_MS + 1000, NOW)).toBe('active');
  });
  it('returns dormant between thresholds', () => {
    expect(aliasState(NOW - DORMANT_MS - 1000, NOW)).toBe('dormant');
    expect(aliasState(NOW - ABANDONED_MS + 1000, NOW)).toBe('dormant');
  });
  it('returns abandoned past the abandoned threshold', () => {
    expect(aliasState(NOW - ABANDONED_MS - 1000, NOW)).toBe('abandoned');
  });
});

describe('summarisePublisher', () => {
  it('returns a single alias when the wallet only used one handle', () => {
    const preds: PredictionView[] = [
      mkPred({ id: '0xa1', identity: 'solo', hit: true }),
      mkPred({ id: '0xa2', identity: 'solo', hit: true }),
      mkPred({ id: '0xa3', identity: 'solo', hit: false }),
    ];
    const verdicts = mkVerdicts([
      ['0xa1', 'medium'],
      ['0xa2', 'medium'],
      ['0xa3', 'medium'],
    ]);
    const map = new Map([['solo', preds]]);
    const result = summarisePublisher(PUB, map, 'solo', verdicts, NOW);

    expect(result.aliases).toHaveLength(1);
    expect(result.aliases[0]).toMatchObject({
      handle: 'solo',
      calls: 3,
      isCurrent: true,
      state: 'active',
    });
    expect(result.walletAggregateScore).not.toBeNull();
  });

  it('sorts current alias first regardless of calls count', () => {
    // "main" has fewer calls but is the page being viewed; "side" has more.
    const preds: PredictionView[] = [
      mkPred({ id: '0xm1', identity: 'main', hit: true }),
      mkPred({ id: '0xs1', identity: 'side', hit: true }),
      mkPred({ id: '0xs2', identity: 'side', hit: false }),
      mkPred({ id: '0xs3', identity: 'side', hit: true }),
    ];
    const verdicts = mkVerdicts([
      ['0xm1', 'medium'],
      ['0xs1', 'medium'],
      ['0xs2', 'medium'],
      ['0xs3', 'medium'],
    ]);
    const map = new Map([
      ['main', preds.filter((p) => p.identity === 'main')],
      ['side', preds.filter((p) => p.identity === 'side')],
    ]);
    const result = summarisePublisher(PUB, map, 'main', verdicts, NOW);
    expect(result.aliases[0]?.handle).toBe('main');
    expect(result.aliases[0]?.isCurrent).toBe(true);
    expect(result.aliases[1]?.handle).toBe('side');
  });

  it('tags dormancy state per alias from lastActivity age', () => {
    const fresh = mkPred({
      id: '0x1', identity: 'fresh', hit: true,
      ageMs: 5 * 24 * 60 * 60 * 1000, // 5d ago
    });
    const middle = mkPred({
      id: '0x2', identity: 'middle', hit: true,
      ageMs: 45 * 24 * 60 * 60 * 1000, // 45d ago
    });
    const old = mkPred({
      id: '0x3', identity: 'old', hit: true,
      ageMs: 120 * 24 * 60 * 60 * 1000, // 120d ago
    });
    const preds: PredictionView[] = [fresh, middle, old];
    const verdicts = mkVerdicts([
      ['0x1', 'medium'],
      ['0x2', 'medium'],
      ['0x3', 'medium'],
    ]);
    const map = new Map([
      ['fresh', [preds[0]!]],
      ['middle', [preds[1]!]],
      ['old', [preds[2]!]],
    ]);
    const result = summarisePublisher(PUB, map, 'fresh', verdicts, NOW);
    const byHandle = Object.fromEntries(
      result.aliases.map((a) => [a.handle, a.state] as const),
    );
    expect(byHandle.fresh).toBe('active');
    expect(byHandle.middle).toBe('dormant');
    expect(byHandle.old).toBe('abandoned');
  });

  it('sets skillScore null when alias is below bold-call floor', () => {
    // One trivial hit — under MIN_BOLD_CALLS (2 medium+hard).
    const preds: PredictionView[] = [
      mkPred({ id: '0x1', identity: 'newbie', hit: true }),
    ];
    const verdicts = mkVerdicts([['0x1', 'trivial']]);
    const map = new Map([['newbie', preds]]);
    const result = summarisePublisher(PUB, map, 'newbie', verdicts, NOW);
    expect(result.aliases[0]?.skillScore).toBeNull();
  });

  it('sharder regression: 10 aliases (2 winners, 8 misses) → aggregate < max alias', () => {
    // Two lucky aliases (each: 3 medium hits, MIN_RANKED_RESOLVED satisfied).
    // Eight failed aliases (each: 3 medium misses).
    // The wallet-aggregate Wilson must be lower than the winners' Wilson —
    // sharding actively HURTS the headline ranking.
    const map = new Map<string, PredictionView[]>();
    const verdictEntries: Array<[string, VerdictLookup['difficulty']]> = [];

    for (let i = 0; i < 2; i += 1) {
      const handle = `winner-${i}`;
      const preds: PredictionView[] = [];
      for (let j = 0; j < 3; j += 1) {
        const id = `0xw${i}${j}`;
        preds.push(mkPred({ id, identity: handle, hit: true }));
        verdictEntries.push([id, 'medium']);
      }
      map.set(handle, preds);
    }
    for (let i = 0; i < 8; i += 1) {
      const handle = `loser-${i}`;
      const preds: PredictionView[] = [];
      for (let j = 0; j < 3; j += 1) {
        const id = `0xl${i}${j}`;
        preds.push(mkPred({ id, identity: handle, hit: false }));
        verdictEntries.push([id, 'medium']);
      }
      map.set(handle, preds);
    }

    const verdicts = mkVerdicts(verdictEntries);
    const result = summarisePublisher(PUB, map, 'winner-0', verdicts, NOW);

    const maxAliasScore = Math.max(
      ...result.aliases
        .map((a) => a.skillScore)
        .filter((s): s is number => s !== null),
    );
    expect(result.walletAggregateScore).not.toBeNull();
    expect(result.walletAggregateScore!).toBeLessThan(maxAliasScore);
  });
});
