// FinalCTA — receipt-styled closing card, last section before the footer
// stamp. Gives visitors who scrolled the whole page a reason to convert
// instead of bouncing.

import Link from 'next/link';
import { PageEyebrow } from './Receipt';
import { PixelMark } from './PixelMark';
import { BIG_SEAL } from './bitmaps';

// Receipt number derived from the build date — stable per deploy, looks
// like a sequence counter, and stays a pure module-level constant (no
// impure Date call during render).
const RECEIPT_NO = (() => {
  const src = process.env.NEXT_PUBLIC_BUILD_DATE ?? '2026-05-21';
  let sum = 0;
  for (const ch of src) sum = (sum * 31 + ch.charCodeAt(0)) % 10000;
  return String(sum).padStart(4, '0');
})();

export function FinalCTA() {
  return (
    <div className="mt-48">
      <div
        style={{
          border: '2px solid var(--ink)',
          borderRadius: 6,
          background: 'var(--paper)',
          boxShadow: '5px 5px 0 var(--ink)',
          overflow: 'hidden',
        }}
      >
        {/* perforation strip */}
        <div
          className="mono final-cta-perf"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 14px',
            height: 16,
            background: 'var(--ink)',
            color: 'var(--paper)',
            fontSize: 9,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          <span>· toldproof · v0.1 testnet</span>
          <span>#{RECEIPT_NO}</span>
        </div>

        <div className="final-cta-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <PageEyebrow>Your turn</PageEyebrow>
            <h2
              className="display"
              style={{ fontSize: 'clamp(26px, 3.4vw, 38px)', maxWidth: 560 }}
            >
              Lock a prediction in the next 60 seconds, or call out someone who
              didn&apos;t.
            </h2>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <Link href="/lock" className="btn lg">
                Lock a prediction →
              </Link>
              <Link href="/bot" className="btn ghost">
                See the bot in action
              </Link>
            </div>
            <p
              className="mono"
              style={{
                margin: 0,
                fontSize: 11,
                color: 'var(--muted)',
                letterSpacing: '0.04em',
                lineHeight: 1.7,
              }}
            >
              ▮ testnet · no fees &nbsp;|&nbsp; · wallet connects in one click
              &nbsp;|&nbsp; · no edits, no take-backs
            </p>
          </div>

          {/* seal mark — collapses on mobile */}
          <div className="final-cta-seal">
            <div
              style={{
                border: '1px dashed var(--ink-3)',
                borderRadius: 4,
                background: 'var(--paper-2)',
                padding: 24,
                display: 'grid',
                placeItems: 'center',
                gap: 10,
              }}
            >
              <PixelMark bitmap={BIG_SEAL} size={72} color="var(--ink)" />
              <span
                className="mono"
                style={{
                  fontSize: 9,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                }}
              >
                Ready to seal
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
