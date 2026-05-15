'use client';

import type { ReactNode } from 'react';

interface Tab<T extends string> {
  id: T;
  label: ReactNode;
  count?: number;
}

interface FilterTabsProps<T extends string> {
  tabs: Tab<T>[];
  value: T;
  onChange: (id: T) => void;
  rightHint?: ReactNode;
}

export function FilterTabs<T extends string>({
  tabs,
  value,
  onChange,
  rightHint,
}: FilterTabsProps<T>) {
  return (
    <div className="filter-bar">
      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`filter-tab${value === t.id ? ' active' : ''}`}
          >
            <span>{t.label}</span>
            {t.count !== undefined && (
              <span className="filter-tab-count">{t.count}</span>
            )}
          </button>
        ))}
      </div>
      {rightHint && <span className="mono filter-hint">{rightHint}</span>}
    </div>
  );
}
