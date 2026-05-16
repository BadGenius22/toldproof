// Profile card — renders a SealedPrediction row on /[handle].
// Uses the design's status-stripe + chip + cipher-blur treatment.

import Link from 'next/link';
import type { PredictionView } from '../lib/registry';

// PR-05 fallback: real topic-at-lock-time needs a Move struct change (out of
// scope for hackathon). Until then, parse hashtags from the revealed text so
// the chip UI still surfaces topics on settled predictions.
function extractHashtags(text: string): string[] {
  const out: string[] = [];
  if (!text) return out;
  const seen = new Set<string>();
  for (const m of text.matchAll(/#([A-Za-z][A-Za-z0-9_]{1,23})/g)) {
    const tag = m[1]!.toLowerCase();
    if (!seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
  }
  return out;
}
import {
  StatusChip,
  TagChip,
  fakeHexBlock,
  fmtAbs,
  fmtRel,
  predictionStatus,
  shortHash,
} from './design';

interface PredictionCardProps {
  p: PredictionView;
  pinned?: boolean;
}

export function PredictionCard({ p, pinned = false }: PredictionCardProps) {
  const now = Date.now();
  const status = predictionStatus(p, now);
  const accent =
    status === 'revealed'
      ? 'var(--verified)'
      : status === 'unlocked'
        ? 'var(--warn)'
        : 'var(--sealed)';

  // Share text is verdict-aware: only render the affordance when the AI
  // judge has already settled the call, so the headline matches the truth.
  const shareUrl = p.resolved
    ? `https://x.com/intent/post?text=${encodeURIComponent(
        `${p.hit ? '✓ Hit' : '✗ Miss'}: "${p.revealedPlaintext}"\n\nLocked on toldproof.xyz/verify/${p.id}`,
      )}`
    : null;

  return (
    <div style={{ position: 'relative' }}>
      {pinned && (
        <span
          style={{
            position: 'absolute',
            top: -10,
            left: 16,
            zIndex: 2,
          }}
        >
          <TagChip variant="bold">★ Best call so far</TagChip>
        </span>
      )}
    <Link
      href={`/verify/${p.id}`}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'grid',
        gridTemplateColumns: '8px 1fr auto',
        gap: 0,
        background: 'var(--paper)',
        border: pinned ? '1px solid var(--verified)' : '1px solid var(--border)',
        borderRadius: 4,
        overflow: 'hidden',
        transition: 'border-color 0.12s',
      }}
    >
      <div style={{ background: accent }} />
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="row" style={{ gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <StatusChip p={p} now={now} />
            {p.resolved && (
              <TagChip variant={p.hit ? 'verified' : 'warn'}>
                {p.hit ? '✓ Hit' : '✗ Miss'} · AI
              </TagChip>
            )}
          </div>
          <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
            Locked {fmtRel(p.sealedAtMs, now)}
          </span>
        </div>

        {status === 'revealed' ? (
          <div className="col" style={{ gap: 6 }}>
            <p className="mono" style={{ margin: 0, fontSize: 15, lineHeight: 1.4, color: 'var(--ink)' }}>
              &quot;{p.revealedPlaintext}&quot;
            </p>
            {extractHashtags(p.revealedPlaintext).length > 0 && (
              <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                {extractHashtags(p.revealedPlaintext).slice(0, 4).map((tag) => (
                  <TagChip key={tag} variant="neutral">#{tag}</TagChip>
                ))}
              </div>
            )}
          </div>
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
              · hidden until {fmtAbs(p.unlockAtMs).slice(0, 16)} UTC
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
    {shareUrl && (
      <a
        href={shareUrl}
        target="_blank"
        rel="noreferrer"
        className="mono"
        style={{
          position: 'absolute',
          bottom: 8,
          right: 48,
          padding: '3px 9px',
          borderRadius: 3,
          background: 'var(--paper-2)',
          border: '1px solid var(--border)',
          fontSize: 10.5,
          color: 'var(--ink-3)',
          textDecoration: 'none',
          letterSpacing: '0.04em',
          zIndex: 2,
        }}
      >
        𝕏 Share
      </a>
    )}
    </div>
  );
}
