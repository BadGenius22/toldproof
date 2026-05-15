'use client';

import { useState } from 'react';
import { PredictionCard } from '../../components/PredictionCard';
import { FilterTabs } from '../../components/design';
import type { PredictionView } from '../../lib/registry';

type Filter = 'all' | 'sealed' | 'awaiting' | 'revealed';

interface Counts {
  all: number;
  sealed: number;
  awaiting: number;
  revealed: number;
}

export function ProfileFilters({
  counts,
  predictions,
  bestCallId,
}: {
  counts: Counts;
  predictions: PredictionView[];
  bestCallId?: string | null;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const now = Date.now();
  const filtered = predictions.filter((p) => {
    if (filter === 'all') return true;
    if (filter === 'revealed') return p.revealed;
    if (filter === 'sealed') return !p.revealed && now < p.unlockAtMs;
    if (filter === 'awaiting') return !p.revealed && now >= p.unlockAtMs;
    return true;
  });
  // Float the pinned best call to position 0 in every filter view so it's
  // the first thing visitors see. Falls back to natural order when the pin
  // isn't in the current filter.
  const visible = bestCallId
    ? [...filtered].sort((a, b) => {
        if (a.id === bestCallId) return -1;
        if (b.id === bestCallId) return 1;
        return 0;
      })
    : filtered;

  const tabs: Array<{ id: Filter; label: string; n: number }> = [
    { id: 'all', label: 'All', n: counts.all },
    { id: 'sealed', label: 'Still locked', n: counts.sealed },
    { id: 'awaiting', label: 'Ready to open', n: counts.awaiting },
    { id: 'revealed', label: 'Opened', n: counts.revealed },
  ];

  return (
    <>
      <div className="mt-32">
        <FilterTabs
          tabs={tabs.map((t) => ({ id: t.id, label: t.label, count: t.n }))}
          value={filter}
          onChange={setFilter}
          rightHint="Sorted newest first"
        />
      </div>

      <div
        className="mt-16"
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        {visible.map((p) => (
          <PredictionCard key={p.id} p={p} pinned={!!bestCallId && p.id === bestCallId} />
        ))}
        {visible.length === 0 && (
          <div
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
            Nothing here yet.
          </div>
        )}
      </div>
    </>
  );
}
