'use client';

import { useEffect, useState } from 'react';

// PC-05: agent-cost estimator slider. localStorage-backed so a returning
// visitor keeps their number. Mirrors how AI infra products like Replicate
// and OpenAI Pricing surface effective monthly cost.

const KEY = 'toldproof.pricing.slider.preds';
const PRICE = 0.1; // USDC per prediction
const MIN = 1;
const MAX = 2000;
const DEFAULT = 200;

export function CostSlider() {
  const [count, setCount] = useState<number>(DEFAULT);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(KEY);
      const parsed = stored ? Number.parseInt(stored, 10) : DEFAULT;
      if (Number.isFinite(parsed) && parsed >= MIN && parsed <= MAX) {
        setCount(parsed);
      }
    } catch {
      /* localStorage unavailable */
    }
    setHydrated(true);
  }, []);

  const onChange = (n: number) => {
    setCount(n);
    try {
      window.localStorage.setItem(KEY, String(n));
    } catch {
      /* ignore */
    }
  };

  const monthly = count * PRICE;
  // SSR: render with default count, hydrate on client.
  const display = hydrated ? count : DEFAULT;
  const monthlyDisplay = hydrated ? monthly : DEFAULT * PRICE;

  return (
    <div
      style={{
        border: '1px solid var(--ink)',
        borderRadius: 4,
        padding: '22px 26px',
        background: 'var(--paper)',
        display: 'grid',
        gap: 14,
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 10 }}>
        <span className="eyebrow">Estimate your agent&apos;s cost</span>
        <span
          className="mono"
          style={{
            fontSize: 11,
            color: 'var(--muted)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          $0.10 per prediction · USDC
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 15,
          lineHeight: 1.55,
          color: 'var(--ink-2)',
        }}
      >
        At{' '}
        <strong
          className="mono"
          style={{ fontSize: 22, color: 'var(--ink)' }}
        >
          {display.toLocaleString()}
        </strong>{' '}
        predictions/month, you&apos;d pay{' '}
        <strong
          className="mono"
          style={{ fontSize: 22, color: 'var(--sealed)' }}
        >
          ${monthlyDisplay.toFixed(2)}
        </strong>
        .
      </p>
      <input
        type="range"
        min={MIN}
        max={MAX}
        value={display}
        onChange={(e) => onChange(Number.parseInt(e.target.value, 10))}
        style={{
          width: '100%',
          accentColor: 'var(--sealed)',
        }}
        aria-label="Predictions per month"
      />
      <div
        className="row mono"
        style={{
          justifyContent: 'space-between',
          fontSize: 10.5,
          color: 'var(--muted)',
          letterSpacing: '0.06em',
        }}
      >
        <span>{MIN}</span>
        <span>500</span>
        <span>1,000</span>
        <span>1,500</span>
        <span>{MAX.toLocaleString()}</span>
      </div>
    </div>
  );
}
