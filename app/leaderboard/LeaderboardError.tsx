'use client';

import { useRouter } from 'next/navigation';

// CC-07: full-card error block on /leaderboard replaces the inline error
// strip. Gives the user a clear retry path via router.refresh() — server
// component will re-render and re-attempt buildLeaderboard().
export function LeaderboardError({ message }: { message: string }) {
  const router = useRouter();
  return (
    <div
      className="mt-32"
      style={{
        border: '1px solid var(--warn)',
        background: 'var(--warn-soft)',
        borderRadius: 4,
        padding: '32px 28px',
        display: 'grid',
        gap: 16,
        textAlign: 'center',
        placeItems: 'center',
      }}
    >
      <span className="eyebrow" style={{ color: 'oklch(0.4 0.14 30)' }}>
        Could not load leaderboard
      </span>
      <h2 className="section" style={{ fontSize: 22, margin: 0 }}>
        The board is offline for a moment.
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 13.5,
          color: 'var(--ink-3)',
          lineHeight: 1.55,
          maxWidth: 480,
        }}
      >
        Sui RPC didn&apos;t respond fast enough. Hit retry — it usually
        clears within a few seconds.
      </p>
      <p
        className="mono"
        style={{
          margin: 0,
          fontSize: 11,
          color: 'var(--muted)',
          maxWidth: 480,
          textAlign: 'left',
          whiteSpace: 'pre-wrap',
          background: 'var(--paper-2)',
          padding: '8px 12px',
          borderRadius: 3,
        }}
      >
        {message}
      </p>
      <button
        type="button"
        className="btn"
        onClick={() => router.refresh()}
      >
        Retry
      </button>
    </div>
  );
}
