// InlineBotPreview — replaces the one-line bot tease with a worked thread:
// a claim, a skeptic asking the bot to verify, and the bot's verdict.
// Static (server component). Bot avatar is the pixel BRAND_MARK.

import Link from 'next/link';
import { PageEyebrow } from './Receipt';
import { PixelMark } from './PixelMark';
import { BRAND_MARK } from './bitmaps';

interface TweetData {
  name: string;
  handle: string;
  time: string;
  body: React.ReactNode;
  kind: 'claim' | 'verify' | 'verdict';
}

const THREAD: TweetData[] = [
  {
    name: 'dewaxindo',
    handle: 'dewaxindo',
    time: '2h',
    kind: 'claim',
    body: (
      <>
        Called the ETH/SOL flip back in February. Not after — before. Locked it
        on toldproof: <span style={{ color: 'var(--sealed-text)' }}>toldproof.xyz/verify/0x7f3a…8c2e</span>
      </>
    ),
  },
  {
    name: 'skeptic_sui',
    handle: 'skeptic_sui',
    time: '1h',
    kind: 'verify',
    body: (
      <>
        <span style={{ color: 'var(--sealed-text)' }}>@toldproof</span> verify —
        did they actually call this ahead of time?
      </>
    ),
  },
  {
    name: 'TOLDPROOF',
    handle: 'toldproof',
    time: '1h',
    kind: 'verdict',
    body: (
      <>
        <strong>Yes — locked 2026-02-09, 38 days before the flip.</strong> The
        text stayed hidden until it opened on 2026-05-20. Nobody could change it,
        not even @dewaxindo.
      </>
    ),
  },
];

export function InlineBotPreview() {
  return (
    <div className="mt-48">
      <PageEyebrow>The verify bot</PageEyebrow>
      <div className="bot-preview-grid mt-16">
        {/* Left — copy */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 className="section" style={{ maxWidth: 480 }}>
            Reply{' '}
            <span className="mono" style={{ fontWeight: 500, color: 'var(--sealed)' }}>
              @toldproof verify
            </span>{' '}
            under any &quot;I called it&quot; tweet.
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              color: 'var(--ink-3)',
              lineHeight: 1.55,
              maxWidth: 460,
            }}
          >
            The bot checks the chain and replies with a careful yes or no. It
            never accuses anyone of lying — it only says whether a locked
            prediction exists.
          </p>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <Link href="/bot" className="btn">
              See all scenarios →
            </Link>
          </div>
          <p
            className="mono"
            style={{
              margin: 0,
              fontSize: 11,
              color: 'var(--muted)',
              letterSpacing: '0.04em',
            }}
          >
            3 scenarios · verified · no-proof · defensive seal
          </p>
        </div>

        {/* Right — the thread */}
        <div style={{ display: 'grid', gap: 8 }}>
          {THREAD.map((t, i) => (
            <MiniTweet key={i} tweet={t} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniTweet({ tweet }: { tweet: TweetData }) {
  const isVerdict = tweet.kind === 'verdict';
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        padding: 12,
        border: `1px solid ${isVerdict ? 'var(--verified)' : 'var(--border)'}`,
        borderRadius: 4,
        background: isVerdict ? 'var(--verified-soft)' : 'var(--paper)',
        marginLeft: tweet.kind === 'claim' ? 0 : 20,
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          flexShrink: 0,
          borderRadius: 3,
          display: 'grid',
          placeItems: 'center',
          background: isVerdict ? 'var(--ink)' : 'var(--ink-3)',
          color: 'var(--paper)',
          fontFamily: 'var(--font-mono), monospace',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {isVerdict ? (
          <PixelMark bitmap={BRAND_MARK} size={18} color="var(--paper)" />
        ) : (
          tweet.name.charAt(0).toUpperCase()
        )}
      </div>
      <div style={{ minWidth: 0, display: 'grid', gap: 3 }}>
        <div
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'baseline',
            flexWrap: 'wrap',
            fontSize: 12,
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{tweet.name}</span>
          <span className="mono" style={{ color: 'var(--muted)' }}>
            @{tweet.handle}
          </span>
          <span className="mono" style={{ color: 'var(--muted)' }}>
            · {tweet.time}
          </span>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.5,
            color: isVerdict ? 'var(--verified-text)' : 'var(--ink-2)',
          }}
        >
          {tweet.body}
        </p>
      </div>
    </div>
  );
}
