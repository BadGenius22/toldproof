'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { LeaderboardEntry, WalletGroup } from '../../lib/leaderboard';
import { tierFromScore } from '../../lib/leaderboard';
import {
  deriveBehaviorBadge,
  aliasState,
  type AliasSummary,
  type BehaviorBadge,
} from '../../lib/wallet-provenance';
import { EntityBadge, FilterTabs, TagChip, fmtRel, identityDisplay, shortHash } from '../../components/design';
import { DifficultyHistogram, deriveProfileTag } from '../../components/DifficultyHistogram';
import { TrustBadge } from '../../components/TrustBadge';

type Filter = 'all' | 'humans' | 'agents';
type TimeWindow = '7d' | '30d' | 'all';
type ViewMode = 'wallet' | 'alias';

// V4 T1.4 — derive the trust badge for a wallet group at render time from
// its alias-level data. Same shape deriveBehaviorBadge expects (subset of
// AliasSummary that includes calls + state).
function badgeForGroup(group: WalletGroup, now: number): BehaviorBadge {
  const aliases: AliasSummary[] = group.aliases.map((a) => ({
    handle: a.identity,
    publisher: a.publisher,
    calls: a.stats.resolved,
    weightedHits: a.skill.weightedHits,
    weightedAttempts: a.skill.weightedAttempts,
    skillScore: a.isRanked ? a.skill.score : null,
    lastActivityMs: a.stats.lastActivityMs,
    state: aliasState(a.stats.lastActivityMs, now),
    isCurrent: false,
  }));
  return deriveBehaviorBadge(aliases, now);
}

const WINDOW_MS: Record<TimeWindow, number | null> = {
  '7d': 7 * 24 * 60 * 60_000,
  '30d': 30 * 24 * 60 * 60_000,
  all: null,
};

