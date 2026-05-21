// GuaranteeViz — three small static data-viz blocks, one per card in the
// "What we prove" grid. No animation; pure render (server component).

// ─── When · MiniTimeline ───────────────────────────────────────────────

export function MiniTimeline() {
  const NOW_PCT = 35;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div
        style={{
          position: 'relative',
          height: 6,
          background: 'var(--paper-3)',
          borderRadius: 3,
        }}
      >
        <div
          style={{
            width: `${NOW_PCT}%`,
            height: '100%',
            background: 'var(--ink-3)',
            borderRadius: 3,
          }}
        />
        <span
          style={{
            position: 'absolute',
            left: `${NOW_PCT}%`,
            top: -3,
            width: 3,
            height: 12,
            background: 'var(--sealed)',
            transform: 'translateX(-50%)',
            borderRadius: 1,
          }}
        />
      </div>
      <div
        className="mono"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 8.5,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
        }}
      >
        <span>sealed</span>
        <span style={{ color: 'var(--sealed-text)' }}>now</span>
        <span>unlock</span>
      </div>
    </div>
  );
}

// ─── What · HashFingerprint ────────────────────────────────────────────

const HASH_CHUNKS = [
  '4f8e2a7d',
  '1c9b5e3f',
  '6a8d2c4b',
  '7e9f1a3d',
  '5c7e9b1f',
  '3a5c7e9b',
  '1d3f5a7c',
  '9e1b3d5f',
];

export function HashFingerprint() {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div
        className="mono"
        style={{
          fontSize: 11,
          lineHeight: 1.6,
          wordBreak: 'break-all',
          color: 'var(--ink-3)',
        }}
      >
        {HASH_CHUNKS.map((chunk, i) => (
          <span
            key={i}
            style={{
              color: i === 3 ? 'var(--ink)' : 'var(--ink-3)',
              fontWeight: i === 3 ? 700 : 400,
              background: i === 3 ? 'var(--sealed-soft)' : 'transparent',
              marginRight: 3,
            }}
          >
            {chunk}
          </span>
        ))}
      </div>
      <div
        className="mono"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 8.5,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
        }}
      >
        <span>sha256</span>
        <span>64 hex · 256 bits</span>
      </div>
    </div>
  );
}

// ─── Who · HandleLink ──────────────────────────────────────────────────

export function HandleLink() {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 12,
            color: 'var(--ink)',
            fontWeight: 600,
          }}
        >
          @dewaxindo
        </span>
        <span
          aria-hidden
          style={{
            flex: 1,
            borderTop: '1px dashed var(--ink-3)',
            minWidth: 16,
          }}
        />
        <span
          className="mono"
          style={{ fontSize: 11, color: 'var(--ink-3)' }}
        >
          0x3f9a…2a1f
        </span>
      </div>
      <div
        className="mono"
        style={{
          fontSize: 8.5,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          textAlign: 'center',
        }}
      >
        linked on Sui
      </div>
    </div>
  );
}
