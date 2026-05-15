'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { LeaderboardEntry } from '../../lib/leaderboard';
import { tierFromScore } from '../../lib/leaderboard';
import { EntityBadge, FilterTabs, TagChip, fmtRel, identityDisplay, shortHash } from '../../components/design';
import { DifficultyHistogram, deriveProfileTag } from '../../components/DifficultyHistogram';

type Filter = 'all' | 'humans' | 'agents';
type TimeWindow = '7d' | '30d' | 'all';

const WINDOW_MS: Record<TimeWindow, number | null> = {
  '7d': 7 * 24 * 60 * 60_000,
  '30d': 30 * 24 * 60 * 60_000,
  all: null,
};

export function LeaderboardClient({ entries }: { entries: LeaderboardEntry[] }) {
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

  return (
    <>
      <div className="mt-24">
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

      {ranked.length > 0 && (
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

      {upcoming.length > 0 && (
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
        className="mono"
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
      <div className="col" style={{ gap: 4 }}>
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
          className="mono"
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
      <div className="col" style={{ gap: 4 }}>
        <DifficultyHistogram mix={entry.skill.mix} compact />
        <span
          className="mono"
          style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}
        >
          {hitPct}% hit rate · {entry.stats.hits}/{entry.stats.resolved}
        </span>
      </div>

      {/* Skill Score — the headline ranking number */}
      <div className="col" style={{ gap: 2, alignItems: 'flex-end' }}>
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

      {/* Arrow */}
      <span
        className="mono"
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
