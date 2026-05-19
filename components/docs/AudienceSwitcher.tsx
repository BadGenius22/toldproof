'use client';

// Three-tab audience picker. Persists choice to localStorage so the docs
// index always opens in the visitor's preferred ordering.

import { useEffect, useState } from 'react';

export type Audience = 'judge' | 'developer' | 'operator';

const STORAGE_KEY = 'tp_docs_audience';

interface Props {
  value: Audience;
  onChange: (next: Audience) => void;
}

export function AudienceSwitcher({ value, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Audience"
      style={{
        display: 'inline-flex',
        gap: 0,
        padding: 4,
        background: 'var(--paper-2)',
        border: '1px solid var(--border)',
        borderRadius: 4,
      }}
    >
      {(['judge', 'developer', 'operator'] as const).map((a) => {
        const active = a === value;
        return (
          <button
            key={a}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(a)}
            className="mono"
            style={{
              border: 'none',
              cursor: 'pointer',
              padding: '6px 14px',
              borderRadius: 3,
              background: active ? 'var(--ink)' : 'transparent',
              color: active ? 'var(--paper)' : 'var(--ink-2)',
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: active ? 600 : 400,
            }}
          >
            {a}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Reads the persisted choice on first render. Defaults to "developer".
 * Pair with AudienceSwitcher to manage state.
 */
export function useAudience(): [Audience, (a: Audience) => void] {
  const [audience, setAudience] = useState<Audience>('developer');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'judge' || stored === 'developer' || stored === 'operator') {
        // Hydrating client-only state from localStorage on mount.
        // The cascading render is intentional (default → stored value).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAudience(stored);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function set(next: Audience) {
    setAudience(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  return [audience, set];
}
