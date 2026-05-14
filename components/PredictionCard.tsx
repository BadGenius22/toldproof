// Profile card — renders a SealedPrediction row on /[handle].
// Uses the design's status-stripe + chip + cipher-blur treatment.

import Link from 'next/link';
import type { PredictionView } from '../lib/registry';
import {
  StatusChip,
  fakeHexBlock,
  fmtAbs,
  fmtRel,
  predictionStatus,
  shortHash,
} from './design';

export function PredictionCard({ p }: { p: PredictionView }) {
  const now = Date.now();
  const status = predictionStatus(p, now);
  const accent =
    status === 'revealed'
      ? 'var(--verified)'
      : status === 'unlocked'
        ? 'var(--warn)'
        : 'var(--sealed)';

  return (
    <Link
      href={`/verify/${p.id}`}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'grid',
        gridTemplateColumns: '8px 1fr auto',
        gap: 0,
        background: 'var(--paper)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        overflow: 'hidden',
        transition: 'border-color 0.12s',
      }}
    >
      <div style={{ background: accent }} />
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="row" style={{ gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <StatusChip p={p} now={now} />
          <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
            Sealed {fmtRel(p.sealedAtMs, now)}
          </span>
        </div>

        {status === 'revealed' ? (
          <p className="mono" style={{ margin: 0, fontSize: 15, lineHeight: 1.4, color: 'var(--ink)' }}>
            &quot;{p.revealedPlaintext}&quot;
          </p>
        ) : (
          <div
            className="mono"
            style={{
              margin: 0,
              fontSize: 13,
              color: 'var(--muted)',
              letterSpacing: '0.04em',
            }}
          >
            <span style={{ filter: 'blur(0.6px)', letterSpacing: '0.15em' }}>
              {fakeHexBlock(p.id, 22).match(/.{1,2}/g)!.join(' ')}
            </span>
            <span style={{ color: 'var(--ink-3)', marginLeft: 8 }}>
              · encrypted until {fmtAbs(p.unlockAtMs).slice(0, 16)} UTC
            </span>
          </div>
        )}

        <div
          className="row"
          style={{
            gap: 14,
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 11,
            color: 'var(--muted)',
            flexWrap: 'wrap',
          }}
        >
          <span>id:{shortHash(p.id, 6, 4)}</span>
          <span>·</span>
          <span>sha256:{p.contentHashHex.slice(0, 12)}…</span>
          <span>·</span>
          <span>walrus:{p.blobId.slice(0, 10)}…</span>
        </div>
      </div>
      <div
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          color: 'var(--muted)',
          fontFamily: 'var(--font-mono), monospace',
          fontSize: 18,
        }}
      >
        →
      </div>
    </Link>
  );
}