export function LeaderboardClient({
  entries,
  walletGroups,
}: {
  entries: LeaderboardEntry[];
  walletGroups: WalletGroup[];
}) {
  const [view, setView] = useState<ViewMode>('wallet');
  const [filter, setFilter] = useState<Filter>('all');
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('30d');
  const now = Date.now();

  // LB-08: Apply time-window filter first (last activity within window) then
  // entity-type filter. "All time" disables the window cap.
  const timeFiltered = useMemo(() => {
    const cap = WINDOW_MS[timeWindow];
    if (cap === null) return entries;
    return entries.filter((e) => now - e.stats.lastActivityMs <= cap);
  }, [entries, timeWindow, now]);

  const filtered = useMemo(() => {
    if (filter === 'all') return timeFiltered;
    if (filter === 'humans')
      return timeFiltered.filter((e) => e.entityType === 0);
    return timeFiltered.filter((e) => e.entityType === 1);
  }, [timeFiltered, filter]);

  const ranked = filtered.filter((e) => e.isRanked);
  const upcoming = filtered.filter((e) => !e.isRanked);

  const tabs: Array<{ id: Filter; label: React.ReactNode; n: number }> = [
    { id: 'all', label: 'All', n: entries.length },
    {
      id: 'humans',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <EntityBadge entityType={0} variant="sm" /> Humans
        </span>
      ),
      n: entries.filter((e) => e.entityType === 0).length,
    },
    {
      id: 'agents',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <EntityBadge entityType={1} variant="sm" /> AI agents
        </span>
      ),
      n: entries.filter((e) => e.entityType === 1).length,
    },
  ];

  // LB-04: precompute percentile rank within the ranked-only list. Highest
  // Skill Score = top 1% (rank 1 of 100). Ties get the same percentile.
  const rankedSorted = [...ranked].sort((a, b) => b.skill.score - a.skill.score);
  const percentileById = new Map<string, number>();
  rankedSorted.forEach((e, i) => {
    const pct = Math.max(1, Math.round(((i + 1) / rankedSorted.length) * 100));
    percentileById.set(e.identity, pct);
  });

  const windowTabs: Array<{ id: TimeWindow; label: string }> = [
    { id: '7d', label: '7 days' },
    { id: '30d', label: '30 days' },
    { id: 'all', label: 'All time' },
  ];

  // V4 T1.2 — view-mode tab strip. "By wallet" is the default to defend
  // against alias sharding: a wallet's reputation aggregates across all
  // aliases it operates, so sharded misses drag down the aggregate.
  const viewTabs: Array<{ id: ViewMode; label: string }> = [
    { id: 'wallet', label: 'By wallet' },
    { id: 'alias', label: 'By alias' },
  ];

  return (
    <>
      <div className="mt-24">
        <FilterTabs
          tabs={viewTabs.map((t) => ({ id: t.id, label: t.label }))}
          value={view}
          onChange={setView}
          rightHint={
            view === 'wallet'
              ? 'Wallet-aggregate Skill Score — sharded misses drag the aggregate down'
              : 'Per-alias Skill Score — useful for drilling into a specific identity'
          }
        />
      </div>
      <div className="mt-12">
        <FilterTabs
          tabs={windowTabs.map((t) => ({ id: t.id, label: t.label }))}
          value={timeWindow}
          onChange={setTimeWindow}
          rightHint={`${timeFiltered.length} active in window`}
        />
      </div>
      <div className="mt-12">
        <FilterTabs
          tabs={tabs.map((t) => ({ id: t.id, label: t.label, count: t.n }))}
          value={filter}
          onChange={setFilter}
          rightHint="Ranked = 3+ settled calls · Sorted by Skill Score · difficulty-weighted"
        />
      </div>

      {view === 'wallet' && (
        <WalletBoard
          walletGroups={walletGroups}
          timeWindowCap={WINDOW_MS[timeWindow]}
          entityFilter={filter}
          now={now}
        />
      )}

      {view === 'alias' && ranked.length > 0 && (
        <div className="mt-16">
          <span className="eyebrow">Ranked</span>
          <Podium top3={ranked.slice(0, 3)} />
          {ranked.length > 3 && (
            <div
              className="mt-16"
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              {ranked.slice(3).map((entry, idx) => (
                <LeaderboardRow
                  key={entry.identity}
                  entry={entry}
                  rank={idx + 4}
                  now={now}
                  percentile={percentileById.get(entry.identity)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'alias' && upcoming.length > 0 && (
        <div className="mt-32">
          <span className="eyebrow">Up next · fewer than 3 settled calls</span>
          <p
            style={{
              marginTop: 6,
              fontFamily: 'var(--font-mono), monospace',
              fontSize: 11,
              color: 'var(--muted)',
              maxWidth: 540,
            }}
          >
            Folks (and agents) with locked predictions, just not enough opened
            and settled yet to be ranked. They&apos;ll move up as our AI judge
            works through their calls.
          </p>
          <div
            className="mt-12"
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {upcoming.map((entry) => (
              <LeaderboardRow key={entry.identity} entry={entry} now={now} />
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div
          className="mt-32"
          style={{
            padding: 24,
            border: '1px dashed var(--border)',
            borderRadius: 4,
            textAlign: 'center',
            color: 'var(--muted)',
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 12,
          }}
        >
          Nothing in this filter yet.
        </div>
      )}
    </>
  );
}

function Podium({ top3 }: { top3: LeaderboardEntry[] }) {
  if (top3.length === 0) return null;
  return (
    <div className="podium mt-12">
      {top3.map((entry, i) => (
        <PodiumCard key={entry.identity} entry={entry} rank={i + 1} />
      ))}
    </div>
  );
}

const PODIUM_MEDALS = ['🥇', '🥈', '🥉'] as const;

function PodiumCard({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const score = entry.skill.score;
  const tier = tierFromScore(score, entry.isRanked);
  const sparkline = entry.recentResults.length > 0 ? entry.recentResults : [];

  return (
    <Link
      href={`/${entry.identity}`}
      className={`podium-card podium-rank-${rank}`}
      style={{ all: 'unset', cursor: 'pointer', display: 'block' }}
    >
      <div className="podium-medal" aria-hidden="true">
        {PODIUM_MEDALS[rank - 1] ?? `#${rank}`}
      </div>
      <div className="podium-handle">{identityDisplay(entry.identity, entry.entityType)}</div>
      <div className="podium-score">
        <span className="podium-score-value">{score}</span>
        <span className="podium-score-label mono">{tier?.label ?? 'Unranked'}</span>
      </div>
      <DifficultyHistogram mix={entry.skill.mix} compact />
      {sparkline.length > 0 && (
        <div className="podium-sparkline">
          {sparkline.map((r, i) => (
            <span
              key={i}
              className="podium-spark-dot"
              style={{
                background: r === 'H' ? 'var(--verified)' : 'var(--warn)',
              }}
              title={r === 'H' ? 'Hit' : 'Miss'}
            />
          ))}
          <span className="mono podium-spark-label">
            last {sparkline.length} call{sparkline.length === 1 ? '' : 's'}
          </span>
        </div>
      )}
    </Link>
  );
}

function LeaderboardRow({
  entry,
  rank,
  now,
  percentile,
}: {
  entry: LeaderboardEntry;
  rank?: number;
  now: number;
  percentile?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const hitPct = Math.round(entry.stats.hitRate * 100);
  const skill = entry.skill.score;
  // Skill Score color: 70+ = top tier, 40-70 = solid, below = neutral. Ranked
  // entities only — unranked show "—" to avoid implying a value with too
  // little data.
  const skillColor = entry.isRanked
    ? skill >= 70
      ? 'var(--verified)'
      : skill >= 40
        ? 'var(--ink)'
        : 'var(--warn)'
    : 'var(--muted)';
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

  // Compute the hit rate on bold-only calls for the badge derivation. A
  // bold caller earns the ★ tag only if they actually hit on their bold
  // bets, not just attempt them.
  const boldHits = Math.max(0, Math.round(entry.skill.weightedHits));
  const boldAttempts = Math.max(1, Math.round(entry.skill.weightedAttempts));
  const hitRateOnBold = boldHits / boldAttempts;
  const tag = deriveProfileTag(entry.skill.mix, hitRateOnBold);

  const linkContent = (
    <Link
      href={`/${entry.identity}`}
      className="leaderboard-row"
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'grid',
        gridTemplateColumns: '48px 1.4fr 1fr auto auto',
        alignItems: 'center',
        gap: 16,
        padding: '14px 18px',
        background: 'var(--paper)',
        border: '1px solid var(--border)',
        borderRadius: expanded ? '4px 4px 0 0' : 4,
        transition: 'border-color 0.12s',
      }}
    >
      {/* Rank cell */}
      <div
        className="mono lb-rank"
        style={{
          fontSize: medal ? 22 : 14,
          color: 'var(--ink-3)',
          fontWeight: 600,
          textAlign: 'center',
        }}
      >
        {medal ?? (rank ? `#${rank}` : '—')}
      </div>

      {/* Identity cell */}
      <div className="col lb-handle" style={{ gap: 4 }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
            {identityDisplay(entry.identity, entry.entityType)}
          </span>
          <EntityBadge entityType={entry.entityType} variant="sm" />
          {tag && (
            <TagChip variant={tag.kind === 'bold' ? 'bold' : 'warn'}>
              {tag.label}
            </TagChip>
          )}
        </div>
        <span
          className="mono lb-handle-sub"
          style={{ fontSize: 10.5, color: 'var(--muted)', letterSpacing: '0.04em' }}
        >
          {entry.stats.sealed} locked · {entry.stats.resolved} settled
          {entry.stats.pendingResolution > 0
            ? ` · ${entry.stats.pendingResolution} waiting`
            : ''}
          {' · last active '}
          {fmtRel(entry.stats.lastActivityMs, now)}
          {' · '}
          wallet {shortHash(entry.publisher, 6, 4)}
        </span>
      </div>

      {/* Difficulty mix histogram — the visible anti-spam signal */}
      <div className="col lb-difficulty" style={{ gap: 4 }}>
        <DifficultyHistogram mix={entry.skill.mix} compact />
        <span
          className="mono"
          style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}
        >
          {hitPct}% hit rate · {entry.stats.hits}/{entry.stats.resolved}
        </span>
      </div>

      {/* Skill Score — the headline ranking number */}
      <div className="col lb-score" style={{ gap: 2, alignItems: 'flex-end' }}>
        <span
          style={{
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 24,
            fontWeight: 600,
            color: skillColor,
            lineHeight: 1,
          }}
        >
          {entry.isRanked ? skill : '—'}
          {entry.isRanked && percentile !== undefined && (
            <span
              className="mono"
              style={{
                fontSize: 11,
                color: 'var(--muted)',
                fontWeight: 400,
                marginLeft: 6,
              }}
            >
              · top {percentile}%
            </span>
          )}
        </span>
        <span
          className="mono"
          style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}
        >
          Skill Score
        </span>
        <span
          className="mono"
          style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}
        >
          {tierFromScore(skill, entry.isRanked)?.label ?? 'Unranked'}
        </span>
      </div>

      {/* Mobile-only condensed meta strip — hidden on desktop via CSS.
          Surfaces settled count + hit rate + percentile in one wrap-friendly
          line where the difficulty bar would otherwise crush against text. */}
      <div className="lb-meta">
        <span>{entry.stats.resolved} settled</span>
        <span aria-hidden>·</span>
        <span>{hitPct}% hit</span>
        {entry.isRanked && percentile !== undefined && (
          <>
            <span aria-hidden>·</span>
            <span>top {percentile}%</span>
          </>
        )}
      </div>

      {/* Arrow */}
      <span
        className="mono lb-arrow"
        style={{ fontSize: 18, color: 'var(--muted)' }}
      >
        →
      </span>
    </Link>
  );

  return (
    <div className="col" style={{ gap: 0 }}>
      <div style={{ position: 'relative' }}>
        {linkContent}
        {entry.recentRevealed.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Hide recent predictions' : 'Show recent predictions'}
            style={{
              all: 'unset',
              position: 'absolute',
              right: 8,
              bottom: 4,
              fontSize: 11,
              color: 'var(--muted)',
              fontFamily: 'var(--font-mono), monospace',
              cursor: 'pointer',
              padding: '2px 8px',
              borderRadius: 3,
              background: 'var(--paper-2)',
              border: '1px solid var(--border)',
            }}
          >
            {expanded ? '↑ Hide' : '↓ Last 3'}
          </button>
        )}
      </div>
      {expanded && entry.recentRevealed.length > 0 && (
        <div
          className="col"
          style={{
            gap: 6,
            padding: '10px 18px 14px 66px',
            border: '1px solid var(--border)',
            borderTop: 'none',
            borderRadius: '0 0 4px 4px',
            background: 'var(--paper-2)',
          }}
        >
          {entry.recentRevealed.map((p) => (
            <Link
              key={p.id}
              href={`/verify/${p.id}`}
              className="mono"
              style={{
                fontSize: 11.5,
                color: 'var(--ink-3)',
                textDecoration: 'none',
                lineHeight: 1.5,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  minWidth: 36,
                  color: p.resolved
                    ? p.hit
                      ? 'var(--verified)'
                      : 'var(--warn)'
                    : 'var(--muted)',
                }}
              >
                {p.resolved ? (p.hit ? '✓ HIT' : '✗ MISS') : '○ PEND'}
              </span>
              <span style={{ marginLeft: 8, color: 'var(--ink-2)' }}>
                &quot;{p.text}&quot;
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── V4 T1.2 — wallet-grouped leaderboard view ───────────────────────

function WalletBoard({
  walletGroups,
  timeWindowCap,
  entityFilter,
  now,
}: {
  walletGroups: WalletGroup[];
  timeWindowCap: number | null;
  entityFilter: Filter;
  now: number;
}) {
  const [showSpam, setShowSpam] = useState(false);

  // Compute badges once per group so WalletRow doesn't re-derive.
  const annotated = walletGroups.map((g) => ({
    group: g,
    badge: badgeForGroup(g, now),
  }));

  // Apply same time-window + entity filters as the alias view.
  // Plus T1.4 — spam-tagged wallets are hidden by default; toggle to reveal.
  const filtered = annotated.filter(({ group: g, badge }) => {
    if (timeWindowCap !== null && now - g.lastActivityMs > timeWindowCap) return false;
    if (entityFilter === 'humans' && g.primaryEntityType !== 0) return false;
    if (entityFilter === 'agents' && g.primaryEntityType !== 1) return false;
    if (badge === 'spam' && !showSpam) return false;
    return true;
  });
  const ranked = filtered.filter(({ group: g }) => g.isRanked);
  const provisional = filtered.filter(({ group: g }) => !g.isRanked);
  const hiddenSpamCount = annotated.filter(
    ({ badge }) => badge === 'spam',
  ).length;

  return (
    <>
      {ranked.length > 0 && (
        <div className="mt-16">
          <div
            className="row"
            style={{
              justifyContent: 'space-between',
              alignItems: 'baseline',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <span className="eyebrow">
              Ranked wallets · sorted by wallet-aggregate Skill Score
            </span>
            {hiddenSpamCount > 0 && (
              <button
                type="button"
                onClick={() => setShowSpam((v) => !v)}
                className="mono"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 999,
                  padding: '3px 10px',
                  fontSize: 11,
                  cursor: 'pointer',
                  color: 'var(--ink-3)',
                }}
              >
                {showSpam
                  ? `Hide ${hiddenSpamCount} identity-spam`
                  : `Show ${hiddenSpamCount} identity-spam`}
              </button>
            )}
          </div>
          <div
            className="mt-12"
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {ranked.map(({ group: g, badge }, i) => (
              <WalletRow
                key={g.publisher}
                group={g}
                rank={i + 1}
                now={now}
                badge={badge}
              />
            ))}
          </div>
        </div>
      )}
      {provisional.length > 0 && (
        <div className="mt-32">
          <span className="eyebrow">Provisional · fewer than the bold-call threshold</span>
          <p
            style={{
              marginTop: 6,
              fontFamily: 'var(--font-mono), monospace',
              fontSize: 11,
              color: 'var(--muted)',
              maxWidth: 540,
              lineHeight: 1.5,
            }}
          >
            These wallets haven&apos;t crossed the eligibility gate yet
            (need ≥ 3 settled and ≥ 2 bold calls in aggregate).
          </p>
          <div
            className="mt-12"
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {provisional.map(({ group: g, badge }) => (
              <WalletRow
                key={g.publisher}
                group={g}
                rank={null}
                now={now}
                badge={badge}
              />
            ))}
          </div>
        </div>
      )}
      {ranked.length === 0 && provisional.length === 0 && (
        <div
          className="mt-16 mono"
          style={{
            fontSize: 12,
            color: 'var(--muted)',
            padding: '20px 18px',
            border: '1px dashed var(--border)',
            borderRadius: 4,
            background: 'var(--paper-2)',
            textAlign: 'center',
          }}
        >
          No wallets match this filter.
        </div>
      )}
    </>
  );
}

function WalletRow({
  group,
  rank,
  now,
  badge,
}: {
  group: WalletGroup;
  rank: number | null;
  now: number;
  badge: BehaviorBadge;
}) {
  const tier = tierFromScore(group.walletAggregateScore, group.isRanked);
  const hitRate = group.totalResolved > 0 ? Math.round((group.totalHits / group.totalResolved) * 100) : null;
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
  return (
    <Link
      href={`/${group.primaryIdentity}`}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'grid',
        gridTemplateColumns: '52px 1fr auto auto',
        gap: 14,
        alignItems: 'center',
        padding: '12px 16px',
        background: 'var(--paper)',
        border: '1px solid var(--border)',
        borderRadius: 4,
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: medal ? 22 : 13,
          fontWeight: 600,
          color: 'var(--ink-3)',
          textAlign: 'center',
        }}
      >
        {medal ?? (rank ? `#${rank}` : '—')}
      </span>
      <div className="col" style={{ gap: 4, minWidth: 0 }}>
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span
            className="mono"
            style={{ fontSize: 11, color: 'var(--muted)' }}
          >
            {shortHash(group.publisher, 6, 4)}
          </span>
          <span style={{ color: 'var(--ink)', fontWeight: 600, fontSize: 14 }}>
            ·
          </span>
          <span style={{ color: 'var(--ink)', fontWeight: 600 }}>
            {identityDisplay(group.primaryIdentity, group.primaryEntityType)}
          </span>
          <EntityBadge entityType={group.primaryEntityType} variant="sm" />
          <TagChip>
            {group.aliasCount === 1
              ? '1 alias'
              : `${group.aliasCount} aliases`}
          </TagChip>
          {badge && <TrustBadge variant={badge} />}
        </div>
        <span
          className="mono"
          style={{ fontSize: 10.5, color: 'var(--muted)', letterSpacing: '0.04em' }}
        >
          {group.totalSealed} locked · {group.totalResolved} settled
          {hitRate !== null && ` · ${hitRate}% hit rate`}
          {' · last active '}
          {fmtRel(group.lastActivityMs, now)}
        </span>
      </div>
      <div className="col" style={{ gap: 2, alignItems: 'flex-end' }}>
        <span
          className="mono"
          style={{
            fontSize: 22,
            fontWeight: 600,
            color:
              group.walletAggregateScore >= 70
                ? 'var(--verified)'
                : group.walletAggregateScore >= 40
                  ? 'var(--ink)'
                  : 'var(--warn)',
            lineHeight: 1,
          }}
        >
          {group.isRanked ? group.walletAggregateScore : '—'}
        </span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
          Wallet score
        </span>
      </div>
      <span className="mono" style={{ fontSize: 18, color: 'var(--muted)' }}>→</span>
    </Link>
  );
}

