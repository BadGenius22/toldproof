// Public profile — `/[handle]` lists every prediction sealed under that X handle.
// Reads directly from the on-chain Registry's `by_handle: Table<String, vector<ID>>`.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getPredictionsForHandle,
  getSuiClientForReads,
  type PredictionView,
} from '../../lib/registry';
import { PredictionCard } from '../../components/PredictionCard';
import {
  PageEyebrow,
  PixelMark,
  BIG_SEAL,
  shortHash,
} from '../../components/design';
import { ProfileFilters } from './filters';

// Anything that isn't a plausible X handle = 404.
// X handles: alphanumeric + underscore, 1-15 chars.
function isPlausibleHandle(s: string): boolean {
  if (s.startsWith('0x')) return false;
  return /^[A-Za-z0-9_]{1,15}$/.test(s);
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle: raw } = await params;
  const handle = raw.toLowerCase().replace(/^@/, '');
  if (!isPlausibleHandle(handle)) notFound();

  const client = getSuiClientForReads();
  const predictions: PredictionView[] = await getPredictionsForHandle(client, handle);

  const now = Date.now();
  const revealed = predictions.filter((p) => p.revealed);
  const sealed = predictions.filter((p) => !p.revealed && now < p.unlockAtMs);
  const awaiting = predictions.filter((p) => !p.revealed && now >= p.unlockAtMs);

  // "Hit rate" placeholder — until manual resolution exists, hits = revealed.
  // Will become hits/revealed once the manual-resolution flow ships.
  const totalResolved = revealed.length + awaiting.length;
  const hitRate = totalResolved > 0 ? Math.round((revealed.length / totalResolved) * 100) : null;

  // Pick the publisher address of the most recent prediction (if any) for the header.
  const publisher = predictions[0]?.publisher;

  return (
    <div className="page">
      <div className="container">
        <PageEyebrow>Public profile · toldproof.xyz/{handle}</PageEyebrow>

        <div className="mt-12 profile-header">
          <div className="col" style={{ gap: 14 }}>
            <div className="row" style={{ gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div
                style={{
                  width: 78,
                  height: 78,
                  background: 'var(--ink)',
                  color: 'var(--paper)',
                  fontFamily: 'var(--font-mono), monospace',
                  fontSize: 36,
                  fontWeight: 600,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 4,
                  flexShrink: 0,
                }}
              >
                {handle.slice(0, 1).toUpperCase()}
              </div>
              <div className="col" style={{ gap: 2 }}>
                <h1
                  className="display"
                  style={{ fontSize: 'clamp(34px, 5vw, 56px)', margin: 0 }}
                >
                  @{handle}
                </h1>
                {publisher && (
                  <span
                    className="mono"
                    style={{ fontSize: 12, color: 'var(--muted)' }}
                  >
                    Sui · {shortHash(publisher, 8, 4)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="row row-actions" style={{ gap: 10, flexWrap: 'wrap' }}>
            <Link href="/seal" className="btn">
              Seal a prediction →
            </Link>
          </div>
        </div>

        {predictions.length > 0 ? (
          <>
            {/* Stats strip */}
            <div
              className="mt-32 grid-4"
              style={{
                gap: 0,
                border: '1px solid var(--ink)',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <Stat label="Sealed total" value={predictions.length} />
              <Stat label="Revealed" value={revealed.length} hue="verified" border />
              <Stat label="Still sealed" value={sealed.length} hue="sealed" />
              <Stat
                label="Hit rate"
                value={hitRate != null ? `${hitRate}%` : '—'}
                sub={`${revealed.length}/${totalResolved} resolved`}
                border
              />
            </div>

            <ProfileFilters
              counts={{
                all: predictions.length,
                sealed: sealed.length,
                awaiting: awaiting.length,
                revealed: revealed.length,
              }}
              predictions={predictions}
            />
          </>
        ) : (
          <EmptyProfileState handle={handle} />
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  hue,
  border,
}: {
  label: string;
  value: string | number;
  sub?: string;
  hue?: 'verified' | 'sealed';
  border?: boolean;
}) {
  const color =
    hue === 'verified'
      ? 'var(--verified)'
      : hue === 'sealed'
        ? 'var(--sealed)'
        : 'var(--ink)';
  return (
    <div
      style={{
        padding: '20px 22px',
        background: 'var(--paper)',
        borderLeft: border ? '1px solid var(--ink)' : 'none',
        borderRight: border ? '1px solid var(--ink)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <span className="eyebrow">{label}</span>
      <span
        style={{
          fontFamily: 'var(--font-mono), monospace',
          fontSize: 34,
          fontWeight: 500,
          letterSpacing: '-0.02em',
          color,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      {sub && (
        <span
          className="mono"
          style={{ fontSize: 10.5, color: 'var(--muted)' }}
        >
          {sub}
        </span>
      )}
    </div>
  );
}

function EmptyProfileState({ handle }: { handle: string }) {
  return (
    <div
      className="mt-32"
      style={{
        border: '1px dashed var(--ink)',
        borderRadius: 4,
        padding: '40px 32px',
        background: 'var(--paper-2)',
        display: 'grid',
        gap: 20,
        placeItems: 'center',
        textAlign: 'center',
      }}
    >
      <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
        <PixelMark bitmap={BIG_SEAL} size={96} color="var(--ink-3)" />
        <div
          style={{
            position: 'absolute',
            top: -8,
            right: -16,
            transform: 'rotate(8deg)',
            padding: '3px 8px',
            background: 'var(--warn-soft)',
            border: '1px solid var(--warn)',
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 9,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'oklch(0.4 0.14 30)',
            borderRadius: 2,
          }}
        >
          Unsealed
        </div>
      </div>

      <div className="col" style={{ gap: 8, maxWidth: 460 }}>
        <h2 className="section" style={{ fontSize: 26 }}>
          @{handle} has not sealed anything.
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 14.5,
            color: 'var(--ink-3)',
            lineHeight: 1.55,
            textWrap: 'pretty',
          }}
        >
          Anyone can claim this handle by sealing a prediction first. Until someone does, every
          &quot;I called it&quot; tweet under @{handle} has zero on-chain backing — and the bot
          will say so.
        </p>
      </div>

      <div className="row" style={{ gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/seal" className="btn">
          ▮ Be the first @{handle} →
        </Link>
        <Link href="/bot" className="btn ghost">
          See what the bot says
        </Link>
      </div>

      <div
        className="row"
        style={{
          gap: 14,
          fontFamily: 'var(--font-mono), monospace',
          fontSize: 10.5,
          color: 'var(--muted)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <span>0 sealed</span>
        <span>·</span>
        <span>0 revealed</span>
        <span>·</span>
        <span>no on-chain history</span>
      </div>
    </div>
  );
}
